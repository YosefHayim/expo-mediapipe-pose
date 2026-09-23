import AVFoundation
import ExpoModulesCore
import MediaPipeTasksVision

final class ExpoMediaPipePoseView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  var options = PoseCameraOptions()
  var processingOptions = PoseProcessingOptions()
  var isActive = true
  let onCameraConfigured = EventDispatcher()
  let onLandmark = EventDispatcher()
  let onPerformanceMetrics = EventDispatcher()
  let onInferenceError = EventDispatcher()

  private let session = AVCaptureSession()
  private let worker = DispatchQueue(label: "expo.modules.mediapipepose", qos: .userInitiated)
  private lazy var preview = AVCaptureVideoPreviewLayer(session: session)
  // Main-thread identity invalidates queued events as soon as props or lifecycle change.
  private var generation = 0
  private var requestedOptions: PoseCameraOptions?
  // Capture, model creation, inference, and teardown all run on worker.
  private var detector: PoseLandmarker?
  private var videoOutput: AVCaptureVideoDataOutput?
  private var captureOptions: PoseCameraOptions?
  private var captureGeneration = 0
  private var effectiveLens = "wide"
  private var appliedZoom = 1.0
  private var acknowledged = false
  private var frameNumber = 0
  private var lastTimestamp = -1
  private var appliedProcessingOptions = PoseProcessingOptions()
  private var frameTiming = PoseFrameTiming()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    preview.videoGravity = .resizeAspectFill
    layer.addSublayer(preview)
    NotificationCenter.default.addObserver(
      self, selector: #selector(lifecycleChanged), name: UIApplication.didBecomeActiveNotification,
      object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(lifecycleChanged),
      name: UIApplication.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(cameraInterrupted), name: .AVCaptureSessionWasInterrupted,
      object: session)
    NotificationCenter.default.addObserver(
      self, selector: #selector(cameraFailed), name: .AVCaptureSessionRuntimeError, object: session)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    let ownedSession = session
    let ownedDetector = detector
    worker.async {
      ownedSession.stopRunning()
      withExtendedLifetime(ownedDetector) {}
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    preview.frame = bounds
    switch window?.windowScene?.interfaceOrientation {
    case .landscapeLeft: options.orientation = .landscapeLeft
    case .landscapeRight: options.orientation = .landscapeRight
    case .portraitUpsideDown: options.orientation = .portraitUpsideDown
    case .portrait: options.orientation = .portrait
    default: break
    }
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
      self.emitFailure("cameraRuntime", token: self.generation)
    }
  }

  @objc private func cameraFailed() { cameraInterrupted() }

  func applyChanges() {
    let applicationIsActive = UIApplication.shared.applicationState == .active
    let viewIsVisible = window != nil && !bounds.isEmpty
    let shouldCapture = isActive && applicationIsActive && viewIsVisible
    let desired = shouldCapture ? options : nil
    if shouldCapture && !processingOptions.isValid {
      requestedOptions = desired
      emitFailure("cameraConfiguration", token: generation)
      return
    }
    let processing = processingOptions
    worker.async { [weak self] in self?.appliedProcessingOptions = processing }
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

  private func startCapture(_ requested: PoseCameraOptions, token: Int) {
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      emitFailure("cameraPermission", token: token)
      return
    }
    guard requested.isValid else {
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
      frameTiming = PoseFrameTiming()
      session.startRunning()
    } catch {
      stopCapture()
      emitFailure("cameraConfiguration", token: token)
    }
  }

  private func openDetector(_ requested: PoseCameraOptions) throws -> PoseLandmarker {
    let configuration = PoseLandmarkerOptions()
    configuration.baseOptions.modelAssetPath = try resolveModelPath(requested)
    configuration.baseOptions.delegate = .GPU
    // Sequential video inference on the capture worker keeps timestamps and metadata paired.
    // AVCaptureVideoDataOutput drops frames while this worker is busy.
    configuration.runningMode = .video
    configuration.numPoses = 1
    configuration.minPoseDetectionConfidence = Float(requested.minPoseDetectionConfidence)
    configuration.minPosePresenceConfidence = Float(requested.minPosePresenceConfidence)
    configuration.minTrackingConfidence = Float(requested.minTrackingConfidence)
    return try PoseLandmarker(options: configuration)
  }

  private func resolveModelPath(_ requested: PoseCameraOptions) throws -> String {
    guard let customPath = requested.modelPath else {
      guard requested.modelVariant == "full",
        let resourceURL = Bundle(for: ExpoMediaPipePoseView.self).url(
          forResource: "ExpoMediaPipePoseModels", withExtension: "bundle"),
        let resourceBundle = Bundle(url: resourceURL),
        let bundledPath = resourceBundle.path(forResource: "pose_landmarker_full", ofType: "task")
      else { throw CameraFailure.invalidModel }
      return bundledPath
    }
    let modelPath: String
    if customPath.hasPrefix("file://") {
      guard let fileURL = URL(string: customPath), fileURL.isFileURL else {
        throw CameraFailure.invalidModel
      }
      modelPath = fileURL.path
    } else {
      modelPath = customPath
    }
    guard modelPath.hasPrefix("/"), FileManager.default.isReadableFile(atPath: modelPath) else {
      throw CameraFailure.invalidModel
    }
    return modelPath
  }

  private func configureCamera(_ requested: PoseCameraOptions) throws {
    let position: AVCaptureDevice.Position = requested.facing == "front" ? .front : .back
    let cameras = AVCaptureDevice.DiscoverySession(
      deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera], mediaType: .video,
      position: position
    ).devices
    let requestedDeviceType: AVCaptureDevice.DeviceType =
      requested.lens == "ultraWide" ? .builtInUltraWideCamera : .builtInWideAngleCamera
    guard let camera = cameras.first(where: { $0.deviceType == requestedDeviceType }) else {
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
    guard session.canAddInput(input), session.canAddOutput(output) else {
      throw CameraFailure.unavailableCamera
    }
    session.addInput(input)
    session.addOutput(output)
    videoOutput = output
    try camera.lockForConfiguration()
    defer { camera.unlockForConfiguration() }
    let frameRate = Double(requested.previewFps)
    let formats = camera.formats.filter { format in
      format.videoSupportedFrameRateRanges.contains {
        $0.minFrameRate <= frameRate && $0.maxFrameRate >= frameRate
      }
    }
    guard
      let format = formats.min(by: { first, second in
        let firstSize = CMVideoFormatDescriptionGetDimensions(first.formatDescription)
        let secondSize = CMVideoFormatDescriptionGetDimensions(second.formatDescription)
        return abs(Int(firstSize.width) * Int(firstSize.height) - 1280 * 720)
          < abs(Int(secondSize.width) * Int(secondSize.height) - 1280 * 720)
      })
    else { throw CameraFailure.unavailableCamera }
    camera.activeFormat = format
    let interval = CMTime(value: 1, timescale: Int32(requested.previewFps))
    camera.activeVideoMinFrameDuration = interval
    camera.activeVideoMaxFrameDuration = interval
    appliedZoom = min(
      max(requested.zoom, max(1, Double(camera.minAvailableVideoZoomFactor))),
      min(100, Double(camera.maxAvailableVideoZoomFactor)))
    camera.videoZoomFactor = CGFloat(appliedZoom)
    effectiveLens = camera.deviceType == .builtInUltraWideCamera ? "ultraWide" : "wide"
  }

  private func configureConnection(_ connection: AVCaptureConnection?, requested: PoseCameraOptions)
  {
    guard let connection else { return }
    if connection.isVideoOrientationSupported {
      connection.videoOrientation = requested.orientation
    }
    if connection.isVideoMirroringSupported {
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = requested.facing == "front"
    }
  }

  func captureOutput(
    _ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    guard output === videoOutput, let requested = captureOptions, let detector,
      let pixels = CMSampleBufferGetImageBuffer(sampleBuffer)
    else { return }
    let token = captureGeneration
    let nowMs = CACurrentMediaTime() * 1000
    let processing = appliedProcessingOptions
    let performance = frameTiming.observeFrame(at: nowMs)
    if processing.metricsEnabled, let performance {
      emit(onPerformanceMetrics, performance.event, token: token)
    }
    guard frameTiming.shouldInfer(at: nowMs, fps: processing.frameLimit) else { return }
    let timestamp = Int(nowMs)
    guard timestamp > lastTimestamp else { return }
    lastTimestamp = timestamp
    let width = CVPixelBufferGetWidth(pixels)
    let height = CVPixelBufferGetHeight(pixels)
    if !acknowledged {
      acknowledged = true
      emit(
        onCameraConfigured,
        [
          "effectiveFacing": requested.facing, "effectiveLens": effectiveLens,
          "appliedZoomFactor": appliedZoom, "mirrored": requested.facing == "front",
          "captureWidth": width, "captureHeight": height,
        ], token: token)
    }
    let receivedAt = Date().timeIntervalSince1970 * 1000
    frameNumber += 1
    do {
      let frame = try MPImage(sampleBuffer: sampleBuffer, orientation: .up)
      let inferenceStartedAt = CACurrentMediaTime()
      let inference = try detector.detect(videoFrame: frame, timestampInMilliseconds: timestamp)
      let inferenceDurationMs = (CACurrentMediaTime() - inferenceStartedAt) * 1000
      frameTiming.recordInference(durationMs: inferenceDurationMs)
      guard frameTiming.shouldDeliver(at: nowMs, fps: processing.callbackFps) else { return }
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
      case .critical: thermal = "critical"
      @unknown default: thermal = "unknown"
      }
      let metadata: [String: Any] = [
        "width": width, "height": height, "cameraFacing": requested.facing,
        "cameraLens": effectiveLens, "cameraMirrored": requested.facing == "front",
        "cameraZoomFactor": appliedZoom,
        "receivedAtMs": receivedAt, "frameNumber": frameNumber,
        "inferenceDurationMs": inferenceDurationMs,
        "poseCount": inference.landmarks.count, "luminance": try luminance(pixels),
        "thermalState": thermal,
        "poseModelDelegate": "GPU", "poseModelVariant": requested.modelVariant,
        "poseModelSource": requested.modelPath == nil ? "bundled" : "local",
      ]
      emit(
        onLandmark,
        ["landmarks": landmarks, "worldLandmarks": worldLandmarks, "additionalData": metadata],
        token: token)
    } catch {
      captureOptions = nil
      emitFailure("inferenceRuntime", token: token)
    }
  }

  private func luminance(_ pixels: CVPixelBuffer) throws -> Double {
    CVPixelBufferLockBaseAddress(pixels, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixels, .readOnly) }
    guard let bytes = CVPixelBufferGetBaseAddress(pixels)?.assumingMemoryBound(to: UInt8.self)
    else { throw CameraFailure.unavailablePixels }
    let width = CVPixelBufferGetWidth(pixels)
    let height = CVPixelBufferGetHeight(pixels)
    let strideBytes = CVPixelBufferGetBytesPerRow(pixels)
    var total = 0.0
    var count = 0
    for row in stride(from: 0, to: height, by: max(1, height / 16)) {
      for column in stride(from: 0, to: width, by: max(1, width / 16)) {
        let offset = row * strideBytes + column * 4
        total +=
          0.2126 * Double(bytes[offset + 2]) + 0.7152 * Double(bytes[offset + 1]) + 0.0722
          * Double(bytes[offset])
        count += 1
      }
    }
    return total / Double(max(1, count)) / 255
  }

  private func emitFailure(_ code: String, token: Int) {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.generation == token, self.requestedOptions != nil else { return }
      self.generation += 1
      // Keep requestedOptions until props or lifecycle change, avoiding an automatic retry loop.
      self.worker.async { self.stopCapture() }
      self.onInferenceError(["code": code])
    }
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
  case unavailablePixels
}
