# Changelog — Cartel Empire Gym Coke Consumption

All notable changes to `cartel-empire-gym-coke-consumption.user.js`. Versions
follow the `@version` header.

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
