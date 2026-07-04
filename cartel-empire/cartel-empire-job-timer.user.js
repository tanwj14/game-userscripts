// ==UserScript==
// @name         Cartel Empire - Status Tracker & Notifier
// @namespace    http://tampermonkey.net/
// @version      1.5.4
// @description  QOL script for Cartel Empire: shows your job / jail / hospital countdown in the browser tab title and sends desktop notifications on job completion and outcomes.
// @author       PureVirginPulp [1611]
// @match        https://cartelempire.online/*
// @grant        GM_notification
// @icon         https://cartelempire.online/images/icon-white.png
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/tanwj14/game-userscripts/main/cartel-empire/cartel-empire-job-timer.user.js
// @downloadURL  https://raw.githubusercontent.com/tanwj14/game-userscripts/main/cartel-empire/cartel-empire-job-timer.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Strip our [TAG] + countdown prefix from a prior load to recover the game's title.
    let originalTitle = document.title
        .replace(/^\[[^\]]*\]\s*/, '')
        .replace(/^[-\s]*\d{1,2}:\d{2}(:\d{2})?\s*/, '');

    let finishTime = parseInt(localStorage.getItem('CEJobFinishTime'), 10) || null;
    let activeJobName = localStorage.getItem('CEActiveJobName') || null;

    let lockType = localStorage.getItem('CELockType') || null;
    let lockFinishTime = parseInt(localStorage.getItem('CELockFinishTime'), 10) || null;

    let jobNotified = localStorage.getItem('CEJobNotified') === 'true';
    let prisonNotified = localStorage.getItem('CEPrisonNotified') === 'true';
    let hospitalNotified = localStorage.getItem('CEHospitalNotified') === 'true';

    // Seen locked this page load — blocks the post-load "looks free" gap from faking a release.
    let observedLockedThisSession = false;

    const isEventsPage = window.location.pathname.toLowerCase().includes('/events');

    // Per-tab ID for single-notifier election.
    const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

    // Banner/toast nodes — cheap observer filter + outcome capture.
    const BANNER_SELECTOR = '[class*="alert-"],[class*="bg-danger"],[class*="bg-success"],[class*="bg-warning"],[class*="bg-info"],.toast';

    // Outcome-banner matchers (prison / hospital consequence). Plain fails use [JOB FAILED].
    //   Prison:   "caught by the police during the <Job> job!"
    //   Hospital: "hospitalised whilst attempting the <Job> job!"
    const RE_PRISON_OUTCOME = /caught by the police|sent to prison|arrested/i;
    const RE_HOSPITAL_OUTCOME = /hospitali[sz]ed/i;
    // Personal Favour early-out — inline .useItemMsg, not a banner.
    const FAVOUR_MSG_SELECTOR = '.useItemMsg';
    const RE_FAVOUR_RELEASE = /ushers you out of (jail|prison)/i;

    // Page-independent lock signals (live-updated into every tab, no reload):
    //   navbar .hospitalIcon/.jailIcon lose d-none; #mainBackground gains *Background class.
    const HOSPITAL_ICON_SELECTOR = '.hospitalIcon';
    const JAIL_ICON_SELECTOR = '.jailIcon';
    const MAIN_BG_SELECTOR = '#mainBackground';
    const HOSPITAL_BG_CLASS = 'hospitalBackground';
    const JAIL_BG_CLASS = 'jailBackground';

    // A lock is the job's outcome only within GRACE of timer end; earlier = self-lock
    // (job keeps running while self-hospitalised/jailed).
    const SELF_LOCK_GRACE = 3;

    // Set true to log result banners to localStorage.CEOutcomeLog for re-tuning matchers.
    const DEBUG_OUTCOME_LOG = false;

    // Pre-render a square icon for notifications.
    let squareIconBase64 = "https://cartelempire.online/images/icon-white.png";
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "https://cartelempire.online/images/icon-white.png";
    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            const maxDim = Math.max(img.width, img.height);
            canvas.width = maxDim;
            canvas.height = maxDim;

            const ctx = canvas.getContext('2d');
            const x = (maxDim - img.width) / 2;
            const y = (maxDim - img.height) / 2;
            ctx.drawImage(img, x, y);

            squareIconBase64 = canvas.toDataURL("image/png");
        } catch (e) {
            console.error("Failed to square notification icon:", e);
        }
    };

    // Append result-banner text/HTML to CEOutcomeLog (deduped). Gated by DEBUG_OUTCOME_LOG.
    function logOutcome(el, text) {
        if (!DEBUG_OUTCOME_LOG) return;
        if (!text) return;
        const sig = text.slice(0, 120);
        const now = Date.now();
        let log = [];
        try { log = JSON.parse(localStorage.getItem('CEOutcomeLog')) || []; } catch (e) { log = []; }

        const lastEntry = log[log.length - 1];
        if (lastEntry && lastEntry.sig === sig && (now - lastEntry.t) < 5000) return;

        log.push({
            t: now,
            iso: new Date(now).toISOString(),
            path: location.pathname,
            cls: typeof el.className === 'string' ? el.className : '',
            sig: sig,
            text: text.slice(0, 300),
            html: el.outerHTML.slice(0, 600)
        });
        if (log.length > 40) log = log.slice(-40);
        localStorage.setItem('CEOutcomeLog', JSON.stringify(log));
    }

    // Prison/hospital consequence banner → notify + reload. Plain fails / status banners ignored.
    function processBanner(el) {
        const text = (el.innerText || "").trim();
        if (!text) return;

        logOutcome(el, text);

        const isPrisonOutcome = RE_PRISON_OUTCOME.test(text);
        const isHospitalOutcome = RE_HOSPITAL_OUTCOME.test(text);
        if (!isPrisonOutcome && !isHospitalOutcome) return;

        // Handle each banner once per load.
        const sig = text.slice(0, 120);
        if (sessionStorage.getItem('CEOutcomeHandled') === sig) return;
        sessionStorage.setItem('CEOutcomeHandled', sig);

        // Capture name before clearJobState wipes it.
        const jobNameAtOutcome = activeJobName;

        clearJobState();
        clearLockState();

        if (isPrisonOutcome) {
            notifyArrested(jobNameAtOutcome);
        } else {
            notifyHospitalised(jobNameAtOutcome);
        }

        location.reload();
    }

    // Favour early-out (no banner). Accepts a node that IS or CONTAINS the .useItemMsg.
    function checkFavourRelease(node) {
        if (!node) return false;
        let msgs = [];
        if (node.matches && node.matches(FAVOUR_MSG_SELECTOR)) msgs = [node];
        else if (node.querySelectorAll) msgs = [...node.querySelectorAll(FAVOUR_MSG_SELECTOR)];

        for (const m of msgs) {
            if (RE_FAVOUR_RELEASE.test(m.innerText || "")) {
                // Mark self-release cross-tab so the release detector stays silent.
                localStorage.setItem('CEReleasedByFavour', String(Date.now()));
                if (lockFinishTime || lockType) clearLockState();
                return true;
            }
        }
        return false;
    }

    // Read text only for banner-like inserts (innerText is the costly part).
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches && node.matches(BANNER_SELECTOR)) {
                    processBanner(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll(BANNER_SELECTOR).forEach(processBanner);
                }
                // Favour msg is inline, not a banner — check separately.
                checkFavourRelease(node);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Sweep banners / favour msgs already present before the observer started.
    function initScan() {
        document.querySelectorAll(BANNER_SELECTOR).forEach(processBanner);
        checkFavourRelease(document);
    }

    function identifyJobType(text) {
        const jobsMap = {
            'Intimidation': /Intimidation/i, 'Arson': /Arson/i, 'GTA': /(Grand Theft Auto|GTA)/i,
            'Transport': /Transport/i, 'Farm': /Farm/i, 'Agave': /Agave/i, 'Paste': /(Coca|Paste)/i,
            'Construction': /Construction/i, 'Blackmail': /Blackmail/i, 'Hacking': /Hacking/i
        };
        for (const [shortName, regex] of Object.entries(jobsMap)) {
            if (regex.test(text)) return shortName;
        }
        return "Job";
    }

    // Parse "HH:MM:SS" / "MM:SS" → seconds.
    function parseTimeString(bannerText) {
        if (!bannerText) return null;
        const timeMatch = bannerText.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (timeMatch) {
            let parts = timeMatch.filter(p => p !== undefined);
            if (parts.length === 4) {
                return (parseInt(parts[1], 10) * 3600) + (parseInt(parts[2], 10) * 60) + parseInt(parts[3], 10);
            } else {
                return (parseInt(parts[1], 10) * 60) + parseInt(parts[2], 10);
            }
        }
        return null;
    }

    // Sync lock type + finish time from the bg-danger lock banner.
    function syncStatusBanners() {
        if (isEventsPage) return;

        const alertBanner = document.querySelector('div[class*="bg-danger"], div[class*="alert-danger"], .alert-danger');
        if (alertBanner) {
            const text = alertBanner.innerText;
            let currentType = null;

            if (/Prison/i.test(text)) currentType = 'Prison';
            if (/Hospital/i.test(text)) currentType = 'Hospital';

            if (currentType !== null) {
                let remainingSeconds = parseTimeString(text);

                // Timer may sit in a following sibling instead of the banner.
                if (remainingSeconds === null) {
                    let sibling = alertBanner.nextElementSibling;
                    for (let i = 0; i < 2 && sibling; i++) {
                        let timeVal = parseTimeString(sibling.innerText);
                        if (timeVal !== null) {
                            remainingSeconds = timeVal;
                            break;
                        }
                        sibling = sibling.nextElementSibling;
                    }
                }

                if (remainingSeconds !== null && remainingSeconds > 0) {
                    const calculatedLockFinish = Math.floor(Date.now() / 1000) + remainingSeconds;

                    if (!lockFinishTime || Math.abs(lockFinishTime - calculatedLockFinish) > 3 || lockType !== currentType) {
                        const isNewSentence = !lockFinishTime || lockType !== currentType;
                        lockType = currentType;
                        lockFinishTime = calculatedLockFinish;
                        localStorage.setItem('CELockType', lockType);
                        localStorage.setItem('CELockFinishTime', lockFinishTime);
                        // Re-arm release notify for a new sentence (flag persists across reloads).
                        if (isNewSentence) {
                            if (currentType === 'Prison') {
                                prisonNotified = false;
                                localStorage.setItem('CEPrisonNotified', 'false');
                            } else if (currentType === 'Hospital') {
                                hospitalNotified = false;
                                localStorage.setItem('CEHospitalNotified', 'false');
                            }
                        }
                    }
                }
            }
        } else {
            // Banner only reliable on /Jobs — clear lock only there (expiry handled in masterClock).
            const currentPath = window.location.pathname.toLowerCase();
            if (currentPath.includes('/jobs')) {
                if (lockFinishTime !== null) {
                    clearLockState();
                }
            }
        }
    }

    // Parse "1h 2m 3s" → seconds.
    function parseCountdownText(text) {
        text = text.trim().toLowerCase();
        let totalSeconds = 0;
        const hourMatch = text.match(/(\d+)\s*h/);
        const minMatch = text.match(/(\d+)\s*m/);
        const secMatch = text.match(/(\d+)\s*s/);

        if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600;
        if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;
        if (secMatch) totalSeconds += parseInt(secMatch[1], 10);
        return totalSeconds;
    }

    // Active job = the #cancelButton card; read its countdown.
    function scanForActiveJob() {
        const isJobsPage = window.location.pathname.toLowerCase().includes('/jobs');
        const now = Math.floor(Date.now() / 1000);

        const cancelBtn = document.querySelector('#cancelButton');
        if (!cancelBtn) {
            // Card gone with time left = cancelled → clear. But it also vanishes while
            // locked (job keeps running), so don't clear when locked.
            if (isJobsPage) {
                if (finishTime && (finishTime - now) > 2 && !detectStatusState()) {
                    clearJobState();
                }
            } else if (finishTime) {
                if ((finishTime - now) < -60) clearJobState();
            }
            return;
        }

        // Scope to the job's own .equipmentModule; .jobContainer leaks other job names.
        const card = cancelBtn.closest('.equipmentModule') || cancelBtn.closest('.jobContainer') || cancelBtn.parentElement;
        const text = card ? (card.innerText || "") : "";

        // Prefer absolute #progressMessage[data-bs-finishtime] (epoch s); fall back to text.
        const progressEl = (card && card.querySelector('#progressMessage')) || document.querySelector('#progressMessage');
        const finishAttr = progressEl ? parseInt(progressEl.getAttribute('data-bs-finishtime'), 10) : NaN;
        let calculatedFinishTime = null;
        if (Number.isFinite(finishAttr) && finishAttr > now) {
            calculatedFinishTime = finishAttr;
        } else {
            const timeMatch = text.match(/\b(?:(\d+)h\s*)?(?:(\d+)m\s*)?(\d+)s\b/i);
            if (timeMatch) {
                const remainingSeconds = parseCountdownText(timeMatch[0]);
                if (remainingSeconds > 0) calculatedFinishTime = now + remainingSeconds;
            }
        }

        if (calculatedFinishTime) {
            const detectedJob = identifyJobType(text);
            if (!finishTime || Math.abs(finishTime - calculatedFinishTime) > 2 || activeJobName !== detectedJob) {
                finishTime = calculatedFinishTime;
                activeJobName = detectedJob;
                jobNotified = false;
                localStorage.setItem('CEJobFinishTime', finishTime);
                localStorage.setItem('CEActiveJobName', activeJobName);
                localStorage.setItem('CEJobNotified', 'false');
            }
        }
    }

    function clearJobState() {
        finishTime = null;
        activeJobName = null;
        jobNotified = false;
        localStorage.removeItem('CEJobFinishTime');
        localStorage.removeItem('CEActiveJobName');
        localStorage.removeItem('CEJobNotified');
        localStorage.removeItem('CEJobFailed');
        localStorage.removeItem('CEJobSelfLocked');
    }

    function clearLockState() {
        lockType = null;
        lockFinishTime = null;
        localStorage.removeItem('CELockType');
        localStorage.removeItem('CELockFinishTime');
    }

    function formatSeconds(totalSeconds) {
        if (!totalSeconds || totalSeconds < 0) return "00:00";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let timeStr = "";
        if (hours > 0) timeStr += String(hours).padStart(2, '0') + ":";
        timeStr += String(minutes).padStart(2, '0') + ":" + String(seconds).padStart(2, '0');
        return timeStr;
    }

    // Cross-tab dedup (30s) + 250ms election so only one tab sends a duplicate.
    function sendDesktopNotification(title, body) {
        const sig = title + '|' + body;
        const now = Date.now();

        let last = null;
        try { last = JSON.parse(localStorage.getItem('CELastNotification')); } catch (e) {}

        // Recently sent/claimed by another tab.
        if (last && last.sig === sig && (now - last.time) < 30000) return;

        localStorage.setItem('CELastNotification', JSON.stringify({ sig: sig, time: now, tab: TAB_ID }));

        setTimeout(() => {
            let winner = null;
            try { winner = JSON.parse(localStorage.getItem('CELastNotification')); } catch (e) {}

            // Lost the election — another tab sends.
            if (winner && winner.sig === sig && winner.tab !== TAB_ID) return;

            if (typeof GM_notification !== 'undefined') {
                GM_notification({
                    title: title,
                    text: body,
                    image: squareIconBase64,
                    timeout: 8000
                });
            }
        }, 250);
    }

    // Live lock state → 'Hospital' | 'Prison' | null (icon primary, background fallback).
    function detectStatusState() {
        const hIcon = document.querySelector(HOSPITAL_ICON_SELECTOR);
        if (hIcon && !hIcon.classList.contains('d-none')) return 'Hospital';
        const jIcon = document.querySelector(JAIL_ICON_SELECTOR);
        if (jIcon && !jIcon.classList.contains('d-none')) return 'Prison';
        const bg = document.querySelector(MAIN_BG_SELECTOR);
        if (bg && bg.classList.contains(HOSPITAL_BG_CLASS)) return 'Hospital';
        if (bg && bg.classList.contains(JAIL_BG_CLASS)) return 'Prison';
        return null;
    }

    // Shared wording so dedup collapses duplicate detections into one alert.
    function notifyHospitalised(jobName) {
        sendDesktopNotification("Hospitalised!", `Your ${jobName || 'Job'} attempt failed and landed you in hospital.`);
    }

    function notifyArrested(jobName) {
        sendDesktopNotification("Arrested!", `Your ${jobName || 'Job'} attempt failed and got you sent to prison.`);
    }

    function notifyReleased(type) {
        sendDesktopNotification("Cartel Empire", type === 'Prison' ? "You're out of Jail!" : "You're out of the Hospital!");
    }

    // Go to /Jobs (reload if already there).
    function goToJobs() {
        if (window.location.pathname.toLowerCase().includes('/jobs')) {
            location.reload();
        } else {
            location.href = 'https://cartelempire.online/Jobs';
        }
    }

    // Locked→free: favour = silent, no redirect; timer release = notify + go to /Jobs.
    function handleRelease(releasedType) {
        const favTs = parseInt(localStorage.getItem('CEReleasedByFavour'), 10) || 0;
        const byFavour = (Date.now() - favTs) < 30000; // favour seen within ~1-2s

        clearLockState();
        document.title = `[FREE!] | ${originalTitle}`;

        if (byFavour) {
            localStorage.removeItem('CEReleasedByFavour');
            return;
        }

        notifyReleased(releasedType);
        const handledKey = 'release-' + releasedType;
        if (sessionStorage.getItem('CELockReleaseHandled') !== handledKey) {
            sessionStorage.setItem('CELockReleaseHandled', handledKey);
            document.title = `[FREE!] Heading to Jobs… | ${originalTitle}`;
            setTimeout(goToJobs, 1200);
        }
    }

    function masterClock() {
        // Used below only to tell job fail from success; consequence banners → processBanner.
        const alertBanner = document.querySelector('div[class*="bg-danger"], div[class*="alert-danger"], .alert-danger');

        scanForActiveJob();
        syncStatusBanners();

        const now = Math.floor(Date.now() / 1000);

        // Locked→free on any tab (live status is truth). Gated on observedLockedThisSession.
        const liveStatus = detectStatusState(); // 'Hospital' | 'Prison' | null
        if (liveStatus) observedLockedThisSession = true;
        if (lockType && observedLockedThisSession && liveStatus === null) {
            handleRelease(lockType);
            return;
        }

        if (lockFinishTime) {
            const lockRemaining = lockFinishTime - now;
            // Job still running under a self-lock → show its countdown, don't wipe it.
            const jobStillRunning = finishTime && (finishTime - now) > SELF_LOCK_GRACE;

            if (lockRemaining > 0 && !jobStillRunning) {
                if (finishTime) clearJobState();
                document.title = `[${lockType}] ${formatSeconds(lockRemaining)} | ${originalTitle}`;
                return;
            } else if (lockRemaining <= 0) {
                // Timer hit 0 without a live-status release: notify once + go /Jobs (keyed on finish).
                document.title = `[FREE!] | ${originalTitle}`;

                if (lockType === 'Prison' && !prisonNotified) {
                    notifyReleased('Prison');
                    prisonNotified = true;
                    localStorage.setItem('CEPrisonNotified', 'true');
                }
                if (lockType === 'Hospital' && !hospitalNotified) {
                    notifyReleased('Hospital');
                    hospitalNotified = true;
                    localStorage.setItem('CEHospitalNotified', 'true');
                }

                const handledKey = String(lockFinishTime);
                if (sessionStorage.getItem('CELockExpiryReloaded') !== handledKey) {
                    sessionStorage.setItem('CELockExpiryReloaded', handledKey);
                    clearLockState();
                    document.title = `[FREE!] Heading to Jobs… | ${originalTitle}`;
                    setTimeout(goToJobs, 1200);
                } else {
                    clearLockState();
                }
                return;
            }
        }

        if (finishTime) {
            const remaining = finishTime - now;

            // Lock near timer end = job outcome; earlier lock = self-lock → remember + keep counting.
            const consequence = detectStatusState(); // 'Hospital' | 'Prison' | null
            if (consequence && remaining > SELF_LOCK_GRACE) {
                localStorage.setItem('CEJobSelfLocked', String(finishTime));
            }
            const jobSelfLocked = (parseInt(localStorage.getItem('CEJobSelfLocked'), 10) || 0) === finishTime;

            // Fire only near timer end and not self-locked; else fall through to done/fail.
            if (consequence && !jobSelfLocked && remaining <= SELF_LOCK_GRACE) {
                document.title = `[${consequence === 'Prison' ? 'ARRESTED' : 'HOSPITALISED'}] | ${originalTitle}`;
                if (lockType !== consequence) {
                    lockType = consequence;
                    localStorage.setItem('CELockType', consequence);
                }
                if (!jobNotified) {
                    if (consequence === 'Prison') notifyArrested(activeJobName);
                    else notifyHospitalised(activeJobName);
                    jobNotified = true;
                    localStorage.setItem('CEJobNotified', 'true');
                }
                // Keep finishTime so the tag persists; lock sync takes over the countdown.
                return;
            }

            if (remaining > 0) {
                document.title = `[${activeJobName}] ${formatSeconds(remaining)} | ${originalTitle}`;
            } else if (remaining >= -10) {
                const hasFailed = alertBanner && /failed/i.test(alertBanner.innerText);

                if (hasFailed || localStorage.getItem('CEJobFailed') === 'true') {
                    localStorage.setItem('CEJobFailed', 'true');
                    document.title = `[JOB FAILED] | ${originalTitle}`;

                    if (!jobNotified) {
                        sendDesktopNotification("Job Failed!", `Your active ${activeJobName || 'Job'} operation has failed.`);
                        jobNotified = true;
                        localStorage.setItem('CEJobNotified', 'true');
                    }
                } else {
                    document.title = `[JOB DONE] | ${originalTitle}`;

                    // Hold success ~3s so a delayed hospital/jail update can pre-empt it.
                    if (!jobNotified && remaining <= -3) {
                        sendDesktopNotification("Job Complete!", `Your active ${activeJobName || 'Job'} operation has finished.`);
                        jobNotified = true;
                        localStorage.setItem('CEJobNotified', 'true');
                    }
                }
            } else {
                clearJobState();
                document.title = `[No Job Running] | ${originalTitle}`;
            }
        } else {
            document.title = `[No Job Running] | ${originalTitle}`;
        }
    }

    // Jitter start so multi-tab ticks don't collide.
    setTimeout(() => {
        initScan();
        masterClock();
        setInterval(masterClock, 1000);
    }, Math.floor(Math.random() * 700));

})();
