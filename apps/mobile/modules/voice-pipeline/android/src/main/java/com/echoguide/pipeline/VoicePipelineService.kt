package com.echoguide.pipeline

import android.content.Context
import com.echoguide.executor.AccessibilityExecutorService
import com.echoguide.executor.PlanValidator
import com.echoguide.network.ActionPlan
import com.echoguide.network.CommandApi
import com.echoguide.network.CommandResult
import com.echoguide.network.ScreenContext
import com.echoguide.network.SpeakCode
import com.echoguide.network.TelemetryClient
import com.echoguide.speech.PhraseCatalog
import com.echoguide.speech.SpeechSynthesizer
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class VoicePipelineService private constructor(private val context: Context) {
  data class Snapshot(
    val isListening: Boolean,
    val isWakeWordReady: Boolean,
    val isExecutorEnabled: Boolean,
    val language: String,
  )

  private val state = ServiceStateStore(context)
  private val api = CommandApi()
  private val telemetry = TelemetryClient()
  private val capture = AudioCapture()
  private val synthesizer = SpeechSynthesizer(context)
  private val machine = CommandStateMachine()
  private val installer = VoskModelInstaller(File(context.filesDir, "models"))
  private val detector = WakeWordDetector(installer.modelDirectory)

  private val worker = Executors.newSingleThreadExecutor()
  private val timers: ScheduledExecutorService = ScheduledThreadPoolExecutor(1)
  private val isBusy = AtomicBoolean(false)
  private val wakeLoopRunning = AtomicBoolean(false)

  private var pendingPlan: ActionPlan? = null

  var outcomeSink: ((Map<String, Any?>) -> Unit)? = null
  var stateSink: ((Map<String, Any?>) -> Unit)? = null

  val isRunning: Boolean get() = isBusy.get() || wakeLoopRunning.get()
  val isWakeWordReady: Boolean get() = installer.isInstalled()
  val isExecutorEnabled: Boolean get() = AccessibilityExecutorService.instance != null

  fun snapshot(): Snapshot = Snapshot(
    isListening = isRunning,
    isWakeWordReady = isWakeWordReady,
    isExecutorEnabled = isExecutorEnabled,
    language = state.language,
  )

  fun prepareWakeWord() {
    worker.execute {
      if (installer.install()) startWakeWordLoop()
      publishState()
    }
  }

  fun startWakeWordLoop() {
    if (!state.hasConsent) return
    if (!installer.isInstalled() || !detector.prepare()) {
      publishState()
      return
    }
    if (!wakeLoopRunning.compareAndSet(false, true)) return
    state.isWakeWordEnabled = true
    worker.execute {
      try {
        while (wakeLoopRunning.get()) {
          if (!capture.awaitWakeWord(detector)) break
          runCommand()
        }
      } finally {
        wakeLoopRunning.set(false)
        publishState()
      }
    }
  }

  fun triggerOnce() {
    if (!state.hasConsent) return
    if (!isBusy.compareAndSet(false, true)) return
    worker.execute {
      try {
        runCommand()
      } finally {
        isBusy.set(false)
        publishState()
      }
    }
  }

  fun stopPipeline() {
    wakeLoopRunning.set(false)
    capture.cancel()
    publishState()
  }

  fun stopWakeWord() {
    wakeLoopRunning.set(false)
    state.isWakeWordEnabled = false
  }

  fun setConsent(granted: Boolean) {
    state.hasConsent = granted
    if (!granted) {
      stopWakeWord()
      capture.cancel()
    }
    publishState()
  }

  fun hasConsent(): Boolean = state.hasConsent

  fun hasVoiceForCurrentLanguage(): Boolean = synthesizer.hasVoiceFor(state.language)

  fun installId(): String = state.installId

  fun refreshPhrases(language: String) {
    worker.execute {
      api.fetchPhrases(language)?.let { PhraseCatalog.applyRemote(it) }
    }
  }

  fun answerConfirmation(confirmed: Boolean) {
    val plan = pendingPlan ?: return
    pendingPlan = null
    worker.execute {
      val requestId = UUID.randomUUID().toString()
      val started = System.currentTimeMillis()
      if (confirmed) {
        machine.on(CommandStateMachine.Event.UserConfirmed)
        finish(runPlan(plan), started, requestId)
      } else {
        speak(machine.on(CommandStateMachine.Event.UserDeclined).speak)
        publish(machine.telemetryOutcome(), elapsed(started), requestId)
      }
    }
  }

  private fun runCommand() {
    machine.reset()
    val requestId = UUID.randomUUID().toString()
    val started = System.currentTimeMillis()
    machine.on(CommandStateMachine.Event.WakeWord)
    publishState()

    if (!state.hasConsent) {
      stopWakeWord()
      publish(machine.telemetryOutcome(), elapsed(started), requestId)
      return
    }

    val executor = AccessibilityExecutorService.instance
    val screen = executor?.captureScreen()
    val foreground = executor?.foregroundPackage().orEmpty()

    if (screen?.hasSensitiveField == true) {
      machine.on(CommandStateMachine.Event.BufferTooShort)
      publish(machine.telemetryOutcome(), elapsed(started), requestId)
      return
    }

    when (val recorded = capture.captureUtterance(VoiceActivityDetector())) {
      is AudioCapture.Result.TooShort, is AudioCapture.Result.Cancelled -> {
        machine.on(CommandStateMachine.Event.BufferTooShort)
        publish(machine.telemetryOutcome(), elapsed(started), requestId)
      }

      is AudioCapture.Result.Unavailable -> {
        speak(machine.on(CommandStateMachine.Event.NetworkFailed(SpeakCode.ERR_NETWORK)).speak)
        publish(machine.telemetryOutcome(), elapsed(started), requestId)
      }

      is AudioCapture.Result.Utterance -> {
        speak(machine.on(CommandStateMachine.Event.BufferClosed(recorded.durationMs)).speak)
        val captureMs = elapsed(started)
        val uploadStarted = System.currentTimeMillis()
        val stillWorking = timers.schedule(
          { synthesizer.playPhrase(SpeakCode.STILL_WORKING.name) },
          STILL_WORKING_AFTER_MS,
          TimeUnit.MILLISECONDS,
        )
        val result = api.submit(
          audio = recorded.pcm,
          durationMs = recorded.durationMs.coerceIn(MIN_UPLOAD_MS, MAX_UPLOAD_MS),
          language = state.language,
          screen = ScreenContext(foreground, screen?.summary.orEmpty()),
          installId = state.installId,
          requestId = requestId,
        )
        stillWorking.cancel(false)
        handleServer(
          result,
          foreground,
          started,
          requestId,
          mapOf("capture" to captureMs, "upload" to elapsed(uploadStarted)),
        )
      }
    }
  }

  private fun handleServer(
    result: CommandResult,
    foreground: String,
    started: Long,
    requestId: String,
    stageTimings: Map<String, Long>,
  ) {
    when (result) {
      is CommandResult.Failed -> {
        speak(machine.on(CommandStateMachine.Event.NetworkFailed(result.speakCode)).speak)
        publish(machine.telemetryOutcome(), elapsed(started), requestId, stageTimings)
      }

      is CommandResult.Success -> {
        val response = result.response
        val plan = response.actionPlan

        if (plan != null && !revalidate(plan, foreground)) {
          speak(machine.on(CommandStateMachine.Event.PlanBlockedLocally).speak)
          publish(machine.telemetryOutcome(), elapsed(started), requestId, stageTimings)
          return
        }

        val transition = machine.on(
          CommandStateMachine.Event.ServerReplied(response.status, response.speakCode, plan),
        )
        speak(transition.speak)

        response.speechResponseText?.let { synthesizer.speak(it, state.language) }

        when (transition.state) {
          CommandStateMachine.State.CONFIRMING -> {
            pendingPlan = transition.plan
            publishState()
          }
          CommandStateMachine.State.EXECUTING -> {
            val executeStarted = System.currentTimeMillis()
            val success = runPlan(transition.plan)
            finish(
              success, started, requestId,
              stageTimings + ("execute" to elapsed(executeStarted)),
            )
          }
          else -> publish(machine.telemetryOutcome(), elapsed(started), requestId, stageTimings)
        }
      }
    }
  }

  private fun revalidate(plan: ActionPlan, foreground: String): Boolean {
    val executor = AccessibilityExecutorService.instance ?: return false
    val fresh = executor.captureScreen()
    val verdict = PlanValidator.validate(plan, foreground, fresh.nodeIds)
    return verdict !is PlanValidator.Verdict.Blocked
  }

  private fun runPlan(plan: ActionPlan?): Boolean {
    val executor = AccessibilityExecutorService.instance ?: return false
    val target = plan ?: return false
    return runCatching { executor.execute(target) }.getOrDefault(false)
  }

  private fun finish(
    success: Boolean,
    started: Long,
    requestId: String,
    stageTimings: Map<String, Long> = emptyMap(),
  ) {
    speak(machine.on(CommandStateMachine.Event.ExecutionFinished(success)).speak)
    publish(machine.telemetryOutcome(), elapsed(started), requestId, stageTimings)
  }

  private fun speak(code: SpeakCode?) {
    code ?: return
    synthesizer.playPhrase(code.name)
  }

  private fun publish(
    outcome: String,
    durationMs: Long,
    requestId: String,
    stageTimings: Map<String, Long> = emptyMap(),
  ) {
    outcomeSink?.invoke(
      mapOf(
        "id" to requestId,
        "outcome" to outcome,
        "durationMs" to durationMs,
        "timestamp" to isoTimestamp(),
      ),
    )
    telemetry.emit(outcome, durationMs, stageTimings, state.installId, requestId)
    publishState()
  }

  private fun publishState() {
    val snapshot = snapshot()
    stateSink?.invoke(
      mapOf(
        "state" to machine.state.name,
        "isListening" to snapshot.isListening,
        "wakeWordAvailable" to snapshot.isWakeWordReady,
        "accessibilityEnabled" to snapshot.isExecutorEnabled,
      ),
    )
  }

  private fun elapsed(started: Long): Long = System.currentTimeMillis() - started

  private fun isoTimestamp(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
      .apply { timeZone = TimeZone.getTimeZone("UTC") }
      .format(System.currentTimeMillis())

  companion object {
    private const val STILL_WORKING_AFTER_MS = 3_000L
    private const val MIN_UPLOAD_MS = 400
    private const val MAX_UPLOAD_MS = 15_000

    @Volatile
    private var instance: VoicePipelineService? = null

    fun get(context: Context): VoicePipelineService =
      instance ?: synchronized(this) {
        instance ?: VoicePipelineService(context.applicationContext).also { instance = it }
      }
  }
}
