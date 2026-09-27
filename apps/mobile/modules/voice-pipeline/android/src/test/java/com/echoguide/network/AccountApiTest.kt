package com.echoguide.network

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AccountApiTest {
  private lateinit var server: MockWebServer
  private lateinit var api: AccountApi
  private val credentials = Credentials(installId = "install-1", sessionToken = "egs_test")

  @Before
  fun start() {
    server = MockWebServer()
    server.start()
    api = AccountApi(baseUrl = server.url("/").toString().trimEnd('/'))
  }

  @After
  fun stop() {
    server.shutdown()
  }

  @Test
  fun `an app grant carries the session, the install id and only the contract's keys`() {
    server.enqueue(MockResponse().setResponseCode(200).setBody("{}"))

    assertTrue(api.recordAppGrant(credentials, "com.whatsapp", granted = true))

    val request = server.takeRequest()
    assertEquals("/v1/app-grants", request.path)
    assertEquals("Bearer egs_test", request.getHeader("Authorization"))
    assertEquals("install-1", request.getHeader("X-Install-ID"))
    val body = JSONObject(request.body.readUtf8())
    assertEquals(setOf("package_name", "granted"), body.keys().asSequence().toSet())
  }

  @Test
  fun `a refused consent write is reported, not swallowed`() {
    server.enqueue(MockResponse().setResponseCode(500))

    assertFalse(api.recordConsent(credentials, "audio_retention", granted = false))
  }

  @Test
  fun `deletion is a DELETE the server accepts with 202`() {
    server.enqueue(MockResponse().setResponseCode(202).setBody("{}"))

    assertTrue(api.deleteUserData(credentials))
    assertEquals("DELETE", server.takeRequest().method)
  }

  @Test
  fun `an entitlement without a subscription row keeps its nulls`() {
    server.enqueue(
      MockResponse().setBody(
        """{"enforcement":"disabled","state":"NONE","status":null,"renews_at":null,"command_quota":null,"commands_used":null}""",
      ),
    )

    val entitlement = api.entitlement(credentials)

    assertEquals(Entitlement(false, "NONE", null, null, null), entitlement)
  }

  @Test
  fun `an unreachable entitlement is null, never a guessed plan`() {
    server.enqueue(MockResponse().setResponseCode(503))

    assertNull(api.entitlement(credentials))
  }
}
