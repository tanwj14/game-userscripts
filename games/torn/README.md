# Torn — Flight Countdown on Tab

A quality-of-life [Tampermonkey](https://www.tampermonkey.net/) userscript for
[Torn](https://www.torn.com). It keeps your flight status on the browser tab
title, so you can track a trip from any tab without switching back to the game.

## Features

| Feature | What it does |
| --- | --- |
| **Countdown in the tab title** | While flying, the tab reads `[DEST] HH:MM:SS \| <Page> \| TORN` — track the remaining flight time from any tab. |
| **Destination label** | Country is shown as a short tag (`[JAPAN]`, `[UK]`, `[CANADA]`, …), read from the header travel status, not scraped from the whole page. |
| **"Reached!" on arrival** | Once you land abroad the title switches to `[DEST] Reached! \| <Page> \| TORN`. |
| **Return flights read as `[TORN]`** | Flying home shows `[TORN] HH:MM:SS`; on landing the title resets to Torn's native title and the cached flight state clears. |
| **Persists across reloads** | Landing time + destination are cached in `localStorage`, so the countdown survives page reloads and is shared between tabs. |

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. **[Click here to install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/torn/torn-flight-countdown.user.js)** — Tampermonkey opens its install prompt.
3. Confirm. Open [Torn](https://www.torn.com) and start a flight.

Updates install automatically (the script self-checks this repo via its
`@updateURL` header).

## Notes

- Uses `localStorage` on `www.torn.com` to persist the flight countdown across
  reloads and share it between tabs.
- Runs at `document-start`, so a fresh page load is needed for a freshly
  installed/updated version to take over the title.

## Development

See [AGENTS.md](AGENTS.md) for the header travel-status DOM facts, state model,
and the live CDP inspection workflow.

## Changelog

See [changelog/flight-countdown.md](changelog/flight-countdown.md).
