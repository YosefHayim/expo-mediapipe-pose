import AVFoundation
import MediaPipeTasksVision
import UIKit

class CameraView: UIView {
    private struct Constants {
        static let edgeOffset: CGFloat = 2.0
    }

    // Oly: start with all limb filters off so the first frames never draw the native white skeleton.
    var propDictionary: [String: Bool]? = [
        "face": false,
        "leftArm": false,
        "leftLeg": false,
        "rightArm": false,
        "leftWrist": false,
        "rightWrist": false,
        "torso": false,
        "rightLeg": false,
        "leftAnkle": false,
        "rightAnkle": false,
    ] {
        didSet {
        }
    }

    var previewView: UIView!
    var cameraUnavailableLabel: UILabel!
    var resumeButton: UIButton!
    var overlayView: OverlayView!

    var heightInfo: CGFloat = 0
    var widthInfo: CGFloat = 0
    var frameCount:Int = 0
    var landmarkData: LandmarkData!
    var isPortrait: Bool = true
    var poseStart: Bool = true
    // Oly: defensively select one primary result if the native task ever returns more than requested.
    private var lockedPrimaryHipX: Float? = nil
    private var lockedPrimaryHipY: Float? = nil
    private let primaryLockMaxDistance: Float = 0.28
    private var emittedLandmarkFrameNumber: Int = 0
    private var isTearingDown = false
    private var cameraConfigurationAcknowledged = false

