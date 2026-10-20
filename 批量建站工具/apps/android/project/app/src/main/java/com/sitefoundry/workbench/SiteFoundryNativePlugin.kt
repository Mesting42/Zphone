package com.sitefoundry.workbench

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.documentfile.provider.DocumentFile
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Narrow device adapters. No arbitrary path, shell or URL execution is exposed
 * to JavaScript. SAF grants are user-selected; source builds use the shared
 * manager in a separate Node process and private project storage.
 */
@CapacitorPlugin(name = "SiteFoundryNative")
class SiteFoundryNativePlugin : Plugin() {
    private val work = Executors.newCachedThreadPool()
    private val exports = ConcurrentHashMap<String, ExportSession>()
    private val imports = ConcurrentHashMap<String, Uri>()
    private lateinit var runtime: NativeRuntimeClient
    private lateinit var templates: AdTemplateStore
    private data class ExportSession(val uri: Uri, val staging: File, val stream: OutputStream, val created: Boolean, var bytes: Long = 0)

    override fun load() {
        runtime = NativeRuntimeClient.get(context)
        templates = AdTemplateStore(context)
    }
    private fun async(call: PluginCall, action: () -> JSONObject) {
        work.execute {
            try { call.resolve(JSObject(action().toString())) }
            catch (error: Exception) { call.reject(error.cause?.message ?: error.message ?: "设备操作失败。") }
        }
    }
    private fun safeName(value: String?) = (value ?: "sitefoundry-export.zip").also {
        require(it.isNotBlank() && it.length <= 240 && !it.contains('/') && !it.contains('\\') && !it.contains('\u0000') && it != "." && it != "..") { "导出文件名无效。" }
    }
    private fun savedDirectory() = context.getSharedPreferences("sitefoundry-device", 0).getString("exportDirectory", null)

    @PluginMethod fun getPlatformInfo(call: PluginCall) = async(call) {
        JSONObject().put("platform", "android").put("appVersion", BuildConfig.VERSION_NAME)
            .put("androidVersion", android.os.Build.VERSION.RELEASE).put("apiLevel", android.os.Build.VERSION.SDK_INT)
            .put("device", android.os.Build.MODEL).put("offlineBuild", true)
            .put("runtimeReady", File(context.applicationInfo.nativeLibraryDir, "libsitefoundrynode.so").canExecute())
            .put("exportDirectoryUri", savedDirectory() ?: JSONObject.NULL)
    }

