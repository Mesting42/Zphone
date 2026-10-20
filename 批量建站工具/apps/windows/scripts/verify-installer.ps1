# Install and reinstall the actual release package in a disposable checkout child.
# Refuse to run if an existing SiteFoundry install/profile/shortcut could be touched.
$ErrorActionPreference = 'Stop'
$windowsAppRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $windowsAppRoot '../..'))
$gitRoot = (& git -C $workspaceRoot rev-parse --show-toplevel).Trim()
if (($gitRoot -replace '\\', '/') -ne 'D:/Min/建站工具') { throw 'Unexpected Git root; installer verification stopped.' }
$evidenceRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot 'coverage/apps-20261013/windows/installer'))
$installRoot = [IO.Path]::GetFullPath((Join-Path $evidenceRoot 'installed-application'))
if (-not $installRoot.StartsWith($evidenceRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid disposable install directory.' }
$installerPath = Join-Path $windowsAppRoot 'release/SiteFoundry-1.0.6.4-Windows-x64-Setup.exe'
$userDataRoot = Join-Path $workspaceRoot 'coverage/apps-20261013/windows-build/profile'
$realDataRoot = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'SiteFoundry'
$installerCache = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'sitefoundry-desktop-updater'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SiteFoundry.lnk'
$menuLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'SiteFoundry.lnk'
$applicationGuid = 'e0e1123b-7f0a-5b02-a0fb-b4f8752595ae' # UUID v5 of com.sitefoundry.workbench; pinned by electron-builder.
$uninstallRegistries = @('HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall', 'HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall', 'HKLM:/Software/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall', 'HKCU:/Software/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall')

function Get-SiteFoundryRegistration {
    @(foreach ($registryPath in $uninstallRegistries) { if (Test-Path -LiteralPath $registryPath) { Get-ChildItem -LiteralPath $registryPath | Where-Object {
        $_.GetValue('DisplayName') -like 'SiteFoundry*' -or $_.PSChildName -match 'SiteFoundry'
    } | ForEach-Object { [ordered]@{ key = $_.Name; displayName = $_.GetValue('DisplayName'); displayVersion = $_.GetValue('DisplayVersion'); uninstallString = $_.GetValue('UninstallString'); installLocation = $_.GetValue('InstallLocation') } } } })
}
function Get-InstallInventory {
    [ordered]@{
        registration = @(Get-SiteFoundryRegistration)
        realUserData = Test-Path -LiteralPath $realDataRoot
        installerCache = Test-Path -LiteralPath $installerCache
        desktopShortcut = Test-Path -LiteralPath $desktopLink
        menuShortcut = Test-Path -LiteralPath $menuLink
    }
}
function Run-CheckedProcess([string]$Executable, [string[]]$Arguments) {
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(180000)) { throw ('Installer process exceeded three minutes: ' + $Executable) }
    if ($process.ExitCode -ne 0) { throw ('Installer returned ' + $process.ExitCode + ': ' + $Executable) }
}

New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$before = Get-InstallInventory
if ($before.registration.Count -or $before.realUserData -or $before.installerCache -or $before.desktopShortcut -or $before.menuShortcut) {
    throw 'Existing SiteFoundry installation data found; preserve it and use an isolated Windows account for this check.'
}
if (Test-Path -LiteralPath $installRoot) { throw 'Disposable install directory already exists; inspect it before another installer run.' }
$report = [ordered]@{ schema = 'sitefoundry-windows-installer/v1'; ok = $false; startedAt = [DateTime]::UtcNow.ToString('o'); gitRoot = $gitRoot; installationDirectory = $installRoot; userDataDirectory = $userDataRoot; before = $before; launches = @() }
$smokeExecutableBefore = $env:SITEFOUNDRY_SMOKE_EXECUTABLE
$smokeOutputBefore = $env:SITEFOUNDRY_SMOKE_OUTPUT_DIR
$installedByThisRun = $false
try {
    $marker = Join-Path $userDataRoot 'installer-upgrade-marker.txt'
    New-Item -ItemType Directory -Path $userDataRoot -Force | Out-Null
    [IO.File]::WriteAllText($marker, 'retained across SiteFoundry reinstall')
    for ($cycle = 1; $cycle -le 2; $cycle++) {
        $installedByThisRun = $true
        Run-CheckedProcess $installerPath @('/S', '/currentuser', '--no-desktop-shortcut', ('/D=' + $installRoot))
        $executable = Join-Path $installRoot 'SiteFoundry.exe'
        if (-not (Test-Path -LiteralPath $executable)) { throw 'Installed executable is missing.' }
        if ((Get-Item -LiteralPath $executable).VersionInfo.FileVersion -ne '1.0.6.4') { throw 'Installed Windows version differs.' }
        $expectedHash = (Get-FileHash -LiteralPath (Join-Path $windowsAppRoot 'release/win-unpacked/SiteFoundry.exe')).Hash
        if ((Get-FileHash -LiteralPath $executable).Hash -ne $expectedHash) { throw 'Installed EXE does not match the packaged EXE.' }
        $env:SITEFOUNDRY_SMOKE_EXECUTABLE = $executable
        $env:SITEFOUNDRY_SMOKE_OUTPUT_DIR = Join-Path $evidenceRoot ('launch-' + $cycle)
        & node (Join-Path $PSScriptRoot 'smoke.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke failed.' }
        if ([IO.File]::ReadAllText($marker) -ne 'retained across SiteFoundry reinstall') { throw 'Reinstall changed the persistent application data.' }
        $cycleInventory = Get-InstallInventory
        $appRegistration = @($cycleInventory.registration | Where-Object { $_.key.EndsWith('\' + $applicationGuid) })
        if ($appRegistration.Count -ne 1 -or $appRegistration[0].uninstallString -notlike ('*' + $installRoot + '*')) { throw 'Installer registration does not point to this disposable application.' }
        $report.launches += [ordered]@{ cycle = $cycle; executable = $executable; sha256 = $expectedHash.ToLowerInvariant(); dataRetained = $true; inventory = $cycleInventory }
    }
    $report.ok = $true
} catch {
    $report.error = $_.ToString()
    throw
} finally {
    $env:SITEFOUNDRY_SMOKE_EXECUTABLE = $smokeExecutableBefore
    $env:SITEFOUNDRY_SMOKE_OUTPUT_DIR = $smokeOutputBefore
    if ($installedByThisRun) {
        $uninstaller = Join-Path $installRoot 'Uninstall SiteFoundry.exe'
        if (Test-Path -LiteralPath $uninstaller) {
            Run-CheckedProcess $uninstaller @('/S', '/currentuser')
            $deadline = [DateTime]::UtcNow.AddSeconds(60)
            # NSIS hands off to a temporary uninstaller helper. The original
            # process may exit before the helper removes links and registration;
            # wait for its complete observable cleanup, not only the EXE removal.
            do {
                $uninstallInventory = Get-InstallInventory
                $cleanupPending = (Test-Path -LiteralPath (Join-Path $installRoot 'SiteFoundry.exe')) -or $uninstallInventory.registration.Count -or $uninstallInventory.desktopShortcut -or $uninstallInventory.menuShortcut
                if ($cleanupPending) { Start-Sleep -Milliseconds 250 }
            } while ($cleanupPending -and [DateTime]::UtcNow -lt $deadline)
        }
        # The preflight established that this exact updater cache did not exist.
        # Remove only this run's known cache after its own uninstaller has exited.
        $resolvedCache = [IO.Path]::GetFullPath($installerCache)
        $localData = [IO.Path]::GetFullPath([Environment]::GetFolderPath('LocalApplicationData'))
        if ($resolvedCache -ne (Join-Path $localData 'sitefoundry-desktop-updater')) { throw 'Unexpected installer cache path.' }
        if (Test-Path -LiteralPath $resolvedCache) { Remove-Item -LiteralPath $resolvedCache -Recurse -Force }
    }
    $report.after = Get-InstallInventory
    $report.uninstalled = -not (Test-Path -LiteralPath (Join-Path $installRoot 'SiteFoundry.exe'))
    $report.userDataRetainedAfterUninstall = Test-Path -LiteralPath (Join-Path $userDataRoot 'installer-upgrade-marker.txt')
    $report.finishedAt = [DateTime]::UtcNow.ToString('o')
    if ($report.after.registration.Count -or $report.after.realUserData -or $report.after.desktopShortcut -or $report.after.menuShortcut) { $report.ok = $false; $report.cleanupIssue = 'Install registration/shortcut inventory was not restored.' }
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'installer-summary.json') -Encoding utf8
}
if (-not $report.ok) { throw 'Installer verification did not complete cleanly; inspect installer-summary.json.' }
Write-Host 'Windows installer, reinstall, isolated launches and data retention passed.'
