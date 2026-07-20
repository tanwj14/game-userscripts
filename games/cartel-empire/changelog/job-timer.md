# Changelog — Cartel Empire Status Tracker & Notifier

All notable changes to this userscript. Versions follow the `@version` header.

## [1.5.6]

- **Fixed false "Job Failed" on a successful job.** The `CEJobFailed` flag was a
  bare boolean that wasn't cleared when a new job started, so a failure from the
  previous job could leak into the next one and mislabel it as failed (common when
  refreshing to start a new job right after a fail). `CEJobFailed` is now stored as
  the job's `finishTime` and matched against the current job — mirroring
  `CEJobSelfLocked` — so a stale flag from a different job is ignored.

## [1.5.5]

- Moved into `games/cartel-empire/` (repo reorg). Updated `@updateURL` /
  `@downloadURL` to the new raw path. No behaviour change. Reinstall once from the
  new raw URL so Tampermonkey tracks the updated location.

## [1.5.4]

- **Fixed false self-hospitalisation/jail notification.** Self-hospitalising or
  self-jailing while a job was still running fired a bogus
  `"Hospitalised! Your <Job> attempt failed..."`. Added `SELF_LOCK_GRACE = 3`: a
  hospital/jail lock is only treated as the current job's outcome when it appears
  within 3s of the job timer ending. An earlier lock is an unrelated self-lock, so
  the notification is suppressed and the job countdown keeps showing. Cross-tab
  flag `CEJobSelfLocked` (keyed to `finishTime`) remembers a pre-existing self-lock
  so the job's later completion isn't misattributed as job-caused.
- **Unified outcome detection.** Removed the duplicate no-timer `bg-danger` outcome
  detector and its dead machinery (`hospitalRedirecting`, `clearAlertSignature`,
  `CELastHandledAlert`, a drifted regex). `processBanner` is now the single
  reactive banner path.
- **Prefer absolute finish time.** `scanForActiveJob` now reads
  `#progressMessage[data-bs-finishtime]` (epoch seconds) and only falls back to
  scraping the `"3m 14s"` countdown text when the attribute is absent.
- Condensed verbose comments (~640 → ~490 lines); logic unchanged.

## [1.5.3]

- Release handling: locked→free detected via live status going clear (no
  release-time source exists). Natural timer run-down notifies and redirects to
  `/Jobs`; `observedLockedThisSession` guards the post-load "looks free" gap.

## [1.5.2]

- Hospital outcome handling: match the `"hospitalised whilst attempting the <Job>
  job!"` banner (distinct connector from the prison phrasing).

## [1.5.1]

- Jail/prison outcome handling: detect the `"caught by the police during the <Job>
  job!"` banner and notify `"Arrested!"`.

## [1.5.0]

- Reworked banner wording detection from live-captured canonical banners
  (success / plain fail / prison / hospital / status / Personal Favour early-out).

## [1.4.2]

- **Fixed wrong job name in tab title.** `scanForActiveJob` scoped to the broad
  `.jobContainer` (which lists multiple jobs), so `identifyJobType` matched the
  first job keyword in the blob instead of the running one. Now scopes to the
  running job's own `.equipmentModule`.
