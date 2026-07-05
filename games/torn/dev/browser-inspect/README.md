# browser-inspect — Torn probes

Torn-specific CDP inspectors for developing `../../torn-flight-countdown.user.js`.

The shared [`tools/browser-inspect/`](../../../../tools/browser-inspect/README.md)
README covers the common setup: launching debug Chrome, the `inspect.js` tool, and
`npm install`.

Run the scripts below from the repo root. Playwright resolves from the root
`node_modules`.

## Scripts

- `inspect-flight.js` — one-shot snapshot of the live flight state: `document.title`,
  the header travel-status `aria-label`, `#tcLogo` title, and the cached
  `torn_flight_landing` / `torn_flight_destination` keys.
- `watch-landing.js` — polls a live flight until it lands, logging the header
  travel-link flip and confirming the `torn_flight_*` cache clears and the title
  resets to Torn's native title (the landing → home branch).

All connect to `http://localhost:9222` and target the `torn.com` tab (skipping
`/builds/` asset frames).
