package com.echoguide.bridge

import com.echoguide.pipeline.VoicePipelineService
import com.echoguide.speech.PhraseCatalog
import com.echoguide.speech.SpeechSynthesizer
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class VoicePipelineTurboModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val pipeline = VoicePipelineService()
    private val synthesizer = SpeechSynthesizer(reactContext)

    override fun getName(): String = "VoicePipelineBridge"

    @ReactMethod
    fun startListening() {
        pipeline.startPipeline()
    }

    @ReactMethod
    fun stopListening() {
        pipeline.stopPipeline()
    }

    @ReactMethod
    fun setLanguage(languageCode: String, promise: Promise) {
        try {
            PhraseCatalog.refresh(reactApplicationContext, languageCode)
            synthesizer.setLanguage(languageCode)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("LANG", error)
        }
    }

    @ReactMethod
    fun revokeConsent(promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun getServiceState(promise: Promise) {
        val state = WritableNativeMap()
        state.putBoolean("isWakeWordActive", false)
        state.putBoolean("isAccessibilityEnabled", false)
        state.putString("currentLanguage", PhraseCatalog.language)
        promise.resolve(state)
    }
}
