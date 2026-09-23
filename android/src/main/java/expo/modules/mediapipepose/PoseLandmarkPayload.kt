package expo.modules.mediapipepose

import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult

internal object PoseLandmarkPayload {
    fun make(result: PoseLandmarkerResult): Map<String, Any> {
        val poses =
            result.landmarks().mapIndexed { index, image ->
                val landmarks = image.map { joint ->
                    mutableMapOf<String, Any>("x" to joint.x(), "y" to joint.y(), "z" to joint.z())
                        .apply {
                            joint.visibility().ifPresent { put("visibility", it) }
                            joint.presence().ifPresent { put("presence", it) }
                        }
                }
                val worldLandmarks =
                    result.worldLandmarks()[index].map { joint ->
                        mutableMapOf<String, Any>(
                                "x" to joint.x(),
                                "y" to joint.y(),
                                "z" to joint.z(),
                            )
                            .apply {
                                joint.visibility().ifPresent { put("visibility", it) }
                                joint.presence().ifPresent { put("presence", it) }
                            }
                    }
                mapOf("landmarks" to landmarks, "worldLandmarks" to worldLandmarks)
            }
        val first = poses.firstOrNull()
        if (first == null)
            return mapOf(
                "landmarks" to emptyList<Any>(),
                "worldLandmarks" to emptyList<Any>(),
                "poses" to poses,
            )
        return mapOf(
            "landmarks" to first.getValue("landmarks"),
            "worldLandmarks" to first.getValue("worldLandmarks"),
            "poses" to poses,
        )
    }
}
