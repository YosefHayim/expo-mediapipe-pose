package expo.modules.mediapipepose

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.camera.core.CameraSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise

internal object PoseCameraCapabilities {
    fun selector(facing: String): CameraSelector =
        if (facing == "front") CameraSelector.DEFAULT_FRONT_CAMERA
        else CameraSelector.DEFAULT_BACK_CAMERA

    fun discover(context: Context, promise: Promise) {
        val permission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
        if (permission != PackageManager.PERMISSION_GRANTED) {
            promise.resolve(mapOf("status" to "permissionRequired"))
            return
        }
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener(
            {
                try {
                    val provider = future.get()
                    val cameras =
                        listOf("front", "back").mapNotNull { facing ->
                            val cameraSelector = selector(facing)
                            if (!provider.hasCamera(cameraSelector)) return@mapNotNull null
                            val info = provider.getCameraInfo(cameraSelector)
                            val modes =
                                info.supportedFrameRateRanges
                                    .filter { it.lower == it.upper && it.lower in 1..60 }
                                    .sortedBy { it.lower }
                                    .map { mapOf("previewFps" to it.lower, "resolution" to null) }
                            if (modes.isEmpty()) return@mapNotNull null
                            val zoom = info.zoomState.value
                            val zoomRange = zoom?.let {
                                mapOf(
                                    "min" to maxOf(1f, it.minZoomRatio),
                                    "max" to minOf(100f, it.maxZoomRatio),
                                )
                            }
                            mapOf(
                                "facing" to facing,
                                "lens" to "wide",
                                "modes" to modes,
                                "zoomRange" to zoomRange,
                            )
                        }
                    if (cameras.isEmpty()) {
                        promise.resolve(mapOf("status" to "unavailable"))
                        return@addListener
                    }
                    promise.resolve(
                        mapOf(
                            "status" to "available",
                            "platform" to "android",
                            "cameras" to cameras,
                        )
                    )
                } catch (error: Exception) {
                    promise.reject(
                        "cameraCapabilities",
                        "Unable to query camera capabilities",
                        error,
                    )
                }
            },
            ContextCompat.getMainExecutor(context),
        )
    }
}
