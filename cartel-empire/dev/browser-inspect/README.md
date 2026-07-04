# browser-inspect

Playwright scripts that connect to a running Chrome over the DevTools protocol
(CDP) to read live page state — used for developing the Cartel Empire userscript
(`../../cartel-empire-job-timer.user.js`).

## One-time setup to make Chrome inspectable

Chrome 136+ ignores `--remote-debugging-port` on the default profile, so we run a
copy of the profile:

1. Close Chrome.
2. Copy the profile (excluding caches) to a debug dir:
   `%LOCALAPPDATA%\Google\Chrome\DebugProfile`
3. Launch:
   `chrome.exe --user-data-dir="%LOCALAPPDATA%\Google\Chrome\DebugProfile" --remote-debugging-port=9222`
4. Play / navigate in that window. It must stay open for the scripts to connect.

## Setup

Playwright is a local dependency of this folder (`package.json` lives here;
`node_modules` is gitignored). Run `npm install` in this folder to restore it.

## Scripts

Run from the repo root, e.g. `node cartel-empire/dev/browser-inspect/inspect.js tabs`.

- `inspect.js` — `tabs` lists open tabs; `dom <urlpart>` dumps a page's HTML;
  `html <urlpart> <selector>` dumps one element.
- `extract-jobs.js` — summarises interactive elements (buttons/links) on the page.
- `inspect-job.js` — inspects the active-job DOM (#cancelButton, .jobContainer, timers).
- `test-logic.js` — validates the userscript's scan selectors against the live page.
- `read-outcome-log.js` — dumps `localStorage.CEOutcomeLog` (the userscript's
  captured result banners) as formatted JSON.

All connect to `http://localhost:9222`.
