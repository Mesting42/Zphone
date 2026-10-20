# Compile the real Kotlin installer and its targeted tests to a new ASCII path.
# This avoids the host Gradle test worker's non-ASCII classpath loading failure;
# it does not substitute an implementation or claim Android device execution.
$ErrorActionPreference = 'Stop'
$application = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$toolchain = if ($env:SITEFOUNDRY_TOOLCHAIN) { $env:SITEFOUNDRY_TOOLCHAIN } else { Join-Path $application 'coverage/apps-20261013/toolchain' }
$javaDirectory = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { (Get-ChildItem -LiteralPath (Join-Path $toolchain 'jdk') -Directory | Select-Object -First 1).FullName }
$java = Join-Path $javaDirectory 'bin/java.exe'
$cache = Join-Path $toolchain 'gradle-cache/caches/modules-2/files-2.1'
$jars = & rg --files $cache | Where-Object { $_.EndsWith('.jar') }
function Find-CachedJar([string]$name) {
    $file = $jars | Where-Object { [System.IO.Path]::GetFileName($_) -eq $name } | Select-Object -First 1
    if (!$file) { throw "Required cached Kotlin/JUnit tool is unavailable: $name" }
    return $file
}
$stdlib = Find-CachedJar 'kotlin-stdlib-2.2.10.jar'
$junit = Find-CachedJar 'junit-4.13.2.jar'
$hamcrest = Find-CachedJar 'hamcrest-core-1.3.jar'
$annotations = Find-CachedJar 'annotations-13.0.jar'
$compilerClasspath = @(
    (Find-CachedJar 'kotlin-compiler-embeddable-2.2.10.jar'), $stdlib,
    (Find-CachedJar 'kotlin-script-runtime-2.2.10.jar'),
    (Find-CachedJar 'kotlin-reflect-1.6.10.jar'),
    (Find-CachedJar 'kotlin-daemon-embeddable-2.2.10.jar'),
    (Find-CachedJar 'kotlinx-coroutines-core-jvm-1.8.0.jar'), $annotations
) -join ';'
$run = Join-Path $toolchain ('runtime-upgrade-check-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff'))
[System.IO.Directory]::CreateDirectory($run) | Out-Null
$source = Join-Path $application 'apps/android/project/app/src/main/java/com/sitefoundry/workbench/RuntimeInstallation.kt'
$testSource = Join-Path $application 'apps/android/project/app/src/test/java/com/sitefoundry/workbench/RuntimeInstallationTest.kt'
Copy-Item -LiteralPath $source -Destination $run
Copy-Item -LiteralPath $testSource -Destination $run
$classes = Join-Path $run 'classes'
$compileLog = Join-Path $run 'compile.log'
$testLog = Join-Path $run 'junit.log'
& $java '-cp' $compilerClasspath 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler' '-no-stdlib' '-no-reflect' '-jvm-target' '21' '-classpath' (@($stdlib, $junit, $hamcrest, $annotations) -join ';') '-d' $classes (Join-Path $run 'RuntimeInstallation.kt') (Join-Path $run 'RuntimeInstallationTest.kt') *> $compileLog
$compileExit = $LASTEXITCODE
if ($compileExit -eq 0) {
    & $java '-cp' (@($classes, $stdlib, $junit, $hamcrest) -join ';') 'org.junit.runner.JUnitCore' 'com.sitefoundry.workbench.RuntimeInstallationTest' *> $testLog
    $testExit = $LASTEXITCODE
} else { $testExit = $null }
$passed = $compileExit -eq 0 -and $testExit -eq 0
$summary = [ordered]@{
    schema = 1; runner = 'JDK21 JUnitCore with freshly compiled Kotlin2.2.10, ASCII classpath'
    scope = 'Windows JVM real filesystem; Android Os.readlink and actual app update still require device acceptance'
    ok = $passed; tests = if ($passed) { 3 } else { 0 }; failures = if ($passed) { 0 } else { $null }
    compileExit = $compileExit; junitExit = $testExit
    productionSourceSha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    testSourceSha256 = (Get-FileHash -LiteralPath $testSource -Algorithm SHA256).Hash.ToLowerInvariant()
    logs = @($compileLog, $testLog)
    originalGradleFailure = 'toolchain/android-runtime-upgrade-tests.log: initializationError ClassNotFoundException before tests'
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $application 'coverage/apps-20261013/android-runtime-upgrade-summary.json') -Encoding utf8
Get-Content -LiteralPath $compileLog
if (Test-Path -LiteralPath $testLog) { Get-Content -LiteralPath $testLog }
if (!$passed) { throw 'Targeted runtime upgrade checks failed; inspect the saved logs.' }
