import AVFoundation
import ExpoModulesCore
import MediaPipeTasksVision

struct CameraOptions: Equatable {
  var facing = "front"
  var lens = "auto"
  var zoom = 1.0
  var frameLimit = 30
  var modelVariant = "full"
  var modelPath: String?
  var landscape = false
}

final class OlyPoseCameraView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  var options = CameraOptions()
  let onCameraConfigured = EventDispatcher()
  let onLandmark = EventDispatcher()
  let onInferenceError = EventDispatcher()

  private let session = AVCaptureSession()
  private let worker = DispatchQueue(label: "expo.modules.olyposecamera", qos: .userInitiated)
  private lazy var preview = AVCaptureVideoPreviewLayer(session: session)
  // Main-thread identity invalidates queued events as soon as props or lifecycle change.
  private var generation = 0
  private var requestedOptions: CameraOptions?
  // Capture, model creation, inference, and teardown all run on worker.
  private var detector: PoseLandmarker?
  private var videoOutput: AVCaptureVideoDataOutput?
  private var captureOptions: CameraOptions?
  private var captureGeneration = 0
  private var effectiveLens = "wide"
  private var appliedZoom = 1.0
  private var acknowledged = false
  private var frameNumber = 0
  private var lastTimestamp = -1

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    preview.videoGravity = .resizeAspectFill
    layer.addSublayer(preview)
    NotificationCenter.default.addObserver(self, selector: #selector(lifecycleChanged), name: UIApplication.didBecomeActiveNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(lifecycleChanged), name: UIApplication.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(cameraInterrupted), name: .AVCaptureSessionWasInterrupted, object: session)
    NotificationCenter.default.addObserver(self, selector: #selector(cameraFailed), name: .AVCaptureSessionRuntimeError, object: session)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    let ownedSession = session
    worker.async { ownedSession.stopRunning() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    preview.frame = bounds
    options.landscape = bounds.width > bounds.height
    applyChanges()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    applyChanges()
  }

  @objc private func lifecycleChanged() {
    DispatchQueue.main.async { [weak self] in self?.applyChanges() }
  }

  @objc private func cameraInterrupted() {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.requestedOptions != nil else { return }
      self.onInferenceError(["code": "cameraRuntime"])
    }
  }

  @objc private func cameraFailed() { cameraInterrupted() }

  func applyChanges() {
    let desired = window != nil && UIApplication.shared.applicationState == .active ? options : nil
    guard desired != requestedOptions else { return }
    requestedOptions = desired
    generation += 1
    let token = generation
    worker.async { [weak self] in
      guard let self else { return }
      self.stopCapture()
      guard let desired else { return }
      self.startCapture(desired, token: token)
    }
  }

  private func stopCapture() {
    videoOutput?.setSampleBufferDelegate(nil, queue: nil)
    videoOutput = nil
    session.stopRunning()
    session.beginConfiguration()
    session.inputs.forEach { session.removeInput($0) }
    session.outputs.forEach { session.removeOutput($0) }
    session.commitConfiguration()
    detector = nil
    captureOptions = nil
  }

  private func startCapture(_ requested: CameraOptions, token: Int) {
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      emitFailure("cameraPermission", token: token)
      return
    }
    guard ["front", "back"].contains(requested.facing),
          ["auto", "wide", "ultraWide"].contains(requested.lens),
          ["lite", "full", "heavy"].contains(requested.modelVariant),
          requested.zoom.isFinite, requested.zoom >= 1,
          (1...60).contains(requested.frameLimit) else {
      emitFailure("cameraConfiguration", token: token)
      return
    }
    do {
      detector = try openDetector(requested)
    } catch {
      emitFailure("modelInitialization", token: token)
      return
    }
    do {
      try configureCamera(requested)
      configureConnection(videoOutput?.connection(with: .video), requested: requested)
      DispatchQueue.main.sync { [weak self] in
        guard let self, self.generation == token else { return }
        self.configureConnection(self.preview.connection, requested: requested)
      }
      captureOptions = requested
      captureGeneration = token
      acknowledged = false
      frameNumber = 0
      lastTimestamp = -1
      session.startRunning()
    } catch {
      stopCapture()
      emitFailure("cameraConfiguration", token: token)
    }
  }

  private func openDetector(_ requested: CameraOptions) throws -> PoseLandmarker {
    let modelPath: String
    if let customPath = requested.modelPath {
      if customPath.hasPrefix("file://"), let fileURL = URL(string: customPath), fileURL.isFileURL {
        modelPath = fileURL.path
      } else {
        modelPath = customPath
      }
      guard modelPath.hasPrefix("/"), FileManager.default.isReadableFile(atPath: modelPath) else {
        throw CameraFailure.invalidModel
      }
    } else {
      guard requested.modelVariant == "full",
            let resourceURL = Bundle(for: OlyPoseCameraView.self).url(forResource: "OlyPoseCameraModels", withExtension: "bundle"),
            let resourceBundle = Bundle(url: resourceURL),
            let bundledPath = resourceBundle.path(forResource: "pose_landmarker_full", ofType: "task") else {
        throw CameraFailure.invalidModel
      }
      modelPath = bundledPath
    }
    let configuration = PoseLandmarkerOptions()
    configuration.baseOptions.modelAssetPath = modelPath
    configuration.baseOptions.delegate = .GPU
    // Sequential video inference on the capture worker keeps timestamps and metadata paired.
    // AVCaptureVideoDataOutput drops frames while this worker is busy.
    configuration.runningMode = .video
    configuration.numPoses = 1
    configuration.minPoseDetectionConfidence = 0.35
    configuration.minPosePresenceConfidence = 0.35
    configuration.minTrackingConfidence = 0.35
    return try PoseLandmarker(options: configuration)
  }

  private func configureCamera(_ requested: CameraOptions) throws {
    let position: AVCaptureDevice.Position = requested.facing == "front" ? .front : .back
    let cameras = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera], mediaType: .video, position: position).devices
    let ultraWide = position == .back && requested.lens != "wide" ? cameras.first { $0.deviceType == .builtInUltraWideCamera } : nil
    guard let camera = ultraWide ?? cameras.first(where: { $0.deviceType == .builtInWideAngleCamera }) else {
      throw CameraFailure.unavailableCamera
    }
    let input = try AVCaptureDeviceInput(device: camera)
    let output = AVCaptureVideoDataOutput()
    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    output.alwaysDiscardsLateVideoFrames = true
    output.setSampleBufferDelegate(self, queue: worker)
    session.beginConfiguration()
    defer { session.commitConfiguration() }
    session.sessionPreset = .hd1280x720
    guard session.canAddInput(input), session.canAddOutput(output) else { throw CameraFailure.unavailableCamera }
    session.addInput(input)
    session.addOutput(output)
    videoOutput = output
    try camera.lockForConfiguration()
    defer { camera.unlockForConfiguration() }
    let frameRate = Double(requested.frameLimit)
    let formats = camera.formats.filter { format in
      format.videoSupportedFrameRateRanges.contains { $0.minFrameRate <= frameRate && $0.maxFrameRate >= frameRate }
    }
    if let format = formats.min(by: { first, second in
      let firstSize = CMVideoFormatDescriptionGetDimensions(first.formatDescription)
      let secondSize = CMVideoFormatDescriptionGetDimensions(second.formatDescription)
      return abs(Int(firstSize.width) * Int(firstSize.height) - 1280 * 720) < abs(Int(secondSize.width) * Int(secondSize.height) - 1280 * 720)
    }) {
      camera.activeFormat = format
      let interval = CMTime(value: 1, timescale: Int32(requested.frameLimit))
      camera.activeVideoMinFrameDuration = interval
      camera.activeVideoMaxFrameDuration = interval
    }
    appliedZoom = min(max(requested.zoom, max(1, Double(camera.minAvailableVideoZoomFactor))), min(100, Double(camera.maxAvailableVideoZoomFactor)))
    camera.videoZoomFactor = CGFloat(appliedZoom)
    effectiveLens = camera.deviceType == .builtInUltraWideCamera ? "ultraWide" : "wide"
  }

  private func configureConnection(_ connection: AVCaptureConnection?, requested: CameraOptions) {
    guard let connection else { return }
    if connection.isVideoOrientationSupported {
      connection.videoOrientation = requested.landscape ? .landscapeRight : .portrait
    }
    if connection.isVideoMirroringSupported {
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = requested.facing == "front"
    }
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard output === videoOutput, let requested = captureOptions, let detector,
          let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let token = captureGeneration
    let timestamp = Int(CACurrentMediaTime() * 1000)
    guard timestamp > lastTimestamp, lastTimestamp < 0 || timestamp - lastTimestamp >= 1000 / requested.frameLimit else { return }
    lastTimestamp = timestamp
    let width = CVPixelBufferGetWidth(pixels)
    let height = CVPixelBufferGetHeight(pixels)
    if !acknowledged {
      acknowledged = true
      emit(onCameraConfigured, ["effectiveFacing": requested.facing, "effectiveLens": effectiveLens,
        "appliedZoomFactor": appliedZoom, "mirrored": requested.facing == "front",
        "captureWidth": width, "captureHeight": height], token: token)
    }
    let capturedAt = Date().timeIntervalSince1970 * 1000
    frameNumber += 1
    do {
      let frame = try MPImage(sampleBuffer: sampleBuffer, orientation: .up)
      let inference = try detector.detect(videoFrame: frame, timestampInMilliseconds: timestamp)
      let landmarks = (inference.landmarks.first ?? []).map { joint -> [String: Any] in
        var coordinates: [String: Any] = ["x": joint.x, "y": joint.y, "z": joint.z]
        if let visibility = joint.visibility { coordinates["visibility"] = visibility }
        if let presence = joint.presence { coordinates["presence"] = presence }
        return coordinates
      }
      let worldLandmarks = (inference.worldLandmarks.first ?? []).map { joint -> [String: Any] in
        var coordinates: [String: Any] = ["x": joint.x, "y": joint.y, "z": joint.z]
        if let visibility = joint.visibility { coordinates["visibility"] = visibility }
        if let presence = joint.presence { coordinates["presence"] = presence }
        return coordinates
      }
      let thermal: String
      switch ProcessInfo.processInfo.thermalState {
      case .nominal: thermal = "nominal"
      case .fair: thermal = "fair"
      case .serious: thermal = "serious"
      default: thermal = "critical"
      }
      let metadata: [String: Any] = ["width": width, "height": height, "cameraFacing": requested.facing,
        "cameraLens": effectiveLens, "cameraMirrored": requested.facing == "front", "cameraZoomFactor": appliedZoom,
        "capturedAtMs": capturedAt, "frameNumber": frameNumber, "inferenceDurationMs": max(0, CACurrentMediaTime() * 1000 - Double(timestamp)),
        "poseCount": inference.landmarks.count, "luminance": luminance(pixels), "thermalState": thermal,
        "poseModelDelegate": "GPU", "poseModelVariant": requested.modelVariant,
        "poseModelSource": requested.modelPath == nil ? "bundled" : "downloaded"]
      emit(onLandmark, ["landmarks": landmarks, "worldLandmarks": worldLandmarks, "additionalData": metadata], token: token)
    } catch {
      captureOptions = nil
      emitFailure("inferenceRuntime", token: token)
    }
  }

  private func luminance(_ pixels: CVPixelBuffer) -> Double {
    CVPixelBufferLockBaseAddress(pixels, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixels, .readOnly) }
    guard let bytes = CVPixelBufferGetBaseAddress(pixels)?.assumingMemoryBound(to: UInt8.self) else { return 0 }
    let width = CVPixelBufferGetWidth(pixels)
    let height = CVPixelBufferGetHeight(pixels)
    let strideBytes = CVPixelBufferGetBytesPerRow(pixels)
    var total = 0.0
    var count = 0
    for row in stride(from: 0, to: height, by: max(1, height / 16)) {
      for column in stride(from: 0, to: width, by: max(1, width / 16)) {
        let offset = row * strideBytes + column * 4
        total += 0.2126 * Double(bytes[offset + 2]) + 0.7152 * Double(bytes[offset + 1]) + 0.0722 * Double(bytes[offset])
        count += 1
      }
    }
    return total / Double(max(1, count)) / 255
  }

  private func emitFailure(_ code: String, token: Int) {
    emit(onInferenceError, ["code": code], token: token)
  }

  private func emit(_ dispatcher: EventDispatcher, _ event: [String: Any], token: Int) {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.generation == token, self.requestedOptions != nil else { return }
      dispatcher(event)
    }
  }
}

private enum CameraFailure: Error {
  case invalidModel
  case unavailableCamera
}
