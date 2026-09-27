package com.echoguide.pipeline

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VoskModelInstallerTest {
  private fun modelZip(vararg entries: String): ByteArray {
    val bytes = ByteArrayOutputStream()
    ZipOutputStream(bytes).use { zip ->
      entries.forEach { name ->
        zip.putNextEntry(ZipEntry(name))
        if (!name.endsWith("/")) zip.write(ByteArray(4_096) { it.toByte() })
        zip.closeEntry()
      }
    }
    return bytes.toByteArray()
  }

  @Test
  fun `it unpacks the bundled model once and reports progress up to done`() {
    val root = Files.createTempDirectory("vosk").toFile()
    val zip = modelZip("vosk-model-small/", "vosk-model-small/conf/", "vosk-model-small/conf/model.conf")
    val progress = mutableListOf<Float>()
    val installer = VoskModelInstaller(root, { ByteArrayInputStream(zip) }, zip.size.toLong())

    assertTrue(installer.install { progress += it })

    assertTrue(installer.isInstalled())
    assertTrue(File(installer.modelDirectory, "conf/model.conf").isFile)
    assertEquals(1f, progress.last(), 0.001f)
    assertTrue(progress.zipWithNext().all { (a, b) -> b >= a })
  }

  @Test
  fun `entries that escape the model folder are skipped`() {
    val root = Files.createTempDirectory("vosk").toFile()
    val zip = modelZip("../evil.txt", "conf/", "conf/model.conf")

    VoskModelInstaller(root, { ByteArrayInputStream(zip) }, -1).install()

    assertFalse(File(root.parentFile, "evil.txt").exists())
  }
}
