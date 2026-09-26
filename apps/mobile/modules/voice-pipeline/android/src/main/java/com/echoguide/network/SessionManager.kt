package com.echoguide.network

import com.echoguide.voice.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONException
import org.json.JSONObject

/** Where the device keeps its install id and session. Implemented over SharedPreferences. */
interface CredentialStore {
  val installId: String
  var sessionToken: String?
  var sessionExpiresAtMs: Long

  /** Starts a new install identity. Used when the server refuses to re-register the old one. */
  fun rotateInstallId(): String
}

data class Credentials(val installId: String, val sessionToken: String)

sealed interface AuthResult {
  data class Issued(val token: String, val expiresInSeconds: Long) : AuthResult
  /** 409: the install id is registered and this device cannot prove it owns it. */
  data object Conflict : AuthResult
  data object Unauthorized : AuthResult
  /** 403: the account is suspended. Keep the session; do not register around the suspension. */
  data object Forbidden : AuthResult
  data object Unavailable : AuthResult
}

class AuthApi(
  private val baseUrl: String = BuildConfig.API_BASE_URL,
  private val client: OkHttpClient = defaultClient(),
) {
  fun register(installId: String, model: String, locale: String, currentToken: String?): AuthResult {
    val body = JSONObject()
      .put("install_id", installId)
      .put("model", model)
      .put("locale", locale)
      .toString()
    val request = Request.Builder()
      .url("$baseUrl/v1/auth/register-device")
      .apply { currentToken?.let { header("Authorization", "Bearer $it") } }
      .post(body.toRequestBody(JSON))
      .build()
    return execute(request)
  }

  fun refresh(installId: String, token: String): AuthResult {
    val request = Request.Builder()
      .url("$baseUrl/v1/auth/refresh")
      .header("Authorization", "Bearer $token")
      .header("X-Install-ID", installId)
      .post(ByteArray(0).toRequestBody(JSON))
      .build()
    return execute(request)
  }

  private fun execute(request: Request): AuthResult = try {
    client.newCall(request).execute().use { response ->
      when (response.code) {
        200 -> parseIssued(response.body?.string().orEmpty())
        401 -> AuthResult.Unauthorized
        403 -> AuthResult.Forbidden
        409 -> AuthResult.Conflict
        else -> AuthResult.Unavailable
      }
    }
  } catch (_: IOException) {
    AuthResult.Unavailable
  }

  private fun parseIssued(payload: String): AuthResult = try {
    val json = JSONObject(payload)
    val token = json.optString("session_token")
    val expiresIn = json.optLong("expires_in", 0)
    if (token.isEmpty() || expiresIn <= 0) AuthResult.Unavailable else AuthResult.Issued(token, expiresIn)
  } catch (_: JSONException) {
    AuthResult.Unavailable
  }

  private companion object {
    val JSON = "application/json; charset=utf-8".toMediaType()

    fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
      .connectTimeout(5, TimeUnit.SECONDS)
      .readTimeout(10, TimeUnit.SECONDS)
      .build()
  }
}

/**
 * Holds the device's session. The server binds every session to the install id, so every
 * authenticated request carries both (`Authorization` and `X-Install-ID`).
 *
 * - No session yet: register. If the server answers 409 (this install id is registered and we
 *   cannot prove we own it), start a new install id and register once more.
 * - Session close to expiry, or expired within the server's grace period: refresh (rotates it).
 * - A 401 on a real request: [invalidate], and the next [credentials] call recovers.
 * - A suspended account (403): keep the session. Registering a fresh install to get around a
 *   suspension is exactly what the server is designed to refuse.
 */
class SessionManager(
  private val api: AuthApi,
  private val store: CredentialStore,
  private val model: String,
  private val locale: () -> String,
  private val clock: () -> Long = System::currentTimeMillis,
) {
  @Synchronized
  fun credentials(): Credentials? {
    val token = store.sessionToken
    if (token == null) return register(allowRotate = true)

    val remainingMs = store.sessionExpiresAtMs - clock()
    if (remainingMs > REFRESH_BEFORE_EXPIRY_MS) return Credentials(store.installId, token)

    return when (val refreshed = api.refresh(store.installId, token)) {
      is AuthResult.Issued -> save(refreshed)
      AuthResult.Unauthorized -> {
        clear()
        register(allowRotate = true)
      }
      AuthResult.Forbidden -> Credentials(store.installId, token)
      // Offline: keep using the session while it is still valid.
      else -> if (remainingMs > 0) Credentials(store.installId, token) else null
    }
  }

  /** The server rejected this token. Forget it so the next call refreshes or re-registers. */
  @Synchronized
  fun invalidate(rejectedToken: String) {
    if (store.sessionToken == rejectedToken) store.sessionExpiresAtMs = 0L
  }

  @Synchronized
  fun hasSession(): Boolean = store.sessionToken != null

  private fun register(allowRotate: Boolean): Credentials? =
    when (val result = api.register(store.installId, model, locale(), null)) {
      is AuthResult.Issued -> save(result)
      AuthResult.Conflict -> if (allowRotate) {
        store.rotateInstallId()
        register(allowRotate = false)
      } else {
        null
      }
      else -> null
    }

  private fun save(issued: AuthResult.Issued): Credentials {
    store.sessionToken = issued.token
    store.sessionExpiresAtMs = clock() + issued.expiresInSeconds * 1000
    return Credentials(store.installId, issued.token)
  }

  private fun clear() {
    store.sessionToken = null
    store.sessionExpiresAtMs = 0L
  }

  private companion object {
    const val REFRESH_BEFORE_EXPIRY_MS = 7L * 24 * 60 * 60 * 1000
  }
}
