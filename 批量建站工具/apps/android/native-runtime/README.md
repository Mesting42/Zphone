# Packaged Android Node CLI

`libsitefoundrynode.so` is a PIE executable linked to the pinned mobile `libnode.so`.
It is **not** a JNI shared library. Package it under `jniLibs/<ABI>/` with
`android:extractNativeLibs="true"` and `jniLibs.useLegacyPackaging = true` so the
installer places it in `applicationInfo.nativeLibraryDir`. Launch it through
`ProcessBuilder`, never copy it into writable app data and execute it there.

Pass CMake `-DNODE_MOBILE_ROOT=<coverage/apps-20261013/toolchain/node-mobile/extracted>`.
Copy the matching `bin/arm64-v8a/libnode.so` and `bin/x86_64/libnode.so` into the
same packaging directories. The prepare script verifies the release digest before
these files are used. The runtime distribution is a prerelease mobile port of
Node 24.21.0, pinned for repeatability; upstream Node does not officially support
Android. Actual emulator/device evidence determines support, not its version name.

Bridge launch environment:

* `TMPDIR=<context.cacheDir>/source-builds/tmp` (create first)
* `HOME=<context.filesDir>/sitefoundry/source-builds/home`
* `LD_LIBRARY_PATH=<applicationInfo.nativeLibraryDir>`
* `PATH=<applicationInfo.nativeLibraryDir>:/system/bin`
* `SITEFOUNDRY_DATA_DIR=<context.filesDir>/sitefoundry`
* `SITEFOUNDRY_NPM_CLI=<copied runtime>/vendor/npm/bin/npm-cli.js`

Start `[nativeLibraryDir/libsitefoundrynode.so, runtime/worker.mjs]`, cwd is the
runtime directory. Send newline separated JSON `{id,method,params}` on stdin.
Responses are `{id,result}` or `{id,error:{code,message}}` on stdout. Diagnostics
use stderr; never parse a project's build log as a bridge message. Persistent
projects/cache/tasks live under the private data directory, outside copied assets.

The worker implements the same API as the Windows `createBuildManager`. Import
archive paths must come from app-owned staging tokens, not arbitrary WebView paths.
Cancel kills a process group; stop the worker on app teardown only after active
tasks are cancelled. Background operation requires the container's foreground
service/lifecycle policy and is not provided merely by this launcher.

Primary constraints: [Android 10 executable restrictions](https://developer.android.com/about/versions/10/behavior-changes-10#execute-permission),
[mobile Node FAQ](https://github.com/fogtape/nodejs-mobile/blob/recipe/docs/FAQ.md),
[pinned release](https://github.com/fogtape/nodejs-mobile/releases/tag/v24.21.0-0).
