package com.echoguide.pipeline

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import com.echoguide.voice.R

class VoicePipelineForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      VoicePipelineService.get(this).stopPipeline()
      stopSelf()
      return START_NOT_STICKY
    }

    startForegroundCompat()
    VoicePipelineService.get(this).startWakeWordLoop()
    return START_STICKY
  }

  override fun onDestroy() {
    VoicePipelineService.get(this).stopPipeline()
    super.onDestroy()
  }

  private fun startForegroundCompat() {
    createChannel()
    val stop = PendingIntent.getService(
      this,
      0,
      Intent(this, VoicePipelineForegroundService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE,
    )
    val notification: Notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(getString(R.string.pipeline_notification_title))
      .setContentText(getString(R.string.pipeline_notification_body))
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setOngoing(true)
      .addAction(
        Notification.Action.Builder(
          null,
          getString(R.string.pipeline_notification_stop),
          stop,
        ).build(),
      )
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun createChannel() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.pipeline_notification_channel),
        NotificationManager.IMPORTANCE_LOW,
      ),
    )
  }

  companion object {
    private const val CHANNEL_ID = "echoguide_voice_pipeline"
    private const val NOTIFICATION_ID = 4711
    const val ACTION_STOP = "com.echoguide.pipeline.STOP"

    fun start(context: Context) {
      val intent = Intent(context, VoicePipelineForegroundService::class.java)
      context.startForegroundService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, VoicePipelineForegroundService::class.java))
    }
  }
}
