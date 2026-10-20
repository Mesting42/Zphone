$ErrorActionPreference = 'Stop'
$coverageRoot = 'D:\Min\建站工具\批量建站工具\coverage'
$applicationRoot = 'D:\Min\建站工具\批量建站工具'
if ((& git -C $applicationRoot rev-parse --show-toplevel).Trim().Replace('\','/') -ne 'D:/Min/建站工具') { throw 'Unexpected repository.' }
# Explicitly reviewed fixture roots only. These are copied Next projects and
# generated websites, not test runners or regression reports. Their junctions
# were already unlinked without traversing the original site's node_modules.
$targets = @(
 'D:\Min\建站工具\批量建站工具\coverage\ad-quick-update\directory-output',
 'D:\Min\建站工具\批量建站工具\coverage\apps-20261013\android-next-fixture',
 'D:\Min\建站工具\批量建站工具\coverage\domain-icons-review-20261013\package',
 'D:\Min\建站工具\批量建站工具\coverage\full-regression-20261009\quick-existing\directory-output',
 'D:\Min\建站工具\批量建站工具\coverage\full-regression-20261010\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\full-regression-20261013\configuration-controls-final-2\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\full-regression-20261013\configuration-controls-final\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\full-regression-20261013\performance-final-1\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\full-regression-20261013\round-1\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\full-regression-20261013\round-2\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\offline-fixes-20261013\offline\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\offline-fixes-20261013\online\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\offline-parity-20261013\offline\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\offline-parity-20261013\online\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\site-motion-20261012\full-regression\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\template-packages-20261012\full-regression-final\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\template-packages-20261012\full-regression\finished-source-build',
 'D:\Min\建站工具\批量建站工具\coverage\navigation-selection-20261012\export-final',
 'D:\Min\建站工具\批量建站工具\coverage\offline-20261013\editorial-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-20261013\game-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-fixes-20261013\offline\offline-core\editorial-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-fixes-20261013\offline\offline-core\game-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-fixes-20261013\online\offline-core\editorial-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-fixes-20261013\online\offline-core\game-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-parity-20261013\offline\offline-core\editorial-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-parity-20261013\offline\offline-core\game-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-parity-20261013\online\offline-core\editorial-export',
 'D:\Min\建站工具\批量建站工具\coverage\offline-parity-20261013\online\offline-core\game-export'
)
$prefix = $coverageRoot + '\'
$plan = Get-Content -Raw -LiteralPath (Join-Path $applicationRoot 'docs/coverage-cleanup-2026-10-14-plan.json') | ConvertFrom-Json
$retainedHashes = @{}
foreach ($item in $plan.keep) {
    if ($item.kind -notin @('test-script','report')) { continue }
    $inFixture = $false
    foreach ($target in $targets) { if ($item.path.StartsWith($target + '\', [StringComparison]::OrdinalIgnoreCase)) { $inFixture = $true; break } }
    if (-not $inFixture) { $retainedHashes[$item.path] = (Get-FileHash -LiteralPath $item.path -Algorithm SHA256).Hash }
}
[long]$additionalBytes = 0
$removed = @()
foreach ($target in $targets) {
    # All paths come from the literal whitelist above; validate their absolute
    # scope and every ancestor before allowing native recursive deletion.
    if ([IO.Path]::GetFullPath($target) -ne $target -or -not $target.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside coverage.' }
    if (-not (Test-Path -LiteralPath $target)) { continue }
    $ancestor = Get-Item -LiteralPath $target -Force
    while ($ancestor.FullName -ne $coverageRoot) {
        if ($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Target ancestor is a link.' }
        $ancestor = $ancestor.Parent
        if (-not $ancestor) { throw 'Target escaped coverage.' }
    }
    $entries = @(Get-ChildItem -LiteralPath $target -Recurse -Force)
    if (@($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Unexpected link inside fixture.' }
    $additionalBytes += [long](($entries | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum)
    Remove-Item -LiteralPath $target -Recurse -Force
    $removed += $target
}
foreach ($path in $retainedHashes.Keys) { if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $retainedHashes[$path]) { throw 'Retained report/runner changed.' } }
$resultPath = Join-Path $applicationRoot 'docs/coverage-cleanup-2026-10-14-result.json'
$result = Get-Content -Raw -LiteralPath $resultPath | ConvertFrom-Json
$restoredReports = @($plan.keep | Where-Object { $_.kind -eq 'report' -and $_.relative -match '/source-native/launch-\d\.json$' })
$totalBytes = [long]$plan.deleteBytes + $additionalBytes - [long](($restoredReports | Measure-Object bytes -Sum).Sum)
$result | Add-Member residualFixtureTreesRemoved $removed -Force
$result | Add-Member residualFixtureBytes $additionalBytes -Force
$result | Add-Member finalPreservedReportsAndScripts $retainedHashes.Count -Force
$result | Add-Member totalDeletedBytes $totalBytes -Force
$result | Add-Member totalDeletedGiB ([Math]::Round($totalBytes/1GB,3)) -Force
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultPath -Encoding utf8
[pscustomobject]@{ residualTreesRemoved=$removed.Count; additionalMiB=[Math]::Round($additionalBytes/1MB,2); totalDeletedGiB=[Math]::Round($totalBytes/1GB,3); retainedReportsAndScripts=$retainedHashes.Count } | ConvertTo-Json
