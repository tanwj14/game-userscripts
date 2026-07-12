# Cartel Empire userscripts

[Tampermonkey](https://www.tampermonkey.net/) userscripts for
[Cartel Empire](https://cartelempire.online). Two scripts live in this folder:

| Script | What it does | Install |
| --- | --- | --- |
| **Status Tracker & Notifier** | Job / jail / hospital countdown in the tab title + desktop notifications | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-job-timer.user.js) |
| **Gym Energy** | Top up energy from Cocaine + alcohol on the Gym page and train in place, with live drug/booster cooldown readouts | [Install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-gym-energy.user.js) |

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

## Gym Energy

A left-edge floating pill on the Gym page (`/Gym`) to top up energy from
Cocaine and alcohol and train immediately — no trip to Inventory and no page
reload. (v1.x shipped as "Gym Coke Consumption"; renamed in 2.0.0.)

### Features

| Feature | What it does |
| --- | --- |
| **One-click consume** | Take Cocaine or drink any owned alcohol from the floating panel without navigating to Inventory. |
| **Two cooldown groups** | Independent Drug and Booster sections, each with its own live timer, cap, and progress bar; persists across reloads and navigation. |
| **Instant energy refresh** | After consuming, the four workout boxes update to your new energy, so you can train right away without reloading. |
| **In-place training** | Workout submits go via AJAX with the game's own result banner shown in place — the page (and panel) never reload. |
| **Max-cooldown guard** | A maxed group shows a red, full bar and greys out that group's buttons; the other group keeps working. |
| **Owned counts** | Shows how much of each consumable you hold, fetched in the background and refreshed when you open the panel. |

### Notes

- Passive by design: it consumes only when you click **Take** / **Drink** and
  never auto-trains — you still start each workout yourself.
- Uses `localStorage` on `cartelempire.online` to cache item ids and persist
  the cooldown readouts across reloads.

---

## Development

See [AGENTS.md](AGENTS.md) for DOM facts, self-lock behaviour, banner-wording
reference, and the live-inspection workflow. Dev tooling lives in
[`dev/browser-inspect/`](dev/browser-inspect/).

## Changelogs

- Status Tracker & Notifier: [changelog/job-timer.md](changelog/job-timer.md).
- Gym Energy: [changelog/gym-energy.md](changelog/gym-energy.md).
