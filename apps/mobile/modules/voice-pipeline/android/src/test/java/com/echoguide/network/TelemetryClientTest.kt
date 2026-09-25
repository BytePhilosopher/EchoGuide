package com.echoguide.network

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class TelemetryClientTest {
  private lateinit var server: MockWebServer

  @Before
  fun start() {
    server = MockWebServer()
    server.start()
  }

  @After
  fun stop() {
    server.shutdown()
  }

  @Test
  fun `it sends only the keys the server allows`() {
    server.enqueue(MockResponse().setResponseCode(202))

    TelemetryClient(baseUrl = server.url("/").toString().trimEnd('/')).emit(
      outcome = "done",
      durationMs = 1200,
      stageTimings = mapOf("capture" to 400L, "upload" to 800L),
      installId = "install-1",
      requestId = "11111111-1111-4111-8111-111111111111",
    )

    val body = JSONObject(server.takeRequest().body.readUtf8())
    assertEquals(
      setOf("outcome", "duration_ms", "stage_timings", "request_id"),
      body.keys().asSequence().toSet(),
    )
  }

  @Test
  fun `a telemetry failure never throws into the command path`() {
    server.enqueue(MockResponse().setResponseCode(500))

    TelemetryClient(baseUrl = server.url("/").toString().trimEnd('/')).emit(
      outcome = "failed",
      durationMs = 10,
      stageTimings = emptyMap(),
      installId = "install-1",
      requestId = "11111111-1111-4111-8111-111111111111",
    )
  }
}
