package com.echoguide.network

import android.util.Base64
import com.echoguide.voice.BuildConfig
import java.io.IOException
import java.io.InterruptedIOException
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.random.Random
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

sealed interface CommandResult {
  data class Success(val response: CommandResponse) : CommandResult
  data class Failed(val speakCode: SpeakCode) : CommandResult
}

class CommandApi(
  private val baseUrl: String = BuildConfig.API_BASE_URL,
  private val breaker: CircuitBreaker = CircuitBreaker(),
  private val client: OkHttpClient = defaultClient(),
  private val sleep: (Long) -> Unit = Thread::sleep,
) {
  fun submit(
    audio: ByteArray,
    durationMs: Int,
    language: String,
    screen: ScreenContext,
    installId: String,
    requestId: String,
  ): CommandResult {
    if (!breaker.allowsRequest()) return CommandResult.Failed(SpeakCode.ERR_NETWORK)

    val idempotencyKey = UUID.randomUUID().toString()
    val body = JSONObject()
      .put("audio_base64", Base64.encodeToString(audio, Base64.NO_WRAP))
      .put("duration_ms", durationMs)
      .put("language", language)
      .put(
        "screen_context",
        JSONObject()
          .put("current_package", screen.currentPackage)
          .put("view_tree_summary", screen.viewTreeSummary),
      )
      .toString()

    val request = Request.Builder()
      .url("$baseUrl/v1/commands")
      .header("X-Install-ID", installId)
      .header("X-Idempotency-Key", idempotencyKey)
      .header("X-Request-ID", requestId)
      .post(body.toRequestBody(JSON))
      .build()

    repeat(MAX_ATTEMPTS) { attemptIndex ->
      when (val outcome = runAttempt(request)) {
        is Attempt.Ok -> {
          breaker.recordSuccess()
          return CommandResult.Success(outcome.response)
        }
        is Attempt.Fatal -> {
          breaker.recordSuccess()
          return CommandResult.Failed(outcome.speakCode)
        }
        is Attempt.Retryable -> {
          breaker.recordFailure()
          if (attemptIndex == MAX_ATTEMPTS - 1) return CommandResult.Failed(outcome.speakCode)
          sleep(backoffMs(attemptIndex))
        }
      }
    }
    return CommandResult.Failed(SpeakCode.ERR_NETWORK)
  }

  fun registerDevice(installId: String, model: String, language: String): Boolean {
    val body = JSONObject()
      .put("install_id", installId)
      .put("model", model)
      .put("locale", language)
      .toString()

    val request = Request.Builder()
      .url("$baseUrl/v1/auth/register-device")
      .post(body.toRequestBody(JSON))
      .build()

    return try {
      client.newCall(request).execute().use { it.isSuccessful }
    } catch (_: IOException) {
      false
    }
  }

  fun fetchPhrases(language: String): Map<String, String>? {
    val request = Request.Builder()
      .url("$baseUrl/v1/phrases?language=$language")
      .get()
      .build()
    return try {
      client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) return null
        val payload = response.body?.string() ?: return null
        val phrases = JSONObject(payload).optJSONObject("phrases") ?: return null
        phrases.keys().asSequence().associateWith { phrases.getString(it) }
      }
    } catch (_: IOException) {
      null
    } catch (_: org.json.JSONException) {
      null
    }
  }

  private sealed interface Attempt {
    data class Ok(val response: CommandResponse) : Attempt
    data class Retryable(val speakCode: SpeakCode) : Attempt
    data class Fatal(val speakCode: SpeakCode) : Attempt
  }

  private fun runAttempt(request: Request): Attempt = try {
    client.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      when {
        response.isSuccessful -> runCatching { CommandResponseParser.parse(payload) }
          .fold({ Attempt.Ok(it) }, { Attempt.Retryable(SpeakCode.ERR_NETWORK) })

        response.code in 400..499 -> Attempt.Fatal(SpeakCode.ERR_REJECTED)
        else -> Attempt.Retryable(SpeakCode.ERR_NETWORK)
      }
    }
  } catch (_: InterruptedIOException) {
    Attempt.Retryable(SpeakCode.ERR_TOO_SLOW)
  } catch (_: IOException) {
    Attempt.Retryable(SpeakCode.ERR_NETWORK)
  }

  private fun backoffMs(attempt: Int): Long {
    val base = BASE_BACKOFF_MS shl attempt
    return base + Random.nextLong(JITTER_MS)
  }

  private companion object {
    val JSON = "application/json; charset=utf-8".toMediaType()
    const val MAX_ATTEMPTS = 2
    const val BASE_BACKOFF_MS = 300L
    const val JITTER_MS = 200L

    fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
      .connectTimeout(5, TimeUnit.SECONDS)

      .readTimeout(14, TimeUnit.SECONDS)
      .writeTimeout(10, TimeUnit.SECONDS)
      .retryOnConnectionFailure(false)
      .build()
  }
}
