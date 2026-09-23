package expo.modules.mediapipepose

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.SystemClock
import androidx.exifinterface.media.ExifInterface
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File

internal class PoseImageOptions : Record {
    @Field var modelVariant: String = "full"
    @Field var modelPath: String? = null
    @Field var maxImageDimension: Int = 2048
    @Field var minPoseDetectionConfidence: Double = 0.35
    @Field var minPosePresenceConfidence: Double = 0.35

    fun validate() {
        require(maxImageDimension in 256..2048)
        val confidences = listOf(minPoseDetectionConfidence, minPosePresenceConfidence)
        require(confidences.all { it.isFinite() && it in 0.0..1.0 })
    }
}

internal object PoseImageAnalysis {
    fun analyze(context: Context, location: String, options: PoseImageOptions): Map<String, Any> {
        options.validate()
        val pixels = decode(PoseModel.localFile(location), options.maxImageDimension)
        try {
            val configuration =
                PoseLandmarker.PoseLandmarkerOptions.builder()
                    .setBaseOptions(PoseModel.options(options.modelVariant, options.modelPath))
                    .setRunningMode(RunningMode.IMAGE)
                    .setNumPoses(1)
                    .setMinPoseDetectionConfidence(options.minPoseDetectionConfidence.toFloat())
                    .setMinPosePresenceConfidence(options.minPosePresenceConfidence.toFloat())
                    .build()
            PoseLandmarker.createFromOptions(context, configuration).use { detector ->
                val image = BitmapImageBuilder(pixels).build()
                try {
                    val started = SystemClock.elapsedRealtimeNanos()
                    val result = detector.detect(image)
                    val duration = (SystemClock.elapsedRealtimeNanos() - started) / 1_000_000.0
                    return PoseLandmarkPayload.make(result) +
                        mapOf(
                            "imageSize" to
                                mapOf("width" to pixels.width, "height" to pixels.height),
                            "inferenceDurationMs" to duration,
                            "model" to
                                mapOf(
                                    "variant" to options.modelVariant,
                                    "delegate" to "CPU",
                                    "source" to
                                        if (options.modelPath == null) "bundled" else "local",
                                ),
                        )
                } finally {
                    image.close()
                }
            }
        } finally {
            if (!pixels.isRecycled) pixels.recycle()
        }
    }

    private fun decode(file: File, maximumDimension: Int): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Image could not be decoded" }
        require(bounds.outWidth.toLong() * bounds.outHeight <= 16_777_216L) {
            "Source image exceeds 16,777,216 pixels; resize it before analysis."
        }
        val largestDimension = maxOf(bounds.outWidth, bounds.outHeight)
        var sampleSize = 1
        while (largestDimension > maximumDimension.toLong() * sampleSize) sampleSize *= 2
        val decoding =
            BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.ARGB_8888
                inScaled = false
            }
        val pixels =
            requireNotNull(BitmapFactory.decodeFile(file.path, decoding)) {
                "Image could not be decoded"
            }
        try {
            val exif = ExifInterface(file)
            val transform =
                Matrix().apply {
                    // ExifInterface defines rotation after the horizontal flip.
                    if (exif.isFlipped) postScale(-1f, 1f)
                    postRotate(exif.rotationDegrees.toFloat())
                }
            val upright =
                Bitmap.createBitmap(pixels, 0, 0, pixels.width, pixels.height, transform, true)
            if (upright !== pixels) pixels.recycle()
            return upright
        } catch (error: Exception) {
            pixels.recycle()
            throw error
        }
    }
}
