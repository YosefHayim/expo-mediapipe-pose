package expo.modules.mediapipepose

import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult

internal object PoseLandmarkPayload {
    fun make(result: PoseLandmarkerResult): Map<String, Any> {
        val landmarks =
            result.landmarks().firstOrNull().orEmpty().map { joint ->
                mutableMapOf<String, Any>("x" to joint.x(), "y" to joint.y(), "z" to joint.z())
                    .apply {
                        joint.visibility().ifPresent { put("visibility", it) }
                        joint.presence().ifPresent { put("presence", it) }
                    }
            }
        val worldLandmarks =
            result.worldLandmarks().firstOrNull().orEmpty().map { joint ->
                mutableMapOf<String, Any>("x" to joint.x(), "y" to joint.y(), "z" to joint.z())
                    .apply {
                        joint.visibility().ifPresent { put("visibility", it) }
                        joint.presence().ifPresent { put("presence", it) }
                    }
            }
        return mapOf("landmarks" to landmarks, "worldLandmarks" to worldLandmarks)
    }
}
