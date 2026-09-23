package expo.modules.mediapipepose

import org.junit.Assert.*
import org.junit.Test

class PoseFrameTimingTest {
    @Test
    fun independentCadenceAndMeasuredWindow() {
        val timing = PoseFrameTiming()
        for (index in 0 until 60) {
            val timestamp = index * 1000.0 / 60
            assertNull(timing.observeFrame(timestamp))
            if (!timing.shouldInfer(timestamp, 15)) continue
            timing.recordInference(12.0)
            timing.shouldDeliver(timestamp, 5)
        }
        val metrics = requireNotNull(timing.observeFrame(1000.0))
        assertEquals(60, metrics.observedFrames)
        assertEquals(15, metrics.inferenceCount)
        assertEquals(5, metrics.resultCount)
        assertEquals(45, metrics.skippedInferenceFrames)
        assertEquals(12.0, requireNotNull(metrics.averageInferenceDurationMs), 0.0)
        assertEquals(60.0, metrics.observedFps, 0.0)
        assertEquals(15.0, metrics.inferenceFps, 0.0)
        assertEquals(5.0, metrics.resultFps, 0.0)
        assertEquals(45, metrics.event["skippedInferenceFrames"])
    }

    @Test
    fun ratesChangeWithoutResettingHistory() {
        val timing = PoseFrameTiming()
        assertTrue(timing.shouldInfer(0.0, 1))
        assertFalse(timing.shouldInfer(10.0, 1))
        assertTrue(timing.shouldInfer(20.0, 60))
        assertFalse(timing.shouldInfer(30.0, 1))
        assertTrue(timing.shouldInfer(1020.0, 1))
        assertTrue(timing.shouldDeliver(0.0, 1))
        assertTrue(timing.shouldDeliver(20.0, 60))
        assertFalse(timing.shouldDeliver(30.0, 1))
        assertTrue(timing.shouldDeliver(1020.0, 1))
    }

    @Test
    fun jitterAndLongGapsDoNotCauseCadenceCollapseOrCatchUpBursts() {
        val timing = PoseFrameTiming()
        for (index in 0 until 120) {
            val jitter = if (index % 2 == 0) 2.0 else -2.0
            val timestamp = index * 1000.0 / 30 + jitter
            assertTrue(timing.shouldInfer(timestamp, 30))
            assertTrue(timing.shouldDeliver(timestamp, 30))
        }
        assertTrue(timing.shouldInfer(10000.0, 30))
        assertFalse(timing.shouldInfer(10001.0, 30))
        assertTrue(timing.shouldDeliver(10000.0, 30))
        assertFalse(timing.shouldDeliver(10001.0, 30))
    }

    @Test
    fun toleranceDoesNotIncreaseSustainedRateWithFastInput() {
        val timing = PoseFrameTiming()
        val accepted = (0 until 10000).count { timing.shouldInfer(it.toDouble(), 30) }
        assertTrue(accepted in 300..301)
    }

    @Test
    fun emptyWindowAndInvalidRatesRemainExplicit() {
        val timing = PoseFrameTiming()
        assertNull(timing.observeFrame(0.0))
        val metrics = requireNotNull(timing.observeFrame(2000.0))
        assertNull(metrics.averageInferenceDurationMs)
        assertNull(metrics.event["averageInferenceDurationMs"])
        assertEquals(0.0, metrics.inferenceFps, 0.0)
        assertTrue(PoseProcessingOptions(frameLimit = 1, callbackFps = 60).isValid())
        assertFalse(PoseProcessingOptions(frameLimit = 0).isValid())
        assertFalse(PoseProcessingOptions(callbackFps = 61).isValid())
    }
}
