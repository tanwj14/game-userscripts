# Cartel Empire — Status Tracker & Notifier

A quality-of-life [Tampermonkey](https://www.tampermonkey.net/) userscript for
[Cartel Empire](https://cartelempire.online). It surfaces your current status
without keeping the tab in focus.

## Features

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

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. **[Click here to install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-job-timer.user.js)** — Tampermonkey opens its install prompt.
3. Confirm. Open [Cartel Empire](https://cartelempire.online) and allow desktop
   notifications when prompted.

Updates install automatically (the script self-checks this repo via its
`@updateURL` header).

## Notes

- Desktop notifications require granting the browser notification permission for
  the site.
- Uses `localStorage` on `cartelempire.online` to persist timers/state across
  reloads and share state between tabs.

## Development

See [AGENTS.md](AGENTS.md) for DOM facts, self-lock behaviour, banner-wording
reference, and the live-inspection workflow. Dev tooling lives in
[`dev/browser-inspect/`](dev/browser-inspect/).

## Changelog

- Status Tracker & Notifier (this script):
  [changelog/job-timer.md](changelog/job-timer.md).
- Gym Coke Consumption (`cartel-empire-gym-coke-consumption.user.js`):
  [changelog/gym-coke.md](changelog/gym-coke.md).