    /// Privacy-safe platform thermal pressure for adaptive performance diagnostics.
    private var currentThermalState: String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal:
            return "nominal"
        case .fair:
            return "fair"
        case .serious:
            return "serious"
        case .critical:
            return "critical"
        @unknown default:
            return "critical"
        }
    }

    private var isSessionRunning = false
    private var isObserving = false
    private let backgroundQueue = DispatchQueue(label: "com.google.mediapipe.cameraController.backgroundQueue")

    // MARK: Controllers that manage functionality
    // Handles all the camera related functionality
    private var cameraFeedService: CameraFeedService?

    private let poseLandmarkerServiceQueue = DispatchQueue(
        label: "com.google.mediapipe.cameraController.poseLandmarkerServiceQueue",
        attributes: .concurrent)

    // Queuing reads and writes to poseLandmarkerService using the Apple recommended way
    // as they can be read and written from multiple threads and can result in race conditions.
    private var _poseLandmarkerService: PoseLandmarkerService?
    private var poseLandmarkerService: PoseLandmarkerService? {
        get {
            poseLandmarkerServiceQueue.sync {
                return self._poseLandmarkerService
            }
        }
        set {
            poseLandmarkerServiceQueue.async(flags: .barrier) {
                self._poseLandmarkerService = newValue
            }
        }
    }


    @objc var height: NSNumber = 0 {
        didSet {
            self.frame.size.height = CGFloat(truncating: height)
            self.heightInfo = CGFloat(truncating: height)
        }
    }


    // Property for width
    @objc var width: NSNumber = 0 {
        didSet {
            self.frame.size.width = CGFloat(truncating: width)
            self.widthInfo = CGFloat(truncating: width)
        }
    }

    @objc var face: Bool = false  {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var leftArm: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }

    @objc var rightArm: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var leftWrist: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var rightWrist: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var torso: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var leftLeg: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var rightLeg: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var leftAnkle: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }
    @objc var rightAnkle: Bool = false {
        didSet {
            updateBodyTrack()
        }
    }

    @objc var frameLimit: NSNumber = DefaultConstants.FRAME_LIMIT {
        didSet {
            cameraFeedService?.setFrameLimit(limit: frameLimit)
        }
    }
    @objc var poseModelAssetPath: String?
    @objc var poseModelVariant: String = "full"
    @objc var cameraFacing: String = "front"
    @objc var cameraLens: String = "auto"
    @objc var cameraZoomFactor: NSNumber = 1
    @objc var orientation: NSNumber = 0 {
        didSet {
//            let result =  CGFloat(truncating: orientation)
//            self.isPortrait = result == 1 ? true : false
        }
    }


    @objc var poseStarted: NSNumber = 0 {
        didSet {
            let result =  CGFloat(truncating: poseStarted)
            self.poseStart = result == 1 ? true : false
        }
    }

    @objc var onLandmark: RCTDirectEventBlock?
    @objc var onCameraConfigured: RCTDirectEventBlock?
    @objc var onInferenceError: RCTDirectEventBlock?
    @objc var onRecordingFinished: RCTDirectEventBlock?
    @objc var recordSession: Bool = false {
        didSet {
            if recordSession {
                cameraFeedService?.startRecording(startRecording: true)
            } else {
                stopDebugRecording()
            }
        }
    }

    // MARK: - Initializers

    override init(frame: CGRect) {
        super.init(frame: frame)
        //  setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        //  setupUI()
    }

    private func updateBodyTrack() {
        // Update propDictionary whenever any property changes
        propDictionary = [
            "face": face,
            "leftArm": leftArm,
            "leftLeg": leftLeg,
            "rightArm": rightArm,
            "leftWrist": leftWrist,
            "rightWrist": rightWrist,
            "torso": torso,
            "rightLeg": rightLeg,
            "leftAnkle": leftAnkle,
            "rightAnkle": rightAnkle,
        ]
    }

    // MARK: Constraints
    private func setupConstraints() {
        previewView.translatesAutoresizingMaskIntoConstraints = false
        cameraUnavailableLabel.translatesAutoresizingMaskIntoConstraints = false
        overlayView.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            previewView.widthAnchor.constraint(equalToConstant: CGFloat(truncating: self.width)),
            previewView.heightAnchor.constraint(equalToConstant: CGFloat(truncating: self.height)),
            previewView.centerXAnchor.constraint(equalTo: self.centerXAnchor),
            previewView.centerYAnchor.constraint(equalTo: self.centerYAnchor),

            cameraUnavailableLabel.centerXAnchor.constraint(equalTo: self.centerXAnchor),
            cameraUnavailableLabel.centerYAnchor.constraint(equalTo: self.centerYAnchor),

            overlayView.topAnchor.constraint(equalTo: previewView.topAnchor),
            overlayView.leadingAnchor.constraint(equalTo: previewView.leadingAnchor),
            overlayView.trailingAnchor.constraint(equalTo: previewView.trailingAnchor),
            overlayView.bottomAnchor.constraint(equalTo: previewView.bottomAnchor)
        ])
    }
    private func teardownUI() {
        isTearingDown = true
        stopDebugRecording()
        stopObserveConfigChanges()
        poseLandmarkerService?.liveStreamDelegate = nil
        poseLandmarkerService = nil
        cameraFeedService?.delegate = nil
        cameraFeedService?.stopSession()
        self.cameraFeedService = nil
        if previewView != nil {
            previewView.removeFromSuperview()
            previewView = nil
        }
        if overlayView != nil {
            overlayView.clear()
            overlayView.removeFromSuperview()
            overlayView = nil
        }
        if cameraUnavailableLabel != nil {
            cameraUnavailableLabel.removeFromSuperview()
            cameraUnavailableLabel = nil
        }
        if resumeButton != nil {
            resumeButton.removeFromSuperview()
            resumeButton = nil
        }
    }

    private func setupUI() {
        teardownUI()
        isTearingDown = false
        cameraConfigurationAcknowledged = false
        requestCameraPermission()
        // Instantiate and add subviews
        previewView = UIView()
        cameraUnavailableLabel = UILabel()
        resumeButton = UIButton()
        overlayView = OverlayView()
        let cameraFeedService = CameraFeedService(
            previewView: previewView,
            cameraFacing: cameraFacing,
            cameraLens: cameraLens,
            cameraZoomFactor: max(1, CGFloat(truncating: cameraZoomFactor)))
        self.cameraFeedService = cameraFeedService
        overlayView.backgroundColor = UIColor.white.withAlphaComponent(0.0)
        addSubview(previewView)
        addSubview(cameraUnavailableLabel)
        //    addSubview(resumeButton)
        addSubview(overlayView)

        previewView.frame =  CGRect(x:0, y: 0, width:widthInfo, height:heightInfo)
        //  cameraUnavailableLabel.frame =  CGRect(x:0, y: 0, width:375, height:812)
        //resumeButton.frame =  CGRect(x:0, y: 0, width:50, height:50)
        overlayView.frame = CGRect(x:0, y: 0, width:widthInfo, height:heightInfo)

        setupConstraints()

        initializePoseLandmarkerServiceOnSessionResumption()


        cameraFeedService.poseStarted(started: self.poseStart)

        cameraFeedService.setFrameLimit(limit: frameLimit)
        cameraFeedService.setOrientation(isPortrait: self.isPortrait)
        cameraFeedService.delegate = self
        cameraFeedService.startLiveCameraSession {[weak self] cameraConfiguration in
            DispatchQueue.main.async {
                switch cameraConfiguration {
                case .failed:
                    self?.emitInferenceError(code: "cameraConfiguration")
                    self?.presentVideoConfigurationErrorAlert()
                case .permissionDenied:
                    self?.emitInferenceError(code: "cameraPermission")
                    self?.presentCameraPermissionsDeniedAlert()
                default:
                    if self?.recordSession == true {
                        self?.cameraFeedService?.startRecording(startRecording: true)
                    }
                }
            }
        }
        cameraFeedService.updateVideoPreviewLayer(toFrame: previewView.bounds)
        UIApplication.shared.isIdleTimerDisabled = true
    }

    @objc
    override func didSetProps(_ changedProps: [String]!) {

        let sizeReady = changedProps.contains("height") && changedProps.contains("width")
        let cameraInputChanged = changedProps.contains("cameraFacing") ||
            changedProps.contains("cameraLens") || changedProps.contains("cameraZoomFactor")
        if sizeReady || (cameraInputChanged && widthInfo > 0 && heightInfo > 0) {
            setupUI()
        }
    }

    @objc func switchCamera() {
        cameraFeedService?.switchCamera()
    }

    private func stopDebugRecording() {
        cameraFeedService?.stopRecording { [weak self] outputURL in
            DispatchQueue.main.async {
                self?.onRecordingFinished?(["uri": outputURL.absoluteString])
            }
        }
    }

    override func willMove(toSuperview newSuperview: UIView?) {
        if newSuperview == nil {
            UIApplication.shared.isIdleTimerDisabled = false
            teardownUI()
        }
    }
    func requestCameraPermission() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            if granted {
                // User granted camera permission
                print("Camera permission granted.")
            } else {
                // User denied camera permission
                print("Camera permission denied.")
            }
        }
    }

    // MARK: - Private Methods

    private func presentCameraPermissionsDeniedAlert() {
        let alertController = UIAlertController(
            title: "Camera Permissions Denied",
            message: "Camera permissions have been denied for this app. You can change this by going to Settings",
            preferredStyle: .alert)

        let cancelAction = UIAlertAction(title: "Cancel", style: .cancel, handler: nil)
        let settingsAction = UIAlertAction(title: "Settings", style: .default) { (action) in
            UIApplication.shared.open(
                URL(string: UIApplication.openSettingsURLString)!, options: [:], completionHandler: nil)
        }
        alertController.addAction(cancelAction)
        alertController.addAction(settingsAction)

        UIApplication.shared.keyWindow?.rootViewController?.present(alertController, animated: true, completion: nil)
    }

    private func presentVideoConfigurationErrorAlert() {
        let alert = UIAlertController(
            title: "Camera Configuration Failed",
            message: "There was an error while configuring camera.",
            preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: nil))

        UIApplication.shared.keyWindow?.rootViewController?.present(alert, animated: true, completion: nil)
    }

    /// Emit one stable error code after teardown guards, without native details or user data.
    private func emitInferenceError(code: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.isTearingDown else { return }
            self.onInferenceError?(["code": code])
        }
    }

    private func initializePoseLandmarkerServiceOnSessionResumption() {
        clearAndInitializePoseLandmarkerService()
        startObserveConfigChanges()
    }

    @objc private func clearAndInitializePoseLandmarkerService() {
        poseLandmarkerService = nil
        let initializedService = PoseLandmarkerService
            .liveStreamPoseLandmarkerService(
                modelPath: selectedPoseModelPath,
                numPoses: InferenceConfigurationManager.sharedInstance.numPoses,
                minPoseDetectionConfidence: InferenceConfigurationManager.sharedInstance.minPoseDetectionConfidence,
                minPosePresenceConfidence: InferenceConfigurationManager.sharedInstance.minPosePresenceConfidence,
                minTrackingConfidence: InferenceConfigurationManager.sharedInstance.minTrackingConfidence,
                liveStreamDelegate: self,
                delegate: InferenceConfigurationManager.sharedInstance.delegate)
        poseLandmarkerService = initializedService
        if initializedService?.poseLandmarker == nil {
            emitInferenceError(code: "modelInitialization")
        }
    }

    private var selectedPoseModelPath: String? {
        guard let assetPath = poseModelAssetPath, !assetPath.isEmpty else {
            return InferenceConfigurationManager.sharedInstance.model.modelPath
        }
        guard assetPath.hasPrefix("file://"), let fileUrl = URL(string: assetPath) else {
            return assetPath
        }
        return fileUrl.path
    }

    private var activePoseModelVariant: String {
        guard poseModelAssetPath?.isEmpty == false else {
            return "full"
        }
        switch poseModelVariant {
        case "lite", "heavy":
            return poseModelVariant
        default:
            return "full"
        }
    }

    private var activePoseModelSource: String {
        return poseModelAssetPath?.isEmpty == false ? "downloaded" : "bundled"
    }

    private func clearPoseLandmarkerServiceOnSessionInterruption() {
        stopObserveConfigChanges()
        poseLandmarkerService = nil
    }

    private func startObserveConfigChanges() {
        NotificationCenter.default
            .addObserver(self,
                         selector: #selector(clearAndInitializePoseLandmarkerService),
                         name: InferenceConfigurationManager.notificationName

                         ,
                         object: nil)
        isObserving = true
    }

    private func stopObserveConfigChanges() {
        if isObserving {
            NotificationCenter.default
                .removeObserver(self,
                                name:InferenceConfigurationManager.notificationName,
                                object: nil)
        }
        isObserving = false
    }

    // MARK: - Oly multi-person primary lock

    /// Hip midpoint of a pose landmark list (indices 23 + 24), or nil when incomplete.
    private func hipCenter(of landmarks: [NormalizedLandmark]) -> (x: Float, y: Float)? {
        guard landmarks.count > 24 else { return nil }
        let left = landmarks[23]
        let right = landmarks[24]
        return (x: (left.x + right.x) / 2, y: (left.y + right.y) / 2)
    }

    /// Approximate torso size used as a "closest / largest person" score.
    private func torsoScale(of landmarks: [NormalizedLandmark]) -> Float {
        guard landmarks.count > 24 else { return 0 }
        let ls = landmarks[11]
        let rs = landmarks[12]
        let lh = landmarks[23]
        let rh = landmarks[24]
        let shoulderWidth = hypot(ls.x - rs.x, ls.y - rs.y)
        let hipWidth = hypot(lh.x - rh.x, lh.y - rh.y)
        let torsoHeight = hypot(((ls.x + rs.x) / 2) - ((lh.x + rh.x) / 2),
                                ((ls.y + rs.y) / 2) - ((lh.y + rh.y) / 2))
        return max(shoulderWidth, hipWidth) * max(torsoHeight, 0.01)
    }

    /// Pick the pose index to stream to JS: sticky hip lock, else largest torso.
    private func selectPrimaryPoseIndex(from poses: [[NormalizedLandmark]]) -> Int? {
        if poses.isEmpty {
            lockedPrimaryHipX = nil
            lockedPrimaryHipY = nil
            return nil
        }
        if poses.count == 1 {
            if let center = hipCenter(of: poses[0]) {
                lockedPrimaryHipX = center.x
                lockedPrimaryHipY = center.y
            }
            return 0
        }

        if let lockX = lockedPrimaryHipX, let lockY = lockedPrimaryHipY {
            var bestIndex: Int? = nil
            var bestDistance = Float.greatestFiniteMagnitude
            for (index, pose) in poses.enumerated() {
                guard let center = hipCenter(of: pose) else { continue }
                let distance = hypot(center.x - lockX, center.y - lockY)
                if distance < bestDistance {
                    bestDistance = distance
                    bestIndex = index
                }
            }
            if let bestIndex, bestDistance <= primaryLockMaxDistance {
                if let center = hipCenter(of: poses[bestIndex]) {
                    lockedPrimaryHipX = center.x
                    lockedPrimaryHipY = center.y
                }
                return bestIndex
            }
        }

        // No stable lock — prefer the largest torso (usually the nearer primary user).
        var bestIndex = 0
        var bestScale: Float = -1
        for (index, pose) in poses.enumerated() {
            let scale = torsoScale(of: pose)
            if scale > bestScale {
                bestScale = scale
                bestIndex = index
            }
        }
        if let center = hipCenter(of: poses[bestIndex]) {
            lockedPrimaryHipX = center.x
            lockedPrimaryHipY = center.y
        }
        return bestIndex
    }

}

