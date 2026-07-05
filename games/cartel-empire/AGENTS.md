# AGENTS.md — Cartel Empire

Game-specific development context for `cartel-empire-job-timer.user.js`. For the
shared shipping workflow and repo conventions, see the [root AGENTS.md](../../AGENTS.md).

In-game author: `PureVirginPulp [1611]`.

QOL script: shows job / jail / hospital countdowns in the browser tab title and
sends cross-tab-deduplicated desktop notifications on job completion and
outcomes. Site: https://cartelempire.online (matches `https://cartelempire.online/*`).

## Live-inspection workflow (Windows, Chrome 136+)

Chrome 136+ ignores `--remote-debugging-port` on the default profile, so run a
copy of the profile:

1. Close Chrome.
2. Copy the profile (minus caches) to `%LOCALAPPDATA%\Google\Chrome\DebugProfile`.
3. Launch:
   `chrome.exe --user-data-dir="%LOCALAPPDATA%\Google\Chrome\DebugProfile" --remote-debugging-port=9222`
4. Play in that window; keep it open. The `dev/browser-inspect/` Playwright
   scripts connect via CDP to `http://localhost:9222` to read live DOM +
   localStorage. See [`dev/browser-inspect/README.md`](dev/browser-inspect/README.md).

## Key DOM facts (captured live)

- **Active job:** the running job's card is `div.equipmentModule` containing only
  that job's name, description, countdown, and `#cancelButton`. The enclosing
  `div.jobContainer` is broader and lists multiple jobs — scoping to it leaks
  other job names into the title (the v1.4.2 bug). Always scope from
  `#cancelButton.closest('.equipmentModule')`.
- **Two `#cancelButton` nodes / ~10 `.equipmentModule`** exist (responsive
  desktop/mobile copies), but only ONE job runs at a time. `querySelector` (first
  match) is correct; no multi-job tracking needed.
- **Job finish time:** `#progressMessage` carries `data-bs-finishtime` = absolute
  epoch **seconds**. Authoritative — prefer it over scraping `"3m 14s"` text.
- **Live status (page-independent):** the game live-updates player status into
  every open tab with no reload. `detectStatusState()` → `'Hospital'|'Prison'|null`:
  primary signal = navbar `.hospitalIcon` / `.jailIcon` losing class `d-none`;
  fallback = `#mainBackground` gaining class `hospitalBackground` / `jailBackground`.
  Match the **class**, not the `.webp` filename (filenames are content-hashed).
  These are applied client-side, so they are ABSENT from raw server HTML.
- **/Hospital timers:** `<span class="countdownTimer" data-release="<epoch_ms>">`
  (absolute ms). Multiple spans exist; isolating the user's own still needs work.

## Self-lock behaviour (critical)

Self-hospitalising / self-jailing via your OWN action (not a job failure) renders
**NO banner** — only the live-status signals change. On `/Jobs` the running-job
card (`#cancelButton` + `#progressMessage`) is **removed from the DOM** the moment
you become locked, even though the job keeps running server-side
(`CEJobFinishTime` stays in the future). So a running job and a self-lock coexist;
the card vanishing does NOT mean the job was cancelled.

Guard (v1.5.4): `SELF_LOCK_GRACE = 3`. A hospital/jail lock is only treated as
THIS job's outcome when it appears within 3s of the job timer ending. A lock seen
with more time left is an unrelated self-lock → notification suppressed, job
countdown keeps showing. `CEJobSelfLocked` (keyed to `finishTime`) remembers a
pre-existing self-lock so the job's later completion isn't misattributed.

`processBanner` is the single reliable detector for genuine **job-caused** locks
(a real consequence always renders a banner; self-locks never do).

## Banner wording reference (captured live)

Result banners (transient, at job end; shape `"HH:MM:SS - <text> - [Refresh]"`):

- **Success** — `card-body text-center bg-success`, e.g. `"...Success! You earned £X and N rep!"`.
- **Plain fail** (no consequence) — `bg-danger`, `"You failed the <Job> job!"`
  (match `/you failed the .* job/i`; `"failed the job"` alone does NOT match).
- **Prison outcome** — `bg-danger`, `"You were caught by the police during the <Job> job!"`.
- **Hospital outcome** — `bg-danger`, `"You were hospitalised whilst attempting the <Job> job!"`.
- **Connector differs**: prison = `"during the"`, hospital = `"whilst attempting the"`.
  A single `/during the .* job/i` regex misses hospital — match each by its own phrase.

Status banners (persistent while serving, `bg-danger text-white` + MM:SS):

- **Prison** — `"You're in Prison, you'll need to wait until you're released or use a Personal Favour..."`.
- **Hospital** — `"You're in Hospital, you'll need to wait until you're released or use Medical Items..."`.

Personal Favour early-out (NOT a banner): inline
`div.col-12.useItemMsg.mt-2.text-success.fw-bold`, text
`"...You hand the Personal Favour to the guard, he quickly ushers you out of Jail."`.
Detect via `.useItemMsg` + `/ushers you out of (jail|prison)/i`. Self-release stays
silent (cross-tab flag `CEReleasedByFavour`); no release-TIME source exists, so
release is detected by live status going CLEAR (locked→free), guarded by
`observedLockedThisSession` against the post-load "looks free" gap.

## localStorage keys

`CEJobFinishTime`, `CEActiveJobName`, `CEJobNotified`, `CEJobFailed`,
`CEJobSelfLocked`, `CELockType`, `CELockFinishTime`, `CEPrisonNotified`,
`CEHospitalNotified`, `CELastNotification` (cross-tab notify dedup),
`CEReleasedByFavour`, `CEOutcomeLog` (debug capture, gated by `DEBUG_OUTCOME_LOG`).
