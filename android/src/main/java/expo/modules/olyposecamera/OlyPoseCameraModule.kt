package expo.modules.olyposecamera

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OlyPoseCameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OlyPoseCamera")
    View(OlyPoseCameraView::class) {
      Events("onCameraConfigured", "onLandmark", "onInferenceError")
      Prop("cameraFacing") { view: OlyPoseCameraView, facing: String -> view.options = view.options.copy(facing = facing) }
      Prop("cameraLens") { view: OlyPoseCameraView, lens: String -> view.options = view.options.copy(lens = lens) }
      Prop("cameraZoomFactor") { view: OlyPoseCameraView, zoom: Double -> view.options = view.options.copy(zoom = zoom) }
      Prop("frameLimit") { view: OlyPoseCameraView, limit: Int -> view.options = view.options.copy(frameLimit = limit) }
      Prop("poseModelVariant") { view: OlyPoseCameraView, variant: String -> view.options = view.options.copy(modelVariant = variant) }
      Prop("poseModelAssetPath") { view: OlyPoseCameraView, path: String? -> view.options = view.options.copy(modelPath = path) }
      OnViewDidUpdateProps { view: OlyPoseCameraView -> view.applyChanges() }
      OnViewDestroys { view: OlyPoseCameraView -> view.destroy() }
    }
  }
}
