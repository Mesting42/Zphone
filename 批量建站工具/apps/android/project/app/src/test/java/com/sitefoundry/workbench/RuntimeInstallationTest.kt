package com.sitefoundry.workbench

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/** Exercise real filesystem replacement and rollback without an Android emulator. */
class RuntimeInstallationTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun updateRemovesDeletedBundledFilesAndPreservesProjectData() {
        val data = temporary.newFolder("sitefoundry")
        val runtime = File(data, "runtime").apply { mkdirs() }
        File(runtime, "vendor/deleted-tool.js").apply { parentFile.mkdirs(); writeText("old tool") }
        File(runtime, ".installed-version").writeText("old")
        val project = File(data, "projects/project/source/node_modules/retained.js").apply { parentFile.mkdirs(); writeText("user dependency") }
        RuntimeInstallation.replace(runtime, "new") { staged -> File(staged, "worker.mjs").writeText("new worker") }
        assertEquals("new", File(runtime, ".installed-version").readText())
        assertEquals("new worker", File(runtime, "worker.mjs").readText())
        assertFalse(File(runtime, "vendor/deleted-tool.js").exists())
        assertEquals("user dependency", project.readText())
        assertEquals(setOf("runtime", "projects"), data.list()?.toSet())
    }

    @Test fun incompleteAssetCopyLeavesTheOldRuntimeAvailable() {
        val data = temporary.newFolder("sitefoundry")
        val runtime = File(data, "runtime").apply { mkdirs() }
        File(runtime, "worker.mjs").writeText("old worker")
        File(runtime, ".installed-version").writeText("old")
        try {
            RuntimeInstallation.replace(runtime, "new") { staged ->
                File(staged, "partial.mjs").writeText("partial")
                throw java.io.IOException("asset copy failed")
            }
            fail("Expected failed update")
        } catch (error: java.io.IOException) { assertEquals("asset copy failed", error.message) }
        assertEquals("old worker", File(runtime, "worker.mjs").readText())
        assertEquals("old", File(runtime, ".installed-version").readText())
        assertEquals(setOf("runtime"), data.list()?.toSet())
    }

    @Test fun unknownFileAtRuntimeLocationIsPreserved() {
        val data = temporary.newFolder("sitefoundry")
        val runtime = File(data, "runtime").apply { writeText("unknown file") }
        try { RuntimeInstallation.replace(runtime, "new") { fail("Must not start a copy") }; fail("Expected occupied path") }
        catch (_: IllegalStateException) { }
        assertEquals("unknown file", runtime.readText())
    }
}