extension CameraView: CameraFeedServiceDelegate {

    func didConfigureCamera(configuration: CameraConfiguration) {
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.isTearingDown else { return }
            self.cameraConfigurationAcknowledged = true
            self.onCameraConfigured?([
                "appliedZoomFactor": configuration.appliedZoomFactor,
                "captureHeight": configuration.captureHeight,
                "captureWidth": configuration.captureWidth,
                "effectiveFacing": configuration.effectiveFacing == .front ? "front" : "back",
                "effectiveLens": configuration.effectiveLens.rawValue,
                "mirrored": configuration.mirrored,
            ])
        }
    }

    func didOutput(sampleBuffer: CMSampleBuffer, orientation: UIImage.Orientation, landmarkData:LandmarkData) {
        guard cameraConfigurationAcknowledged else { return }
        let currentTimeMs = Date().timeIntervalSince1970 * 1000
        // Pass the pixel buffer to mediapipe
        backgroundQueue.async { [weak self] in
            self?.poseLandmarkerService?.detectAsync(
                sampleBuffer: sampleBuffer,
                orientation: orientation,
                timeStamps: Int(currentTimeMs))
        }
        self.landmarkData = landmarkData
        //   self.sampleBuffer = sampleBuffer
    }

    // MARK: Session Handling Alerts

    func sessionWasInterrupted(canResumeManually resumeManually: Bool) {
        // Updates the UI when session is interupted.
        if resumeManually {
            resumeButton.isHidden = false
        } else {
            cameraUnavailableLabel.isHidden = false
        }
        clearPoseLandmarkerServiceOnSessionInterruption()
    }

    func sessionInterruptionEnded() {
        // Updates UI once session interruption has ended.
        cameraUnavailableLabel.isHidden = true
        resumeButton.isHidden = true
        initializePoseLandmarkerServiceOnSessionResumption()
    }

    func didEncounterSessionRuntimeError() {
        // Handles session run time error by updating the UI and providing a button if session can be
        // manually resumed.
        resumeButton.isHidden = false
        clearPoseLandmarkerServiceOnSessionInterruption()
        emitInferenceError(code: "cameraRuntime")
    }
}

