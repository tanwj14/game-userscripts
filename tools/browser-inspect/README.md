# browser-inspect (shared)

Game-agnostic tooling for developing the userscripts against a live browser:
`inspect.js` connects to a running Chrome over the DevTools protocol (CDP) to
read live page state.

Game-specific probes live with each game and reuse this setup and the shared
`playwright` dependency. See [Per-game probes](#per-game-probes) below.

## One-time setup to make Chrome inspectable

Chrome 136+ ignores `--remote-debugging-port` on the default profile, so run a
copy of the profile:

1. Close Chrome.
2. Copy the profile (excluding caches) to a debug dir:
   `%LOCALAPPDATA%\Google\Chrome\DebugProfile`
3. Launch:
   `chrome.exe --user-data-dir="%LOCALAPPDATA%\Google\Chrome\DebugProfile" --remote-debugging-port=9222`
4. Play / navigate in that window. It must stay open for the scripts to connect.

## Install dependencies

From the repo root:

```
npm install
```

- `playwright` is declared once, in the repo-root `package.json`.
- One root install covers every script under `tools/` and `games/<game>/dev/`, since
  Node resolves dependencies by walking up the folder tree.
- No per-folder install is needed.
- The generated `node_modules` is gitignored.

## Shared script

Run from the repo root:

- `node tools/browser-inspect/inspect.js tabs` — list open tabs (title + url)
- `node tools/browser-inspect/inspect.js dom <urlpart>` — dump a page's HTML
- `node tools/browser-inspect/inspect.js html <urlpart> <selector>` — dump one element

All connect to `http://localhost:9222`.

## Per-game probes

Game-specific inspectors (which hard-code that game's selectors / localStorage
keys) live with the game:

- [`games/cartel-empire/dev/browser-inspect/`](../../games/cartel-empire/dev/browser-inspect/)
- [`games/torn/dev/browser-inspect/`](../../games/torn/dev/browser-inspect/)
