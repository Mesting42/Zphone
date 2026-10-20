package com.sitefoundry.workbench

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/** Visible foreground lifetime for dependency preparation and local builds. */
class BuildTaskService : Service() {
    private val monitor = Executors.newSingleThreadScheduledExecutor()
    private var monitoring: ScheduledFuture<*>? = null
    @Volatile private var activeTaskId: String? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channel = "sitefoundry-builds"
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(channel, "本地网站构建", NotificationManager.IMPORTANCE_LOW)
        )
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        startForeground(41, Notification.Builder(this, channel).setSmallIcon(R.drawable.ic_stat_sitefoundry)
            .setContentTitle("SiteFoundry 本地构建").setContentText("正在准备依赖或生成网站，请打开应用查看进度。")
            .setContentIntent(open).setOngoing(true).build())
        intent?.getStringExtra("taskId")?.let { taskId ->
            activeTaskId = taskId
            monitoring?.cancel(false)
            monitoring = monitor.scheduleWithFixedDelay({
                try {
                    val result = NativeRuntimeClient.get(this).request("taskStatus", JSONObject().put("taskId", taskId))
                    if (activeTaskId == taskId && result.optString("state") in setOf("succeeded", "failed", "cancelled", "interrupted")) {
                        stopForeground(STOP_FOREGROUND_REMOVE)
                        stopSelf()
                    }
                } catch (_: Exception) {
                    // A stopped runtime persists an interrupted task for the UI
                    // to recover. The foreground service has no remaining work.
                    if (activeTaskId == taskId) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
                }
            }, 1, 3, TimeUnit.SECONDS)
        }
        return START_NOT_STICKY
    }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onTimeout(startId: Int, fgsType: Int) {
        activeTaskId?.let { taskId ->
            monitor.execute { try { NativeRuntimeClient.get(this).request("cancelTask", JSONObject().put("taskId", taskId)) } catch (_: Exception) { } }
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }
    override fun onDestroy() {
        monitoring?.cancel(false)
        monitor.shutdown()
        super.onDestroy()
    }
}
