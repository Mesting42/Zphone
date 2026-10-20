package com.sitefoundry.workbench

import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import com.getcapacitor.Bridge
import com.getcapacitor.BridgeWebChromeClient

/**
 * Android document providers disagree on RAR/7Z/JSON MIME types, and Capacitor
 * maps extension-only accept lists through the device's MimeTypeMap. A valid
 * archive can consequently disappear before the app gets a chance to read it.
 * Use an unrestricted document picker for declared document extensions; the
 * workbench parsers still enforce the format/content contract after selection.
 * Media capture keeps the original Capacitor behavior and permission handling.
 */
class WorkbenchFileChooser(bridge: Bridge) : BridgeWebChromeClient(bridge) {
    override fun onShowFileChooser(
        webView: WebView,
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams
    ): Boolean {
        val documentInput = params.acceptTypes.flatMap { it.split(',') }.any {
            it.trim().lowercase() in setOf(
                ".json", ".zip", ".rar", ".7z", ".tar.gz", ".tgz", ".txt", ".js",
                "application/json", "application/zip", "application/x-zip-compressed",
                "application/vnd.rar", "application/x-rar", "application/x-rar-compressed",
                "application/x-7z-compressed", "application/gzip", "application/x-tar",
                "application/javascript", "text/javascript", "text/plain"
            )
        }
        if (!documentInput || params.isCaptureEnabled) return super.onShowFileChooser(webView, callback, params)
        val compatible = object : WebChromeClient.FileChooserParams() {
            override fun getMode() = params.mode
            override fun getAcceptTypes() = arrayOf("*/*")
            override fun isCaptureEnabled() = false
            override fun getTitle() = params.title
            override fun getFilenameHint() = params.filenameHint
            override fun createIntent(): Intent = params.createIntent().apply {
                type = "*/*"
                removeExtra(Intent.EXTRA_MIME_TYPES)
            }
        }
        return super.onShowFileChooser(webView, callback, compatible)
    }
}
