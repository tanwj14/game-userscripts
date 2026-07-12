# Changelog — Cartel Empire Gym Energy

## [2.0.2]

- **Fixed: a take's cooldown "bounced back" to the pre-consume time.** The
  game's popover countdown is client-side state that lags AJAX consumes by up
  to ~a minute, so the immediate post-consume popover reconcile read the stale
  pre-consume value and rolled back the correct message-parsed clock (observed
  live: take → `26:59:41` shown, reverted to `23:59:41` one second later,
  self-corrected only at the next 60s reconcile). A server-confirmed value
  (parsed consume message or a max rejection) now holds authority for 2
  minutes: popover reads that would roll the clock back during that window are
  ignored; afterwards the popover regains authority, keeping the cross-tab
  self-heal.
- When the message wording doesn't parse, the popover re-read retries at
  ~1s/25s/65s so it catches the popover once the game refreshes it.
- **Collapsing the panel clears the last action message** instead of letting
  it linger forever.
- Real cocaine wording captured live: "You took some Cocaine, gaining 50
  Energy, for a total of 50! Drug cooldown has increased to 26:59:41/24:00:00."
  — hours run past 24 with no day component (the popover uses `D:HH:MM:SS`);
  cocaine adds 3h. Both formats parse.

All notable changes to `cartel-empire-gym-energy.user.js` (v1.x shipped as
`cartel-empire-gym-coke-consumption.user.js` — renamed in 2.0.0). Versions
follow the `@version` header.

## [2.0.1]

- **Fixed: maxed booster still showed green Drink buttons.** Real drink success
  messages don't carry the drug-style `increased to X/Y` wording the widget
  parsed, so drinking on the page never advanced the booster clock and the
  group never registered max. (Live finding: the booster cooldown can overshoot
  its cap — 25:48 remaining vs a 24:00 cap — and ticks down from there.) The
  cooldown is now reconciled from the group's status-icon popover right after
  every consume, independent of message wording; and the server's max rejection
  ("…you're at max Booster cooldown.") immediately greys the group and triggers
  the same popover reconcile.
- **Fixed: workout energy boxes not updating after a drink.** Same wording
  dependency — the `for a total of X` energy parse missed on drinks. The
  response's `energyGained` field is now the fallback (current energy + gain),
  so the energy display and the four train inputs update regardless of wording.
- A max rejection no longer triggers the stale-id inventory refetch (~1.2MB).
- **Clocks self-heal without a reload.** Both cooldown popovers are re-read
  every 60s while the tab is visible, and immediately when you return to the
  tab — so a cooldown changed outside the widget (another tab, the Inventory
  page, another script) greys/ungreys the buttons on its own. The re-read is
  skipped while you're hovering a popover so it doesn't get yanked shut.

## [2.0.0]

- **Renamed to "Gym Energy"** (`cartel-empire-gym-energy.user.js`). The
  filename and `@name` changed, so Tampermonkey treats it as a new script:
  uninstall the old "Gym Coke Consumption" **before** installing this one from
  the new raw URL — there is no auto-update across the rename, and running
  both at once double-fires the train interceptor (each workout click would
  POST twice).
- **Unified energy widget: Cocaine + alcohol.** The single-Cocaine pill is now
  a grouped panel with two independent cooldown sections — **Drug** (Cocaine,
  "Take") and **Booster** (every owned alcohol, "Drink", sorted by tier:
  Corana → Mexcal → Blancoda → Repose → Anejo → Raicilla). Each group has its
  own timer, cap, bar, and `localStorage` key; the drug group reuses the v1.x
  key so a mid-cooldown upgrade keeps its readout. Both groups seed from their
  own status-icon popover (`.drugIcon` / `.boosterIcon`) with the same
  day-aware, retrying, flash-free read.
- **Max-cooldown behaviour reworked.** A maxed group now greys out all of that
  group's buttons with a red, full bar while the timer keeps counting — no "At
  max cooldown" button text. Groups gate independently; consuming stays
  blocked programmatically too.
- **One inventory read feeds both groups.** The background `/Inventory` fetch
  collects all consumables in a single pass (exact "Take Cocaine" match,
  generic "Drink X" + Alcohol-category detection, name-anchored counts,
  desktop/mobile duplicate buttons deduped), keeping the 15s throttle, 6s
  abort, and keep-last-list failure handling. Concurrent callers (panel open +
  consume retry) now share one in-flight fetch instead of racing two.
- **New pill icon.** The cropped Cocaine sprite is replaced by a ⚡ lightning
  bolt — the widget is about energy, not one drug.
- In-place training (AJAX workout POST, server banner, button restore) carries
  over from v1.4.x unchanged.

## [1.4.1]

- **Fixed max cooldown misreading as ~1 hour.** At/over 24h the drug pill formats
  the time as `D:HH:MM:SS` (e.g. `1:00:06:35`), but the cooldown parser only
  understood `HH:MM:SS`, so it grabbed the `1:00:06` substring and read ~1 hour —
  under the cap, so after a refresh the Take button flipped back to a clickable
  "Take Cocaine" instead of the red "At max cooldown". `hmsToSec` and the pill /
  consume-message regexes are now day-aware (accept an optional leading day
  component).

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
  it never risks training twice. It also snapshots each workout button's label
  at load and force-restores it (enabled + original text) after every train, so
  the game's own "Please wait" submit handler can't leave the button stuck now
  that the page no longer reloads.

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
