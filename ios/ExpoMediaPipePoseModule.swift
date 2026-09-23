import ExpoModulesCore

public class ExpoMediaPipePoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoMediaPipePose")
    View(ExpoMediaPipePoseView.self) {
      Events("onCameraConfigured", "onLandmark", "onInferenceError")
      Prop("isActive") { (view: ExpoMediaPipePoseView, active: Bool) in view.isActive = active }
      Prop("cameraFacing") { (view: ExpoMediaPipePoseView, facing: String) in
        view.options.facing = facing
      }
      Prop("cameraLens") { (view: ExpoMediaPipePoseView, lens: String) in view.options.lens = lens }
      Prop("cameraZoomFactor") { (view: ExpoMediaPipePoseView, zoom: Double) in
        view.options.zoom = zoom
      }
      Prop("frameLimit") { (view: ExpoMediaPipePoseView, limit: Int) in
        view.options.frameLimit = limit
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
