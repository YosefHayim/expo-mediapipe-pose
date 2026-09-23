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
        require(uri.scheme == "file") { "Expected a local file URI or absolute path" }
        require(uri.authority.isNullOrEmpty() || uri.authority == "localhost")
        require(uri.query == null && uri.fragment == null)
        return readableFile(File(requireNotNull(uri.path)))
    }

    private fun readableFile(file: File): File {
        require(file.isAbsolute && file.isFile && file.canRead()) { "File is not readable" }
        return file
    }

    fun options(variant: String, path: String?): BaseOptions {
        require(variant in listOf("lite", "full", "heavy"))
        val base = BaseOptions.builder().setDelegate(Delegate.CPU)
        if (path == null) {
            require(variant == "full") { "A local model is required for this variant" }
            return base.setModelAssetPath("pose_landmarker_full.task").build()
        }
        FileInputStream(localFile(path)).use { stream ->
            base.setModelAssetBuffer(
                stream.channel.map(FileChannel.MapMode.READ_ONLY, 0, stream.channel.size())
            )
        }
        return base.build()
    }
}
