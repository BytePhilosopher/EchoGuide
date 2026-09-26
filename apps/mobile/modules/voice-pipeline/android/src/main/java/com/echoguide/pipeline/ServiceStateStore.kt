package com.echoguide.pipeline

import android.content.Context
import android.content.SharedPreferences
import com.echoguide.network.CredentialStore

class ServiceStateStore(context: Context) : CredentialStore {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  override val installId: String
    get() = prefs.getString(KEY_INSTALL_ID, null) ?: newInstallId()

  // App-private storage, alongside the install id it is bound to. Neither is useful alone.
  override var sessionToken: String?
    get() = prefs.getString(KEY_SESSION_TOKEN, null)
    set(value) = prefs.edit().putString(KEY_SESSION_TOKEN, value).apply()

  override var sessionExpiresAtMs: Long
    get() = prefs.getLong(KEY_SESSION_EXPIRES_AT, 0L)
    set(value) = prefs.edit().putLong(KEY_SESSION_EXPIRES_AT, value).apply()

  override fun rotateInstallId(): String {
    prefs.edit().remove(KEY_SESSION_TOKEN).remove(KEY_SESSION_EXPIRES_AT).apply()
    return newInstallId()
  }

  var language: String
    get() = prefs.getString(KEY_LANGUAGE, DEFAULT_LANGUAGE) ?: DEFAULT_LANGUAGE
    set(value) = prefs.edit().putString(KEY_LANGUAGE, value).apply()

  var isWakeWordEnabled: Boolean
    get() = prefs.getBoolean(KEY_WAKE_WORD, false)
    set(value) = prefs.edit().putBoolean(KEY_WAKE_WORD, value).apply()

  var hasConsent: Boolean
    get() = prefs.getBoolean(KEY_CONSENT, false)
    set(value) = prefs.edit().putBoolean(KEY_CONSENT, value).apply()

  var wakeWord: String
    get() = prefs.getString(KEY_WAKE_PHRASE, DEFAULT_WAKE_WORD) ?: DEFAULT_WAKE_WORD
    set(value) = prefs.edit().putString(KEY_WAKE_PHRASE, value.trim().lowercase()).apply()

  var isRegistered: Boolean
    get() = prefs.getBoolean(KEY_REGISTERED, false)
    set(value) = prefs.edit().putBoolean(KEY_REGISTERED, value).apply()

  private fun newInstallId(): String {
    val generated = java.util.UUID.randomUUID().toString()
    prefs.edit().putString(KEY_INSTALL_ID, generated).apply()
    return generated
  }

  private companion object {
    const val FILE = "echoguide_service_state"
    const val KEY_INSTALL_ID = "install_id"
    const val KEY_SESSION_TOKEN = "session_token"
    const val KEY_SESSION_EXPIRES_AT = "session_expires_at_ms"
    const val KEY_LANGUAGE = "language"
    const val KEY_WAKE_WORD = "wake_word_enabled"
    const val KEY_CONSENT = "consent_granted"
    const val KEY_REGISTERED = "device_registered"
    const val KEY_WAKE_PHRASE = "wake_phrase"
    const val DEFAULT_LANGUAGE = "am-ET"
    const val DEFAULT_WAKE_WORD = "echo"
  }
}
