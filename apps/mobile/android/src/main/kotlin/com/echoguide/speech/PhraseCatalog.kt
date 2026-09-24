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

    fun locale(): Locale {
        return if (language == "en-US") Locale.US else Locale("am", "ET")
    }
}
