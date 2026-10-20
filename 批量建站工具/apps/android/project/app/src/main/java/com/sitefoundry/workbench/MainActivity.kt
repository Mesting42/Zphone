package com.sitefoundry.workbench

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.webkit.WebViewFeature
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient

/** Single responsive activity for phones, tablets, rotation and multi-window. */
class MainActivity : BridgeActivity() {
    private var resolvingBack = false
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SiteFoundryNativePlugin::class.java)
        super.onCreate(savedInstanceState)

        // A current WebView supplies a main-frame/origin-scoped bridge. The legacy
        // addJavascriptInterface bridge is exposed to imported sandboxed frames;
        // stop that fallback instead of granting device access to uploaded sites.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            bridge.webView.removeJavascriptInterface("androidBridge")
            val notice = TextView(this).apply {
                text = "请先更新 Android System WebView，再重新打开 SiteFoundry。更新后可离线使用。"
                textSize = 18f
                setPadding(32, 64, 32, 32)
            }
            setContentView(notice)
            return
        }
        bridge.webView.webChromeClient = WorkbenchFileChooser(bridge)
        bridge.setWebViewClient(object : BridgeWebViewClient(bridge) {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val response = super.shouldInterceptRequest(view, request) ?: return null
                val uri = request.url
                // Opaque-origin sandbox previews may consume the bundled font
                // catalog without opening access to native APIs or general assets.
                if (uri.scheme == "https" && uri.host == "localhost" && uri.path?.startsWith("/fonts/") == true) {
                    val headers = HashMap(response.responseHeaders ?: emptyMap())
                    headers["Access-Control-Allow-Origin"] = "*"
                    headers["Cross-Origin-Resource-Policy"] = "cross-origin"
                    response.responseHeaders = headers
                }
                if (uri.path?.endsWith(".wasm") == true) response.mimeType = "application/wasm"
                return response
            }
        })
        // Close the workbench's active modal before changing pages or leaving the
        // application. This callback also supports Android 10's hardware back key.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (resolvingBack) return
                resolvingBack = true
                bridge.webView.evaluateJavascript("Boolean(window.SiteFoundryPlatform && window.SiteFoundryPlatform.handleBack && window.SiteFoundryPlatform.handleBack())") { handled ->
                    resolvingBack = false
                    if (handled != "true") {
                        if (bridge.webView.canGoBack()) bridge.webView.goBack() else finish()
                    }
                }
            }
        })
    }
}
