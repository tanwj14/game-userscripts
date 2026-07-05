# Changelog — Torn Flight Countdown on Tab

All notable changes to this userscript. Versions follow the `@version` header.

## [9.8]

- First release in this repo (added `@updateURL` / `@downloadURL` for
  auto-update). Dropped the stale `-debug` version suffix — no debug code was
  present.
- **Destination from header travel status.** State (home / flying / abroad) and
  destination are read from the header travel link's `aria-label` (with the
  logo `title` as an arrived-only fallback), not from whole-page text — so a
  return flight correctly reads as `[TORN]`.
- **Landing → home reset** verified live: on landing back in Torn the travel
  link disappears, the cached `torn_flight_*` keys clear, and the title resets
  to the game's native title.
- Cleanup (behaviour-preserving): single `match()` per branch in `detectTravel`
  (removed duplicate test/match regex pairs); one `isScriptTitle()` helper
  replacing three drifted title-ownership checks; `localStorage` keys hoisted to
  `KEY_LANDING` / `KEY_DEST` constants with consistent `String(...)` coercion;
  removed an unused `aria` return field.
