package expo.modules.olyposecamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraInfo
import androidx.camera.core.CameraState
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.Observer
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.io.FileInputStream
import java.nio.channels.FileChannel
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

data class CameraOptions(
  val facing: String = "front",
  val lens: String = "auto",
  val zoom: Double = 1.0,
  val frameLimit: Int = 30,
  val modelVariant: String = "full",
  val modelPath: String? = null,
  val rotation: Int = 0,
)

class OlyPoseCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext), LifecycleEventObserver {
  var options = CameraOptions()
  private val onCameraConfigured by EventDispatcher()
  private val onLandmark by EventDispatcher()
  private val onInferenceError by EventDispatcher()
  private val previewView = PreviewView(context).apply {
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }
  private val worker = Executors.newSingleThreadExecutor()
  private val mainExecutor = ContextCompat.getMainExecutor(context)
  private val generation = AtomicInteger()
  private var lifecycleOwner: LifecycleOwner? = null
  private var requestedOptions: CameraOptions? = null
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
    options = options.copy(rotation = display?.rotation ?: 0)
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
    val owner = lifecycleOwner ?: return
    if (destroyed || !isAttachedToWindow || width == 0 || !owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) return
    if (requestedOptions == options) return
    stopCapture()
    val requested = options
    val token = generation.get()
    requestedOptions = requested
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      emitFailure("cameraPermission", token)
      return
    }
    if (requested.facing !in listOf("front", "back") || requested.lens !in listOf("auto", "wide", "ultraWide") ||
      requested.modelVariant !in listOf("lite", "full", "heavy") || !requested.zoom.isFinite() || requested.zoom < 1 || requested.frameLimit !in 1..60) {
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
    if (!destroyed) worker.execute {
      detector?.close()
      detector = null
    }
  }

  private fun openDetector(requested: CameraOptions): PoseLandmarker {
    val base = BaseOptions.builder().setDelegate(Delegate.CPU)
    val customPath = requested.modelPath
    if (customPath == null) {
      require(requested.modelVariant == "full")
      base.setModelAssetPath("pose_landmarker_full.task")
    } else {
      val modelUri = Uri.parse(customPath)
      require(modelUri.scheme == null || modelUri.scheme == "file")
      val modelFile = File(requireNotNull(modelUri.path))
      require(modelFile.isAbsolute && modelFile.isFile && modelFile.canRead())
      FileInputStream(modelFile).use { stream ->
        base.setModelAssetBuffer(stream.channel.map(FileChannel.MapMode.READ_ONLY, 0, stream.channel.size()))
      }
    }
    return PoseLandmarker.createFromOptions(context, PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(base.build())
      .setRunningMode(RunningMode.VIDEO)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.35f)
      .setMinPosePresenceConfidence(0.35f)
      .setMinTrackingConfidence(0.35f)
      .build())
  }

  private fun bindCamera(owner: LifecycleOwner, requested: CameraOptions, token: Int) {
    if (generation.get() != token) return
    val cameraProvider = ProcessCameraProvider.getInstance(context)
    cameraProvider.addListener(providerReady@{
      if (generation.get() != token) return@providerReady
      try {
        val activeProvider = cameraProvider.get()
        provider = activeProvider
        val cameraPreview = Preview.Builder().setTargetResolution(Size(1280, 720)).setTargetRotation(requested.rotation).build()
        val cameraAnalysis = ImageAnalysis.Builder()
          .setTargetResolution(Size(1280, 720))
          .setTargetRotation(requested.rotation)
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
          .build()
        preview = cameraPreview
        analysis = cameraAnalysis
        cameraPreview.setSurfaceProvider(previewView.surfaceProvider)
        // CameraX's default physical wide camera is the explicit Android fallback for ultraWide.
        val selector = if (requested.facing == "front") CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
        val camera = activeProvider.bindToLifecycle(owner, selector, cameraPreview, cameraAnalysis)
        val zoomState = camera.cameraInfo.zoomState.value
        val appliedZoom = requested.zoom.toFloat().coerceIn(maxOf(1f, zoomState?.minZoomRatio ?: 1f), minOf(100f, zoomState?.maxZoomRatio ?: 1f))
        val zoomChange = camera.cameraControl.setZoomRatio(appliedZoom)
        zoomChange.addListener(zoomReady@{
          if (generation.get() != token) return@zoomReady
          try {
            zoomChange.get()
            attachAnalyzer(cameraAnalysis, requested, token, appliedZoom)
          } catch (_: Exception) { emitFailure("cameraConfiguration", token) }
        }, mainExecutor)
        val observer = Observer<CameraState> { state ->
          if (state.error != null) emitFailure("cameraRuntime", token)
        }
        observedCamera = camera.cameraInfo
        cameraObserver = observer
        camera.cameraInfo.cameraState.observe(owner, observer)
      } catch (_: Exception) { emitFailure("cameraConfiguration", token) }
    }, mainExecutor)
  }

  private fun attachAnalyzer(cameraAnalysis: ImageAnalysis, requested: CameraOptions, token: Int, appliedZoom: Float) {
    var acknowledged = false
    var frameNumber = 0
    var lastTimestamp = -1L
    var failed = false
    cameraAnalysis.setAnalyzer(worker) { cameraImage ->
      var rotatedPixels: Bitmap? = null
      try {
        val timestamp = SystemClock.uptimeMillis()
        if (generation.get() != token || failed || timestamp <= lastTimestamp ||
          (lastTimestamp >= 0 && timestamp - lastTimestamp < 1000 / requested.frameLimit)) return@setAnalyzer
        lastTimestamp = timestamp
        val activeDetector = detector ?: return@setAnalyzer
        val capturedAt = System.currentTimeMillis()
        val pixels = uprightPixels(cameraImage, requested.facing == "front")
        rotatedPixels = pixels
        if (!acknowledged) {
          acknowledged = true
          val configuration = mapOf("effectiveFacing" to requested.facing, "effectiveLens" to "wide", "appliedZoomFactor" to appliedZoom,
            "mirrored" to (requested.facing == "front"), "captureWidth" to pixels.width, "captureHeight" to pixels.height)
          emit(token) { onCameraConfigured(configuration) }
        }
        frameNumber += 1
        val image = BitmapImageBuilder(pixels).build()
        val inference = try { activeDetector.detectForVideo(image, timestamp) } finally { image.close() }
        val landmarks = inference.landmarks().firstOrNull().orEmpty().map { joint ->
          mutableMapOf<String, Any>("x" to joint.x(), "y" to joint.y(), "z" to joint.z()).apply {
            joint.visibility().ifPresent { confidence -> put("visibility", confidence) }
            joint.presence().ifPresent { confidence -> put("presence", confidence) }
          }
        }
        val worldLandmarks = inference.worldLandmarks().firstOrNull().orEmpty().map { joint ->
          mutableMapOf<String, Any>("x" to joint.x(), "y" to joint.y(), "z" to joint.z()).apply {
            joint.visibility().ifPresent { confidence -> put("visibility", confidence) }
            joint.presence().ifPresent { confidence -> put("presence", confidence) }
          }
        }
        val metadata = mapOf("width" to pixels.width, "height" to pixels.height, "cameraFacing" to requested.facing,
          "cameraLens" to "wide", "cameraMirrored" to (requested.facing == "front"), "cameraZoomFactor" to appliedZoom,
          "capturedAtMs" to capturedAt, "frameNumber" to frameNumber, "inferenceDurationMs" to (SystemClock.uptimeMillis() - timestamp),
          "poseCount" to inference.landmarks().size, "luminance" to luminance(pixels), "thermalState" to thermalState(),
          "poseModelDelegate" to "CPU", "poseModelVariant" to requested.modelVariant,
          "poseModelSource" to if (requested.modelPath == null) "bundled" else "downloaded")
        val frame = mapOf("landmarks" to landmarks, "worldLandmarks" to worldLandmarks, "additionalData" to metadata)
        emit(token) { onLandmark(frame) }
      } catch (_: Exception) {
        failed = true
        emitFailure("inferenceRuntime", token)
      } finally {
        rotatedPixels?.recycle()
        cameraImage.close()
      }
    }
  }

  private fun uprightPixels(cameraImage: ImageProxy, mirrored: Boolean): Bitmap {
    val pixels = cameraImage.toBitmap()
    val transform = Matrix().apply {
      postRotate(cameraImage.imageInfo.rotationDegrees.toFloat())
      if (mirrored) postScale(-1f, 1f)
    }
    val upright = Bitmap.createBitmap(pixels, 0, 0, pixels.width, pixels.height, transform, true)
    if (upright !== pixels) pixels.recycle()
    return upright
  }

  private fun luminance(pixels: Bitmap): Double {
    var total = 0.0
    var count = 0
    for (row in 0 until pixels.height step maxOf(1, pixels.height / 16)) {
      for (column in 0 until pixels.width step maxOf(1, pixels.width / 16)) {
        val color = pixels.getPixel(column, row)
        total += 0.2126 * ((color shr 16) and 255) + 0.7152 * ((color shr 8) and 255) + 0.0722 * (color and 255)
        count += 1
      }
    }
    return total / maxOf(1, count) / 255
  }

  private fun thermalState(): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "nominal"
    val power = context.getSystemService(PowerManager::class.java)
    return when (power?.currentThermalStatus) {
      PowerManager.THERMAL_STATUS_MODERATE -> "fair"
      PowerManager.THERMAL_STATUS_SEVERE -> "serious"
      PowerManager.THERMAL_STATUS_CRITICAL, PowerManager.THERMAL_STATUS_EMERGENCY, PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
      else -> "nominal"
    }
  }

  private fun emitFailure(code: String, token: Int) { emit(token) { onInferenceError(mapOf("code" to code)) } }

  private fun emit(token: Int, callback: () -> Unit) {
    mainExecutor.execute { if (!destroyed && generation.get() == token && requestedOptions != null) callback() }
  }
}
