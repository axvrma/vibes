package com.axvrma.vibes

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.media.MediaMetadataRetriever
import android.graphics.Bitmap
import java.io.File
import android.provider.DocumentsContract
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import com.ryanheise.audioservice.AudioServiceActivity
import java.util.concurrent.Executors

class MainActivity : AudioServiceActivity() {
    private var picker: MethodChannel.Result? = null
    private val worker = Executors.newSingleThreadExecutor()
    override fun configureFlutterEngine(engine: FlutterEngine) {
        super.configureFlutterEngine(engine)
        MethodChannel(engine.dartExecutor.binaryMessenger, "vibes/local-library").setMethodCallHandler { call, result ->
            when (call.method) {
                "pickFolder" -> {
                    if (picker != null) { result.error("BUSY", "Folder picker is already open", null) }
                    else {
                        picker = result
                        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
                        startActivityForResult(intent, 2301)
                    }
                }
                "thumbnail" -> worker.execute {
                    try {
                        val key = (call.argument<String>("id") ?: "video").replace(Regex("[^A-Za-z0-9_]"), "_")
                        val folder = File(cacheDir,"vibes-thumbnails"); folder.mkdirs()
                        val output = File(folder,"$key.jpg")
                        if (!output.exists()) {
                            val retriever = MediaMetadataRetriever()
                            try {
                                retriever.setDataSource(this,Uri.parse(call.argument<String>("uri")))
                                val bitmap = if (android.os.Build.VERSION.SDK_INT >= 27) retriever.getScaledFrameAtTime(0,MediaMetadataRetriever.OPTION_CLOSEST_SYNC,480,480) else retriever.getFrameAtTime(0)
                                if (bitmap != null) { output.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG,75,it) };bitmap.recycle() }
                            } finally { retriever.release() }
                        }
                        runOnUiThread { result.success(if(output.exists())output.path else null) }
                    } catch (error:Exception) { runOnUiThread {result.success(null)} }
                }
                "listVideos" -> worker.execute {
                    try {
                        val tree = Uri.parse(call.argument<String>("tree")!!)
                        val recursive = call.argument<Boolean>("recursive") ?: false
                        val videos = mutableListOf<Map<String, Any>>()
                        fun walk(id: String) {
                            val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, id)
                            contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE), null, null, null)?.use { cursor ->
                                while (cursor.moveToNext()) {
                                    val childId = cursor.getString(0)
                                    val name = cursor.getString(1) ?: continue
                                    if (name.startsWith(".")) continue
                                    val mime = cursor.getString(2)
                                    if (mime == DocumentsContract.Document.MIME_TYPE_DIR) { if (recursive) walk(childId) }
                                    else if (name.substringAfterLast('.', "").lowercase() in setOf("mp4", "mov", "mkv", "webm", "m4v", "avi")) {
                                        val uri = DocumentsContract.buildDocumentUriUsingTree(tree, childId)
                                        videos.add(mapOf("id" to "${tree.authority}:$childId", "uri" to uri.toString(), "name" to name, "size" to cursor.getLong(3)))
                                    }
                                }
                            } ?: throw IllegalStateException("Folder provider is unavailable. Choose the folder again.")
                        }
                        walk(DocumentsContract.getTreeDocumentId(tree))
                        runOnUiThread { result.success(videos) }
                    } catch (error: Exception) { runOnUiThread { result.error("FOLDER_UNAVAILABLE", "Folder access expired or the provider is unavailable. Choose the folder again.", null) } }
                }
                else -> result.notImplemented()
            }
        }
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 2301) {
            val result = picker; picker = null
            val uri = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) { result?.success(null); return }
            try {
                contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                result?.success(uri.toString())
            } catch (error: Exception) { result?.error("PERMISSION", "This provider could not retain folder access", null) }
        }
    }
    override fun onDestroy() { worker.shutdown(); super.onDestroy() }
}
