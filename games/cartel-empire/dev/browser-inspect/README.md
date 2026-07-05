# browser-inspect — Cartel Empire probes

Cartel-Empire-specific CDP inspectors for developing
`../../cartel-empire-job-timer.user.js`.

The shared [`tools/browser-inspect/`](../../../../tools/browser-inspect/README.md)
README covers the common setup: launching debug Chrome, the `inspect.js` tool, and
`npm install`.

Run the scripts below from the repo root. Playwright resolves from the root
`node_modules`.

## Scripts

- `extract-jobs.js` — summarises interactive elements (buttons/links) on the page.
- `inspect-job.js` — inspects the active-job DOM (`#cancelButton`, `.jobContainer`, timers).
- `test-logic.js` — validates the userscript's scan selectors against the live page.
- `read-outcome-log.js` — dumps `localStorage.CEOutcomeLog` (the userscript's
  captured result banners) as formatted JSON.

All connect to `http://localhost:9222` and target the `cartelempire.online` tab.
