package expo.modules.mediapipepose

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import java.io.File
import java.nio.ByteOrder
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

internal class PoseMaskStore {
    companion object {
        private val startupLock = Any()
        private var startupCleaned = false
        private const val directoryPrefix = "expo-mediapipe-pose-masks-"

        private fun cleanPreviousProcessFiles(cache: File) =
            synchronized(startupLock) {
                if (startupCleaned) return@synchronized
                val entries = requireNotNull(cache.listFiles()) { "Cannot inspect mask cache" }
                for (entry in entries) {
                    if (!entry.name.startsWith(directoryPrefix)) continue
                    check(entry.deleteRecursively()) { "Cannot clear previous mask files" }
                }
                startupCleaned = true
            }
    }

    private val directoryName = "$directoryPrefix${UUID.randomUUID()}"
    private var directory: File? = null
    private val leases = mutableMapOf<String, File>()
    private val closed = AtomicBoolean(false)

    @Synchronized
    fun save(
        context: Context,
        result: PoseLandmarkerResult,
        width: Int,
        height: Int,
        maximumDimension: Int,
    ): Map<String, Any> {
        check(!closed.get()) { "Mask owner is closed" }
        if (result.landmarks().isEmpty()) return mapOf("status" to "empty")
        if (leases.size >= 2) return mapOf("status" to "backpressure")
        val masks =
            result.segmentationMasks().orElseThrow {
                IllegalStateException("Segmentation masks are missing")
            }
        check(masks.size == result.landmarks().size)
        val id = UUID.randomUUID().toString()
        cleanPreviousProcessFiles(context.cacheDir)
        val root = File(context.cacheDir, directoryName)
        directory = root
        val folder = File(root, id)
        check(folder.mkdirs()) { "Cannot create mask directory" }
        leases[id] = folder
        try {
            val payload = masks.mapIndexed { index, mask ->
                val file = File(folder, "$index.png")
                val size = encode(mask, file, maximumDimension)
                mapOf(
                    "poseIndex" to index,
                    "uri" to file.toURI().toString(),
                    "width" to size.first,
                    "height" to size.second,
                )
            }
            return mapOf(
                "status" to "available",
                "leaseId" to id,
                "masks" to payload,
                "imageSize" to mapOf("width" to width, "height" to height),
            )
        } catch (error: Exception) {
            release(id)
            throw error
        }
    }

    @Synchronized
    fun release(id: String) {
        val folder = leases[id] ?: return
        check(folder.deleteRecursively()) { "Cannot remove mask output" }
        leases.remove(id)
        folder.parentFile?.delete()
    }

    fun discard(segmentation: Map<String, Any>?) {
        val id = segmentation?.get("leaseId") as? String ?: return
        CompletableFuture.runAsync {
            try {
                release(id)
            } catch (error: Exception) {
                Log.e("PoseMasks", "Mask cleanup failed", error)
            }
        }
    }

    fun destroy() {
        closed.set(true)
        CompletableFuture.runAsync {
            synchronized(this) {
                val root = directory
                if (root != null && !root.deleteRecursively())
                    Log.e("PoseMasks", "Mask cleanup failed")
                leases.clear()
            }
        }
    }

    private fun encode(mask: MPImage, file: File, maximumDimension: Int): Pair<Int, Int> {
        require(mask.width > 0 && mask.height > 0)
        val scale = minOf(1.0, maximumDimension.toDouble() / maxOf(mask.width, mask.height))
        val width = maxOf(1, (mask.width * scale).toInt())
        val height = maxOf(1, (mask.height * scale).toInt())
        val probabilities =
            ByteBufferExtractor.extract(mask).order(ByteOrder.nativeOrder()).asFloatBuffer()
        require(probabilities.remaining() == mask.width * mask.height)
        val pixels = IntArray(width * height)
        for (row in 0 until height) {
            val sourceRow = minOf(mask.height - 1, ((row + 0.5) * mask.height / height).toInt())
            for (column in 0 until width) {
                val sourceColumn =
                    minOf(mask.width - 1, ((column + 0.5) * mask.width / width).toInt())
                val probability = probabilities.get(sourceRow * mask.width + sourceColumn)
                require(probability.isFinite())
                val alpha = (probability.coerceIn(0f, 1f) * 255).roundToInt()
                pixels[row * width + column] = (alpha shl 24) or 0x00ffffff
            }
        }
        val bitmap = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
        try {
            file.outputStream().use { output ->
                check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output))
            }
        } finally {
            bitmap.recycle()
        }
        return width to height
    }
}
