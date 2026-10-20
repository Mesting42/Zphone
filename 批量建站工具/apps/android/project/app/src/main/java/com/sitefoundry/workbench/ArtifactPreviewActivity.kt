package com.sitefoundry.workbench

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import java.io.ByteArrayInputStream
import java.io.File

/** Built output preview in a WebView with no Capacitor/device interfaces. */
class ArtifactPreviewActivity : AppCompatActivity() {
    private lateinit var web: WebView
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val root = File(intent.getStringExtra("artifactRoot") ?: "").canonicalFile
        val privateRoot = File(filesDir, "sitefoundry").canonicalFile
        if (!root.path.startsWith(privateRoot.path + File.separator) || !root.isDirectory) { finish(); return }
        val shell = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; fitsSystemWindows = true; setBackgroundColor(0xfff6f5f1.toInt()) }
        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(16, 8, 16, 8) }
        bar.addView(TextView(this).apply { text = "SiteFoundry · 构建预览"; textSize = 16f }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(Button(this).apply { text = "返回"; setOnClickListener { finish() } })
        shell.addView(bar)
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // No JavascriptInterface or postMessage listener is registered here.
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    if (request.url.scheme != "https" || request.url.host != "sitefoundry.preview") return null
                    val path = request.url.path ?: "/"
                    var file = File(root, path.removePrefix("/")).canonicalFile
                    if (file.isDirectory) file = File(file, "index.html")
                    if (!file.path.startsWith(root.path + File.separator) || !file.isFile) {
                        return WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream("文件不存在".toByteArray()))
                    }
                    val extension = file.extension.lowercase()
                    val mime = when (extension) {
                        "js", "mjs" -> "application/javascript"
                        "wasm" -> "application/wasm"
                        "woff2" -> "font/woff2"
                        "woff" -> "font/woff"
                        "json" -> "application/json"
                        else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
                    }
                    val headers = mutableMapOf("Cache-Control" to "no-cache", "X-Content-Type-Options" to "nosniff")
                    if (extension in listOf("woff", "woff2", "ttf", "otf")) headers["Access-Control-Allow-Origin"] = "*"
                    return WebResourceResponse(mime, if (mime.startsWith("text/") || extension in listOf("js", "mjs", "json")) "UTF-8" else null, 200, "OK", headers, file.inputStream())
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.scheme == "https" && request.url.host == "sitefoundry.preview") return false
                    if (request.hasGesture() && request.url.scheme in listOf("https", "http")) {
                        try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (_: Exception) { }
                    }
                    return true
                }
            }
        }
        shell.addView(web, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(shell)
        if (state != null) web.restoreState(state) else web.loadUrl("https://sitefoundry.preview/")
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
    }
    override fun onSaveInstanceState(outState: Bundle) { web.saveState(outState); super.onSaveInstanceState(outState) }
    override fun onDestroy() { web.destroy(); super.onDestroy() }
}