//func uiImageFromPixelBuffer(_ pixelBuffer: CVPixelBuffer) -> UIImage? {
//    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
//    let context = CIContext()
//    if let cgImage = context.createCGImage(ciImage, from: ciImage.extent) {
//        return UIImage(cgImage: cgImage)
//    }
//    return nil
//}


//func dataFromUIImage(_ image: UIImage) -> Data? {
//  return image.jpegData(compressionQuality: 0.5)
//}
//
//
//func base64StringFromData(_ data: Data) -> String {
//    return data.base64EncodedString()
//}



// MARK: PoseLandmarkerServiceLiveStreamDelegate

extension CameraView: PoseLandmarkerServiceLiveStreamDelegate {


    func poseLandmarkerService(
        _ poseLandmarkerService: PoseLandmarkerService,
        didFinishDetection result: ResultBundle?,
        error: Error?) {
        if error != nil {
            emitInferenceError(code: "inferenceRuntime")
            return
        }
        guard let poseLandmarkerResult = result?.poseLandmarkerResults.first as? PoseLandmarkerResult else { return }
        let inferenceDurationMs = result?.inferenceTime ?? 0
        let capturedAtMs = Date().timeIntervalSince1970 * 1000 - inferenceDurationMs
        emittedLandmarkFrameNumber += 1
        let emittedFrameNumber = emittedLandmarkFrameNumber
        let poseCount = poseLandmarkerResult.landmarks.count
        frameCount = 0
        let primaryIndex = selectPrimaryPoseIndex(from: poseLandmarkerResult.landmarks)
        let results = primaryIndex.flatMap { poseLandmarkerResult.landmarks[$0] }
        let worldLandmarks = primaryIndex.flatMap { index in
            poseLandmarkerResult.worldLandmarks.indices.contains(index)
                ? poseLandmarkerResult.worldLandmarks[index]
                : nil
        }
        let additionalData: [String: Any] = [
            "cameraFacing": landmarkData?.cameraFacing ?? cameraFacing,
            "cameraLens": landmarkData?.cameraLens ?? "wide",
            "cameraMirrored": landmarkData?.cameraMirrored ?? (cameraFacing == "front"),
            "cameraZoomFactor": landmarkData?.cameraZoomFactor ?? 1,
            "height": landmarkData?.height ?? CGFloat(isPortrait ? DefaultConstants.HEIGHT : DefaultConstants.WIDTH),
            "width": landmarkData?.width ?? CGFloat(isPortrait ? DefaultConstants.WIDTH : DefaultConstants.HEIGHT),
            "luminance": landmarkData?.luminance ?? 0,
            "capturedAtMs": capturedAtMs,
            "inferenceDurationMs": inferenceDurationMs,
            "poseCount": poseCount,
            "poseModelDelegate": InferenceConfigurationManager.sharedInstance.delegate.name,
            "poseModelSource": activePoseModelSource,
            "poseModelVariant": activePoseModelVariant,
            "thermalState": currentThermalState,
            "presentationTimeStamp": landmarkData?.presentationTimeStamp ?? 0,
            "frameNumber": emittedFrameNumber,
            "startTimestamp": landmarkData?.startTimestamp ?? 0,
        ]
        let landmarkPayload: [String: Any]

        if let landmarks = results {
            var landmarksArray: [Float] = []
            landmarksArray.reserveCapacity(landmarks.count * 5)
            // Pack one detected landmark as x, y, z, visibility, presence without per-field dictionaries.
            for landmark in landmarks {
                landmarksArray.append(contentsOf: [
                    landmark.x,
                    landmark.y,
                    landmark.z,
                    landmark.visibility?.floatValue ?? -1,
                    landmark.presence?.floatValue ?? -1,
                ])
            }

            var worldLandmarksArray: [Float] = []
            if let worldLandmarks {
                worldLandmarksArray.reserveCapacity(worldLandmarks.count * 5)
                // Pack one world landmark as x, y, z, visibility, presence for the JS scorer.
                for landmark in worldLandmarks {
                    worldLandmarksArray.append(contentsOf: [
                        landmark.x,
                        landmark.y,
                        landmark.z,
                        landmark.visibility?.floatValue ?? -1,
                        landmark.presence?.floatValue ?? -1,
                    ])
                }
            }
            landmarkPayload = [
                "additionalData": additionalData,
                "landmarks": landmarksArray,
                "worldLandmarks": worldLandmarksArray,
            ]
        } else {
            // Emit an explicit empty frame so React Native clears stale pose state.
            lockedPrimaryHipX = nil
            lockedPrimaryHipY = nil
            landmarkPayload = [
                "additionalData": additionalData,
                "landmarks": [],
                "worldLandmarks": [],
            ]
        }

        // React Native view events and UIKit drawing cross the main thread only after
        // selection and payload packing finish on MediaPipe's result callback queue.
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.isTearingDown else { return }
            self.onLandmark?(landmarkPayload)

            let nativeOverlayEnabled = self.propDictionary?.values.contains(true) == true
            if !nativeOverlayEnabled {
                if let overlayView = self.overlayView, !overlayView.poseOverlays.isEmpty {
                    overlayView.clear()
                }
                return
            }

            guard let previewView = self.previewView, let overlayView = self.overlayView,
                  let propDictionary = self.propDictionary,
                  let cameraFeedService = self.cameraFeedService else { return }
            guard previewView.superview != nil else { return }
            let imageSize = cameraFeedService.videoResolution
            let poseOverlays = OverlayView().poseOverlays(
                fromMultiplePoseLandmarks: poseLandmarkerResult.landmarks,
                inferredOnImageOfSize: imageSize,
                ovelayViewSize: overlayView.bounds.size,
                imageContentMode: overlayView.imageContentMode,
                andOrientation: UIImage.Orientation.from(
                    deviceOrientation: UIDevice.current.orientation),
                isPortrait: self.isPortrait,
                propDictionary: propDictionary)
            overlayView.clear()
            overlayView.draw(
                poseOverlays: poseOverlays,
                inBoundsOfContentImageOfSize: imageSize,
                imageContentMode: cameraFeedService.videoGravity.contentMode,
                isPortrait: self.isPortrait)
        }
    }
}

// MARK: - AVLayerVideoGravity Extension

extension AVLayerVideoGravity {
    var contentMode: UIView.ContentMode {
        switch self {
        case .resizeAspectFill:
            return .scaleAspectFill
        case .resizeAspect:
            return .scaleAspectFit
        case .resize:
            return .scaleToFill
        default:
            return .scaleAspectFill
        }
    }


}
