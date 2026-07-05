# browser-inspect (shared)

Game-agnostic tooling for developing the userscripts against a live browser:
`inspect.js` connects to a running Chrome over the DevTools protocol (CDP) to read
live page state. Per-game probes live in each game's own `<game>/dev/browser-inspect/`
and reuse the same setup and the shared `playwright` dependency.

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

`playwright` is declared once in the **repo-root** `package.json`. From the repo
root run `npm install` — this creates a root `node_modules` (gitignored) that
every script under `tools/` and `<game>/dev/` resolves via Node's upward
`node_modules` lookup. No per-folder install needed.

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
