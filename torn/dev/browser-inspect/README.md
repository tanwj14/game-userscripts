# browser-inspect — Torn probes

Torn-specific CDP inspectors for developing `../../torn-flight-countdown.user.js`.
For the debug-Chrome setup, the shared `inspect.js` (`tabs` / `dom` / `html`), and
dependency install, see the shared
[`tools/browser-inspect/`](../../../tools/browser-inspect/README.md).

Playwright resolves from the repo-root `node_modules` (run `npm install` at the
repo root once). Run these from the repo root.

## Scripts

- `inspect-flight.js` — one-shot snapshot of the live flight state: `document.title`,
  the header travel-status `aria-label`, `#tcLogo` title, and the cached
  `torn_flight_landing` / `torn_flight_destination` keys.
- `watch-landing.js` — polls a live flight until it lands, logging the header
  travel-link flip and confirming the `torn_flight_*` cache clears and the title
  resets to Torn's native title (the landing → home branch).

All connect to `http://localhost:9222` and target the `torn.com` tab (skipping
`/builds/` asset frames).
