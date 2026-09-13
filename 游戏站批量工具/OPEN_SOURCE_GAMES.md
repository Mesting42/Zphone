# Open-source local game library

The tool includes a first batch of 72 self-hosted HTML5 games selected from the
`SSS`, `SS`, `S`, and `A` tiers of:

- Source: https://github.com/wangzifan396-wzf/mini-browser-games
- License: MIT
- Runtime bundle: `js/open-source-games-bundle.js`
- Import script: `scripts/build-open-source-library.mjs`

Each catalog entry contains the complete single-file game source and a
1280x720 cover captured from the running game. When this source is selected,
the exported website contains:

- `games/*.html` for local gameplay;
- `images/*` for local covers;
- `OPEN_SOURCE_NOTICES.txt` for attribution;
- `licenses/mini-browser-games-MIT.txt` for the required license copy.

The main generated website may use its own design and advertising configuration.
Do not remove the exported license or attribution files.

## Refreshing the bundle

Run:

```powershell
npm run library:update
```

If Playwright and Sharp are available, the importer captures compressed WebP
covers from a local browser. Otherwise, it creates 1280x720 SVG fallback covers.
After refreshing, run `npm run check` and `npm test`.
