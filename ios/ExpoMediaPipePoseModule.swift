import ExpoModulesCore

public class ExpoMediaPipePoseModule: Module {
  private let videos = PoseVideoAnalysis()
  private var mediaWorker: DispatchQueue { videos.worker }
  public func definition() -> ModuleDefinition {
    Name("ExpoMediaPipePose")
    AsyncFunction("getCameraCapabilities") { PoseCameraCapabilities.discover() }
    AsyncFunction("analyzePoseImage") { (location: String, options: PoseImageOptions) in
      try PoseImageAnalysis.analyze(location, options: options)
    }.runOnQueue(mediaWorker)
    AsyncFunction("openPoseVideo") {
      (location: String, options: PoseImageOptions, trackingConfidence: Double) async throws
        -> [String: Any] in
      try await self.videos.open(location, options: options, trackingConfidence: trackingConfidence)
    }
    AsyncFunction("readPoseVideoFrame") {
      (id: String, timestampMs: Int) async throws -> [String: Any] in
      try await self.videos.read(id, timestampMs: timestampMs)
    }
    AsyncFunction("closePoseVideo") { (id: String) in self.videos.close(id) }.runOnQueue(
      mediaWorker)
    OnDestroy { self.mediaWorker.async { self.videos.destroy() } }
    View(ExpoMediaPipePoseView.self) {
      Events("onCameraConfigured", "onLandmark", "onInferenceError", "onPerformanceMetrics")
      Prop("isActive") { (view: ExpoMediaPipePoseView, active: Bool) in view.isActive = active }
      Prop("cameraFacing") { (view: ExpoMediaPipePoseView, facing: String) in
        view.options.facing = facing
      }
      Prop("cameraLens") { (view: ExpoMediaPipePoseView, lens: String) in view.options.lens = lens }
      Prop("cameraZoomFactor") { (view: ExpoMediaPipePoseView, zoom: Double) in
        view.options.zoom = zoom
      }
      Prop("frameLimit") { (view: ExpoMediaPipePoseView, limit: Int) in
        view.processingOptions.frameLimit = limit
      }
      Prop("previewFps") { (view: ExpoMediaPipePoseView, fps: Int) in view.options.previewFps = fps
      }
      Prop("callbackFps") { (view: ExpoMediaPipePoseView, fps: Int) in
        view.processingOptions.callbackFps = fps
      }
      Prop("performanceMetricsEnabled") { (view: ExpoMediaPipePoseView, enabled: Bool) in
        view.processingOptions.metricsEnabled = enabled
      }
      Prop("poseModelVariant") { (view: ExpoMediaPipePoseView, variant: String) in
        view.options.modelVariant = variant
      }
      Prop("poseModelAssetPath") { (view: ExpoMediaPipePoseView, path: String?) in
        view.options.modelPath = path
      }
      Prop("minPoseDetectionConfidence") { (view: ExpoMediaPipePoseView, confidence: Double) in
        view.options.minPoseDetectionConfidence = confidence
      }
      Prop("minPosePresenceConfidence") { (view: ExpoMediaPipePoseView, confidence: Double) in
        view.options.minPosePresenceConfidence = confidence
      }
      Prop("minTrackingConfidence") { (view: ExpoMediaPipePoseView, confidence: Double) in
        view.options.minTrackingConfidence = confidence
      }
      OnViewDidUpdateProps { (view: ExpoMediaPipePoseView) in view.applyChanges() }
    }
  }
}
