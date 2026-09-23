package expo.modules.mediapipepose

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMediaPipePoseModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoMediaPipePose")
        View(ExpoMediaPipePoseView::class) {
            Events("onCameraConfigured", "onLandmark", "onInferenceError")
            Prop("isActive") { view: ExpoMediaPipePoseView, active: Boolean ->
                view.isActive = active
            }
            Prop("cameraFacing") { view: ExpoMediaPipePoseView, facing: String ->
                view.options = view.options.copy(facing = facing)
            }
            Prop("cameraLens") { view: ExpoMediaPipePoseView, lens: String ->
                view.options = view.options.copy(lens = lens)
            }
            Prop("cameraZoomFactor") { view: ExpoMediaPipePoseView, zoom: Double ->
                view.options = view.options.copy(zoom = zoom)
            }
            Prop("frameLimit") { view: ExpoMediaPipePoseView, limit: Int ->
                view.options = view.options.copy(frameLimit = limit)
            }
            Prop("poseModelVariant") { view: ExpoMediaPipePoseView, variant: String ->
                view.options = view.options.copy(modelVariant = variant)
            }
            Prop("poseModelAssetPath") { view: ExpoMediaPipePoseView, path: String? ->
                view.options = view.options.copy(modelPath = path)
            }
            Prop("minPoseDetectionConfidence") { view: ExpoMediaPipePoseView, confidence: Double ->
                view.options = view.options.copy(minPoseDetectionConfidence = confidence)
            }
            Prop("minPosePresenceConfidence") { view: ExpoMediaPipePoseView, confidence: Double ->
                view.options = view.options.copy(minPosePresenceConfidence = confidence)
            }
            Prop("minTrackingConfidence") { view: ExpoMediaPipePoseView, confidence: Double ->
                view.options = view.options.copy(minTrackingConfidence = confidence)
            }
            OnViewDidUpdateProps { view: ExpoMediaPipePoseView -> view.applyChanges() }
            OnViewDestroys { view: ExpoMediaPipePoseView -> view.destroy() }
        }
    }
}
