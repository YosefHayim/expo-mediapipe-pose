package expo.modules.mediapipepose

data class PoseCameraOptions(
    val facing: String = "front",
    val lens: String = "auto",
    val zoom: Double = 1.0,
    val previewFps: Int = 30,
    val modelVariant: String = "full",
    val modelPath: String? = null,
    val rotation: Int = 0,
    val viewWidth: Int = 0,
    val viewHeight: Int = 0,
    val minPoseDetectionConfidence: Double = 0.35,
    val minPosePresenceConfidence: Double = 0.35,
    val minTrackingConfidence: Double = 0.35,
) {
    fun isValid(): Boolean {
        if (facing !in listOf("front", "back")) return false
        if (lens !in listOf("auto", "wide")) return false
        if (modelVariant !in listOf("lite", "full", "heavy")) return false
        if (!zoom.isFinite() || zoom < 1) return false
        if (previewFps !in 1..60) return false
        val confidenceValues =
            listOf(minPoseDetectionConfidence, minPosePresenceConfidence, minTrackingConfidence)
        return confidenceValues.all { it.isFinite() && it in 0.0..1.0 }
    }
}
