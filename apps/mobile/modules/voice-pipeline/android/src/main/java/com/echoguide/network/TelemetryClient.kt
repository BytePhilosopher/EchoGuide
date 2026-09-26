package com.echoguide.network

import com.echoguide.voice.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class TelemetryClient(
  private val baseUrl: String = BuildConfig.API_BASE_URL,
  private val client: OkHttpClient = defaultClient(),
) {
  fun emit(
    outcome: String,
    durationMs: Long,
    stageTimings: Map<String, Long>,
    installId: String,
    requestId: String,
    sessionToken: String? = null,
  ) {
    // The server attributes events to the session's user and refuses them without one.
    if (sessionToken == null) return
    val timings = JSONObject().apply {
      stageTimings.forEach { (stage, ms) -> put(stage, ms) }
    }
    val body = JSONObject()
      .put("outcome", outcome)
      .put("duration_ms", durationMs)
      .put("stage_timings", timings)
      .put("request_id", requestId)
      .toString()

    val request = Request.Builder()
      .url("$baseUrl/v1/telemetry/events")
      .header("X-Install-ID", installId)
      .header("Authorization", "Bearer $sessionToken")
      .header("X-Request-ID", requestId)
      .post(body.toRequestBody(JSON))
      .build()

    try {
      client.newCall(request).execute().close()
    } catch (_: IOException) {
    }
  }

  private companion object {
    val JSON = "application/json; charset=utf-8".toMediaType()

    fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
      .connectTimeout(3, TimeUnit.SECONDS)
      .readTimeout(3, TimeUnit.SECONDS)
      .build()
  }
}
