# Changelog — Cartel Empire Status Tracker & Notifier

All notable changes to this userscript. Versions follow the `@version` header.

## [1.6.0]

- **Fixed missed "Hospitalised!" / "Arrested!" on a job outcome.** In a tab that
  wasn't refreshed at the moment a job ended, the script fired a premature
  "Job Complete!" and set `CEJobNotified`, which then muted the real outcome it
  detected afterwards (the tab tag flipped to `[HOSPITALISED]` but no notification
  fired). Job outcomes now dedup on their own `CEOutcomeNotified` flag (keyed to
  the job's `finishTime`), independent of the completion ping, so a premature
  "complete" can no longer suppress the outcome.
- **Reconcile the outcome on a later reload.** When a tracked job's timer ends the
  script now leaves a breadcrumb (`CEJobEndedUnresolved` + job name + timestamp).
  If a subsequent page load finds you locked, the outcome fires then — covering the
  common case where you only discover the hospitalisation minutes later, after
  `finishTime` was cleared and the transient result banner is long gone. Guarded so
  it fires once per job and never for a self-lock, a job that resolved free, or a
  breadcrumb older than 2h.
- **Silent early self-release; notify only on natural run-down.** Leaving hospital
  early with Medical Items (or jail with a Personal Favour) no longer fires a
  "you're released" notification — you did it deliberately — but still auto-redirects
  to `/Jobs`. A natural timer run-down still notifies. Early-vs-natural is detected
  from whether the lock timer still had time left, independent of the item wording.
- **Release notification no longer cut off by the redirect.** The natural-release
  redirect now waits ~4.5s (was 1.2s) so the "You're out!" notification is readable
  before the tab navigates; the silent early-out redirect stays snappy (~1.2s).
- Cleaned up a stale `CE_InHospital` localStorage key left by an older version.

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
