package com.echoguide.network

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class SessionManagerTest {
  private lateinit var server: MockWebServer
  private var now = 1_000_000L

  private class MemoryStore : CredentialStore {
    override var installId = "install-original-0001"
    override var sessionToken: String? = null
    override var sessionExpiresAtMs = 0L
    var rotations = 0
    override fun rotateInstallId(): String {
      rotations += 1
      sessionToken = null
      sessionExpiresAtMs = 0L
      installId = "install-rotated-000$rotations"
      return installId
    }
  }

  @Before
  fun start() {
    server = MockWebServer()
    server.start()
  }

  @After
  fun stop() {
    server.shutdown()
  }

  private fun manager(store: CredentialStore) = SessionManager(
    api = AuthApi(baseUrl = server.url("/").toString().trimEnd('/')),
    store = store,
    model = "Pixel",
    locale = { "am-ET" },
    clock = { now },
  )

  private fun issued(token: String, expiresIn: Long = 30L * 24 * 3600) =
    MockResponse().setResponseCode(200).setBody("""{"status":"registered","session_token":"$token","expires_in":$expiresIn}""")

  @Test
  fun `registers once and stores the session`() {
    val store = MemoryStore()
    server.enqueue(issued("egs_one"))

    val first = manager(store).credentials()
    val second = manager(store).credentials()

    assertEquals(Credentials("install-original-0001", "egs_one"), first)
    assertEquals(first, second)
    assertEquals(1, server.requestCount)
    assertEquals(null, server.takeRequest().getHeader("Authorization"))
  }

  @Test
  fun `a 409 starts a new install id and registers once more`() {
    val store = MemoryStore()
    server.enqueue(MockResponse().setResponseCode(409))
    server.enqueue(issued("egs_new"))

    val credentials = manager(store).credentials()

    assertEquals(Credentials("install-rotated-0001", "egs_new"), credentials)
    assertEquals(1, store.rotations)
  }

  @Test
  fun `a session near expiry is refreshed with its install id`() {
    val store = MemoryStore().apply {
      sessionToken = "egs_old"
      sessionExpiresAtMs = now + 60_000
    }
    server.enqueue(issued("egs_fresh"))

    val credentials = manager(store).credentials()

    val request = server.takeRequest()
    assertEquals("/v1/auth/refresh", request.path)
    assertEquals("Bearer egs_old", request.getHeader("Authorization"))
    assertEquals("install-original-0001", request.getHeader("X-Install-ID"))
    assertEquals("egs_fresh", credentials?.sessionToken)
  }

  @Test
  fun `a revoked session falls back to registration`() {
    val store = MemoryStore().apply {
      sessionToken = "egs_revoked"
      sessionExpiresAtMs = now - 1
    }
    server.enqueue(MockResponse().setResponseCode(401))
    server.enqueue(MockResponse().setResponseCode(409))
    server.enqueue(issued("egs_after"))

    assertEquals("egs_after", manager(store).credentials()?.sessionToken)
  }

  @Test
  fun `a suspended account keeps its session and never registers around it`() {
    val store = MemoryStore().apply {
      sessionToken = "egs_suspended"
      sessionExpiresAtMs = now + 1000
    }
    server.enqueue(MockResponse().setResponseCode(403))

    assertEquals("egs_suspended", manager(store).credentials()?.sessionToken)
    assertEquals(1, server.requestCount)
    assertEquals(0, store.rotations)
  }

  @Test
  fun `offline with a still-valid session keeps using it; offline and expired gives nothing`() {
    val store = MemoryStore().apply {
      sessionToken = "egs_valid"
      sessionExpiresAtMs = now + 1000
    }
    server.shutdown()
    assertEquals("egs_valid", manager(store).credentials()?.sessionToken)
    store.sessionExpiresAtMs = now - 1
    assertNull(manager(store).credentials())
  }

  @Test
  fun `invalidate forces a refresh on the next call`() {
    val store = MemoryStore().apply {
      sessionToken = "egs_a"
      sessionExpiresAtMs = now + 30L * 24 * 3600 * 1000
    }
    val sessions = manager(store)
    sessions.invalidate("egs_a")
    server.enqueue(issued("egs_b"))
    assertNotEquals("egs_a", sessions.credentials()?.sessionToken)
  }
}
