package expo.modules.mediapipepose

import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.components.containers.Landmark
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import java.util.Optional
import org.junit.Assert.assertThrows
import org.junit.Test

class PoseLandmarkPayloadTest {
    @Test
    fun mismatchedStreamsRejectInsteadOfDroppingOrInventingPoseData() {
        val mismatched =
            object : PoseLandmarkerResult() {
                override fun timestampMs() = 0L

                override fun landmarks(): List<List<NormalizedLandmark>> = listOf(emptyList())

                override fun worldLandmarks(): List<List<Landmark>> = emptyList()

                override fun segmentationMasks(): Optional<List<MPImage>> = Optional.empty()
            }
        assertThrows(IllegalStateException::class.java) {
            PoseLandmarkPayload.make(mismatched)
        }
    }
}
