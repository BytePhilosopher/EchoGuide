package com.echoguide.network

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CommandApiTest {
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

  private fun api() = CommandApi(
    baseUrl = server.url("/").toString().trimEnd('/'),
    sleep = {},
  )

  private fun submit(target: CommandApi = api()) = target.submit(
    audio = ByteArray(64),
    durationMs = 900,
    language = "am-ET",
    screen = ScreenContext("com.app", "[id: com.app:id/ok]"),
    installId = "install-1",
    requestId = "11111111-1111-4111-8111-111111111111",
  )

  private fun accepted() = MockResponse().setResponseCode(200).setBody(
    """{"command_id":"c1","status":"ACCEPTED","speak_code":"ACK"}""",
  )

  @Test
  fun `a retry reuses the idempotency key so a command cannot run twice`() {
    server.enqueue(MockResponse().setResponseCode(500))
    server.enqueue(accepted())

    submit()

    val first = server.takeRequest().getHeader("X-Idempotency-Key")
    val second = server.takeRequest().getHeader("X-Idempotency-Key")
    assertEquals(first, second)
  }

  @Test
  fun `separate utterances use different idempotency keys`() {
    server.enqueue(accepted())
    server.enqueue(accepted())

    val target = api()
    submit(target)
    submit(target)

    assertNotEquals(
      server.takeRequest().getHeader("X-Idempotency-Key"),
      server.takeRequest().getHeader("X-Idempotency-Key"),
    )
  }

  @Test
  fun `a server error is retried exactly once`() {
    server.enqueue(MockResponse().setResponseCode(500))
    server.enqueue(accepted())

    val result = submit()

    assertEquals(2, server.requestCount)
    assertTrue(result is CommandResult.Success)
  }

  @Test
  fun `a rejected request is not retried`() {
    server.enqueue(MockResponse().setResponseCode(400))

    val result = submit()

    assertEquals(1, server.requestCount)
    assertEquals(SpeakCode.ERR_REJECTED, (result as CommandResult.Failed).speakCode)
  }

  @Test
  fun `repeated failures open the breaker and stop opening sockets`() {
    repeat(6) { server.enqueue(MockResponse().setResponseCode(500)) }

    val target = api()
    repeat(3) { submit(target) }
    val before = server.requestCount
    val result = submit(target)

    assertEquals(before, server.requestCount)
    assertEquals(SpeakCode.ERR_NETWORK, (result as CommandResult.Failed).speakCode)
  }

  @Test
  fun `the request carries the install id and a request id`() {
    server.enqueue(accepted())
    submit()
    val request = server.takeRequest()
    assertEquals("install-1", request.getHeader("X-Install-ID"))
    assertEquals("11111111-1111-4111-8111-111111111111", request.getHeader("X-Request-ID"))
  }

  @Test
  fun `the body carries base64 audio and the screen context, never a transcript`() {
    server.enqueue(accepted())
    submit()
    val body = server.takeRequest().body.readUtf8()
    assertTrue(body.contains("audio_base64"))
    assertTrue(body.contains("com.app:id/ok"))
    assertTrue(body.contains("\"duration_ms\":900"))
  }
}
