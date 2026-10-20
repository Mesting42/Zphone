package com.sitefoundry.workbench

import android.content.Context
import android.util.Log
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Subprocess transport only. Project parsing, preparation and build policy live
 * in the shared JavaScript manager; UI and SAF code never implement them again.
 */
class NativeRuntimeClient private constructor(private val context: Context) {
    companion object {
        @Volatile private var instance: NativeRuntimeClient? = null
        /** One manager owns private projects for the application's whole lifetime. */
        fun get(context: Context): NativeRuntimeClient = instance ?: synchronized(this) {
            instance ?: NativeRuntimeClient(context.applicationContext).also { instance = it }
        }
    }
    private var process: Process? = null
    private val pending = ConcurrentHashMap<String, CompletableFuture<JSONObject>>()
    private val runtimeDirectory = File(context.filesDir, "sitefoundry/runtime")
    val dataDirectory = File(context.filesDir, "sitefoundry")

    @Synchronized private fun start() {
        if (process?.isAlive == true) return
        val nativeDirectory = File(context.applicationInfo.nativeLibraryDir)
        val executable = File(nativeDirectory, "libsitefoundrynode.so")
        check(executable.canExecute()) { "本地构建运行时不可执行，请重新安装完整安装包。" }
        // Assets carry no user state. Copy on each app version upgrade; dependencies
        // and projects live in a separate data directory and survive upgrades.
        val version = context.assets.open("build-runtime-fingerprint.txt").bufferedReader().use { it.readText().trim() }
        val marker = File(runtimeDirectory, ".installed-version")
        if (!marker.exists() || marker.readText() != version) {
            RuntimeInstallation.replace(runtimeDirectory, version) { staged -> copyAssets("build-runtime", staged) }
        }
        val temporary = File(context.cacheDir, "runtime-tmp").apply { mkdirs() }
        val runtimeHome = File(context.filesDir, "runtime-home").apply { mkdirs() }
        dataDirectory.mkdirs()
        val runtimeBin = File(context.filesDir, "runtime-bin").apply { mkdirs() }
        val nodeLink = File(runtimeBin, "node")
        // APK updates may move nativeLibraryDir. readlink also detects dangling
        // links, for which File.exists() incorrectly reports no directory entry.
        val currentTarget = try { Os.readlink(nodeLink.absolutePath) }
        catch (error: ErrnoException) {
            if (error.errno == OsConstants.ENOENT) null
            else if (error.errno == OsConstants.EINVAL) throw IllegalStateException("本地 Node 入口被其他文件占用，请先保留该文件后处理。", error)
            else throw error
        }
        if (currentTarget != executable.absolutePath) {
            val replacement = File(runtimeBin, ".node-update-${UUID.randomUUID()}")
            Os.symlink(executable.absolutePath, replacement.absolutePath)
            try { Os.rename(replacement.absolutePath, nodeLink.absolutePath) }
            finally { Files.deleteIfExists(replacement.toPath()) }
        }
        val builder = ProcessBuilder(executable.absolutePath, File(runtimeDirectory, "worker.mjs").absolutePath)
            .directory(runtimeDirectory)
        builder.environment().apply {
            put("HOME", runtimeHome.absolutePath)
            put("TMPDIR", temporary.absolutePath)
            put("LD_LIBRARY_PATH", nativeDirectory.absolutePath)
            put("PATH", "${runtimeBin.absolutePath}:${nativeDirectory.absolutePath}:/system/bin")
            put("SITEFOUNDRY_DATA_DIR", dataDirectory.absolutePath)
            put("SITEFOUNDRY_NPM_CLI", File(runtimeDirectory, "vendor/npm/bin/npm-cli.js").absolutePath)
        }
        process = builder.start()
        val child = process!!
        Thread({
            try {
                child.inputStream.bufferedReader().useLines { lines ->
                    lines.forEach { line ->
                        try {
                            val reply = JSONObject(line)
                            val id = reply.optString("id")
                            val waiter = pending.remove(id)
                            if (waiter != null) {
                                val error = reply.optJSONObject("error")
                                if (error != null) waiter.completeExceptionally(IllegalStateException(error.optString("message")))
                                else waiter.complete(reply.optJSONObject("result") ?: JSONObject().put("projects", reply.opt("result")))
                            }
                        } catch (_: Exception) { Log.i("SiteFoundryNode", line.take(2000)) }
                    }
                }
            } finally {
                pending.values.forEach { it.completeExceptionally(IllegalStateException("本机构建进程已停止。")) }
                pending.clear()
            }
        }, "sitefoundry-node-replies").start()
        Thread({ child.errorStream.bufferedReader().useLines { it.forEach { line -> Log.i("SiteFoundryNode", line.take(2000)) } } }, "sitefoundry-node-logs").start()
    }

    fun request(method: String, params: JSONObject = JSONObject()): JSONObject {
        start()
        val id = UUID.randomUUID().toString()
        val result = CompletableFuture<JSONObject>()
        pending[id] = result
        synchronized(this) {
            val payload = JSONObject().put("id", id).put("method", method).put("params", params)
            process!!.outputStream.write((payload.toString() + "\n").toByteArray(Charsets.UTF_8))
            process!!.outputStream.flush()
        }
        // Preparation/build calls may perform substantial work. Cancellation is
        // a separate request and is never queued behind a synchronous build call.
        try { return result.get(45, TimeUnit.MINUTES) }
        finally { pending.remove(id) }
    }

    private fun copyAssets(path: String, destination: File) {
        val children = context.assets.list(path) ?: emptyArray()
        if (children.isNotEmpty()) {
            destination.mkdirs()
            children.forEach { copyAssets("$path/$it", File(destination, it)) }
        } else {
            destination.parentFile?.mkdirs()
            context.assets.open(path).use { input -> destination.outputStream().use { input.copyTo(it) } }
        }
    }
}
