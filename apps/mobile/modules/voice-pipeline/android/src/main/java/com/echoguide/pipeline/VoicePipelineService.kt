package com.echoguide.pipeline

import android.content.Context
import com.echoguide.executor.AccessibilityExecutorService
import com.echoguide.executor.PlanValidator
import com.echoguide.network.AccountApi
import com.echoguide.network.ActionPlan
import com.echoguide.network.AuthApi
import com.echoguide.network.CommandApi
import com.echoguide.network.CommandResult
import com.echoguide.network.CommandStatus
import com.echoguide.network.Entitlement
import com.echoguide.network.ScreenContext
import com.echoguide.network.SessionManager
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
import java.util.concurrent.LinkedBlockingQueue
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
  private val account = AccountApi()
  private val sessions = SessionManager(
    api = AuthApi(),
    store = state,
    model = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}",
    locale = { state.language },
  )
  private val capture = AudioCapture()
  private val synthesizer = SpeechSynthesizer(context)
  private val machine = CommandStateMachine()
  private val installer = VoskModelInstaller(
    modelRoot = File(context.filesDir, "models"),
    openModel = { context.assets.open(MODEL_ASSET) },
    modelBytes = runCatching { context.assets.openFd(MODEL_ASSET).use { it.length } }.getOrDefault(-1L),
  )

  /** 0..1 while the bundled model is being unpacked, null otherwise. */
  @Volatile
  private var modelProgress: Float? = null
  private var detector = WakeWordDetector(installer.modelDirectory, state.wakeWord)

  // The microphone and the command in flight. The wake loop holds this thread for as long as it
  // listens, so nothing that must run meanwhile may be queued on it.
  private val worker = Executors.newSingleThreadExecutor()
  private val background = Executors.newSingleThreadExecutor()
  private val answers = LinkedBlockingQueue<Boolean>()
  private val timers: ScheduledExecutorService = ScheduledThreadPoolExecutor(1)
  private val isBusy = AtomicBoolean(false)
  private val wakeLoopRunning = AtomicBoolean(false)

  @Volatile
  private var pendingGrant: String? = null

  init {
    AccessibilityExecutorService.onShortcut = { triggerOnce() }
  }

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

  /** Downloads the wake word model. Listening itself starts only inside the foreground service. */
  fun prepareWakeWord() {
    background.execute {
      if (installer.isInstalled()) return@execute publishState()
      var lastPercent = -1
      modelProgress = 0f
      publishState()
      installer.install { fraction ->
        val percent = (fraction * 100).toInt()
        if (percent == lastPercent) return@install
        lastPercent = percent
        modelProgress = fraction
        publishState()
      }
      modelProgress = null
      publishState()
    }
  }

  fun modelProgress(): Float? = modelProgress

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
    answers.offer(false)
    publishState()
  }

  fun stopWakeWord() {
    wakeLoopRunning.set(false)
    state.isWakeWordEnabled = false
  }

  /** Applies on the device at once; the return value is whether the server recorded it too. */
  fun setConsent(granted: Boolean): Boolean {
    state.hasConsent = granted
    if (!granted) {
      stopWakeWord()
      capture.cancel()
    }
    publishState()
    return recordConsent(VOICE_CONTROL_SCOPE, granted)
  }

  fun recordConsent(scope: String, granted: Boolean): Boolean {
    val credentials = sessions.credentials() ?: return false
    return account.recordConsent(credentials, scope, granted)
  }

  fun entitlement(): Entitlement? = sessions.credentials()?.let(account::entitlement)

  /** The device forgets the account only once the server has accepted the deletion. */
  fun deleteUserData(): Boolean {
    val credentials = sessions.credentials() ?: return false
    if (!account.deleteUserData(credentials)) return false
    stopWakeWord()
    capture.cancel()
    answers.offer(false)
    state.forgetAccount()
    publishState()
    return true
  }

  fun hasConsent(): Boolean = state.hasConsent

  fun hasVoiceForCurrentLanguage(): Boolean = synthesizer.hasVoiceFor(state.language)

  fun installId(): String = state.installId

  fun setWakeWord(phrase: String) {
    val next = phrase.trim().lowercase()
    if (next.isEmpty() || next == state.wakeWord) return
    val wasRunning = wakeLoopRunning.get()
    stopWakeWord()
    capture.cancel()
    state.wakeWord = next
    detector.close()
    detector = WakeWordDetector(installer.modelDirectory, next)
    if (wasRunning) startWakeWordLoop()
  }

  fun wakeWord(): String = state.wakeWord

  fun registerDevice() {
    background.execute {
      state.isRegistered = sessions.credentials() != null
    }
  }

  fun refreshPhrases(language: String) {
    background.execute {
      api.fetchPhrases(language)?.let { PhraseCatalog.applyRemote(it) }
    }
  }

  fun answerConfirmation(confirmed: Boolean) {
    answers.offer(confirmed)
  }

  /** Waits on the command's own thread for the user's yes or no. No answer in time is a no. */
  private fun awaitAnswer(): Boolean {
    answers.clear()
    publishState()
    return try {
      answers.poll(ANSWER_TIMEOUT_SECONDS, TimeUnit.SECONDS) == true
    } catch (_: InterruptedException) {
      false
    }
  }

  private fun isGrantedNow(packageName: String): Boolean {
    pendingGrant = packageName
    machine.on(CommandStateMachine.Event.GrantRequired)
    synthesizer.playPhrase(GRANT_APP_PHRASE)
    val confirmed = awaitAnswer()
    pendingGrant = null

    if (!confirmed) {
      speak(machine.on(CommandStateMachine.Event.UserDeclined).speak)
      return false
    }
    val isRecorded =
      sessions.credentials()?.let { account.recordAppGrant(it, packageName, granted = true) } == true
    if (!isRecorded) {
      speak(machine.on(CommandStateMachine.Event.NetworkFailed(SpeakCode.ERR_NETWORK)).speak)
      return false
    }
    state.grantedApps = state.grantedApps + packageName
    machine.on(CommandStateMachine.Event.WakeWord)
    publishState()
    return true
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

    // The server refuses plans for apps the user has not allowed, so ask before recording.
    if (foreground.isNotEmpty() && foreground !in state.grantedApps && !isGrantedNow(foreground)) {
      publishState()
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
        val submit = { credentials: com.echoguide.network.Credentials? ->
          api.submit(
            audio = recorded.pcm,
            durationMs = recorded.durationMs.coerceIn(MIN_UPLOAD_MS, MAX_UPLOAD_MS),
            language = state.language,
            screen = ScreenContext(foreground, screen?.summary.orEmpty()),
            installId = credentials?.installId ?: state.installId,
            requestId = requestId,
            sessionToken = credentials?.sessionToken,
          )
        }
        val credentials = sessions.credentials()
        var result = submit(credentials)
        // A rejected session never ran the command, so one retry with a fresh session is safe.
        if (result is CommandResult.Failed && result.unauthorized && credentials != null) {
          sessions.invalidate(credentials.sessionToken)
          result = submit(sessions.credentials())
        }
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

        // ponytail: matches the server's reason text; give the response a reason code if it grows.
        // The server no longer holds this grant (new account, revoked elsewhere): ask again next time.
        if (response.status == CommandStatus.REJECTED && response.repromptReason == APP_NOT_AUTHORIZED) {
          state.grantedApps = state.grantedApps - foreground
        }

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
          CommandStateMachine.State.CONFIRMING ->
            if (awaitAnswer()) {
              machine.on(CommandStateMachine.Event.UserConfirmed)
              publishState()
              val executeStarted = System.currentTimeMillis()
              val success = runPlan(transition.plan)
              finish(
                success, started, requestId,
                stageTimings + ("execute" to elapsed(executeStarted)),
              )
            } else {
              speak(machine.on(CommandStateMachine.Event.UserDeclined).speak)
              publish(machine.telemetryOutcome(), elapsed(started), requestId, stageTimings)
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
    background.execute {
      val credentials = sessions.credentials()
      telemetry.emit(outcome, durationMs, stageTimings, credentials?.installId ?: state.installId, requestId, credentials?.sessionToken)
    }
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
        "grantFor" to pendingGrant?.let(::appLabel),
        "modelProgress" to modelProgress?.toDouble(),
      ),
    )
  }

  private fun appLabel(packageName: String): String = runCatching {
    val manager = context.packageManager
    manager.getApplicationLabel(manager.getApplicationInfo(packageName, 0)).toString()
  }.getOrDefault(packageName)

  private fun elapsed(started: Long): Long = System.currentTimeMillis() - started

  private fun isoTimestamp(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
      .apply { timeZone = TimeZone.getTimeZone("UTC") }
      .format(System.currentTimeMillis())

  companion object {
    private const val STILL_WORKING_AFTER_MS = 3_000L
    private const val MIN_UPLOAD_MS = 400
    private const val MAX_UPLOAD_MS = 15_000
    private const val ANSWER_TIMEOUT_SECONDS = 30L
    private const val MODEL_ASSET = "vosk-model.zip"
    private const val GRANT_APP_PHRASE = "GRANT_APP"
    private const val APP_NOT_AUTHORIZED = "App not authorized for voice control"
    const val VOICE_CONTROL_SCOPE = "voice_control"
    const val AUDIO_RETENTION_SCOPE = "audio_retention"

    @Volatile
    private var instance: VoicePipelineService? = null

    fun get(context: Context): VoicePipelineService =
      instance ?: synchronized(this) {
        instance ?: VoicePipelineService(context.applicationContext).also { instance = it }
      }
  }
}
