package expo.modules.mediapipepose

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.util.Range
import android.util.Size
import androidx.camera.core.CameraInfo
import androidx.camera.core.CameraState
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.Observer
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

class ExpoMediaPipePoseView(context: Context, appContext: AppContext) :
    ExpoView(context, appContext), LifecycleEventObserver {
    override val shouldUseAndroidLayout = true
    var options = PoseCameraOptions()
    var processingOptions = PoseProcessingOptions()
    @Volatile private var appliedProcessingOptions = PoseProcessingOptions()
    var isActive = true
    private val onCameraConfigured by EventDispatcher()
    private val onLandmark by EventDispatcher()
    private val onPerformanceMetrics by EventDispatcher<Map<String, Any?>>()
    private val onInferenceError by EventDispatcher()
    private val previewView =
        PreviewView(context).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    internal var maskStore: PoseMaskStore? = null
    private val worker = Executors.newSingleThreadExecutor()
    private val mainExecutor = ContextCompat.getMainExecutor(context)
    private val generation = AtomicInteger()
    private var lifecycleOwner: LifecycleOwner? = null
    private var requestedOptions: PoseCameraOptions? = null
    private var provider: ProcessCameraProvider? = null
    private var preview: Preview? = null
    private var analysis: ImageAnalysis? = null
    private var observedCamera: CameraInfo? = null
    private var cameraObserver: Observer<CameraState>? = null
    private var destroyed = false
    // Only worker accesses the detector, including initialization and close.
    private var detector: PoseLandmarker? = null

    init {
        addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        val activity = appContext.currentActivity
        if (activity !is LifecycleOwner) {
            onInferenceError(mapOf("code" to "nativeViewInitialization"))
            return
        }
        lifecycleOwner = activity
        activity.lifecycle.addObserver(this)
        applyChanges()
    }

    override fun onDetachedFromWindow() {
        lifecycleOwner?.lifecycle?.removeObserver(this)
        lifecycleOwner = null
        stopCapture()
        super.onDetachedFromWindow()
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        previewView.layout(0, 0, right - left, bottom - top)
        val currentDisplay = display ?: return
        options =
            options.copy(rotation = currentDisplay.rotation, viewWidth = width, viewHeight = height)
        applyChanges()
    }

    override fun onStateChanged(owner: LifecycleOwner, event: Lifecycle.Event) {
        when (event) {
            Lifecycle.Event.ON_START -> applyChanges()
            Lifecycle.Event.ON_STOP -> stopCapture()
            else -> Unit
        }
    }

    fun destroy() {
        if (destroyed) return
        lifecycleOwner?.lifecycle?.removeObserver(this)
        lifecycleOwner = null
        stopCapture()
        destroyed = true
        worker.shutdown()
    }

    fun applyChanges() {
        val shouldStop = !isActive && requestedOptions != null
        if (shouldStop) stopCapture()
        if (!isActive) return
        val owner = lifecycleOwner ?: return
        val hasLayout = width > 0 && height > 0
        val viewIsVisible = isAttachedToWindow && hasLayout
        val lifecycleIsStarted = owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
        if (destroyed || !viewIsVisible) return
        if (!lifecycleIsStarted) return
        if (!processingOptions.isValid()) {
            // Terminal errors require an isActive toggle or remount, including invalid processing
            // props.
            requestedOptions = options
            emitFailure("cameraConfiguration", generation.get())
            return
        }
        appliedProcessingOptions = processingOptions
        if (requestedOptions == options) return
        stopCapture()
        val requested = options
        val token = generation.get()
        requestedOptions = requested
        if (
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            emitFailure("cameraPermission", token)
            return
        }
        if (!requested.isValid()) {
            emitFailure("cameraConfiguration", token)
            return
        }
        worker.execute {
            if (generation.get() != token) return@execute
            try {
                detector = openDetector(requested)
                mainExecutor.execute { bindCamera(owner, requested, token) }
            } catch (_: Exception) {
                emitFailure("modelInitialization", token)
            }
        }
    }

    private fun stopCapture() {
        generation.incrementAndGet()
        requestedOptions = null
        cameraObserver?.let { observedCamera?.cameraState?.removeObserver(it) }
        cameraObserver = null
        observedCamera = null
        analysis?.clearAnalyzer()
        preview?.let { provider?.unbind(it) }
        analysis?.let { provider?.unbind(it) }
        preview = null
        analysis = null
        if (!destroyed)
            worker.execute {
                detector?.close()
                detector = null
            }
    }

    private fun openDetector(requested: PoseCameraOptions): PoseLandmarker {
        return PoseLandmarker.createFromOptions(
            context,
            PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(PoseModel.options(requested.modelVariant, requested.modelPath))
                .setRunningMode(RunningMode.VIDEO)
                .setNumPoses(requested.maxPoses)
                .setOutputSegmentationMasks(requested.segmentationEnabled)
                .setMinPoseDetectionConfidence(requested.minPoseDetectionConfidence.toFloat())
                .setMinPosePresenceConfidence(requested.minPosePresenceConfidence.toFloat())
                .setMinTrackingConfidence(requested.minTrackingConfidence.toFloat())
                .build(),
        )
    }

    private fun bindCamera(owner: LifecycleOwner, requested: PoseCameraOptions, token: Int) {
        if (generation.get() != token) return
        val cameraProvider = ProcessCameraProvider.getInstance(context)
        cameraProvider.addListener(
            providerReady@{
                if (generation.get() != token) return@providerReady
                try {
                    val activeProvider = cameraProvider.get()
                    provider = activeProvider
                    val selector = PoseCameraCapabilities.selector(requested.facing)
                    val cameraInfo = activeProvider.getCameraInfo(selector)
                    val targetFrameRate = Range(requested.previewFps, requested.previewFps)
                    require(cameraInfo.supportedFrameRateRanges.contains(targetFrameRate))
                    val cameraPreview =
                        Preview.Builder()
                            .setTargetFrameRate(targetFrameRate)
                            .setTargetResolution(Size(1280, 720))
                            .setTargetRotation(requested.rotation)
                            .build()
                    val cameraAnalysis =
                        ImageAnalysis.Builder()
                            .setTargetResolution(Size(1280, 720))
                            .setTargetRotation(requested.rotation)
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                            .build()
                    preview = cameraPreview
                    analysis = cameraAnalysis
                    cameraPreview.setSurfaceProvider(previewView.surfaceProvider)
                    val viewport = requireNotNull(previewView.viewPort)
                    val useCases =
                        UseCaseGroup.Builder()
                            .setViewPort(viewport)
                            .addUseCase(cameraPreview)
                            .addUseCase(cameraAnalysis)
                            .build()
                    val camera = activeProvider.bindToLifecycle(owner, selector, useCases)
                    val zoomState = requireNotNull(camera.cameraInfo.zoomState.value)
                    val minimumZoom = maxOf(1f, zoomState.minZoomRatio)
                    val maximumZoom = minOf(100f, zoomState.maxZoomRatio)
                    val appliedZoom = requested.zoom.toFloat().coerceIn(minimumZoom, maximumZoom)
                    val zoomChange = camera.cameraControl.setZoomRatio(appliedZoom)
                    zoomChange.addListener(
                        zoomReady@{
                            if (generation.get() != token) return@zoomReady
                            try {
                                zoomChange.get()
                                attachAnalyzer(cameraAnalysis, requested, token, appliedZoom)
                            } catch (_: Exception) {
                                emitFailure("cameraConfiguration", token)
                            }
                        },
                        mainExecutor,
                    )
                    val observer =
                        Observer<CameraState> { state ->
                            if (state.error != null) emitFailure("cameraRuntime", token)
                        }
                    observedCamera = camera.cameraInfo
                    cameraObserver = observer
                    camera.cameraInfo.cameraState.observe(owner, observer)
                } catch (_: Exception) {
                    emitFailure("cameraConfiguration", token)
                }
            },
            mainExecutor,
        )
    }

    private fun attachAnalyzer(
        cameraAnalysis: ImageAnalysis,
        requested: PoseCameraOptions,
        token: Int,
        appliedZoom: Float,
    ) {
        var acknowledged = false
        var frameNumber = 0
        var lastTimestamp = -1L
        var failed = false
        val frameTiming = PoseFrameTiming()
        cameraAnalysis.setAnalyzer(worker) { cameraImage ->
            var rotatedPixels: Bitmap? = null
            var outputMasks = emptyList<MPImage>()
            var inputImage: MPImage? = null
            try {
                if (generation.get() != token) return@setAnalyzer
                if (failed) return@setAnalyzer
                val nowMs = SystemClock.elapsedRealtimeNanos() / 1_000_000.0
                val processing = appliedProcessingOptions
                val performance = frameTiming.observeFrame(nowMs)
                val metricsRequested = processing.metricsEnabled && performance != null
                if (metricsRequested) {
                    val event = requireNotNull(performance).event
                    emit(token) { onPerformanceMetrics(event) }
                }
                if (!frameTiming.shouldInfer(nowMs, processing.frameLimit)) return@setAnalyzer
                val timestamp = nowMs.toLong()
                if (timestamp <= lastTimestamp) return@setAnalyzer
                lastTimestamp = timestamp
                val activeDetector = detector ?: return@setAnalyzer
                val receivedAt = System.currentTimeMillis()
                val pixels = uprightPixels(cameraImage, requested.facing == "front")
                rotatedPixels = pixels
                if (!acknowledged) {
                    acknowledged = true
                    val configuration =
                        mapOf(
                            "effectiveFacing" to requested.facing,
                            "effectiveLens" to "wide",
                            "appliedZoomFactor" to appliedZoom,
                            "mirrored" to (requested.facing == "front"),
                            "captureWidth" to pixels.width,
                            "captureHeight" to pixels.height,
                        )
                    emit(token) { onCameraConfigured(configuration) }
                }
                frameNumber += 1
                val image = BitmapImageBuilder(pixels).build()
                inputImage = image
                val inferenceStartedAt = SystemClock.elapsedRealtimeNanos()
                val inference = activeDetector.detectForVideo(image, timestamp)
                outputMasks = inference.segmentationMasks().orElse(emptyList())
                val inferenceDurationMs =
                    (SystemClock.elapsedRealtimeNanos() - inferenceStartedAt) / 1_000_000.0
                frameTiming.recordInference(inferenceDurationMs)
                if (!frameTiming.shouldDeliver(nowMs, processing.callbackFps)) return@setAnalyzer
                val metadata =
                    mapOf(
                        "width" to pixels.width,
                        "height" to pixels.height,
                        "cameraFacing" to requested.facing,
                        "cameraLens" to "wide",
                        "cameraMirrored" to (requested.facing == "front"),
                        "cameraZoomFactor" to appliedZoom,
                        "receivedAtMs" to receivedAt,
                        "frameNumber" to frameNumber,
                        "inferenceDurationMs" to inferenceDurationMs,
                        "poseCount" to inference.landmarks().size,
                        "luminance" to luminance(pixels),
                        "thermalState" to thermalState(),
                        "poseModelDelegate" to "CPU",
                        "poseModelVariant" to requested.modelVariant,
                        "poseModelSource" to
                            if (requested.modelPath == null) "bundled" else "local",
                    )
                val landmarkPayload = PoseLandmarkPayload.make(inference)
                val segmentation =
                    if (requested.segmentationEnabled)
                        requireNotNull(maskStore)
                            .save(
                                context,
                                inference,
                                pixels.width,
                                pixels.height,
                                requested.maskMaxDimension,
                            )
                    else null
                val frame =
                    landmarkPayload +
                        mapOf("additionalData" to metadata) +
                        (if (segmentation == null) emptyMap()
                        else mapOf("segmentation" to segmentation))
                emit(token, segmentation) { onLandmark(frame) }
            } catch (_: Exception) {
                failed = true
                emitFailure("inferenceRuntime", token)
            } finally {
                // MPImage owns its Bitmap and recycles it on close, after telemetry has been
                // sampled.
                outputMasks.forEach { it.close() }
                inputImage?.close()
                recyclePixels(rotatedPixels)
                cameraImage.close()
            }
        }
    }

    private fun uprightPixels(cameraImage: ImageProxy, mirrored: Boolean): Bitmap {
        val pixels = cameraImage.toBitmap()
        try {
            val transform =
                Matrix().apply {
                    postRotate(cameraImage.imageInfo.rotationDegrees.toFloat())
                    if (mirrored) postScale(-1f, 1f)
                }
            val crop = cameraImage.cropRect
            val upright =
                Bitmap.createBitmap(
                    pixels,
                    crop.left,
                    crop.top,
                    crop.width(),
                    crop.height(),
                    transform,
                    true,
                )
            if (upright !== pixels) pixels.recycle()
            return upright
        } catch (error: Exception) {
            recyclePixels(pixels)
            throw error
        }
    }

    private fun recyclePixels(pixels: Bitmap?) {
        if (pixels == null) return
        if (pixels.isRecycled) return
        pixels.recycle()
    }

    private fun luminance(pixels: Bitmap): Double {
        var total = 0.0
        var count = 0
        for (row in 0 until pixels.height step maxOf(1, pixels.height / 16)) {
            for (column in 0 until pixels.width step maxOf(1, pixels.width / 16)) {
                val color = pixels.getPixel(column, row)
                total +=
                    0.2126 * ((color shr 16) and 255) +
                        0.7152 * ((color shr 8) and 255) +
                        0.0722 * (color and 255)
                count += 1
            }
        }
        return total / maxOf(1, count) / 255
    }

    private fun thermalState(): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "unknown"
        val power = context.getSystemService(PowerManager::class.java) ?: return "unknown"
        return when (power.currentThermalStatus) {
            PowerManager.THERMAL_STATUS_NONE -> "nominal"
            PowerManager.THERMAL_STATUS_LIGHT,
            PowerManager.THERMAL_STATUS_MODERATE -> "fair"
            PowerManager.THERMAL_STATUS_SEVERE -> "serious"
            PowerManager.THERMAL_STATUS_CRITICAL,
            PowerManager.THERMAL_STATUS_EMERGENCY,
            PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
            else -> "unknown"
        }
    }

    private fun emitFailure(code: String, token: Int) {
        emit(token) {
            val failedOptions = requestedOptions
            stopCapture()
            // Keep the failed request latched until configuration or active state changes.
            requestedOptions = failedOptions
            onInferenceError(mapOf("code" to code))
        }
    }

    private fun emit(token: Int, segmentation: Map<String, Any>? = null, callback: () -> Unit) {
        val store = maskStore
        mainExecutor.execute {
            val currentGeneration = generation.get() == token && requestedOptions != null
            if (destroyed || !currentGeneration) {
                store?.discard(segmentation)
                return@execute
            }
            callback()
        }
    }
}
