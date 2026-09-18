package com.echoguide.bridge

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Section 5.4 TurboModule Kotlin Implementation
 * Exposes non-sensitive control methods to React Native.
 */
class VoicePipelineTurboModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VoicePipelineBridge"

    @ReactMethod
    fun startListening() {
        // Delegate to VoicePipelineService
    }

    @ReactMethod
    fun stopListening() {
        // Delegate to VoicePipelineService
    }
}
