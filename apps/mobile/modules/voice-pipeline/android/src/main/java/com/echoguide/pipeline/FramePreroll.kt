package com.echoguide.pipeline

class FramePreroll(private val capacity: Int) {
  private val frames = ArrayDeque<ShortArray>(capacity)

  fun push(frame: ShortArray, length: Int) {
    if (frames.size == capacity) frames.removeFirst()
    frames.addLast(frame.copyOf(length))
  }

  fun drain(): List<ShortArray> {
    val out = frames.toList()
    frames.clear()
    return out
  }

  fun clear() = frames.clear()
}
