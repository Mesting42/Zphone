param([switch]$Apply)
$ErrorActionPreference = 'Stop'

# This maintenance task is deliberately confined to coverage. Reports and real
# runner sources stay in place; generated websites, copied inputs and profiles
# can be regenerated. Never traverse directory junctions into original material.
$applicationRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedGitRoot = [IO.Path]::GetFullPath((Join-Path $applicationRoot '..'))
$actualGitRoot = [IO.Path]::GetFullPath((& git -C $applicationRoot rev-parse --show-toplevel).Trim())
if ($actualGitRoot -ne $expectedGitRoot) { throw 'Unexpected Git root.' }
$coverageRoot = [IO.Path]::GetFullPath((Join-Path $applicationRoot 'coverage'))
if ((Get-Item -LiteralPath $coverageRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'coverage must be a real directory.' }
$coveragePrefix = $coverageRoot + [IO.Path]::DirectorySeparatorChar
$toolchainPrefix = 'apps-20261013/toolchain/'
$keep = [Collections.Generic.List[object]]::new()
$remove = [Collections.Generic.List[object]]::new()
$links = [Collections.Generic.List[string]]::new()
$enumeration = [IO.EnumerationOptions]::new()
$enumeration.RecurseSubdirectories = $true
$enumeration.AttributesToSkip = [IO.FileAttributes]::ReparsePoint
$enumeration.IgnoreInaccessible = $false

function Assert-CoveragePath([string]$Path) {
    $resolved = [IO.Path]::GetFullPath($Path)
    if (-not $resolved.StartsWith($coveragePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Outside cleanup scope: $resolved" }
    return $resolved
}
function Relative-Path([string]$Path) { return [IO.Path]::GetRelativePath($coverageRoot, $Path).Replace('\','/') }
function Tree-Size([string]$Path) {
    [long]$bytes = 0
    foreach ($file in [IO.Directory]::EnumerateFiles($Path, '*', $enumeration)) { $bytes += [IO.FileInfo]::new($file).Length }
    return $bytes
}
function Add-Keep([IO.FileSystemInfo]$Entry, [string]$Kind) {
    $keep.Add([pscustomobject]@{ path=$Entry.FullName; relative=(Relative-Path $Entry.FullName); kind=$Kind; bytes=($(if ($Entry -is [IO.FileInfo]) { $Entry.Length } else { Tree-Size $Entry.FullName })) })
}
function Plan-Directory([string]$Directory) {
    foreach ($entry in Get-ChildItem -LiteralPath $Directory -Force) {
        $path = Assert-CoveragePath $entry.FullName
        $relative = Relative-Path $path
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { $links.Add($path); continue }
        if ($entry.PSIsContainer) {
            # SDK/JDK/NDK, Node Mobile and Gradle dependencies are used by the
            # existing build scripts, so they are not historical test outputs.
            if ($relative.StartsWith($toolchainPrefix) -and $relative.Substring($toolchainPrefix.Length) -notmatch '/') {
                if ($entry.Name -notmatch '^(avd|runtime-upgrade-check.*)$') { Add-Keep $entry 'build-toolchain'; continue }
            }
            $generated = $entry.Name -match '^(node_modules|\.next|\.git|\.cache|profiles?.*|inputs?|fixtures?.*|source-builds|projects|source(?:-.*)?|finished-source-build|android-next-fixture|directory-output|export-final|editorial-export|game-export|package|baseline|before-detail.*|backup.*|exports?|exported.*|native-saved|native-exports|directory-input|extracted.*|scaffold-smoke|screenshots?|captures?|assets|images|fonts|site|public|dist|out|build|data|snapshots?|staging|avd|runtime-upgrade-check.*)$' -or $entry.Name -match '.*-before$'
            if ($generated) {
                $remove.Add([pscustomobject]@{ path=$path; relative=$relative; kind='directory'; bytes=(Tree-Size $path) })
            } else { Plan-Directory $path }
            continue
        }
        $extension = $entry.Extension.ToLowerInvariant()
        $isScript = $extension -in @('.mjs','.cjs','.ps1','.py','.cmd','.bat','.sh') -or ($extension -eq '.js' -and $relative -match '(^|/)(runners|scripts|tests)/')
        $isReport = $extension -in @('.md','.json','.csv','.tsv','.xml','.lcov') -or ($extension -eq '.txt' -and $entry.Name -match '(signature|badging|align|verification|certificate|summary|report)') -or ($extension -eq '.html' -and $entry.Name -match '(report|coverage)')
        # Top-level tool download archives remain available for offline reuse.
        $isToolArchive = $relative.StartsWith($toolchainPrefix) -and $relative.Substring($toolchainPrefix.Length) -notmatch '/' -and $extension -eq '.zip'
        if ($isScript) { Add-Keep $entry 'test-script' }
        elseif ($isReport) { Add-Keep $entry 'report' }
        elseif ($isToolArchive) { Add-Keep $entry 'build-toolchain-archive' }
        else { $remove.Add([pscustomobject]@{ path=$path; relative=$relative; kind='file'; bytes=$entry.Length }) }
    }
}
$planPath = Join-Path $applicationRoot 'docs/coverage-cleanup-2026-10-14-plan.json'
if ($Apply) {
    # Apply the inventory already reviewed, rather than rescanning SDK and
    # profile trees. Validate its scope again before accepting any paths.
    $savedPlan = Get-Content -Raw -LiteralPath $planPath | ConvertFrom-Json
    if ($savedPlan.coverageRoot -ne $coverageRoot -or $savedPlan.gitRoot -ne $actualGitRoot) { throw 'Cleanup plan belongs to another workspace.' }
    foreach ($item in $savedPlan.keep) { [void](Assert-CoveragePath $item.path); $keep.Add($item) }
    foreach ($item in $savedPlan.remove) { [void](Assert-CoveragePath $item.path); $remove.Add($item) }
    foreach ($item in $savedPlan.preservedLinks) { [void](Assert-CoveragePath $item); $links.Add($item) }
    # Some generated native-run directories contain top-level launch reports.
    # Copy those small records aside and restore them at the same paths after
    # their profile/output tree is deleted. Package manifests in copied source
    # trees are inputs, not reports, and do not match this explicit filter.
    foreach ($target in @($remove | Where-Object kind -eq 'directory')) {
        foreach ($file in Get-ChildItem -LiteralPath $target.path -File -Force) {
            if ($file.Extension -eq '.json' -and $file.Name -match '(report|results|summary|frozen-source|delivery|task-status|application-identity|launch-\d|input-manifest|preservation|audit|verification)') { Add-Keep $file 'report' }
        }
    }
    foreach ($file in @($remove | Where-Object { $_.kind -eq 'file' -and $_.relative -match '(^|/)FileSaver[^/]*\.min\.js$' })) {
        Add-Keep (Get-Item -LiteralPath $file.path) 'test-script'
        [void]$remove.Remove($file)
    }
} else { Plan-Directory $coverageRoot }
$deleteBytes = [long](($remove | Measure-Object -Property bytes -Sum).Sum)
$keepBytes = [long](($keep | Measure-Object -Property bytes -Sum).Sum)
$plan = [pscustomobject]@{ at=(Get-Date).ToString('o'); applicationDirectory=$applicationRoot; gitRoot=$actualGitRoot; coverageRoot=$coverageRoot; deleteBytes=$deleteBytes; keepBytes=$keepBytes; keep=@($keep); remove=@($remove); preservedLinks=@($links) }
$plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $planPath -Encoding utf8
[pscustomobject]@{ apply=[bool]$Apply; deleteTargets=$remove.Count; deleteGiB=[Math]::Round($deleteBytes/1GB,3); keepFilesOrTrees=$keep.Count; keepGiB=[Math]::Round($keepBytes/1GB,3); preservedLinks=$links.Count; plan=$planPath } | ConvertTo-Json
if (-not $Apply) { return }

# Hash every retained report/runner and both official packages before deleting.
$protected = @($keep | Where-Object { $_.kind -in @('test-script','report') } | ForEach-Object { $_.path })
$protected += @('apps/windows/release/SiteFoundry-1.0.1-Windows-x64-Setup.exe','apps/android/release/SiteFoundry-1.0.1-android-release.apk') | ForEach-Object { Join-Path $applicationRoot $_ }
$protectedHashes = @{}
foreach ($path in $protected) { $protectedHashes[$path] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
$temporaryReports = Join-Path $applicationRoot ('docs/.coverage-cleanup-retained-' + (Get-Date -Format 'yyyyMMddHHmmssfff'))
if (Test-Path -LiteralPath $temporaryReports) { throw 'Temporary preservation directory already exists.' }
New-Item -ItemType Directory -Path $temporaryReports | Out-Null
$restore = [Collections.Generic.List[object]]::new()
foreach ($item in $keep) {
    if ($item.kind -ne 'report') { continue }
    foreach ($target in $remove) {
        if ($target.kind -eq 'directory' -and $item.path.StartsWith($target.path + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            $copy = Join-Path $temporaryReports $item.relative
            New-Item -ItemType Directory -Path (Split-Path -Parent $copy) -Force | Out-Null
            Copy-Item -LiteralPath $item.path -Destination $copy
            $restore.Add([pscustomobject]@{ original=$item.path; copy=$copy })
            break
        }
    }
}
$deleted = [Collections.Generic.List[string]]::new()
$failures = [Collections.Generic.List[object]]::new()
# Remove only the junction entries. Non-recursive Directory.Delete on Windows
# unlinks a directory junction and never deletes its external target contents.
foreach ($link in $links) {
    $linkPath = Assert-CoveragePath $link
    $entry = Get-Item -LiteralPath $linkPath -Force
    if (-not ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'A recorded link changed type.' }
    [IO.Directory]::Delete($linkPath, $false)
    $deleted.Add((Relative-Path $linkPath))
}
foreach ($target in $remove) {
    $path = Assert-CoveragePath $target.path
    try {
        if ($target.kind -eq 'directory') {
            # Revalidate every ancestor and reject any reparse point. Removal
            # remains native PowerShell end-to-end, never shell-composed paths.
            $parent = [IO.DirectoryInfo]::new($path)
            while ($parent.FullName -ne $coverageRoot) {
                if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point encountered; target left intact.' }
                $parent = $parent.Parent
                if (-not $parent) { throw 'Directory escaped coverage.' }
            }
            Remove-Item -LiteralPath $path -Recurse -Force
        } else { Remove-Item -LiteralPath $path -Force }
        $deleted.Add($target.relative)
        if ($deleted.Count % 1000 -eq 0) { Write-Output ('Deleted targets: ' + $deleted.Count + '/' + $remove.Count) }
    } catch { $failures.Add([pscustomobject]@{ path=$path; error=$_.Exception.Message }) }
}
foreach ($item in $restore) {
    [void](Assert-CoveragePath $item.original)
    New-Item -ItemType Directory -Path (Split-Path -Parent $item.original) -Force | Out-Null
    Copy-Item -LiteralPath $item.copy -Destination $item.original -Force
}
# Remove empty folders bottom-up without recursive deletion or following links.
function Remove-Empty([string]$Directory) {
    foreach ($entry in Get-ChildItem -LiteralPath $Directory -Directory -Force) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        $relative = Relative-Path $entry.FullName
        if ($relative.StartsWith($toolchainPrefix)) { continue }
        Remove-Empty $entry.FullName
        if (@(Get-ChildItem -LiteralPath $entry.FullName -Force).Count -eq 0) { Remove-Item -LiteralPath (Assert-CoveragePath $entry.FullName) -Force }
    }
}
Remove-Empty $coverageRoot
foreach ($path in $protectedHashes.Keys) {
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $protectedHashes[$path]) { throw "Protected file changed: $path" }
}
# This temporary directory was created exclusively by this invocation. Check
# the absolute parent/name before recursively removing these extra report copies.
$temporaryReports = [IO.Path]::GetFullPath($temporaryReports)
if ([IO.Path]::GetDirectoryName($temporaryReports) -ne (Join-Path $applicationRoot 'docs') -or [IO.Path]::GetFileName($temporaryReports) -notlike '.coverage-cleanup-retained-*') { throw 'Invalid preservation directory.' }
Remove-Item -LiteralPath $temporaryReports -Recurse -Force
$result = [pscustomobject]@{ finishedAt=(Get-Date).ToString('o'); deleteGiB=[Math]::Round($deleteBytes/1GB,3); deletedTargets=$deleted.Count; protectedFilesVerified=$protectedHashes.Count; preservedLinks=@($links); failures=@($failures); deleted=@($deleted); plan=$planPath }
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $applicationRoot 'docs/coverage-cleanup-2026-10-14-result.json') -Encoding utf8
$result | Select-Object deleteGiB,deletedTargets,protectedFilesVerified,failures | ConvertTo-Json -Depth 4
if ($failures.Count) { throw 'Some test artifacts could not be removed; see cleanup result.' }
