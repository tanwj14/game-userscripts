// ==UserScript==
// @name         Cartel Empire - Gym Coke Consumption
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Left-edge floating widget on the Gym page to consume Cocaine and instantly refresh the workout energy boxes (no reload), with a live drug-cooldown readout.
// @author       PureVirginPulp [1611]
// @match        https://cartelempire.online/Gym
// @grant        none
// @icon         https://cartelempire.online/images/icon-white.png
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-gym-coke-consumption.user.js
// @downloadURL  https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-gym-coke-consumption.user.js
// ==/UserScript==

(function () {
    'use strict';

    if (document.getElementById('ceCoke')) return; // guard against double-inject

    const CACHE_KEY = 'ceGymCokeId';        // cached inventory GUID for Cocaine
    const CD_KEY = 'ceGymCokeCooldown';     // persisted { end, cap } cooldown snapshot
    const COKE_LABEL = 'Take Cocaine';      // EXACT match — "Take Tainted Cocaine" is a different item
    const DEFAULT_CAP = 24 * 3600;          // fallback cooldown cap; real value comes from the game
    const REFRESH_MS = 15000;               // throttle owned-count re-fetches on panel open
    const FETCH_TIMEOUT = 6000;             // abort a slow inventory fetch, keep the last-known count

    // ---------- time helpers ----------
    const hmsToSec = (hms) => {
        const p = String(hms).split(':').map(Number);
        return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0;
    };
    const fmt = (sec) => {
        sec = Math.max(0, Math.round(sec));
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // ---------- state ----------
    let cooldownEnd = 0;          // ms timestamp when cooldown clears (0 = none / unknown)
    let capSec = DEFAULT_CAP;     // cooldown cap in seconds (server-authoritative once known)
    let qty = null;              // owned Cocaine count
    let busy = false;
    let lastInvFetch = 0;        // ms of the last completed inventory read (throttle window)
    let invFetching = false;     // guard against overlapping inventory fetches
    let training = false;        // guard against overlapping train submits

    // ---------- inventory / consume ----------
    async function fetchInventoryDoc() {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT); // don't let a slow fetch hang
        try {
            const r = await fetch('/Inventory', { cache: 'no-cache', credentials: 'same-origin', signal: ctrl.signal });
            if (!r.ok) throw new Error('inventory request failed (' + r.status + ')');
            return new DOMParser().parseFromString(await r.text(), 'text/html');
        } finally {
            clearTimeout(t);
        }
    }
    function readCoke(doc) {
        const btn = Array.from(doc.querySelectorAll('.use-item-btn'))
            .find((b) => (b.getAttribute('aria-label') || '') === COKE_LABEL);
        if (!btn) return null;
        let count = null;
        const row = btn.closest('.inventoryItemWrapper');
        if (row) {
            // name-anchored so "Tainted Cocaine x1890" can't bleed into the plain-Cocaine count
            const m = row.textContent.replace(/\s+/g, ' ').match(/(?:^|[^a-z])Cocaine\s*x\s*([\d,]+)/i);
            if (m) count = parseInt(m[1].replace(/,/g, ''), 10);
        }
        return { id: btn.getAttribute('id'), count };
    }
    // Refresh id (cached) + owned count from a live inventory fetch.
    async function refreshFromInventory() {
        const coke = readCoke(await fetchInventoryDoc());
        if (coke && coke.id) {
            localStorage.setItem(CACHE_KEY, coke.id);
            qty = coke.count;
        } else {
            qty = 0;
        }
        lastInvFetch = Date.now(); // completed read → (re)start the throttle window
        return coke;
    }
    // Non-blocking, throttled owned-count refresh; keeps the last-known count on failure/timeout.
    function refreshInventoryCount(force) {
        if (invFetching || (!force && Date.now() - lastInvFetch < REFRESH_MS)) return;
        invFetching = true;
        refreshFromInventory()
            .catch((e) => { if (force) setStatus('Error: ' + e.message, 'err'); }) // background failures stay quiet
            .finally(() => { invFetching = false; render(); });
    }
    async function postUse(id) {
        const r = await fetch('/Inventory/Use?id=' + id, { method: 'POST', credentials: 'same-origin' });
        try { return await r.json(); } catch { return null; }
    }

    async function consume() {
        if (busy || atMaxCd()) return; // maxed cooldown: block even programmatic triggers
        busy = true; render();
        setStatus('Taking Cocaine…', 'muted');
        try {
            let id = localStorage.getItem(CACHE_KEY);
            if (!id) { const c = await refreshFromInventory(); id = c && c.id; }
            if (!id) { setStatus('No Cocaine in your inventory.', 'err'); return; }

            let data = await postUse(id);
            // stale cached id (e.g. stack emptied/changed) → re-resolve once and retry
            if (!isSuccess(data)) {
                const c = await refreshFromInventory();
                if (c && c.id && c.id !== id) data = await postUse(c.id);
            }

            if (isSuccess(data)) {
                applySuccess(data.statusMsg.success);
            } else {
                setStatus((data && data.statusMsg && data.statusMsg.error) || 'Could not use Cocaine.', 'err');
            }
        } catch (e) {
            setStatus('Error: ' + e.message, 'err');
        } finally {
            busy = false; render();
        }
    }
    const isSuccess = (d) => d && d.status === 200 && d.statusMsg && d.statusMsg.success;

    // Parse the game's own success message for the authoritative new energy + cooldown/cap.
    function applySuccess(msg) {
        const total = msg.match(/for a total of (\d[\d,]*)/i);
        if (total) setEnergy(parseInt(total[1].replace(/,/g, ''), 10));

        // "Drug cooldown has increased to 12:00:23/24:00:00" — never assume a fixed +3h (events halve it)
        const cd = msg.match(/increased to\s*(\d{1,2}:\d{2}:\d{2})\s*\/\s*(\d{1,2}:\d{2}:\d{2})/i);
        if (cd) { cooldownEnd = Date.now() + hmsToSec(cd[1]) * 1000; capSec = hmsToSec(cd[2]); saveCooldown(); }

        if (qty != null) qty = Math.max(0, qty - 1);
        setStatus(msg, 'ok');
    }

    // ---------- the fix: make the new energy usable in the workout boxes without a reload ----------
    function setEnergy(newEnergy) {
        const cur = document.querySelector('#currentEnergy');
        if (cur) cur.innerText = newEnergy;
        const maxEl = document.querySelector('#maxEnergy');
        const max = maxEl ? parseInt((maxEl.innerText || '').replace(/,/g, ''), 10) : NaN;
        const denom = Number.isFinite(max) && max > 0 ? max : newEnergy;
        const bar = document.querySelector('#energyProgress');
        if (bar) {
            bar.style.width = Math.min(100, (newEnergy / denom) * 100) + '%';
            bar.setAttribute('aria-valuenow', newEnergy);
        }
        // each of the 4 Train forms has a static energyToUse snapshot; raise cap + value to the new energy
        document.querySelectorAll('input[name="energyToUse"]').forEach((inp) => {
            inp.setAttribute('max', String(newEnergy));
            inp.value = String(newEnergy);
            inp.setAttribute('placeholder', String(newEnergy));
            inp.setAttribute('aria-label', String(newEnergy));
        });
    }

    // ---------- in-place training: AJAX the native workout POST so the page (and widget) don't reload ----------
    async function submitTrain(form) {
        const input = form.querySelector('input[name="energyToUse"]');
        const r = await fetch(form.getAttribute('action'), {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'energyToUse=' + encodeURIComponent(input ? input.value : ''),
        });
        if (!r.ok) throw new Error('train request failed (' + r.status + ')');
        return new DOMParser().parseFromString(await r.text(), 'text/html');
    }
    // clone the server's own result banner (.statusAlertBox, success or danger) into the gym column
    function showTrainBanner(doc) {
        const box = doc.querySelector('.statusAlertBox');
        const anchor = document.querySelector('#mainBackground .container .row .col-12')
            || document.querySelector('#mainBackground .container');
        if (!box || !anchor) return false;
        document.querySelectorAll('.ceCoke-trainmsg').forEach((n) => n.remove()); // drop a prior injected banner
        const el = box.cloneNode(true);
        el.classList.add('ceCoke-trainmsg');
        anchor.insertBefore(el, anchor.firstChild);
        el.scrollIntoView({ block: 'nearest' });
        return true;
    }
    // snapshot each Train button's label at load and restore it after a train, so a co-installed script's disabled "Please wait" can't stick once we suppress the reload
    const trainButton = (form) => form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
    const btnLabel = (b) => (b.tagName === 'INPUT' ? b.value : b.textContent);
    const setBtnLabel = (b, v) => { if (v == null) return; if (b.tagName === 'INPUT') b.value = v; else b.textContent = v; };
    function snapshotTrainButtons() {
        document.querySelectorAll('form[action^="/gym/train/"]').forEach((f) => {
            const b = trainButton(f);
            if (b && b.dataset.ceOrigLabel == null) b.dataset.ceOrigLabel = btnLabel(b);
        });
    }
    function restoreTrainButton(b) {
        if (!b) return;
        b.disabled = false; b.removeAttribute('disabled');
        setBtnLabel(b, b.dataset.ceOrigLabel);
    }
    function onTrainSubmit(e) {
        const form = e.target;
        if (!form || form.tagName !== 'FORM' || !/^\/gym\/train\//i.test(form.getAttribute('action') || '')) return;
        e.preventDefault();
        if (training) return; // ignore rapid double-submits
        training = true;
        const btn = e.submitter || trainButton(form); // reset THIS button so it can't stay stuck disabled
        submitTrain(form).then((doc) => {
            const shown = showTrainBanner(doc);
            const cur = doc.querySelector('#currentEnergy');
            const n = cur ? parseInt((cur.innerText || '').replace(/,/g, ''), 10) : NaN;
            if (Number.isFinite(n)) setEnergy(n); // sync energy + workout boxes to the post-train value
            // unrecognised 2xx: the POST already hit the server — reload to show truth, never re-train (would double-spend)
            if (!shown && !Number.isFinite(n)) location.reload();
        }).catch(() => {
            location.reload(); // request failed — reflect real state via reload; never auto-resubmit (could double-train)
        }).finally(() => { training = false; restoreTrainButton(btn); });
    }

    // ---------- initial cooldown (read the drug pill's on-show popover, flash-free) ----------
    function seedCooldownFromPill(retries = 2) {
        const icon = document.querySelector('.drugIcon');
        // pill is revealed client-side (~600ms post-load) — only trust "clear" once retries are spent
        if (!icon || icon.classList.contains('d-none')) {
            if (retries > 0) { setTimeout(() => seedCooldownFromPill(retries - 1), retries === 2 ? 1000 : 3000); return; }
            cooldownEnd = 0; try { localStorage.removeItem(CD_KEY); } catch (e) {} render();
            return;
        }
        const anchor = icon.querySelector('a.hovertext');
        if (!anchor) return;
        let inst = null;
        const done = () => {
            try { if (inst) inst.hide(); } catch (e) { /* popover may already be disposed */ }
            document.documentElement.classList.remove('ceCoke-reading');
        };
        try {
            document.documentElement.classList.add('ceCoke-reading'); // hide the popover while we read it
            inst = bootstrap.Popover.getOrCreateInstance(anchor);
            inst.show();
            // the game swaps in the live "…HH:MM:SS" text asynchronously — poll instead of one fixed read
            const t0 = Date.now();
            const poll = setInterval(() => {
                const body = document.querySelector('.popover .popover-body');
                const m = body && body.innerText.match(/(\d{1,2}:\d{2}:\d{2})/);
                if (m) {
                    clearInterval(poll);
                    cooldownEnd = Date.now() + hmsToSec(m[1]) * 1000;
                    saveCooldown(); // popover is authoritative — reconcile the stored value
                    done(); render();
                } else if (Date.now() - t0 > 2000) {
                    clearInterval(poll); done();
                    // pill says a cooldown exists but no timer was read — retry the whole seed
                    if (retries > 0) setTimeout(() => seedCooldownFromPill(retries - 1), retries === 2 ? 1000 : 3000);
                }
            }, 120);
        } catch (e) {
            done();
        }
    }
    const cdRemaining = () => (cooldownEnd ? Math.max(0, (cooldownEnd - Date.now()) / 1000) : 0);
    // 2s tolerance so an exact-cap readout still counts as maxed
    const atMaxCd = () => capSec > 0 && cdRemaining() >= capSec - 2;

    // persist as an absolute end-time so remaining stays correct across reloads/navigation
    const saveCooldown = () => { try { localStorage.setItem(CD_KEY, JSON.stringify({ end: cooldownEnd, cap: capSec })); } catch (e) {} };
    function restoreCooldown() {
        try {
            const s = JSON.parse(localStorage.getItem(CD_KEY) || 'null');
            if (s && s.end > Date.now()) { cooldownEnd = s.end; if (s.cap > 0) capSec = s.cap; }
        } catch (e) {}
    }

    // ---------- UI ----------
    const el = {};
    function buildUI() {
        const style = document.createElement('style');
        style.textContent = `
            .ceCoke-reading .popover { opacity: 0 !important; pointer-events: none !important; }
            #ceCoke { position: fixed; left: 12px; top: 50%; transform: translateY(-50%);
                z-index: 1030; font-family: inherit; display: flex; align-items: center; }
            #ceCoke .ce-tab { width: 44px; height: 44px; border-radius: 50%; cursor: pointer; flex: none;
                background: linear-gradient(180deg, #242834, #191c24); border: 1px solid #3a3f4b;
                display: flex; align-items: center; justify-content: center; overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,.5);
                transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
            #ceCoke .ce-tab:hover { transform: scale(1.07); border-color: #565d6d; box-shadow: 0 3px 14px rgba(0,0,0,.6); }
            #ceCoke .ce-tab:focus-visible { outline: 2px solid #8bd18e; outline-offset: 2px; }
            #ceCoke.open .ce-tab { border-color: #565d6d; }
            /* item art is a wide 150x75 sprite — square cover-crop instead of squishing it */
            #ceCoke .ce-tab img { width: 30px; height: 30px; object-fit: cover; }
            #ceCoke .ce-panel { width: 236px; margin-left: 10px; padding: 12px 14px;
                background: #1c1f26; border: 1px solid #3a3f4b; border-radius: 10px; color: #e6e6e6;
                box-shadow: 0 6px 20px rgba(0,0,0,.55);
                opacity: 0; visibility: hidden; pointer-events: none;
                transform-origin: left center; transform: translateX(-8px) scale(.98);
                /* closing: keep width fixed, fade+slide, then hide only after the fade ends */
                transition: opacity .18s ease, transform .18s ease, visibility 0s linear .18s; }
            #ceCoke.open .ce-panel { opacity: 1; visibility: visible; transform: none; pointer-events: auto;
                transition: opacity .18s ease, transform .18s ease, visibility 0s; }
            #ceCoke .ce-h { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 14px;
                margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid #2a2e38; }
            #ceCoke .ce-h img { width: 20px; height: 20px; object-fit: cover; }
            #ceCoke .ce-qty { display: flex; justify-content: space-between; align-items: baseline;
                font-size: 12px; color: #9aa0ac; margin: 0 0 10px; }
            #ceCoke .ce-qtyval { font-size: 15px; font-weight: 700; color: #e6e6e6; font-variant-numeric: tabular-nums; }
            #ceCoke .ce-take { width: 100%; padding: 8px 10px; border: 1px solid #35913a; border-radius: 7px;
                background: #2e7d32; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer;
                transition: background .15s ease; }
            #ceCoke .ce-take:hover:not(:disabled) { background: #35913a; }
            #ceCoke .ce-take:active:not(:disabled) { transform: translateY(1px); }
            #ceCoke .ce-take:focus-visible { outline: 2px solid #8bd18e; outline-offset: 2px; }
            #ceCoke .ce-take:disabled { background: #2a2e38; border-color: #3a3f4b; color: #7a8090; cursor: not-allowed; }
            /* maxed cooldown: red, beats the grey :disabled rule */
            #ceCoke .ce-take.maxcd:disabled { background: #b53a35; border-color: #d9534f; color: #fff; cursor: not-allowed; }
            #ceCoke .ce-cd { display: flex; justify-content: space-between; align-items: baseline;
                font-size: 11px; color: #9aa0ac; margin-top: 12px; }
            #ceCoke .ce-cdval { color: #c7ccd6; font-variant-numeric: tabular-nums; }
            #ceCoke .ce-cdval.ready { color: #8bd18e; font-weight: 600; }
            #ceCoke .ce-bar { height: 5px; border-radius: 3px; background: #2a2e38; margin-top: 5px; overflow: hidden; }
            #ceCoke .ce-bar > span { display: block; height: 100%; width: 0; border-radius: 3px;
                background: #57b45c; transition: width .3s ease, background-color .3s ease; }
            #ceCoke .ce-bar > span.warn { background: #e0a53f; }
            #ceCoke .ce-bar > span.hot { background: #d9534f; }
            #ceCoke .ce-msg { font-size: 11px; margin-top: 8px; line-height: 1.35; min-height: 14px; }
            #ceCoke .ce-msg.ok { color: #8bd18e; } #ceCoke .ce-msg.err { color: #e88; } #ceCoke .ce-msg.muted { color: #9aa0ac; }
        `;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.id = 'ceCoke';
        root.innerHTML = `
            <div class="ce-tab" role="button" tabindex="0" title="Cocaine" aria-label="Cocaine panel" aria-expanded="false">
                <img src="/images/items/301.png" alt=""></div>
            <div class="ce-panel">
                <div class="ce-h"><img src="/images/items/301.png" alt="">Cocaine</div>
                <div class="ce-qty">Owned <span class="ce-qtyval">…</span></div>
                <button class="ce-take" type="button">Take Cocaine</button>
                <div class="ce-cd">Drug cooldown <span class="ce-cdval">—</span></div>
                <div class="ce-bar"><span class="ce-barfill"></span></div>
                <div class="ce-msg" aria-live="polite"></div>
            </div>`;
        document.body.appendChild(root);

        el.root = root;
        el.tab = root.querySelector('.ce-tab');
        el.take = root.querySelector('.ce-take');
        el.qty = root.querySelector('.ce-qtyval');
        el.cdRow = root.querySelector('.ce-cd');
        el.cd = root.querySelector('.ce-cdval');
        el.bar = root.querySelector('.ce-barfill');
        el.msg = root.querySelector('.ce-msg');

        // toggle via click or keyboard; opening refreshes the count (forced on first load, else throttled)
        const toggle = () => {
            const open = root.classList.toggle('open');
            el.tab.setAttribute('aria-expanded', String(open));
            if (open) refreshInventoryCount(qty == null);
        };
        el.tab.addEventListener('click', toggle);
        el.tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) toggle(); });
        el.take.addEventListener('click', consume);
    }

    function setStatus(text, cls) { if (el.msg) { el.msg.textContent = text; el.msg.className = 'ce-msg ' + (cls || ''); } }

    function render() {
        if (!el.root) return;
        el.qty.textContent = qty == null ? '…' : qty.toLocaleString('en-US');
        const rem = cdRemaining();
        const ready = !cooldownEnd || rem <= 0;
        el.cd.textContent = ready ? 'ready' : `${fmt(rem)} / ${fmt(capSec)}`;
        el.cd.classList.toggle('ready', ready);
        const ratio = ready ? 0 : Math.min(1, rem / capSec);
        el.bar.style.width = ratio * 100 + '%';
        el.bar.className = 'ce-barfill' + (ratio >= 0.85 ? ' hot' : ratio >= 0.5 ? ' warn' : '');
        el.cdRow.title = ready ? '' : 'Headroom to cap: ' + fmt(capSec - rem);
        // button state priority: busy > at-max-cooldown > out-of-stock > normal
        const outOfStock = qty === 0;
        const atMax = atMaxCd();
        el.take.disabled = busy || atMax || outOfStock;
        el.take.textContent = busy ? 'Taking…' : atMax ? 'At max cooldown' : outOfStock ? 'None left' : 'Take Cocaine';
        el.take.classList.toggle('maxcd', !busy && atMax);
    }

    // ---------- init ----------
    restoreCooldown(); // instant readout from the last known value; the seed reconciles it
    buildUI();
    render();
    snapshotTrainButtons(); // capture pristine "Train" labels before a click can flip them to "Please wait"
    document.addEventListener('submit', onTrainSubmit, true); // intercept the native workout POSTs
    // bootstrap can lag document-idle — wait for it (≤5s) before seeding
    (function waitBoot(tries) {
        if (window.bootstrap && bootstrap.Popover) return seedCooldownFromPill();
        if (tries > 0) setTimeout(() => waitBoot(tries - 1), 500);
    })(10);
    setInterval(render, 1000);
})();
