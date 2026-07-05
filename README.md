# game-userscripts

Personal collection of [Tampermonkey](https://www.tampermonkey.net/) userscripts
for browser games. Each game lives in its own folder with the script, its own
README (features + install link), and a changelog.

## Scripts

| Game | Script | Install |
| --- | --- | --- |
| [Cartel Empire](https://cartelempire.online) | Status Tracker & Notifier — job / jail / hospital countdown in the tab title + desktop notifications | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/cartel-empire/cartel-empire-job-timer.user.js) · [Details](cartel-empire/README.md) |
| [Torn](https://www.torn.com) | Flight Countdown on Tab — persistent flight countdown + destination label in the tab title | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/torn/torn-flight-countdown.user.js) · [Details](torn/README.md) |

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
  <game>/
    <game>.user.js       # the userscript (stable raw URL for auto-update)
    README.md            # game-specific features + install link
    CHANGELOG.md         # version history
    dev/                 # optional dev tooling for that game
```

## Contributing / developing

See [AGENTS.md](AGENTS.md) for the development workflow and per-game gotchas.

## License

[MIT](LICENSE)
