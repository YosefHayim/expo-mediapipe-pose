import ExpoModulesCore

public class OlyPoseCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OlyPoseCamera")
    View(OlyPoseCameraView.self) {
      Events("onCameraConfigured", "onLandmark", "onInferenceError")
      Prop("cameraFacing") { (view: OlyPoseCameraView, facing: String) in view.options.facing = facing }
      Prop("cameraLens") { (view: OlyPoseCameraView, lens: String) in view.options.lens = lens }
      Prop("cameraZoomFactor") { (view: OlyPoseCameraView, zoom: Double) in view.options.zoom = zoom }
      Prop("frameLimit") { (view: OlyPoseCameraView, limit: Int) in view.options.frameLimit = limit }
      Prop("poseModelVariant") { (view: OlyPoseCameraView, variant: String) in view.options.modelVariant = variant }
      Prop("poseModelAssetPath") { (view: OlyPoseCameraView, path: String?) in view.options.modelPath = path }
      OnViewDidUpdateProps { (view: OlyPoseCameraView) in view.applyChanges() }
    }
  }
}
