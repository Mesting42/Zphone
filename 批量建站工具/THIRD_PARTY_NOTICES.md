# Third-party notices

Runtime dependencies are version-locked in `package-lock.json`.

- JSZip 3.10.1 — MIT or GPLv3, used only inside the generator to read and write ZIP files.
- libarchive.js 2.0.2 — MIT, WebAssembly runtime used locally to import RAR and 7z data packages.
- FileSaver.js 2.0.5 — MIT, local browser download helper. License and upstream details are included in `js/vendor/file-saver-2.0.5.LICENSE.md` and `js/vendor/file-saver-2.0.5.NOTICE.md`.
- Vite 7.1.4 — MIT, development and production build tool.
- Vitest 3.2.4 — MIT, automated test runner.
- DM Sans and Newsreader — SIL Open Font License 1.1, loaded for the generator UI only. Exported sites use local system font fallbacks and do not depend on a font CDN.

The 36 approved domain SVG icons use artwork from OpenMoji (CC BY-SA 4.0), Twemoji (CC BY 4.0), Noto Emoji (Apache-2.0), IconPark by ByteDance (Apache-2.0), and DiceBear Adventurer by Lisa Wischofsky (CC BY 4.0). Artwork is distributed under its own license, separately from generated website code. Per-icon sources, pinned revisions and SHA-256 hashes are recorded in `motion/icons-provenance.json`; license texts are included in `motion/ICONS-LICENSE.txt` and `motion/icons/licenses/`. The site exporter includes the applicable icon notice with generated sites.

The generated static websites do not depend on JSZip, Vite, Vitest, a CDN, remote JSON, or client-side JavaScript for primary content.
