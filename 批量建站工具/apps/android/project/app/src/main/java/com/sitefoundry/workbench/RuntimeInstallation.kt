package com.sitefoundry.workbench

import java.io.File
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.FileVisitResult
import java.nio.file.attribute.BasicFileAttributes
import java.util.UUID

/** Replace bundled tools only; imported projects and dependency stores are siblings. */
internal object RuntimeInstallation {
    fun replace(directory: File, fingerprint: String, copy: (File) -> Unit) {
        val parent = requireNotNull(directory.parentFile) { "运行时路径必须有专属父目录。" }.canonicalFile
        check(parent.mkdirs() || parent.isDirectory) { "无法创建本地运行时目录。" }
        val installed = File(parent, directory.name)
        val present = Files.exists(installed.toPath(), LinkOption.NOFOLLOW_LINKS)
        // An unexpected file/link is never treated as an owned runtime tree.
        check(!present || (!Files.isSymbolicLink(installed.toPath()) && installed.isDirectory)) { "本地运行时目录被其他文件占用。" }
        val suffix = UUID.randomUUID().toString()
        val staged = File(parent, ".runtime-install-$suffix")
        val previous = File(parent, ".runtime-previous-$suffix")
        check(staged.mkdir()) { "无法准备本地运行时更新。" }
        var movedPrevious = false
        var installedNew = false
        try {
            copy(staged)
            File(staged, ".installed-version").writeText(fingerprint)
            if (present) {
                check(installed.renameTo(previous)) { "无法暂存旧运行时。" }
                movedPrevious = true
            }
            if (!staged.renameTo(installed)) {
                if (movedPrevious) check(previous.renameTo(installed)) { "运行时更新失败，且旧运行时恢复失败。" }
                throw IllegalStateException("运行时更新失败，已保留原有项目。")
            }
            installedNew = true
        } finally {
            // Walk without FOLLOW_LINKS so even an unexpected link in an old
            // asset tree removes only the link, never a project's target folder.
            removeOwnedTree(staged, parent)
            if (installedNew && movedPrevious) removeOwnedTree(previous, parent)
        }
    }

    private fun removeOwnedTree(directory: File, parent: File) {
        val root = directory.toPath().toAbsolutePath().normalize()
        check(root.parent == parent.toPath().toAbsolutePath().normalize()) { "运行时临时路径无效。" }
        if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return
        Files.walkFileTree(root, object : SimpleFileVisitor<Path>() {
            override fun visitFile(file: Path, attributes: BasicFileAttributes): FileVisitResult {
                Files.delete(file)
                return FileVisitResult.CONTINUE
            }
            override fun postVisitDirectory(directory: Path, error: java.io.IOException?): FileVisitResult {
                if (error != null) throw error
                Files.delete(directory)
                return FileVisitResult.CONTINUE
            }
        })
    }
}
