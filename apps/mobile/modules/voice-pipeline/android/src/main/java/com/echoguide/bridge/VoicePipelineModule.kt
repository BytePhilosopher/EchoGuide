package com.echoguide.bridge

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.ActivityNotFoundException
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.echoguide.executor.AccessibilityExecutorService
import com.echoguide.pipeline.ServiceStateStore
import com.echoguide.pipeline.VoicePipelineForegroundService
import com.echoguide.pipeline.VoicePipelineService
import com.echoguide.speech.PhraseCatalog
import com.echoguide.speech.SpeechSynthesizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VoicePipelineModule : Module() {
  private var synthesizer: SpeechSynthesizer? = null
  private var store: ServiceStateStore? = null

  override fun definition() = ModuleDefinition {
    Name("VoicePipeline")

    Events("onLastCommandOutcome", "onPipelineState")

    OnStartObserving {
      pipeline()?.apply {
        outcomeSink = { outcome -> sendEvent("onLastCommandOutcome", outcome) }
        stateSink = { snapshot -> sendEvent("onPipelineState", snapshot) }
      }
    }

    OnStopObserving {
      pipeline()?.apply {
        outcomeSink = null
        stateSink = null
      }
    }

    // A microphone foreground service started without the permission throws on Android 14.
    Function("startListening") {
      val context = appContext.reactContext ?: return@Function false
      if (!granted(context, Manifest.permission.RECORD_AUDIO)) return@Function false
      VoicePipelineForegroundService.start(context)
      true
    }

    Function("stopListening") {
      pipeline()?.stopPipeline()
      appContext.reactContext?.let { VoicePipelineForegroundService.stop(it) }
    }

    Function("triggerListening") {
      pipeline()?.triggerOnce()
    }

    AsyncFunction("confirmPending") { confirmed: Boolean ->
      pipeline()?.answerConfirmation(confirmed)
    }

    AsyncFunction("setWakeWord") { phrase: String ->
      pipeline()?.setWakeWord(phrase)
      pipeline()?.wakeWord() ?: phrase
    }

    AsyncFunction("registerDevice") {
      pipeline()?.registerDevice()
    }

    AsyncFunction("prepareWakeWord") {
      pipeline()?.prepareWakeWord()
    }

    AsyncFunction("openAccessibilitySettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { context.startActivity(intent) }.isSuccess
    }

    AsyncFunction("openVoiceSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent("com.android.settings.TTS_SETTINGS")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (_: ActivityNotFoundException) {
        runCatching {
          context.startActivity(
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
          )
        }.isSuccess
      }
    }

    AsyncFunction("setLanguage") { languageCode: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      PhraseCatalog.refresh(context, languageCode)
      speech(context).setLanguage(languageCode)
      store(context).language = PhraseCatalog.language
      pipeline()?.refreshPhrases(PhraseCatalog.language)
      true
    }

    AsyncFunction("setConsent") { granted: Boolean ->
      pipeline()?.setConsent(granted) ?: false
    }

    AsyncFunction("revokeConsent") {
      val isRecorded = pipeline()?.setConsent(false) ?: false
      pipeline()?.stopPipeline()
      appContext.reactContext?.let { VoicePipelineForegroundService.stop(it) }
      isRecorded
    }

    AsyncFunction("setAudioRetention") { optIn: Boolean ->
      pipeline()?.recordConsent(VoicePipelineService.AUDIO_RETENTION_SCOPE, optIn) ?: false
    }

    AsyncFunction("getEntitlement") {
      pipeline()?.entitlement()?.let {
        mapOf(
          "isEnforced" to it.isEnforced,
          "state" to it.state,
          "renewsAt" to it.renewsAt,
          "commandQuota" to it.commandQuota,
          "commandsUsed" to it.commandsUsed,
        )
      }
    }

    AsyncFunction("deleteUserData") {
      val isDeleted = pipeline()?.deleteUserData() ?: false
      if (isDeleted) appContext.reactContext?.let { VoicePipelineForegroundService.stop(it) }
      isDeleted
    }

    AsyncFunction("getServiceState") {
      val context = appContext.reactContext
      val snapshot = pipeline()?.snapshot()
      mapOf(
        "isWakeWordActive" to (snapshot?.isListening ?: false),
        "isWakeWordReady" to (snapshot?.isWakeWordReady ?: false),
        "isAccessibilityEnabled" to (context?.let { isExecutorEnabled(it) } ?: false),
        "hasConsent" to (pipeline()?.hasConsent() ?: false),
        "hasVoice" to (pipeline()?.hasVoiceForCurrentLanguage() ?: false),
        "installId" to (pipeline()?.installId() ?: ""),
        "currentLanguage" to (snapshot?.language ?: PhraseCatalog.language),
        "wakeWord" to (pipeline()?.wakeWord() ?: "echo"),
        "modelProgress" to pipeline()?.modelProgress()?.toDouble(),
      )
    }

    AsyncFunction("getPermissionStatus") {
      val context = appContext.reactContext
      mapOf(
        "microphoneGranted" to (context?.let { granted(it, Manifest.permission.RECORD_AUDIO) } ?: false),
        "accessibilityGranted" to (context?.let { isExecutorEnabled(it) } ?: false),
        "overlayGranted" to (context?.let { granted(it, Manifest.permission.SYSTEM_ALERT_WINDOW) } ?: false),
      )
    }
  }

  private fun pipeline(): VoicePipelineService? =
    appContext.reactContext?.let { VoicePipelineService.get(it) }

  private fun speech(context: Context): SpeechSynthesizer =
    synthesizer ?: SpeechSynthesizer(context).also { synthesizer = it }

  private fun store(context: Context): ServiceStateStore =
    store ?: ServiceStateStore(context).also { store = it }

  private fun granted(context: Context, permission: String): Boolean =
    context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

  private fun isExecutorEnabled(context: Context): Boolean {
    if (AccessibilityExecutorService.instance != null) return true
    val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
      ?: return false
    return manager
      .getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      .any { it.resolveInfo.serviceInfo.name == AccessibilityExecutorService::class.java.name }
  }
}
