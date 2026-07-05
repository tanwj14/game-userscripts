# browser-inspect — Cartel Empire probes

Cartel-Empire-specific CDP inspectors for developing
`../../cartel-empire-job-timer.user.js`. For the debug-Chrome setup, the shared
`inspect.js` (`tabs` / `dom` / `html`), and dependency install, see the shared
[`tools/browser-inspect/`](../../../tools/browser-inspect/README.md).

Playwright resolves from the repo-root `node_modules` (run `npm install` at the
repo root once). Run these from the repo root.

## Scripts

- `extract-jobs.js` — summarises interactive elements (buttons/links) on the page.
- `inspect-job.js` — inspects the active-job DOM (`#cancelButton`, `.jobContainer`, timers).
- `test-logic.js` — validates the userscript's scan selectors against the live page.
- `read-outcome-log.js` — dumps `localStorage.CEOutcomeLog` (the userscript's
  captured result banners) as formatted JSON.

All connect to `http://localhost:9222` and target the `cartelempire.online` tab.
