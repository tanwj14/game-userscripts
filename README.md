# game-userscripts

Personal collection of [Tampermonkey](https://www.tampermonkey.net/) userscripts
for browser games. Each game lives in its own folder with its script(s), its own
README (features + install link), and per-script changelogs.

## Scripts

| Game | Script | Install |
| --- | --- | --- |
| [Cartel Empire](https://cartelempire.online) | Status Tracker & Notifier — job / jail / hospital countdown in the tab title + desktop notifications | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-job-timer.user.js) · [Details](games/cartel-empire/README.md) |
| [Cartel Empire](https://cartelempire.online) | Gym Coke Consumption — consume Cocaine from the Gym page and instantly refresh the workout energy boxes, with a live drug-cooldown readout | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-gym-coke-consumption.user.js) · [Details](games/cartel-empire/README.md) |
| [Torn](https://www.torn.com) | Flight Countdown on Tab — persistent flight countdown + destination label in the tab title | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/torn/torn-flight-countdown.user.js) · [Details](games/torn/README.md) |

## Installing a script

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Click an **Install** link above — Tampermonkey opens its install prompt.
3. Confirm. The script auto-runs on the game's site.

Scripts carry `@updateURL` / `@downloadURL` headers pointing at this repo, so
Tampermonkey checks for updates automatically. Shipping an update = bump the
script's `@version` header and push to `main`.

## Repo layout

```
game-userscripts/
  README.md              # this index
  LICENSE                # MIT (shared)
  AGENTS.md              # dev / AI-harness conventions (shared)
  package.json           # shared dev deps (playwright) for the browser-inspect tooling
  tools/
    browser-inspect/     # shared, game-agnostic CDP inspector + debug-Chrome setup
  games/
    <game>/
      <game>-<script>.user.js  # one or more userscripts (stable raw URLs for auto-update)
      README.md                # game-specific features + install links
      changelog/               # per-script version history (<script>.md)
      dev/                     # optional game-specific dev probes (playwright from repo root)
```

## Contributing / developing

See [AGENTS.md](AGENTS.md) for the development workflow and per-game gotchas.

## License

[MIT](LICENSE)
