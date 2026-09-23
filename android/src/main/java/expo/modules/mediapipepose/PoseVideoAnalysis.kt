package expo.modules.mediapipepose

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.os.Build
import android.os.SystemClock
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import expo.modules.kotlin.Promise
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

private class PoseVideoSession(
    val context: Context,
    val retriever: MediaMetadataRetriever,
    val detector: PoseLandmarker,
    val durationMs: Long,
    val options: PoseImageOptions,
) {
    val id = UUID.randomUUID().toString()
    var lastTimestamp = -1L

    fun close() {
        try {
            detector.close()
        } finally {
            retriever.release()
        }
    }
}

internal class PoseVideoAnalysis(private val masks: PoseMaskStore) {
    private val worker = Executors.newSingleThreadExecutor()
    private val destroyed = AtomicBoolean(false)
    private var session: PoseVideoSession? = null

    private fun submit(promise: Promise, operation: () -> Any?) {
        if (destroyed.get()) {
            promise.reject("videoAnalysisDisposed", "Video analysis owner is closed", null)
            return
        }
        try {
            worker.execute {
                if (destroyed.get()) {
                    promise.reject("videoAnalysisDisposed", "Video analysis owner is closed", null)
                    return@execute
                }
                try {
                    promise.resolve(operation())
                } catch (error: Exception) {
                    promise.reject(
                        "videoAnalysis",
                        "Video analysis failed: ${error.message}",
                        error,
                    )
                }
            }
        } catch (error: RejectedExecutionException) {
            promise.reject("videoAnalysisDisposed", "Video analysis owner is closed", error)
        }
    }

    fun open(
        context: Context,
        location: String,
        options: PoseImageOptions,
        trackingConfidence: Double,
        promise: Promise,
    ) =
        submit(promise) {
            check(session == null) { "Close the active video analysis before opening another" }
            require(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                "Bounded video decoding requires Android API 27 or newer"
            }
            options.validate()
            require(trackingConfidence.isFinite() && trackingConfidence in 0.0..1.0)
            val file = PoseModel.localFile(location)
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(file.path)
                require(
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) ==
                        "yes"
                ) {
                    "File has no video track"
                }
                val duration =
                    requireNotNull(
                            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                        )
                        .toLong()
                require(duration > 0)
                val configuration =
                    PoseLandmarker.PoseLandmarkerOptions.builder()
                        .setBaseOptions(PoseModel.options(options.modelVariant, options.modelPath))
                        .setRunningMode(RunningMode.VIDEO)
                        .setNumPoses(options.maxPoses)
                        .setOutputSegmentationMasks(options.segmentationEnabled)
                        .setMinPoseDetectionConfidence(options.minPoseDetectionConfidence.toFloat())
                        .setMinPosePresenceConfidence(options.minPosePresenceConfidence.toFloat())
                        .setMinTrackingConfidence(trackingConfidence.toFloat())
                        .build()
                val detector = PoseLandmarker.createFromOptions(context, configuration)
                val opened =
                    PoseVideoSession(
                        context.applicationContext,
                        retriever,
                        detector,
                        duration,
                        options,
                    )
                session = opened
                mapOf("id" to opened.id, "durationMs" to duration)
            } catch (error: Exception) {
                retriever.release()
                throw error
            }
        }

    fun read(id: String, timestampMs: Long, promise: Promise) =
        submit(promise) {
            val current = requireNotNull(session) { "Video analysis is not open" }
            require(current.id == id) { "Unknown video analysis" }
            require(
                timestampMs > current.lastTimestamp && timestampMs in 0 until current.durationMs
            )
            current.lastTimestamp = timestampMs
            try {
                check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1)
                val limit = current.options.maxImageDimension
                val decoded =
                    requireNotNull(
                        current.retriever.getScaledFrameAtTime(
                            timestampMs * 1000,
                            MediaMetadataRetriever.OPTION_CLOSEST,
                            limit,
                            limit,
                        )
                    ) {
                        "Video frame could not be decoded"
                    }
                val pixels =
                    try {
                        requireNotNull(decoded.copy(Bitmap.Config.ARGB_8888, false))
                    } finally {
                        decoded.recycle()
                    }
                try {
                    val image = BitmapImageBuilder(pixels).build()
                    var outputMasks = emptyList<com.google.mediapipe.framework.image.MPImage>()
                    try {
                        val started = SystemClock.elapsedRealtimeNanos()
                        val result = current.detector.detectForVideo(image, timestampMs)
                        val inferenceDurationMs =
                            (SystemClock.elapsedRealtimeNanos() - started) / 1_000_000.0
                        outputMasks = result.segmentationMasks().orElse(emptyList())
                        val landmarkPayload = PoseLandmarkPayload.make(result)
                        val segmentation =
                            if (current.options.segmentationEnabled)
                                mapOf(
                                    "segmentation" to
                                        masks.save(
                                            current.context,
                                            result,
                                            pixels.width,
                                            pixels.height,
                                            current.options.maskMaxDimension,
                                        )
                                )
                            else emptyMap()
                        val detection =
                            landmarkPayload +
                                segmentation +
                                mapOf(
                                    "imageSize" to
                                        mapOf("width" to pixels.width, "height" to pixels.height),
                                    "inferenceDurationMs" to inferenceDurationMs,
                                    "model" to
                                        mapOf(
                                            "variant" to current.options.modelVariant,
                                            "delegate" to "CPU",
                                            "source" to
                                                if (current.options.modelPath == null) "bundled"
                                                else "local",
                                        ),
                                )
                        mapOf(
                            "timestampMs" to timestampMs,
                            "decodedTimestampMs" to null,
                            "detection" to detection,
                        )
                    } finally {
                        outputMasks.forEach { it.close() }
                        image.close()
                    }
                } finally {
                    if (!pixels.isRecycled) pixels.recycle()
                }
            } catch (error: Exception) {
                closeSession(id)
                throw error
            }
        }

    private fun closeSession(id: String) {
        val current = session ?: return
        if (current.id != id) return
        session = null
        current.close()
    }

    fun close(id: String, promise: Promise) =
        submit(promise) {
            closeSession(id)
            null
        }

    fun destroy() {
        if (!destroyed.compareAndSet(false, true)) return
        worker.execute {
            val current = session
            session = null
            current?.close()
        }
        worker.shutdown()
    }
}
