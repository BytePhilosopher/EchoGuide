package com.echoguide.network

object Base64Encoder {
  private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

  fun encode(bytes: ByteArray): String {
    if (bytes.isEmpty()) return ""
    val out = StringBuilder((bytes.size + 2) / 3 * 4)
    var i = 0

    while (i + 2 < bytes.size) {
      val chunk = (bytes[i].toInt() and 0xFF shl 16) or
        (bytes[i + 1].toInt() and 0xFF shl 8) or
        (bytes[i + 2].toInt() and 0xFF)
      out.append(ALPHABET[chunk ushr 18 and 0x3F])
      out.append(ALPHABET[chunk ushr 12 and 0x3F])
      out.append(ALPHABET[chunk ushr 6 and 0x3F])
      out.append(ALPHABET[chunk and 0x3F])
      i += 3
    }

    when (bytes.size - i) {
      1 -> {
        val chunk = bytes[i].toInt() and 0xFF shl 16
        out.append(ALPHABET[chunk ushr 18 and 0x3F])
        out.append(ALPHABET[chunk ushr 12 and 0x3F])
        out.append("==")
      }
      2 -> {
        val chunk = (bytes[i].toInt() and 0xFF shl 16) or (bytes[i + 1].toInt() and 0xFF shl 8)
        out.append(ALPHABET[chunk ushr 18 and 0x3F])
        out.append(ALPHABET[chunk ushr 12 and 0x3F])
        out.append(ALPHABET[chunk ushr 6 and 0x3F])
        out.append('=')
      }
    }

    return out.toString()
  }
}
