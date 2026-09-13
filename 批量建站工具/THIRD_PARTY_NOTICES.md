# Third-party notices

Runtime dependencies are version-locked in `package-lock.json`.

- JSZip 3.10.1 — MIT or GPLv3, used only inside the generator to read and write ZIP files.
- libarchive.js 2.0.2 — MIT, WebAssembly runtime used locally to import RAR and 7z data packages.
- Vite 7.1.4 — MIT, development and production build tool.
- Vitest 3.2.4 — MIT, automated test runner.
- DM Sans and Newsreader — SIL Open Font License 1.1, loaded for the generator UI only. Exported sites use local system font fallbacks and do not depend on a font CDN.

The generated static websites do not depend on JSZip, Vite, Vitest, a CDN, remote JSON, or client-side JavaScript for primary content.