    @PluginMethod fun selectExportDirectory(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        startActivityForResult(call, intent, "exportDirectorySelected")
    }
    @ActivityCallback private fun exportDirectorySelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { call.resolve(JSObject().put("cancelled", true)); return }
        try {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            context.getSharedPreferences("sitefoundry-device", 0).edit().putString("exportDirectory", uri.toString()).apply()
            call.resolve(JSObject().put("directoryUri", uri.toString()).put("name", DocumentFile.fromTreeUri(context, uri)?.name ?: "已授权目录"))
        } catch (error: Exception) { call.reject(error.message ?: "目录授权失败。") }
    }

    @PluginMethod fun beginExport(call: PluginCall) {
        try {
            val name = safeName(call.getString("name"))
            val directory = call.getString("directoryUri") ?: savedDirectory()
            if (directory != null) {
                async(call) {
                    val root = DocumentFile.fromTreeUri(context, Uri.parse(directory)) ?: throw IllegalArgumentException("导出目录不可用，请重新选择。")
                    val relative = call.getString("relativePath")
                    if (relative != null) {
                        val segments = relative.split('/')
                        require(segments.isNotEmpty() && segments.all { it.isNotBlank() && it != "." && it != ".." && !it.contains('\\') && !it.contains('\u0000') }) { "导出相对路径无效。" }
                        var parent = root
                        segments.dropLast(1).forEach { segment ->
                            val child = parent.findFile(segment) ?: parent.createDirectory(segment) ?: throw IllegalStateException("无法创建导出子目录。")
                            require(child.isDirectory) { "导出子目录与已有文件冲突。" }
                            parent = child
                        }
                        val existing = parent.findFile(segments.last())
                        require(existing == null || existing.isFile) { "导出文件与已有子目录冲突。" }
                        val document = existing ?: parent.createFile(call.getString("mimeType") ?: "application/octet-stream", safeName(segments.last())) ?: throw IllegalStateException("无法创建导出文件。")
                        openExport(document.uri, existing == null)
                    } else {
                        val document = root.createFile(call.getString("mimeType") ?: "application/zip", name) ?: throw IllegalStateException("无法创建导出文件。")
                        openExport(document.uri)
                    }
                }
            } else {
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(call.getString("mimeType") ?: "application/zip").putExtra(Intent.EXTRA_TITLE, name)
                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                startActivityForResult(call, intent, "exportDocumentSelected")
            }
        } catch (error: Exception) { call.reject(error.message ?: "导出失败。") }
    }
    private fun openExport(uri: Uri, created: Boolean = true): JSONObject {
        val token = UUID.randomUUID().toString()
        val staging = File(File(context.cacheDir, "export-staging").apply { mkdirs() }, token)
        // Stage chunks privately so cancelling an existing folder export leaves
        // the previous file intact. Final commit streams, with bounded memory.
        exports[token] = ExportSession(uri, staging, staging.outputStream(), created)
        return JSONObject().put("token", token).put("uri", uri.toString())
    }
    @ActivityCallback private fun exportDocumentSelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { call.resolve(JSObject().put("cancelled", true)); return }
        async(call) { openExport(uri) }
    }
    @PluginMethod fun appendExport(call: PluginCall) = async(call) {
        val session = exports[call.getString("token")] ?: throw IllegalArgumentException("导出会话不存在。")
        val encoded = call.getString("dataBase64") ?: ""
        require(encoded.length <= 1500000) { "单个传输块过大。" }
        val bytes = Base64.decode(encoded, Base64.DEFAULT)
        synchronized(session) { session.stream.write(bytes); session.bytes += bytes.size }
        JSONObject().put("bytes", session.bytes)
    }
    @PluginMethod fun finishExport(call: PluginCall) = async(call) {
        val session = exports.remove(call.getString("token")) ?: throw IllegalArgumentException("导出会话不存在。")
        synchronized(session) { session.stream.flush(); session.stream.close() }
        try {
            session.staging.inputStream().use { input -> context.contentResolver.openOutputStream(session.uri, "wt").use { output -> requireNotNull(output) { "无法写入导出文件。" }; input.copyTo(output, 256 * 1024) } }
        } finally { session.staging.delete() }
        JSONObject().put("saved", true).put("uri", session.uri.toString()).put("bytes", session.bytes)
    }
    @PluginMethod fun cancelExport(call: PluginCall) = async(call) {
        exports.remove(call.getString("token"))?.let { session ->
            synchronized(session) { session.stream.close() }
            session.staging.delete()
            // Remove only a document created by this session. Existing folder
            // export files retain their previous content when the user cancels.
            if (session.created) try { DocumentsContract.deleteDocument(context.contentResolver, session.uri) } catch (_: Exception) { }
        }
        JSONObject().put("cancelled", true)
    }

    @PluginMethod fun selectImportDirectory(call: PluginCall) {
        startActivityForResult(call, Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION), "importDirectorySelected")
    }
    @ActivityCallback private fun importDirectorySelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { call.resolve(JSObject().put("cancelled", true)); return }
        async(call) {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val directory = DocumentFile.fromTreeUri(context, uri) ?: throw IllegalArgumentException("导入目录不可用。")
            val files = JSONArray()
            fun walk(node: DocumentFile, prefix: String) {
                node.listFiles().forEach { child ->
                    val name = child.name ?: return@forEach
                    val path = if (prefix.isEmpty()) name else "$prefix/$name"
                    if (child.isDirectory) walk(child, path)
                    else if (child.isFile) {
                        require(files.length() < 50000) { "目录超过 50000 个文件，请选择更具体的项目目录。" }
                        imports[child.uri.toString()] = child.uri
                        files.put(JSONObject().put("name", name).put("path", path).put("uri", child.uri.toString()).put("size", child.length()).put("type", child.type ?: "application/octet-stream").put("lastModified", child.lastModified()))
                    }
                }
            }
            walk(directory, "")
            JSONObject().put("directoryUri", uri.toString()).put("name", directory.name).put("files", files)
        }
    }
    @PluginMethod fun readImportFile(call: PluginCall) = async(call) {
        val uri = imports[call.getString("uri")] ?: throw IllegalArgumentException("文件不在当前授权的导入目录中。")
        val offset = call.getLong("offset") ?: 0L
        val length = call.getInt("length") ?: 1024 * 1024
        require(offset >= 0 && length in 1..1024 * 1024) { "文件读取范围无效。" }
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "文件无法读取。" }
            var remaining = offset
            while (remaining > 0) { val skipped = input.skip(remaining); if (skipped <= 0) { if (input.read() == -1) break; remaining-- } else remaining -= skipped }
            val buffer = ByteArray(length)
            var read = 0
            while (read < length) { val amount = input.read(buffer, read, length - read); if (amount == -1) break; read += amount }
            val size = DocumentFile.fromSingleUri(context, uri)?.length() ?: -1L
            JSONObject().put("dataBase64", Base64.encodeToString(buffer.copyOf(read), Base64.NO_WRAP))
                .put("eof", read < length || (size >= 0 && offset + read >= size)).put("bytes", read).put("size", size)
        }
    }

    @PluginMethod fun templateRequest(call: PluginCall) = async(call) {
        try { templates.request(call.getString("method") ?: "GET", call.getString("path") ?: "", call.getObject("body") ?: JSObject()) }
        catch (error: Exception) { JSONObject().put("status", 400).put("body", JSONObject().put("error", error.message)) }
    }

    @PluginMethod fun getBuildCapabilities(call: PluginCall) = getPlatformInfo(call)
    @PluginMethod fun listProjects(call: PluginCall) = buildRequest(call, "listProjects")
    @PluginMethod fun inspectProject(call: PluginCall) = buildRequest(call, "inspectProject")
    @PluginMethod fun prepareProject(call: PluginCall) = buildRequest(call, "prepareProject", true)
    @PluginMethod fun startBuild(call: PluginCall) = buildRequest(call, "startBuild", true)
    @PluginMethod fun taskStatus(call: PluginCall) = buildRequest(call, "taskStatus")
    @PluginMethod fun cancelTask(call: PluginCall) = buildRequest(call, "cancelTask")
    private fun buildRequest(call: PluginCall, method: String, longTask: Boolean = false) = async(call) {
        if (longTask) context.startForegroundService(Intent(context, BuildTaskService::class.java))
        try {
            val result = runtime.request(method, call.data)
            // The service monitors completion independently of the WebView, so
            // closing a modal or returning home cannot leave a stale notification.
            if (longTask) {
                val taskId = result.optString("taskId", result.optString("id"))
                if (taskId.isNotBlank()) context.startForegroundService(Intent(context, BuildTaskService::class.java).putExtra("taskId", taskId))
            }
            result
        } catch (error: Exception) { if (longTask) context.stopService(Intent(context, BuildTaskService::class.java)); throw error }
    }
    @PluginMethod fun importProject(call: PluginCall) {
        if (call.getBoolean("pick", false) == true) {
            startActivityForResult(call, Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "sourceProjectSelected")
        } else call.reject("请使用系统文件选择器导入源码 ZIP。")
    }
    @ActivityCallback private fun sourceProjectSelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { call.resolve(JSObject().put("cancelled", true)); return }
        async(call) {
            val staging = File(context.cacheDir, "source-imports").apply { mkdirs() }
            val archive = File(staging, UUID.randomUUID().toString() + ".zip")
            try {
                context.contentResolver.openInputStream(uri).use { input -> requireNotNull(input); archive.outputStream().use { input.copyTo(it, 256 * 1024) } }
                val document = DocumentFile.fromSingleUri(context, uri)
                runtime.request("importProject", JSONObject().put("archivePath", archive.absolutePath).put("name", document?.name ?: "源码项目"))
            } finally { archive.delete() }
        }
    }
    @PluginMethod fun exportArtifact(call: PluginCall) {
      work.execute { try {
        val artifact = runtime.request("exportArtifact", JSONObject(call.data.toString()).put("encoding", "path"))
        val source = File(artifact.getString("artifactPath")).canonicalFile
        require(source.path.startsWith(runtime.dataDirectory.canonicalPath + File.separator) && source.isFile) { "构建产物路径无效。" }
        call.data.put("_sourcePath", source.absolutePath)
        call.data.put("_sourceBytes", source.length())
        call.data.put("name", safeName(artifact.optString("name", "sitefoundry-build.zip")))
        call.data.put("mimeType", artifact.optString("mimeType", "application/zip"))
        // This method starts an asynchronous document picker; its own callback
        // completes the original call after streaming from private storage.
        activity.runOnUiThread { saveArtifact(call) }
      } catch (error: Exception) { call.reject(error.cause?.message ?: error.message ?: "导出构建产物失败。") } }
    }
    @PluginMethod fun previewArtifact(call: PluginCall) = async(call) {
        val artifact = runtime.request("describeArtifact", JSONObject().put("taskId", call.getString("taskId")))
        val root = File(artifact.getString("rootDirectory")).canonicalFile
        require(root.path.startsWith(runtime.dataDirectory.canonicalPath + File.separator) && root.isDirectory) { "预览产物路径无效。" }
        activity.runOnUiThread { activity.startActivity(Intent(activity, ArtifactPreviewActivity::class.java).putExtra("artifactRoot", root.absolutePath)) }
        JSONObject().put("opened", true)
    }
    private fun saveArtifact(call: PluginCall) {
        val directory = savedDirectory()
        if (directory != null) {
            async(call) {
                val target = DocumentFile.fromTreeUri(context, Uri.parse(directory))?.createFile(call.getString("mimeType") ?: "application/zip", safeName(call.getString("name"))) ?: throw IllegalStateException("导出目录不可用。")
                copyArtifact(call, target.uri)
            }
        } else startActivityForResult(call, Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(call.getString("mimeType") ?: "application/zip").putExtra(Intent.EXTRA_TITLE, call.getString("name")), "artifactDocumentSelected")
    }
    @ActivityCallback private fun artifactDocumentSelected(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { call.resolve(JSObject().put("cancelled", true)); return }
        async(call) { copyArtifact(call, uri) }
    }
    private fun copyArtifact(call: PluginCall, uri: Uri): JSONObject {
        File(call.getString("_sourcePath") ?: "").inputStream().use { input -> context.contentResolver.openOutputStream(uri, "w").use { output -> requireNotNull(output); input.copyTo(output, 256 * 1024) } }
        return JSONObject().put("saved", true).put("uri", uri.toString()).put("bytes", call.getLong("_sourceBytes") ?: 0)
    }
}
