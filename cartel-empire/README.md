# Cartel Empire — Status Tracker & Notifier

A quality-of-life [Tampermonkey](https://www.tampermonkey.net/) userscript for
[Cartel Empire](https://cartelempire.online). It surfaces your current status
without keeping the tab in focus.

## Features

- **Countdown in the tab title** — your active job / jail / hospital timer shows
  as `[Job] MM:SS`, `[Prison] MM:SS`, `[Hospital] MM:SS` right in the browser tab,
  so you can track it from any tab.
- **Desktop notifications** on:
  - **Job complete** — `"Job Complete!"` when your operation finishes.
  - **Job failed** — plain fail with no consequence.
  - **Arrested** — job-caused jailing (`"Arrested! Your <Job> attempt failed..."`).
  - **Hospitalised** — job-caused injury.
  - **Released** — when you're out of jail / hospital, then jumps you to `/Jobs`.
- **Page-independent status** — detects jail/hospital state from the live navbar
  signals, so it works on any page of the site, not just `/Jobs`.
- **Correct self-lock handling** — self-hospitalising / self-jailing while a job
  is still running does NOT fire a false "attempt failed" notification; the job
  keeps counting down.
- **Multi-tab safe** — notifications are deduplicated across open tabs (only one
  tab fires each alert).
- **Personal Favour aware** — using a Personal Favour to leave jail is handled
  silently (no bogus "you're released" spam).

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. **[Click here to install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/cartel-empire/cartel-empire-job-timer.user.js)** — Tampermonkey opens its install prompt.
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

See [CHANGELOG.md](CHANGELOG.md).
