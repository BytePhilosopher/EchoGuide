package com.echoguide.speech

import android.content.Context
import org.json.JSONObject
import java.util.Locale

object PhraseCatalog {
    @Volatile
    var language: String = "am-ET"
        private set

    private var phrases: JSONObject = JSONObject()

    fun refresh(context: Context, languageCode: String) {
        language = if (languageCode == "en-US") "en-US" else "am-ET"
        phrases = JSONObject(context.assets.open("phrases.json").bufferedReader().use { it.readText() })
    }

    fun text(key: String): String {
        val entry = phrases.optJSONObject(key) ?: return key
        val localized = entry.optString(language)
        if (localized.isNotEmpty()) return localized
        return entry.optString("en-US", key)
    }

    fun assetPath(key: String): String = "phrases/$language/$key.mp3"

    fun applyRemote(remote: Map<String, String>) {
        remote.forEach { (key, value) ->
            val entry = phrases.optJSONObject(key) ?: JSONObject().also { phrases.put(key, it) }
            entry.put(language, value)
        }
    }

    fun locale(): Locale = if (language == "en-US") Locale.US else Locale.forLanguageTag("am-ET")
}
