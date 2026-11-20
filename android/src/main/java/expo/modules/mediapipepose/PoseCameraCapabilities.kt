package expo.modules.mediapipepose

import androidx.camera.core.CameraSelector

internal object PoseCameraCapabilities {
    fun selector(facing: String): CameraSelector =
        if (facing == "front") CameraSelector.DEFAULT_FRONT_CAMERA
        else CameraSelector.DEFAULT_BACK_CAMERA
}
