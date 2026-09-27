package com.echoguide.network

import com.echoguide.voice.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONException
import org.json.JSONObject

data class Entitlement(
  val isEnforced: Boolean,
  val state: String,
  val renewsAt: String?,
  val commandQuota: Int?,
  val commandsUsed: Int?,
)

/** The signed-in user's grants, consent, plan and data deletion. Every call carries the session. */
class AccountApi(
  private val baseUrl: String = BuildConfig.API_BASE_URL,
  private val client: OkHttpClient = defaultClient(),
) {
  fun recordAppGrant(credentials: Credentials, packageName: String, granted: Boolean): Boolean =
    succeeds(
      request(credentials, "/v1/app-grants")
        .post(json(JSONObject().put("package_name", packageName).put("granted", granted))),
    )

  fun recordConsent(credentials: Credentials, scope: String, granted: Boolean): Boolean =
    succeeds(
      request(credentials, "/v1/consent/grants")
        .post(json(JSONObject().put("scope", scope).put("granted", granted))),
    )

  fun deleteUserData(credentials: Credentials): Boolean =
    succeeds(request(credentials, "/v1/consent/user-data").delete())

  fun entitlement(credentials: Credentials): Entitlement? = try {
    client.newCall(request(credentials, "/v1/billing/entitlement").get().build()).execute().use { response ->
      if (!response.isSuccessful) return null
      val body = JSONObject(response.body?.string().orEmpty())
      Entitlement(
        isEnforced = body.optString("enforcement") == "enforced",
        state = body.optString("state", "UNKNOWN"),
        renewsAt = if (body.isNull("renews_at")) null else body.optString("renews_at"),
        commandQuota = if (body.isNull("command_quota")) null else body.optInt("command_quota"),
        commandsUsed = if (body.isNull("commands_used")) null else body.optInt("commands_used"),
      )
    }
  } catch (_: IOException) {
    null
  } catch (_: JSONException) {
    null
  }

  private fun request(credentials: Credentials, path: String): Request.Builder =
    Request.Builder()
      .url("$baseUrl$path")
      .header("Authorization", "Bearer ${credentials.sessionToken}")
      .header("X-Install-ID", credentials.installId)

  private fun json(body: JSONObject): RequestBody = body.toString().toRequestBody(JSON)

  private fun succeeds(request: Request.Builder): Boolean = try {
    client.newCall(request.build()).execute().use { it.isSuccessful }
  } catch (_: IOException) {
    false
  }

  private companion object {
    val JSON = "application/json; charset=utf-8".toMediaType()

    fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
      .connectTimeout(5, TimeUnit.SECONDS)
      .readTimeout(10, TimeUnit.SECONDS)
      .build()
  }
}
