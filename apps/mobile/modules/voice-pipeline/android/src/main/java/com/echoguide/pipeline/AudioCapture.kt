package com.echoguide.pipeline

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.ByteArrayOutputStream

class AudioCapture(
  private val sampleRate: Int = 16_000,
  private val recorderFactory: (Int) -> AudioRecord = ::defaultRecorder,
) {
  sealed interface Result {
    data class Utterance(val pcm: ByteArray, val durationMs: Int, val hitMaxLength: Boolean) : Result

    data object TooShort : Result
    data object Unavailable : Result
    data object Cancelled : Result
  }

  @Volatile
  private var isCancelled = false

  fun cancel() {
    isCancelled = true
  }

  fun awaitWakeWord(detector: WakeWordDetector): Boolean {
    isCancelled = false
    detector.reset()
    return withRecorder { recorder, frame ->
      while (!isCancelled) {
        val read = recorder.read(frame, 0, frame.size)
        if (read <= 0) continue
        if (detector.accept(frame, read)) return@withRecorder true
      }
      false
    } ?: false
  }

  fun captureUtterance(vad: VoiceActivityDetector): Result {
    isCancelled = false
    vad.reset()

    val pcm = ByteArrayOutputStream(MAX_UTTERANCE_BYTES)
    val outcome = withRecorder { recorder, frame ->
      while (!isCancelled) {
        val read = recorder.read(frame, 0, frame.size)
        if (read <= 0) continue
        when (vad.accept(frame, read)) {
          VoiceActivityDetector.Decision.WAITING -> Unit
          VoiceActivityDetector.Decision.SPEAKING -> append(pcm, frame, read)
          VoiceActivityDetector.Decision.DISCARDED_TOO_SHORT -> return@withRecorder Result.TooShort
          VoiceActivityDetector.Decision.CLOSED_BY_SILENCE,
          VoiceActivityDetector.Decision.CLOSED_BY_LIMIT,
          -> {
            append(pcm, frame, read)
            val bytes = pcm.toByteArray()
            return@withRecorder Result.Utterance(
              pcm = bytes,
              durationMs = durationMs(bytes.size),
              hitMaxLength = vad.lastDecision == VoiceActivityDetector.Decision.CLOSED_BY_LIMIT,
            )
          }
        }
      }
      Result.Cancelled
    }
    return outcome ?: Result.Unavailable
  }

  @SuppressLint("MissingPermission")
  private fun <T> withRecorder(block: (AudioRecord, ShortArray) -> T): T? {
    val minBuffer = AudioRecord.getMinBufferSize(sampleRate, CHANNEL, ENCODING)
    if (minBuffer <= 0) return null

    val recorder = runCatching { recorderFactory(maxOf(minBuffer * 2, FRAME_SAMPLES * 8)) }
      .getOrNull() ?: return null
    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      return null
    }

    val frame = ShortArray(FRAME_SAMPLES)
    return try {
      recorder.startRecording()
      block(recorder, frame)
    } catch (_: IllegalStateException) {
      null
    } finally {
      runCatching { recorder.stop() }
      recorder.release()
    }
  }

  private fun append(sink: ByteArrayOutputStream, frame: ShortArray, length: Int) {
    for (i in 0 until length) {
      val sample = frame[i].toInt()
      sink.write(sample and 0xFF)
      sink.write((sample shr 8) and 0xFF)
    }
  }

  private fun durationMs(byteCount: Int): Int = byteCount / 2 * 1000 / sampleRate

  private companion object {
    const val CHANNEL = AudioFormat.CHANNEL_IN_MONO
    const val ENCODING = AudioFormat.ENCODING_PCM_16BIT

    const val FRAME_SAMPLES = 320

    const val MAX_UTTERANCE_BYTES = 15 * 16_000 * 2

    @SuppressLint("MissingPermission")
    fun defaultRecorder(bufferSize: Int): AudioRecord = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      16_000,
      CHANNEL,
      ENCODING,
      bufferSize,
    )
  }
}
