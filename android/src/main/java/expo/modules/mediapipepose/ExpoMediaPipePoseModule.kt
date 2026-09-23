package expo.modules.mediapipepose

import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ExpoMediaPipePoseModule : Module() {
    private val photoDispatcher = Dispatchers.Default.limitedParallelism(1)
    private val masks = PoseMaskStore()
    private val videos = PoseVideoAnalysis(masks)

    override fun definition() = ModuleDefinition {
        Name("ExpoMediaPipePose")
        AsyncFunction("getCameraCapabilities") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("cameraCapabilities", "React context is unavailable", null)
                return@AsyncFunction
            }
            PoseCameraCapabilities.discover(context, promise)
        }
        AsyncFunction("analyzePoseImage") Coroutine
            { location: String, options: PoseImageOptions ->
                val context = requireNotNull(appContext.reactContext).applicationContext
                withContext(photoDispatcher) {
                    PoseImageAnalysis.analyze(context, location, options, masks)
                }
            }
        AsyncFunction("openPoseVideo") {
            location: String,
            options: PoseImageOptions,
            trackingConfidence: Double,
            promise: Promise ->
            videos.open(
                requireNotNull(appContext.reactContext),
                location,
                options,
                trackingConfidence,
                promise,
            )
        }
        AsyncFunction("readPoseVideoFrame") { id: String, timestampMs: Long, promise: Promise ->
            videos.read(id, timestampMs, promise)
        }
        AsyncFunction("closePoseVideo") { id: String, promise: Promise ->
            videos.close(id, promise)
        }
        AsyncFunction("releasePoseSegmentation") { id: String -> masks.release(id) }
        OnDestroy {
            videos.destroy()
            masks.destroy()
        }
        View(ExpoMediaPipePoseView::class) {
            Events("onCameraConfigured", "onLandmark", "onInferenceError", "onPerformanceMetrics")
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
                view.processingOptions = view.processingOptions.copy(frameLimit = limit)
            }
            Prop("previewFps") { view: ExpoMediaPipePoseView, fps: Int ->
                view.options = view.options.copy(previewFps = fps)
            }
            Prop("callbackFps") { view: ExpoMediaPipePoseView, fps: Int ->
                view.processingOptions = view.processingOptions.copy(callbackFps = fps)
            }
            Prop("performanceMetricsEnabled") { view: ExpoMediaPipePoseView, enabled: Boolean ->
                view.processingOptions = view.processingOptions.copy(metricsEnabled = enabled)
            }
            Prop("segmentationEnabled") { view: ExpoMediaPipePoseView, enabled: Boolean ->
                view.options = view.options.copy(segmentationEnabled = enabled)
            }
            Prop("maskMaxDimension") { view: ExpoMediaPipePoseView, dimension: Int ->
                view.options = view.options.copy(maskMaxDimension = dimension)
            }
            Prop("maxPoses") { view: ExpoMediaPipePoseView, count: Int ->
                view.options = view.options.copy(maxPoses = count)
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
            OnViewDidUpdateProps { view: ExpoMediaPipePoseView ->
                view.maskStore = masks
                view.applyChanges()
            }
            OnViewDestroys { view: ExpoMediaPipePoseView -> view.destroy() }
        }
    }
}
