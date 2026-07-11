# Changelog — Cartel Empire Gym Coke Consumption

All notable changes to `cartel-empire-gym-coke-consumption.user.js`. Versions
follow the `@version` header.

## [1.4.0]

- **Training no longer reloads the page (widget stays open).** The four native
  workout forms did a full-page POST, which reset the widget to collapsed after
  every set. A capture-phase `submit` interceptor now sends the same
  `energyToUse` POST via `fetch` (following redirects, session-cookie only — the
  forms carry no CSRF token), clones the server's own result banner
  (`.statusAlertBox`, success or error) into the gym column, and syncs the
  post-train energy into the display and workout boxes — all without navigating,
  so the pill stays where it was. Strictly 1:1 with your click: no auto-repeat,
  no auto-train. On any failed/unrecognised response it reloads to reflect the
  real state rather than re-POSTing — the request already reached the server, so
  it never risks training twice.

## [1.3.0]

- **Owned-count auto-refreshes on panel open.** Previously the count was fetched
  only on the first open and then just decremented locally, so consuming Cocaine
  elsewhere left the widget's number stale until a reload. Opening the panel now
  re-reads inventory, throttled to at most once per 15s so rapid open/close
  doesn't re-download the ~1.2MB inventory page. The fetch is non-blocking (the
  panel opens instantly and the number updates in place) and abort-capped at 6s,
  keeping the last-known count on a slow/failed request instead of blanking it.

## [1.2.0]

- **Take button gates at max cooldown.** When the remaining drug cooldown is
  within 2s of the cap, the button becomes a red, disabled "At max cooldown"
  instead of the green "Take Cocaine"; `consume()` also bails on the same check
  so keyboard/programmatic triggers can't fire it.
- **Fixed janky panel collapse.** `visibility` sat in the transition shorthand
  and the bare `translateX(-6px)` nudge had no origin, so closing read as a
  stretch toward the tab. The panel now fades+slides with
  `transform-origin: left center` (`translateX(-8px) scale(.98)`), and
  `visibility: hidden` is delayed until the fade completes (0s delay when
  opening). Width stays fixed — no reflow.
- **Reliable cooldown seeding.** The old single 450ms popover read raced the
  game: the live "…HH:MM:SS" text is swapped in asynchronously, `.drugIcon`
  only loses `d-none` ~600ms after load (client-side), and `window.bootstrap`
  can lag `document-idle`. Seeding now waits for bootstrap (≤5s), polls the
  popover body (every 120ms, ≤2s), retries the whole read (~1s/~3s), and only
  trusts an absent/`d-none` pill as "no cooldown" once retries are spent. All
  exit paths hide the popover and remove the flash-guard class.
- **Cooldown survives reloads.** The cooldown is persisted as an absolute
  end-time + cap in `localStorage` (`ceGymCokeCooldown`), written on every
  successful popover read and consume, restored instantly at load (no
  empty-bar flash), reconciled by the authoritative popover read, and cleared
  when the pill confirms no cooldown.
- Tampermonkey `@icon` switched to the standard site icon (`icon-white.png`),
  matching the job-timer script; the widget's in-panel coke art is unchanged.
