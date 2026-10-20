package com.sitefoundry.workbench

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Durable template persistence. AST analysis is shared browser code, not regex. */
class AdTemplateStore(private val context: Context) {
    private val root = File(context.filesDir, "sitefoundry/ad-templates")
    private val builtIn = setOf("initial", "v1.0.0", "v1.0.1", "v1.0.2", "v1.0.2.1")
    private val versionPattern = Regex("^v[0-9]+(?:\\.[0-9]+){2,3}(?:-[0-9A-Za-z.-]+)?$")
    private val fields = listOf("bannerPath1", "bannerPath2", "bannerPath3", "bannerPath4", "interstitialPath", "anchorPath", "analyticsID")

    @Synchronized fun request(method: String, path: String, body: JSONObject): JSONObject {
        ensureInitialStore()
        val manifest = readManifest()
        val catalog = readCatalog(manifest)
        if (method == "GET" && path == "/__sitefoundry/ad-templates")
            return response(200, JSONObject().put("manifest", manifest).put("templates", catalog))
        require(method == "POST") { "该模板接口不支持此请求方式。" }
        if (path.endsWith("/default")) {
            val version = body.optString("version")
            require(builtIn.contains(version) || (0 until catalog.length()).any { catalog.getJSONObject(it).optString("version") == version }) { "默认版本不存在。" }
            manifest.put("defaultVersion", version)
            atomicWrite(File(root, "manifest.json"), manifest)
            return response(200, JSONObject().put("manifest", manifest))
        }
        require(path == "/__sitefoundry/ad-templates/save") { "模板接口不存在。" }
        val template = body.optJSONObject("template") ?: throw IllegalArgumentException("请先完成共享语法校验。")
        val version = template.optString("version")
        require(versionPattern.matches(version) && !builtIn.contains(version)) { "版本号无效或已经内置。" }
        require((0 until catalog.length()).none { catalog.getJSONObject(it).optString("version") == version }) { "版本 $version 已存在。" }
        val source = template.optString("source")
        require(source.isNotBlank() && source.toByteArray(Charsets.UTF_8).size <= 1024 * 1024) { "模板必须有内容且不超过 1 MB。" }
        val mapping = template.getJSONObject("fields")
        val ranges = template.getJSONObject("ranges")
        val names = HashSet<String>()
        fields.forEach { field ->
            val name = mapping.optString(field)
            if (name.isNotEmpty()) {
                require(names.add(name)) { "模板变量映射重复。" }
                val range = ranges.getJSONObject(field)
                val start = range.getInt("start")
                val end = range.getInt("end")
                require(start >= 0 && end > start && end <= source.length) { "模板替换范围无效。" }
            } else require(field == "bannerPath4") { "模板缺少必需变量映射。" }
        }
        val relativeFile = "custom/$version.json"
        template.put("file", relativeFile)
        atomicWrite(File(root, relativeFile), template)
        manifest.getJSONArray("templates").put(JSONObject().put("version", version).put("file", relativeFile))
        manifest.put("defaultVersion", version)
        atomicWrite(File(root, "manifest.json"), manifest)
        return response(201, JSONObject().put("manifest", manifest).put("template", template))
    }

    private fun response(status: Int, body: JSONObject) = JSONObject().put("status", status).put("body", body)
    private fun readManifest() = JSONObject(File(root, "manifest.json").readText())
    private fun readCatalog(manifest: JSONObject): JSONArray {
        val templates = JSONArray()
        val entries = manifest.optJSONArray("templates") ?: JSONArray()
        for (index in 0 until entries.length()) {
            val entry = entries.getJSONObject(index)
            val path = entry.optString("file")
            if (Regex("^custom/[A-Za-z0-9.-]+\\.json$").matches(path)) {
                val file = File(root, path)
                if (file.exists()) templates.put(JSONObject(file.readText()))
            }
        }
        return templates
    }

    private fun ensureInitialStore() {
        if (File(root, "manifest.json").exists()) return
        root.mkdirs()
        fun copyAsset(path: String, target: File) {
            val children = context.assets.list(path) ?: emptyArray()
            if (children.isNotEmpty()) {
                target.mkdirs()
                children.forEach { copyAsset("$path/$it", File(target, it)) }
            } else {
                target.parentFile?.mkdirs()
                context.assets.open(path).use { input -> target.outputStream().use { input.copyTo(it) } }
            }
        }
        try { copyAsset("public/ad-templates", root) }
        catch (_: Exception) {
            atomicWrite(File(root, "manifest.json"), JSONObject().put("schema", "sitefoundry-ad-templates/v1").put("defaultVersion", "v1.0.2.1").put("templates", JSONArray()))
        }
    }

    private fun atomicWrite(file: File, value: JSONObject) {
        file.parentFile?.mkdirs()
        val atomic = AtomicFile(file)
        val output = atomic.startWrite()
        try { output.write((value.toString(2) + "\n").toByteArray(Charsets.UTF_8)); atomic.finishWrite(output) }
        catch (error: Exception) { atomic.failWrite(output); throw error }
    }
}
