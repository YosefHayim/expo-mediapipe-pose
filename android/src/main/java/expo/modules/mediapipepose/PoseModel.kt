package expo.modules.mediapipepose

import android.net.Uri
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import java.io.File
import java.io.FileInputStream
import java.nio.channels.FileChannel

internal object PoseModel {
    fun localFile(location: String): File {
        if (location.startsWith("/")) return readableFile(File(location))
        val uri = Uri.parse(location)
        require(uri.scheme.equals("file", ignoreCase = true)) {
            "Expected a local file URI or absolute path"
        }
        require(
            uri.authority.isNullOrEmpty() || uri.authority.equals("localhost", ignoreCase = true)
        )
        require(uri.query == null && uri.fragment == null)
        return readableFile(File(requireNotNull(uri.path)))
    }

    private fun readableFile(file: File): File {
        require(file.isAbsolute && file.isFile && file.canRead()) { "File is not readable" }
        return file
    }

    fun options(variant: String, path: String?, delegate: String): BaseOptions {
        require(variant in listOf("lite", "full", "heavy"))
        val base = BaseOptions.builder().setDelegate(mediaPipeDelegate(delegate))
        val hasNoLocalPath = path == null

        if (hasNoLocalPath) {
            return base.setModelAssetPath(bundledAsset(variant)).build()
        }

        val modelFile = localFile(requireNotNull(path))
        FileInputStream(modelFile).use { stream ->
            base.setModelAssetBuffer(
                stream.channel.map(FileChannel.MapMode.READ_ONLY, 0, stream.channel.size())
            )
        }
        return base.build()
    }

    private fun bundledAsset(variant: String): String {
        if (variant == "lite") return "pose_landmarker_lite.task"
        if (variant == "full") return "pose_landmarker_full.task"
        if (variant == "heavy") return "pose_landmarker_heavy.task"
        throw IllegalArgumentException("Unknown pose model")
    }

    private fun mediaPipeDelegate(delegate: String): Delegate {
        if (delegate == "gpu") return Delegate.GPU
        if (delegate == "cpu") return Delegate.CPU
        throw IllegalArgumentException("Unknown pose delegate")
    }
}
