# SiteFoundry source build runtime

The installed app reuses the current JavaScript workbench and additionally offers
a native source project builder. It imports source into private application data,
prepares platform-specific dependencies once while online, checks their byte
manifest, invokes the local framework, and exports its actual static build output.
No Windows `node_modules` is copied to Android. No source-only ZIP is substituted
for a failed build. Original input archives/projects remain untouched.

## Factory API

`createBuildManager({dataDirectory,nodeExecutable,nodeEnv,npmCli,onEvent})` from
`index.mjs` implements:

| Method | Parameters | Result |
| --- | --- | --- |
| `importProject` | `{name,archivePath}` or `{name,archiveBase64}` | Project `{id,projectId,name,framework,prepared,preparationReasons}` |
| `listProjects` | none | Project array, integrity rechecked |
| `inspectProject` | `{projectId}` | Project, readiness and reasons |
| `prepareProject` | `{projectId,online:true}` | Async task snapshot |
| `startBuild` | `{projectId,offline:true}` | Async task snapshot |
| `taskStatus` | `{taskId}` | Latest snapshot, bounded logs, error/artifact |
| `cancelTask` | `{taskId}` | Snapshot after requesting process-tree cancellation |
| `exportArtifact` | `{taskId,encoding:'path'}` | `{name,mimeType,artifactPath,bytes}` |

Native bridges accept `{pick:true}` for import and stream the chosen SAF/dialog
file to an app-owned staging path. They resolve that path internally before
calling the factory. `sourceDirectory` is available only to trusted development
checks. Never expose it or unrestricted `archivePath` to web content. Native
export streams the returned internal path to the user's chosen destination;
`encoding:'base64'` is an optional small-file fallback.

Task snapshots use `{id,taskId,projectId,operation,state,logs,error?,artifact?}`.
States: `queued`, `running`, `succeeded`, `failed`, `cancelled`, `interrupted`.
`inspectProject`/`listProjects` additionally return `latestTask` when available,
so native UI can restore a running job or previous artifact after navigation.
Only one preparation/build runs at a time; cancellation terminates its process
tree. Restarted active tasks are reported interrupted. Projects and prepared
dependencies survive app updates in the app data directory.

## Packaging

Run `node apps/build-runtime/prepare-runtime.mjs` once during app development.
This pins npm 10.9.4 and validates the npm registry's archive integrity. Include
`index.mjs`, `zip.mjs`, `worker.mjs`, `build-entry.cjs`, `network-guard.cjs`, `local-fonts.mjs`, and
`vendor/npm/**` plus `vendor/npm-provenance.json` in both native distributions.
The same preparation script bundles the shared Next font AST converter, its
dependency licenses and the audited local font library under `vendor/**`.
Include `android-adapters.mjs` too, or bundle its import into `index.mjs`.
Include `android-process-adapter.cjs`; only Android adds this preload to Node
children. It resolves directly spawned Node shebang bins (including cross-env
children) through the installed native CLI, and supplies the packaged npm shell
for default child_process.exec calls. Windows does not install this adapter.
The vendor directory is generated, excluded from Git, and must never include the
large historical regression directories. If bundling `index.mjs`, keep the
entry/guard files beside the bundle because the builder resolves adjacent files.

Windows uses its packaged Node runtime (Electron may set
`ELECTRON_RUN_AS_NODE=1`). Android uses the separately packaged executable
launcher in `../android/native-runtime`; this is needed for subprocess workers.
Set Node's memory allowance appropriately for the device rather than allocating
every CPU core. Preparation uses the installed target device's platform/ABI.

## Supported project conditions

The initial builder accepts npm projects with a `package-lock.json` and a build
script. Next's static export is expected to write `out/index.html`; other projects
must write `dist`, `build`, or `out`. Server-only Next projects need a separate
local server deployment workflow and are not presented as static artifacts.
Package scripts execute only within the native app's imported private project.
Dependencies which require unsupported Android native binaries/custom toolchains
fail visibly. Prepared does not claim that arbitrary external services, dynamic
server APIs, remote content, or any npm package are offline compatible.

Next installs an exact-version SWC WASM compiler while online. Offline builds
inherit a Node HTTP/TLS/socket/fetch guard and disable telemetry/lock repair
downloads. A complete actual build and network-blocked device evidence are still
required to claim a project works offline. SHA256 of package/lock plus platform,
ABI and the actual packaged Node executable's major/module ABI identify
preparation; every installed dependency file and copied local font is rehashed
before reporting readiness. Added, changed or missing files require prep.
Raw supported `next/font/google` imports are converted in the private project
copy with the shared browser AST transform before installation; unknown font
families, dynamic options and unsupported subsets fail visibly. Licenses are
included in both source and deployable output. No original ZIP/source is edited.

Each successful task stores its own output snapshot for preview. Later builds
cannot change an older task's preview or ZIP. A new build clears previous output
folders in its imported copy, so a successful no-op command cannot accidentally
export stale generated files.

Android additionally prepares exact official esbuild/Rollup WASM distributions
when these packages are present. A packaged `libsitefoundryshell.so` supplies npm
with Node command functions for private source files, which the system shell reads
without attempting forbidden execution of private downloaded binaries. Installed
dependency lifecycle hooks are executed after adapting compilers; unsupported
native build hooks fail visibly. `dispose()` is native-only and cancels active
process groups before shutdown; the JSON worker also disposes when stdin closes.

ZIP limits are explicit: 512 MiB input compressed, 1 GiB expanded, 50,000 entries,
ZIP32 stored/deflate only. Archive symlinks/traversal/duplicates are rejected.
Artifact ZIP output streams entries to disk instead of collecting all file
content in one buffer; SAF should likewise stream the artifact without Base64.
