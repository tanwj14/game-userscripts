# Cartel Empire userscripts

[Tampermonkey](https://www.tampermonkey.net/) userscripts for
[Cartel Empire](https://cartelempire.online). Two scripts live in this folder:

| Script | What it does | Install |
| --- | --- | --- |
| **Status Tracker & Notifier** | Job / jail / hospital countdown in the tab title + desktop notifications | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-job-timer.user.js) |
| **Gym Coke Consumption** | Consume Cocaine from the Gym page and instantly refresh the workout energy boxes, with a live drug-cooldown readout | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-gym-coke-consumption.user.js) |

For either: install [Tampermonkey](https://www.tampermonkey.net/), click the
script's **Install** link (Tampermonkey opens its install prompt), and confirm.
Updates install automatically via each script's `@updateURL` header.

---

## Status Tracker & Notifier

Surfaces your current status without keeping the tab in focus.

### Features

| Feature | What it does |
| --- | --- |
| **Countdown in the tab title** | Your active job / jail / hospital timer shows as `[Job] MM:SS`, `[Prison] MM:SS`, `[Hospital] MM:SS` right in the browser tab — track it from any tab without switching. |
| **Desktop notifications** | Fires on key events (see table below) so you don't have to watch the game. |
| **Page-independent status** | Detects jail/hospital state from live navbar signals, so it works on any page of the site, not just `/Jobs`. |
| **Correct self-lock handling** | Self-hospitalising / self-jailing while a job is still running does *not* fire a false "attempt failed" alert — the job keeps counting down. |
| **Multi-tab safe** | Notifications are deduplicated across open tabs — only one tab fires each alert. |
| **Personal Favour aware** | Leaving jail early via a Personal Favour is handled silently (no bogus "you're released" spam). |

### Notification triggers

| Trigger | Notification |
| --- | --- |
| Job complete | `"Job Complete!"` when your operation finishes. |
| Job failed | Plain fail, no consequence. |
| Arrested | Job-caused jailing (`"Arrested! Your <Job> attempt failed..."`). |
| Hospitalised | Job-caused injury. |
| Released | When you're out of jail / hospital — then jumps you to `/Jobs`. |

### Notes

- Desktop notifications require granting the browser notification permission for
  the site.
- Uses `localStorage` on `cartelempire.online` to persist timers/state across
  reloads and share state between tabs.

---

## Gym Coke Consumption

A left-edge floating pill on the Gym page (`/Gym`) that lets you consume Cocaine
and train immediately — no trip to Inventory and no page reload.

### Features

| Feature | What it does |
| --- | --- |
| **One-click consume** | Take Cocaine from the floating pill without navigating to Inventory. |
| **Instant energy refresh** | After consuming, the four workout boxes update to your new energy, so you can train right away without reloading. |
| **Live drug cooldown** | Shows the remaining drug cooldown and cap with a bar; persists across reloads and navigation. |
| **Max-cooldown guard** | The Take button turns red and disables (`At max cooldown`) once you're at the cooldown cap. |
| **Owned count** | Shows how much Cocaine you hold, fetched in the background and refreshed when you open the pill. |

### Notes

- Passive by design: it consumes only when you click **Take** and never
  auto-trains — you still start each workout yourself.
- Uses `localStorage` on `cartelempire.online` to cache the item id and persist
  the cooldown readout across reloads.

---

## Development

See [AGENTS.md](AGENTS.md) for DOM facts, self-lock behaviour, banner-wording
reference, and the live-inspection workflow. Dev tooling lives in
[`dev/browser-inspect/`](dev/browser-inspect/).

## Changelogs

- Status Tracker & Notifier: [changelog/job-timer.md](changelog/job-timer.md).
- Gym Coke Consumption: [changelog/gym-coke.md](changelog/gym-coke.md).
