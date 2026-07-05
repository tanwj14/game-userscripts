# AGENTS.md — Torn

Game-specific development context for `torn-flight-countdown.user.js`. For the
shared shipping workflow and repo conventions, see the [root AGENTS.md](../../AGENTS.md).

In-game author: `ToiletPaper1USD [2875069]`.

QOL script: keeps a flight countdown on the browser tab title. Site:
https://www.torn.com (matches `https://www.torn.com/*`). Runs at
`document-start`; a freshly installed/updated version needs a full page reload
to take over the title.

## State model

`detectTravel()` returns `{ state, label }` where `state` is one of:

- **`home`** — no header travel link present. Not flying, not abroad. The
  `updateTabTimer` else-branch clears `torn_flight_landing` / `torn_flight_destination`
  and the title resets to the game's native title.
- **`flying`** — in transit. Header link `aria-label` reads
  `"Traveling from <A> to <B>"`; destination is `<B>` (so a return flight reads
  as `Torn` → label `[TORN]`).
- **`abroad`** — landed overseas. `aria-label` reads `"Abroad in <country>"`.

The tab title is rendered from the `localStorage` cache each tick:
`[LABEL] HH:MM:SS | <Page> | TORN` while the countdown runs, `[LABEL] Reached!`
once landed abroad, and the native title once home. A `[TORN]` return flight
clears its cache when the countdown hits zero (no "Reached!" for coming home).

## Key DOM facts (captured live)

- **Travel status link:** `a[href*="sid=travel"][aria-label]` in the header
  mirrors the globe (in transit) / cart (arrived) icons. Its `aria-label` is the
  trusted, short source for state + destination — parse it, do **not** scan
  `document.body.innerText` for country names (false positives). Body-text checks
  (`Remaining Flight Time`, `Travel home`) are only fallbacks if the aria wording
  changes.
- **Remaining flight time:** on the travel page, body text
  `"Remaining Flight Time - HH:MM:SS"`. Parsed once into an absolute landing
  timestamp cached in `localStorage['torn_flight_landing']` (epoch ms).
- **Arrived-only label fallback:** `#tcLogo`'s `title` attribute, mapped through
  `COUNTRY_MAP` when the aria-label has no usable destination.
- **Landing transition:** when a flight lands back in Torn, the travel page
  auto-redirects to `index.php` and the header travel link disappears → `state`
  becomes `home`. Verified live (Canada → Torn): title reset to `Home | TORN`,
  both `torn_flight_*` keys cleared.

## localStorage keys (on `www.torn.com`)

- `torn_flight_landing` — absolute landing time, epoch ms (string).
- `torn_flight_destination` — cached label, e.g. `[JAPAN]` / `[TORN]`.

Both are cleared on `home`, and the `[TORN]` return-flight cache self-clears when
its countdown reaches zero.

## Live-inspection workflow (CDP)

Uses the shared debug-Chrome setup in
[`tools/browser-inspect/`](../../tools/browser-inspect/README.md)
(`--remote-debugging-port=9222`, `playwright` from the repo root). Torn-specific
probes are in [`dev/browser-inspect/`](dev/browser-inspect/):

- `inspect-flight.js` — one-shot snapshot of `document.title`, the travel link
  `aria-label`, `#tcLogo` title, and the `torn_flight_*` keys.
- `watch-landing.js` — polls a flight until it lands and confirms the cache clears
  and the title resets (the landing → home branch).

Both pick the `torn.com` page that is not a `/builds/` asset. All travel states
(flying both directions incl. return → `[TORN]`, abroad, and landing → home) have
been verified live this way.
