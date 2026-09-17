package com.tsmediapipe.fragment

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.AspectRatio
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.gson.Gson
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.tsmediapipe.CameraFragmentManager
import com.tsmediapipe.MainViewModel
import com.tsmediapipe.PoseLandmarkerHelper
import com.tsmediapipe.ReactContextProvider
import com.tsmediapipe.databinding.FragmentMyCameraBinding
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class CameraFragment : Fragment(), PoseLandmarkerHelper.LandmarkerListener {
  // Oly: stick to one person when MediaPipe returns multiple poses.
  private var lockedPrimaryHipX: Float? = null
  private var lockedPrimaryHipY: Float? = null
  private val primaryLockMaxDistance = 0.28f
  private var emittedLandmarkFrameNumber = 0L

  /** Privacy-safe platform thermal pressure for adaptive performance diagnostics. */
  private fun currentThermalState(): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
    val powerManager = context?.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return null
    return when (powerManager.currentThermalStatus) {
      PowerManager.THERMAL_STATUS_NONE,
      PowerManager.THERMAL_STATUS_LIGHT -> "nominal"
      PowerManager.THERMAL_STATUS_MODERATE -> "fair"
      PowerManager.THERMAL_STATUS_SEVERE -> "serious"
      PowerManager.THERMAL_STATUS_CRITICAL,
      PowerManager.THERMAL_STATUS_EMERGENCY,
      PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
      else -> "critical"
    }
  }

  /** Hip midpoint (landmarks 23 + 24) for multi-person stickiness. */
  private fun hipCenter(pose: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>): Pair<Float, Float>? {
    if (pose.size <= 24) return null
    val left = pose[23]
    val right = pose[24]
    return Pair((left.x() + right.x()) / 2f, (left.y() + right.y()) / 2f)
  }

  /** Approximate torso scale — larger usually means nearer primary user. */
  private fun torsoScale(pose: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>): Float {
    if (pose.size <= 24) return 0f
    val ls = pose[11]
    val rs = pose[12]
    val lh = pose[23]
    val rh = pose[24]
    val shoulderWidth = kotlin.math.hypot((ls.x() - rs.x()).toDouble(), (ls.y() - rs.y()).toDouble()).toFloat()
    val hipWidth = kotlin.math.hypot((lh.x() - rh.x()).toDouble(), (lh.y() - rh.y()).toDouble()).toFloat()
    val midShoulderX = (ls.x() + rs.x()) / 2f
    val midShoulderY = (ls.y() + rs.y()) / 2f
    val midHipX = (lh.x() + rh.x()) / 2f
    val midHipY = (lh.y() + rh.y()) / 2f
    val torsoHeight = kotlin.math.hypot((midShoulderX - midHipX).toDouble(), (midShoulderY - midHipY).toDouble()).toFloat()
    return maxOf(shoulderWidth, hipWidth) * maxOf(torsoHeight, 0.01f)
  }

  /**
   * Sticky primary-user index across frames: nearest locked hip, else largest torso.
   */
  private fun selectPrimaryPoseIndex(
    poses: List<List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>>
  ): Int? {
    if (poses.isEmpty()) {
      lockedPrimaryHipX = null
      lockedPrimaryHipY = null
      return null
    }
    if (poses.size == 1) {
      hipCenter(poses[0])?.let { (x, y) ->
        lockedPrimaryHipX = x
        lockedPrimaryHipY = y
      }
      return 0
    }

    val lockX = lockedPrimaryHipX
    val lockY = lockedPrimaryHipY
    if (lockX != null && lockY != null) {
      var bestIndex: Int? = null
      var bestDistance = Float.MAX_VALUE
      for ((index, pose) in poses.withIndex()) {
        val center = hipCenter(pose) ?: continue
        val distance = kotlin.math.hypot((center.first - lockX).toDouble(), (center.second - lockY).toDouble()).toFloat()
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      }
      if (bestIndex != null && bestDistance <= primaryLockMaxDistance) {
        hipCenter(poses[bestIndex])?.let { (x, y) ->
          lockedPrimaryHipX = x
          lockedPrimaryHipY = y
        }
        return bestIndex
      }
    }

    var bestIndex = 0
    var bestScale = -1f
    for ((index, pose) in poses.withIndex()) {
      val scale = torsoScale(pose)
      if (scale > bestScale) {
        bestScale = scale
        bestIndex = index
      }
    }
    hipCenter(poses[bestIndex])?.let { (x, y) ->
      lockedPrimaryHipX = x
      lockedPrimaryHipY = y
    }
    return bestIndex
  }

  companion object {
    private const val TAG = "Pose Landmarker"
    const val ARG_POSE_MODEL_ASSET_PATH = "poseModelAssetPath"
    const val ARG_POSE_MODEL_VARIANT = "poseModelVariant"
    const val ARG_CAMERA_FACING = "cameraFacing"
    const val ARG_REACT_NATIVE_VIEW_ID = "reactNativeViewId"
  }

  private var _fragmentCameraBinding: FragmentMyCameraBinding? = null
  private val PERMISSIONS_REQUIRED = arrayOf(Manifest.permission.CAMERA)

  private val fragmentCameraBinding
    get() = _fragmentCameraBinding!!

  private lateinit var poseLandmarkerHelper: PoseLandmarkerHelper
  private val viewModel: MainViewModel by activityViewModels()
  private var preview: Preview? = null
  private var imageAnalyzer: ImageAnalysis? = null
  private var camera: Camera? = null
  private var cameraProvider: ProcessCameraProvider? = null
  private var cameraFacing = CameraSelector.LENS_FACING_FRONT

  /** Emit one view-scoped stable error code without native details or user data. */
  private fun emitInferenceError(errorCode: String) {
    val reactNativeViewId = arguments?.getInt(ARG_REACT_NATIVE_VIEW_ID, View.NO_ID) ?: View.NO_ID
    if (reactNativeViewId == View.NO_ID) return
    val safePayload = Gson().toJson(
      mapOf(
        "code" to errorCode,
        "viewId" to reactNativeViewId
      )
    )
    ReactContextProvider.reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onInferenceError", safePayload)
  }

  /** Blocking ML operations are performed using this executor */
  private lateinit var backgroundExecutor: ExecutorService

  fun hasPermissions(context: Context) = PERMISSIONS_REQUIRED.all {
    ContextCompat.checkSelfPermission(
      context,
      it
    ) == PackageManager.PERMISSION_GRANTED
  }

  private val requestPermissionLauncher =
    registerForActivityResult(
      ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
      if (isGranted) {
        completeCameraSetUpWithPose()
      } else {
        emitInferenceError("cameraPermission")
      }
    }

  fun completeCameraSetUpWithPose() {
    setUpCamera()

    // Create the PoseLandmarkerHelper that will handle the inference
    backgroundExecutor.execute {
      poseLandmarkerHelper = PoseLandmarkerHelper(
        context = requireContext(),
        runningMode = RunningMode.LIVE_STREAM,
        minPoseDetectionConfidence = viewModel.currentMinPoseDetectionConfidence,
        minPoseTrackingConfidence = viewModel.currentMinPoseTrackingConfidence,
        minPosePresenceConfidence = viewModel.currentMinPosePresenceConfidence,
        currentModel = when (arguments?.getString(ARG_POSE_MODEL_VARIANT)) {
          "lite" -> PoseLandmarkerHelper.MODEL_POSE_LANDMARKER_LITE
          "heavy" -> PoseLandmarkerHelper.MODEL_POSE_LANDMARKER_HEAVY
          else -> PoseLandmarkerHelper.MODEL_POSE_LANDMARKER_FULL
        },
        currentModelAssetPath = arguments?.getString(ARG_POSE_MODEL_ASSET_PATH),
        currentDelegate = viewModel.currentDelegate,
        poseLandmarkerHelperListener = this
      )
    }
  }

  override fun onResume() {
    super.onResume()

    // Start the PoseLandmarkerHelper again when users come back
    // to the foreground.
    backgroundExecutor.execute {
      if (this::poseLandmarkerHelper.isInitialized) {
        if (poseLandmarkerHelper.isClose()) {
          poseLandmarkerHelper.setupPoseLandmarker()
        }
      }
    }
  }

  override fun onPause() {
    super.onPause()
    if (this::poseLandmarkerHelper.isInitialized) {
      viewModel.setMinPoseDetectionConfidence(poseLandmarkerHelper.minPoseDetectionConfidence)
      viewModel.setMinPoseTrackingConfidence(poseLandmarkerHelper.minPoseTrackingConfidence)
      viewModel.setMinPosePresenceConfidence(poseLandmarkerHelper.minPosePresenceConfidence)
      viewModel.setDelegate(poseLandmarkerHelper.currentDelegate)

      // Close the PoseLandmarkerHelper and release resources
      backgroundExecutor.execute { poseLandmarkerHelper.clearPoseLandmarker() }
    }
  }

  override fun onDestroyView() {
    _fragmentCameraBinding = null
    super.onDestroyView()

    backgroundExecutor.shutdown()
    backgroundExecutor.awaitTermination(
      Long.MAX_VALUE, TimeUnit.NANOSECONDS
    )
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    CameraFragmentManager.cameraFragment = this
  }

  override fun onDestroy() {
    super.onDestroy()
    CameraFragmentManager.cameraFragment = null
  }

  override fun onCreateView(
    inflater: LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
  ): View {
    _fragmentCameraBinding =
      FragmentMyCameraBinding.inflate(inflater, container, false)

    return fragmentCameraBinding.root
  }

  @SuppressLint("MissingPermission")
  override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    super.onViewCreated(view, savedInstanceState)
    cameraFacing = if (arguments?.getString(ARG_CAMERA_FACING) == "back") {
      CameraSelector.LENS_FACING_BACK
    } else {
      CameraSelector.LENS_FACING_FRONT
    }

    // Initialize our background executor
    backgroundExecutor = Executors.newSingleThreadExecutor()

    if (!hasPermissions(requireContext())) {
      requestPermissionLauncher.launch(
        Manifest.permission.CAMERA
      )
    } else {
      completeCameraSetUpWithPose()
    }
  }

  private fun setUpCamera() {
    val cameraProviderFuture =
      ProcessCameraProvider.getInstance(requireContext())
    cameraProviderFuture.addListener(
      {
        try {
          cameraProvider = cameraProviderFuture.get()
          bindCameraUseCases()
        } catch (cameraError: Exception) {
          Log.e(TAG, "Camera provider initialization failed", cameraError)
          emitInferenceError("cameraConfiguration")
        }
      }, ContextCompat.getMainExecutor(requireContext())
    )
  }

  @SuppressLint("UnsafeOptInUsageError")
  private fun bindCameraUseCases() {
    val cameraProvider = cameraProvider
    if (cameraProvider == null) {
      emitInferenceError("cameraConfiguration")
      return
    }

    val cameraSelector =
      CameraSelector.Builder().requireLensFacing(cameraFacing).build()

    preview = Preview.Builder().setTargetAspectRatio(AspectRatio.RATIO_4_3)
      .setTargetRotation(_fragmentCameraBinding?.viewFinder?.display?.rotation ?: 0)
      .build()

    imageAnalyzer =
      ImageAnalysis.Builder().setTargetAspectRatio(AspectRatio.RATIO_4_3)
        .setTargetRotation(_fragmentCameraBinding?.viewFinder?.display?.rotation ?: 0)
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
        .build()
        .also {
          it.setAnalyzer(backgroundExecutor) { image ->
            detectPose(image)
          }
        }

    cameraProvider.unbindAll()

    try {
      camera = cameraProvider.bindToLifecycle(
        this, cameraSelector, preview, imageAnalyzer
      )

      if (cameraFacing == CameraSelector.LENS_FACING_BACK) {
        val minimumZoomRatio = camera?.cameraInfo?.zoomState?.value?.minZoomRatio ?: 1f
        camera?.cameraControl?.setZoomRatio(minimumZoomRatio.coerceAtLeast(1f))
      }

      preview?.setSurfaceProvider(fragmentCameraBinding.viewFinder.surfaceProvider)
    } catch (exc: Exception) {
      Log.e(TAG, "Use case binding failed", exc)
      emitInferenceError("cameraConfiguration")
    }
  }

  private fun detectPose(imageProxy: ImageProxy) {
    if (this::poseLandmarkerHelper.isInitialized) {
      poseLandmarkerHelper.detectLiveStream(
        imageProxy = imageProxy,
        isFrontCamera = cameraFacing == CameraSelector.LENS_FACING_FRONT
      )
    }
  }

  fun switchCamera() {
    cameraFacing = if (cameraFacing == CameraSelector.LENS_FACING_BACK) {
      CameraSelector.LENS_FACING_FRONT
    } else {
      CameraSelector.LENS_FACING_BACK
    }
    Log.d(
      "CameraFragment",
      "Switched camera to ${if (cameraFacing == CameraSelector.LENS_FACING_BACK) "BACK" else "FRONT"}"
    )
    // Add your code to bind camera use cases again with the new cameraFacing value
    bindCameraUseCases()
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    _fragmentCameraBinding?.viewFinder?.display?.let { display ->
      imageAnalyzer?.targetRotation = display.rotation
    }
  }

  override fun onResults(
    resultBundle: PoseLandmarkerHelper.ResultBundle
  ) {
    activity?.runOnUiThread {
      if (_fragmentCameraBinding != null) {

        val data = resultBundle.results.first()
        val landmarksArray: MutableList<Map<String, Any>> = mutableListOf()
        val worldLandmarksArray: MutableList<Map<String, Any>> = mutableListOf()

        val landmarks = data.landmarks()
        val worldLandmarks = data.worldLandmarks()
        val primaryIndex = selectPrimaryPoseIndex(landmarks)
        emittedLandmarkFrameNumber += 1

        if (primaryIndex != null && primaryIndex < landmarks.size) {
          for (landmark in landmarks[primaryIndex]) {
            val landmarkData: Map<String, Any> = mapOf(
              "x" to landmark.x(),
              "y" to landmark.y(),
              "z" to landmark.z(),
              "visibility" to landmark.visibility().get(),
              "presence" to landmark.presence().get()
            )
            landmarksArray.add(landmarkData)
          }
        } else {
          lockedPrimaryHipX = null
          lockedPrimaryHipY = null
        }

        worldLandmarks?.let {
          if (primaryIndex != null && primaryIndex < it.size && it[primaryIndex].size == 33) {
            for (worldLandmark in it[primaryIndex]) {
              val worldLandmarkData: Map<String, Any> = mapOf(
                "x" to worldLandmark.x(),
                "y" to worldLandmark.y(),
                "z" to worldLandmark.z(),
                "visibility" to worldLandmark.visibility().get(),
                "presence" to worldLandmark.presence().get()
              )
              worldLandmarksArray.add(worldLandmarkData)
            }
          }
        }

        val additionalData = mutableMapOf<String, Any>(
          "cameraFacing" to if (cameraFacing == CameraSelector.LENS_FACING_FRONT) "front" else "back",
          "cameraLens" to "wide",
          "cameraMirrored" to (cameraFacing == CameraSelector.LENS_FACING_FRONT),
          "cameraZoomFactor" to 1,
          "height" to resultBundle.inputImageHeight,
          "width" to resultBundle.inputImageWidth,
          "capturedAtMs" to System.currentTimeMillis() - resultBundle.inferenceTime,
          "frameNumber" to emittedLandmarkFrameNumber,
          "inferenceDurationMs" to resultBundle.inferenceTime,
          "poseCount" to landmarks.size,
          "poseModelDelegate" to poseLandmarkerHelper.modelDelegateName,
          "poseModelSource" to poseLandmarkerHelper.modelSourceName,
          "poseModelVariant" to poseLandmarkerHelper.modelVariantName,
//          "presentationTimeStamp" to resultBundle.presentationTimeStamp,
//          "frameNumber" to resultBundle.frameNumber,
//          "startTimestamp" to resultBundle.startTimestamp
        )
        currentThermalState()?.let { thermalState ->
          additionalData["thermalState"] = thermalState
        }

        val swiftDict: MutableMap<String, Any> = mutableMapOf(
          "landmarks" to landmarksArray,
          "additionalData" to additionalData,
          "worldLandmarks" to worldLandmarksArray
        )


        val gson = Gson()
        val jsonData = gson.toJson(swiftDict)

        val reactContext = ReactContextProvider.reactApplicationContext
        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("onLandmark", jsonData)

        fragmentCameraBinding.myOverlay.setResults(
          resultBundle.results.first(),
          resultBundle.inputImageHeight,
          resultBundle.inputImageWidth,
          RunningMode.LIVE_STREAM
        )
        fragmentCameraBinding.myOverlay.invalidate()
      }
    }
  }

  override fun onError(errorCode: String) {
    emitInferenceError(errorCode)
  }
}
