package com.echoguide

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeIsolationTest {
  @Test
  fun `only the bridge package knows React Native exists`() {
    val sourceRoot = File("src/main/java/com/echoguide")
    assertTrue("source root not found at ${sourceRoot.absolutePath}", sourceRoot.isDirectory)

    val offenders = sourceRoot.walkTopDown()
      .filter { it.isFile && it.extension == "kt" }
      .filterNot { it.parentFile?.name == "bridge" }
      .filter { file ->
        file.readLines().any { line ->
          line.startsWith("import expo.") || line.startsWith("import com.facebook.")
        }
      }
      .map { it.relativeTo(sourceRoot).path }
      .toList()

    assertTrue(
      "these files reach React Native outside bridge/: $offenders",
      offenders.isEmpty(),
    )
  }
}
