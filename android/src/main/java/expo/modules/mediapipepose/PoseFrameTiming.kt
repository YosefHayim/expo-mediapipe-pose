package expo.modules.mediapipepose

data class PoseProcessingOptions(
    val frameLimit: Int = 30,
    val callbackFps: Int = 30,
    val metricsEnabled: Boolean = false,
) {
    fun isValid(): Boolean {
        if (frameLimit !in 1..60) return false
        return callbackFps in 1..60
    }
}

data class PosePerformanceSnapshot(
    val intervalMs: Double,
    val observedFrames: Int,
    val inferenceCount: Int,
    val resultCount: Int,
    val skippedInferenceFrames: Int,
    val averageInferenceDurationMs: Double?,
) {
    val event: Map<String, Any?>
        get() =
            mapOf(
                "intervalMs" to intervalMs,
                "observedFrames" to observedFrames,
                "inferenceCount" to inferenceCount,
                "resultCount" to resultCount,
                "skippedInferenceFrames" to skippedInferenceFrames,
                "observedFps" to observedFps,
                "inferenceFps" to inferenceFps,
                "resultFps" to resultFps,
                "averageInferenceDurationMs" to averageInferenceDurationMs,
            )

    val observedFps: Double
        get() = observedFrames * 1000.0 / intervalMs

    val inferenceFps: Double
        get() = inferenceCount * 1000.0 / intervalMs

    val resultFps: Double
        get() = resultCount * 1000.0 / intervalMs
}

class PoseFrameTiming {
    private var lastInferenceMs: Double? = null
    private var lastResultMs: Double? = null
    private var windowStartedAtMs: Double? = null
    private var observedFrames = 0
    private var inferenceCount = 0
    private var resultCount = 0
    private var skippedInferenceFrames = 0
    private var totalInferenceDurationMs = 0.0

    fun observeFrame(nowMs: Double): PosePerformanceSnapshot? {
        val startedAt = windowStartedAtMs
        if (startedAt == null) {
            windowStartedAtMs = nowMs
            observedFrames = 1
            return null
        }
        val intervalMs = nowMs - startedAt
        if (intervalMs < 1000) {
            observedFrames += 1
            return null
        }
        val averageDuration =
            if (inferenceCount > 0) totalInferenceDurationMs / inferenceCount else null
        val snapshot =
            PosePerformanceSnapshot(
                intervalMs,
                observedFrames,
                inferenceCount,
                resultCount,
                skippedInferenceFrames,
                averageDuration,
            )
        windowStartedAtMs = nowMs
        observedFrames = 1
        inferenceCount = 0
        resultCount = 0
        skippedInferenceFrames = 0
        totalInferenceDurationMs = 0.0
        return snapshot
    }

    fun shouldInfer(nowMs: Double, fps: Int): Boolean {
        val previous = lastInferenceMs
        val arrivedTooSoon = previous != null && nowMs - previous + 0.000001 < 1000.0 / fps
        if (arrivedTooSoon) {
            skippedInferenceFrames += 1
            return false
        }
        lastInferenceMs = nowMs
        return true
    }

    fun recordInference(durationMs: Double) {
        inferenceCount += 1
        totalInferenceDurationMs += durationMs
    }

    fun shouldDeliver(nowMs: Double, fps: Int): Boolean {
        val previous = lastResultMs
        val arrivedTooSoon = previous != null && nowMs - previous + 0.000001 < 1000.0 / fps
        if (arrivedTooSoon) return false
        lastResultMs = nowMs
        resultCount += 1
        return true
    }
}
