// ==UserScript==
// @name         Cartel Empire - Gym Energy
// @namespace    http://tampermonkey.net/
// @version      2.0.3
// @description  Left-edge floating widget on the Gym page to top up energy from Cocaine + alcohol, with per-group drug/booster cooldown readouts, and to train in place without a full-page reload.
// @author       PureVirginPulp [1611]
// @match        https://cartelempire.online/Gym
// @grant        none
// @icon         https://cartelempire.online/images/icon-white.png
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-gym-energy.user.js
// @downloadURL  https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/cartel-empire/cartel-empire-gym-energy.user.js
// ==/UserScript==

(function () {
    'use strict';

    if (document.getElementById('ceGym')) return; // guard against double-inject

    const DEFAULT_CAP = 24 * 3600;          // fallback cooldown cap (drug + booster share it); real value comes from the game
    const REFRESH_MS = 15000;               // throttle inventory re-fetches on panel open
    const FETCH_TIMEOUT = 6000;             // abort a slow inventory fetch, keep the last-known list
    const RECONCILE_MS = 60000;             // periodic popover re-read so the clocks stay honest without a reload
    const COKE_LABEL = 'Take Cocaine';      // EXACT match — "Take Tainted Cocaine" is a different item
    // alcohols in tier order (cheapest→priciest); anything unlisted sorts last, stable
    const ALC_ORDER = ['Corana Beer', 'Mexcal Beer', 'Blancoda Tequila', 'Repose Tequila', 'Anejo Tequila', 'Raicilla'];
    const alcIdx = (n) => { const i = ALC_ORDER.indexOf(n); return i < 0 ? 99 : i; };

    // two independent cooldown groups; drug reuses the v1.x key so mid-cooldown users don't lose it on upgrade
    const GROUPS = {
        drug:    { icon: '.drugIcon',    key: 'ceGymCokeCooldown',    cooldownEnd: 0, capSec: DEFAULT_CAP, authAt: 0 },
        booster: { icon: '.boosterIcon', key: 'ceGymBoosterCooldown', cooldownEnd: 0, capSec: DEFAULT_CAP, authAt: 0 },
    };

    // ---------- time helpers ----------
    // accepts D:HH:MM:SS (≥24h cooldowns), HH:MM:SS, or MM:SS
    const hmsToSec = (hms) => {
        const p = String(hms).split(':').map(Number);
        if (p.length === 4) return p[0] * 86400 + p[1] * 3600 + p[2] * 60 + p[3];
        return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0;
    };
    const fmt = (sec) => {
        sec = Math.max(0, Math.round(sec));
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // regex-safe item name

    // ---------- state ----------
    let items = null;            // consumables list [{name,id,count,group}] (null = not loaded)
    let lastInvFetch = 0;        // ms of the last completed inventory read (throttle window)
    let invPromise = null;       // shared in-flight inventory read — concurrent callers reuse it
    let training = false;        // guard against overlapping train submits
    const busyKeys = new Set();  // group|name of items mid-consume (survives id changes on retry)
    const itemKey = (it) => it.group + '|' + it.name;

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
    // collect Cocaine (drug) + every owned alcohol (booster) from one inventory doc
    function readConsumables(doc) {
        const list = [];
        const seen = new Set(); // inventory renders each button twice (desktop+mobile dupes) — keep the first
        doc.querySelectorAll('.use-item-btn').forEach((btn) => {
            const aria = btn.getAttribute('aria-label') || '';
            const row = btn.closest('.inventoryItemWrapper');
            const text = row ? row.textContent.replace(/\s+/g, ' ') : '';
            let group = null, name = null;
            if (aria === COKE_LABEL) { group = 'drug'; name = 'Cocaine'; }
            else if (/^Drink\s+/i.test(aria) && /\bAlcohol\b/i.test(text)) { group = 'booster'; name = aria.replace(/^Drink\s+/i, '').trim(); }
            else return;
            if (seen.has(group + '|' + name)) return;
            seen.add(group + '|' + name);
            // name-anchored count so "Tainted Cocaine x1890" / other tequilas can't bleed in
            let count = null;
            const m = text.match(new RegExp('(?:^|[^a-z])' + esc(name) + '\\s*x\\s*([\\d,]+)', 'i'));
            if (m) count = parseInt(m[1].replace(/,/g, ''), 10);
            list.push({ id: btn.getAttribute('id'), name, count, group });
        });
        return list;
    }
    // Single-flight inventory read: concurrent callers (panel open + consume retry) share one fetch.
    function refreshFromInventory() {
        if (invPromise) return invPromise;
        invPromise = (async () => {
            items = readConsumables(await fetchInventoryDoc());
            lastInvFetch = Date.now(); // completed read → (re)start the throttle window
            renderRows();              // item set changed → rebuild rows
            return items;
        })().finally(() => { invPromise = null; });
        return invPromise;
    }
    // Non-blocking, throttled inventory refresh; keeps the last-known list on failure/timeout.
    function refreshInventory(force) {
        if (invPromise || (!force && Date.now() - lastInvFetch < REFRESH_MS)) return;
        refreshFromInventory()
            .catch((e) => { if (force) setStatus('Error: ' + e.message, 'err'); }) // background failures stay quiet
            .finally(() => render());
    }
    async function postUse(id) {
        const r = await fetch('/Inventory/Use?id=' + id, { method: 'POST', credentials: 'same-origin' });
        try { return await r.json(); } catch { return null; }
    }
    const isSuccess = (d) => d && d.status === 200 && d.statusMsg && d.statusMsg.success;
    // real rejection wording: "Couldn't use Corana Beer as you're at max Booster cooldown."
    const isMaxCdError = (d) => /at max \w+ cooldown/i.test((d && d.statusMsg && d.statusMsg.error) || '');
    const findItem = (group, name) => (items || []).find((it) => it.group === group && it.name === name);

    async function consume(item) {
        const g = GROUPS[item.group];
        if (busyKeys.has(itemKey(item)) || atMaxCd(g)) return; // maxed group: block even programmatic triggers
        const key = itemKey(item);
        const drink = item.group === 'booster';
        busyKeys.add(key); render();
        setStatus((drink ? 'Drinking ' : 'Taking ') + item.name + '…', 'muted');
        try {
            let data = item.id ? await postUse(item.id) : null;
            // stale id (stack emptied/changed) → re-resolve by name+group and retry once; a max rejection isn't a stale id
            if (!isSuccess(data) && !isMaxCdError(data)) {
                await refreshFromInventory();
                const fresh = findItem(item.group, item.name);
                if (fresh && fresh.id && fresh.id !== item.id) data = await postUse(fresh.id);
                if (fresh) item = fresh;
            }
            if (isSuccess(data)) {
                applySuccess(data, item);
            } else {
                // server says maxed → grey the group now; the (possibly lagging) popover may not roll this back
                if (isMaxCdError(data)) { g.cooldownEnd = Math.max(g.cooldownEnd, Date.now() + g.capSec * 1000); g.authAt = Date.now(); saveCooldown(g); }
                setStatus((data && data.statusMsg && data.statusMsg.error) || 'Could not use ' + item.name + '.', 'err');
            }
        } catch (e) {
            setStatus('Error: ' + e.message, 'err');
        } finally {
            busyKeys.delete(key); render();
        }
    }

    // Apply a consume success: new energy + this group's cooldown, without depending on message wording.
    function applySuccess(data, item) {
        const msg = data.statusMsg.success;
        // energy: absolute total when the message carries it, else current + the response's energyGained field
        const total = msg.match(/for a total of (\d[\d,]*)/i);
        if (total) {
            setEnergy(parseInt(total[1].replace(/,/g, ''), 10));
        } else if (data.energyGained > 0) {
            const curEl = document.querySelector('#currentEnergy');
            const cur = curEl ? parseInt((curEl.innerText || '').replace(/,/g, ''), 10) : NaN;
            if (Number.isFinite(cur)) setEnergy(cur + data.energyGained);
        }

        // real wording: "Drug cooldown has increased to 26:59:41/24:00:00." (hours run past 24, no day part)
        const g = GROUPS[item.group];
        const cd = msg.match(/increased to\s*(\d{1,3}(?::\d{2}){2,3})\s*\/\s*(\d{1,2}(?::\d{2}){2,3})/i);
        if (cd) {
            // the message is server truth — mark it so a lagging popover read can't roll the clock back
            g.cooldownEnd = Date.now() + hmsToSec(cd[1]) * 1000; g.capSec = hmsToSec(cd[2]); g.authAt = Date.now(); saveCooldown(g);
        } else if (/cooldown is maxed/i.test(msg)) {
            // real maxed-drink wording: "You drank a Blancoda Tequila, your Alcohol cooldown is maxed!" —
            // no time given, but maxed is server truth: grey the group now instead of waiting for the popover.
            // The retries still converge on the exact overshoot (a higher popover read passes the
            // anti-rollback guard; a stale lower one is rejected).
            g.cooldownEnd = Math.max(g.cooldownEnd, Date.now() + g.capSec * 1000); g.authAt = Date.now(); saveCooldown(g);
            [1000, 25000, 65000].forEach((ms) => setTimeout(() => reconcileCooldown(g), ms));
        } else {
            // wording missed → the popover is the only source, but it lags AJAX consumes by up to ~1min: retry until fresh
            [1000, 25000, 65000].forEach((ms) => setTimeout(() => reconcileCooldown(g), ms));
        }

        if (item.count != null) item.count = Math.max(0, item.count - 1);
        setStatus(msg, 'ok');
    }

    // ---------- make the new energy usable in the workout boxes without a reload ----------
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
        document.querySelectorAll('.ceGym-trainmsg').forEach((n) => n.remove()); // drop a prior injected banner
        const clone = box.cloneNode(true);
        clone.classList.add('ceGym-trainmsg');
        anchor.insertBefore(clone, anchor.firstChild);
        clone.scrollIntoView({ block: 'nearest' });
        return true;
    }
    // snapshot each Train button's label at load and restore it after a train, so a co-installed "Please wait" submit handler can't leave it stuck once we suppress the reload
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

    // ---------- cooldown seeding (read each icon's on-show popover, flash-free) ----------
    let readingRefs = 0; // ref-count so two concurrent seeds don't unhide each other's popover early
    const beginReading = () => { readingRefs++; document.documentElement.classList.add('ceGym-reading'); };
    const endReading = () => { if (--readingRefs <= 0) { readingRefs = 0; document.documentElement.classList.remove('ceGym-reading'); } };

    function seedCooldown(group, retries = 2) {
        const icon = document.querySelector(group.icon);
        // icon is revealed client-side (~600ms post-load) — only trust "clear" once retries are spent
        if (!icon || icon.classList.contains('d-none')) {
            if (retries > 0) { setTimeout(() => seedCooldown(group, retries - 1), retries === 2 ? 1000 : 3000); return; }
            group.cooldownEnd = 0; try { localStorage.removeItem(group.key); } catch (e) {} render();
            return;
        }
        const anchor = icon.querySelector('a.hovertext');
        if (!anchor) return;
        let inst = null;
        const done = () => { try { if (inst) inst.hide(); } catch (e) { /* popover may already be disposed */ } endReading(); };
        try {
            beginReading();
            inst = bootstrap.Popover.getOrCreateInstance(anchor);
            inst.show();
            // the game swaps in the live time text asynchronously — poll this popover (scoped by aria-describedby) instead of one fixed read
            const t0 = Date.now();
            const poll = setInterval(() => {
                const pop = document.getElementById(anchor.getAttribute('aria-describedby'));
                const body = pop && pop.querySelector('.popover-body');
                const m = body && body.innerText.match(/(\d{1,2}(?::\d{2}){2,3})/); // day-aware: D:HH:MM:SS at/over 24h
                if (m) {
                    clearInterval(poll);
                    // the popover countdown lags AJAX consumes (~1min): while a fresh server-confirmed value
                    // is in force, ignore a popover read that would roll the clock back by more than drift
                    const remMs = hmsToSec(m[1]) * 1000;
                    const stale = group.authAt && Date.now() - group.authAt < 120000
                        && remMs < (group.cooldownEnd - Date.now()) - 60000;
                    if (!stale) { group.cooldownEnd = Date.now() + remMs; saveCooldown(group); }
                    done(); render();
                } else if (Date.now() - t0 > 2000) {
                    clearInterval(poll); done();
                    if (retries > 0) setTimeout(() => seedCooldown(group, retries - 1), retries === 2 ? 1000 : 3000);
                }
            }, 120);
        } catch (e) {
            done();
        }
    }
    // Re-read a group's popover shortly after a consume — cooldown truth without message parsing.
    // Skipped while the icon is hidden (no cooldown yet and the icon may not unhide without a reload).
    function reconcileCooldown(g) {
        const icon = document.querySelector(g.icon);
        if (icon && !icon.classList.contains('d-none')) setTimeout(() => seedCooldown(g, 1), 500);
    }
    // Keep both clocks honest while the page sits open (cooldowns can change from other tabs/scripts).
    function reconcileAll() {
        if (document.visibilityState !== 'visible') return;
        if (!readingRefs && document.querySelector('.popover.show')) return; // user is reading a popover — don't yank it
        Object.keys(GROUPS).forEach((n) => reconcileCooldown(GROUPS[n]));
    }
    const cdRemaining = (g) => (g.cooldownEnd ? Math.max(0, (g.cooldownEnd - Date.now()) / 1000) : 0);
    // 2s tolerance so an exact-cap readout still counts as maxed
    const atMaxCd = (g) => g.capSec > 0 && cdRemaining(g) >= g.capSec - 2;

    // persist each group as an absolute end-time so remaining stays correct across reloads/navigation
    const saveCooldown = (g) => { try { localStorage.setItem(g.key, JSON.stringify({ end: g.cooldownEnd, cap: g.capSec })); } catch (e) {} };
    function restoreCooldown(g) {
        try {
            const s = JSON.parse(localStorage.getItem(g.key) || 'null');
            if (s && s.end > Date.now()) { g.cooldownEnd = s.end; if (s.cap > 0) g.capSec = s.cap; }
        } catch (e) {}
    }

    // ---------- UI ----------
    const el = { groups: {}, rowRefs: [] };
    // lightning bolt emoji — self-contained energy motif for the pill
    const BOLT = '<span class="ce-bolt" aria-hidden="true">⚡</span>';

    function buildUI() {
        const style = document.createElement('style');
        style.textContent = `
            .ceGym-reading .popover { opacity: 0 !important; pointer-events: none !important; }
            #ceGym { position: fixed; left: 12px; top: 50%; transform: translateY(-50%);
                z-index: 1030; font-family: inherit; display: flex; align-items: center; }
            #ceGym .ce-tab { width: 44px; height: 44px; border-radius: 50%; cursor: pointer; flex: none;
                background: linear-gradient(180deg, #242834, #191c24); border: 1px solid #3a3f4b;
                display: flex; align-items: center; justify-content: center; overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,.5);
                transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
            #ceGym .ce-tab:hover { transform: scale(1.07); border-color: #565d6d; box-shadow: 0 3px 14px rgba(0,0,0,.6); }
            #ceGym .ce-tab:focus-visible { outline: 2px solid #8bd18e; outline-offset: 2px; }
            #ceGym.open .ce-tab { border-color: #565d6d; }
            #ceGym .ce-bolt { font-size: 22px; line-height: 1; filter: drop-shadow(0 0 3px rgba(245,197,66,.55)); }
            /* optically center the pill glyph (emoji ink is offset in its line box) */
            #ceGym .ce-tab .ce-bolt { transform: translate(1px, -0.5px); }
            #ceGym .ce-panel { width: 250px; margin-left: 10px; padding: 12px 14px;
                background: #1c1f26; border: 1px solid #3a3f4b; border-radius: 10px; color: #e6e6e6;
                box-shadow: 0 6px 20px rgba(0,0,0,.55);
                opacity: 0; visibility: hidden; pointer-events: none;
                transform-origin: left center; transform: translateX(-8px) scale(.98);
                /* closing: keep width fixed, fade+slide, then hide only after the fade ends */
                transition: opacity .18s ease, transform .18s ease, visibility 0s linear .18s; }
            #ceGym.open .ce-panel { opacity: 1; visibility: visible; transform: none; pointer-events: auto;
                transition: opacity .18s ease, transform .18s ease, visibility 0s; }
            #ceGym .ce-h { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 14px;
                margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid #2a2e38; }
            #ceGym .ce-h .ce-bolt { font-size: 15px; }
            #ceGym .ce-energy { display: flex; justify-content: space-between; align-items: baseline;
                font-size: 12px; color: #9aa0ac; margin: 0 0 4px; }
            #ceGym .ce-energyval { font-size: 14px; font-weight: 700; color: #e6e6e6; font-variant-numeric: tabular-nums; }
            #ceGym .ce-group { margin-top: 14px; }
            #ceGym .ce-gh { display: flex; justify-content: space-between; align-items: baseline;
                font-size: 11px; color: #9aa0ac; }
            #ceGym .ce-cdval { color: #c7ccd6; font-variant-numeric: tabular-nums; }
            #ceGym .ce-cdval.ready { color: #8bd18e; font-weight: 600; }
            #ceGym .ce-bar { height: 5px; border-radius: 3px; background: #2a2e38; margin-top: 5px; overflow: hidden; }
            #ceGym .ce-bar > span { display: block; height: 100%; width: 0; border-radius: 3px;
                background: #57b45c; transition: width .3s ease, background-color .3s ease; }
            #ceGym .ce-bar > span.warn { background: #e0a53f; }
            #ceGym .ce-bar > span.hot { background: #d9534f; }
            #ceGym .ce-rows { margin-top: 7px; }
            #ceGym .ce-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; }
            #ceGym .ce-rowname { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e6e6e6; }
            #ceGym .ce-rowqty { color: #9aa0ac; font-variant-numeric: tabular-nums; }
            #ceGym .ce-rowbtn { padding: 4px 10px; border: 1px solid #35913a; border-radius: 6px; flex: none;
                background: #2e7d32; color: #fff; font-weight: 700; font-size: 12px; cursor: pointer;
                transition: background .15s ease; }
            #ceGym .ce-rowbtn:hover:not(:disabled) { background: #35913a; }
            #ceGym .ce-rowbtn:active:not(:disabled) { transform: translateY(1px); }
            #ceGym .ce-rowbtn:focus-visible { outline: 2px solid #8bd18e; outline-offset: 2px; }
            #ceGym .ce-rowbtn:disabled { background: #2a2e38; border-color: #3a3f4b; color: #7a8090; cursor: not-allowed; }
            #ceGym .ce-rownote { font-size: 11px; color: #6b7280; margin-top: 6px; }
            #ceGym .ce-msg { font-size: 11px; margin-top: 10px; line-height: 1.35; min-height: 14px; }
            #ceGym .ce-msg.ok { color: #8bd18e; } #ceGym .ce-msg.err { color: #e88; } #ceGym .ce-msg.muted { color: #9aa0ac; }
        `;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.id = 'ceGym';
        root.innerHTML = `
            <div class="ce-tab" role="button" tabindex="0" title="Gym Energy" aria-label="Gym Energy panel" aria-expanded="false">${BOLT}</div>
            <div class="ce-panel">
                <div class="ce-h">${BOLT}Gym Energy</div>
                <div class="ce-energy">Energy <span class="ce-energyval">…</span></div>
                <div class="ce-group" data-group="drug">
                    <div class="ce-gh"><span>Drug cooldown</span><span class="ce-cdval">—</span></div>
                    <div class="ce-bar"><span></span></div>
                    <div class="ce-rows"></div>
                </div>
                <div class="ce-group" data-group="booster">
                    <div class="ce-gh"><span>Booster cooldown</span><span class="ce-cdval">—</span></div>
                    <div class="ce-bar"><span></span></div>
                    <div class="ce-rows"></div>
                </div>
                <div class="ce-msg" aria-live="polite"></div>
            </div>`;
        document.body.appendChild(root);

        el.root = root;
        el.tab = root.querySelector('.ce-tab');
        el.energy = root.querySelector('.ce-energyval');
        el.msg = root.querySelector('.ce-msg');
        Object.keys(GROUPS).forEach((name) => {
            const g = root.querySelector(`.ce-group[data-group="${name}"]`);
            el.groups[name] = { cd: g.querySelector('.ce-cdval'), bar: g.querySelector('.ce-bar > span'), rows: g.querySelector('.ce-rows') };
        });

        // toggle via click or keyboard; opening refreshes the list (forced on first load, else throttled)
        const toggle = () => {
            const open = root.classList.toggle('open');
            el.tab.setAttribute('aria-expanded', String(open));
            if (open) refreshInventory(items == null);
            else setStatus('', ''); // collapse dismisses the last action message
        };
        el.tab.addEventListener('click', toggle);
        el.tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) toggle(); });
    }

    function setStatus(text, cls) { if (el.msg) { el.msg.textContent = text; el.msg.className = 'ce-msg ' + (cls || ''); } }

    // rebuild the per-group item rows (structure) — called when the item set changes
    function renderRows() {
        if (!el.root) return;
        el.rowRefs = [];
        Object.keys(GROUPS).forEach((name) => {
            const container = el.groups[name].rows;
            container.textContent = '';
            if (items === null) { addNote(container, '…'); return; }
            let list = items.filter((it) => it.group === name);
            if (name === 'booster') list = list.slice().sort((a, b) => alcIdx(a.name) - alcIdx(b.name));
            if (!list.length) { addNote(container, name === 'drug' ? 'No Cocaine' : 'No alcohol'); return; }
            list.forEach((item) => {
                const row = document.createElement('div'); row.className = 'ce-row';
                const nm = document.createElement('span'); nm.className = 'ce-rowname'; nm.textContent = item.name; nm.title = item.name;
                const q = document.createElement('span'); q.className = 'ce-rowqty';
                const b = document.createElement('button'); b.type = 'button'; b.className = 'ce-rowbtn';
                b.addEventListener('click', () => consume(item));
                row.append(nm, q, b); container.appendChild(row);
                el.rowRefs.push({ item, qtyEl: q, btn: b, key: itemKey(item) });
            });
        });
        render();
    }
    const addNote = (c, t) => { const d = document.createElement('div'); d.className = 'ce-rownote'; d.textContent = t; c.appendChild(d); };

    // per-second live update: energy readout, both cooldown bars/timers, per-row button states
    function render() {
        if (!el.root) return;
        const cur = document.querySelector('#currentEnergy'), mx = document.querySelector('#maxEnergy');
        el.energy.textContent = (cur ? cur.innerText.trim() : '…') + (mx ? ' / ' + mx.innerText.trim() : '');

        Object.keys(GROUPS).forEach((name) => {
            const g = GROUPS[name], ui = el.groups[name];
            const rem = cdRemaining(g), ready = !g.cooldownEnd || rem <= 0;
            ui.cd.textContent = ready ? 'ready' : `${fmt(rem)} / ${fmt(g.capSec)}`; // timer stays visible even when maxed
            ui.cd.classList.toggle('ready', ready);
            const ratio = ready ? 0 : Math.min(1, rem / g.capSec);
            ui.bar.style.width = ratio * 100 + '%';
            ui.bar.className = ratio >= 0.85 ? 'hot' : ratio >= 0.5 ? 'warn' : '';
        });

        // maxed group greys ALL its buttons (red bar above signals why); no "at max" text label
        el.rowRefs.forEach((r) => {
            const maxed = atMaxCd(GROUPS[r.item.group]);
            const isBusy = busyKeys.has(r.key);
            const out = r.item.count === 0;
            const drink = r.item.group === 'booster';
            r.qtyEl.textContent = 'x' + (r.item.count == null ? '…' : r.item.count.toLocaleString('en-US'));
            r.btn.disabled = isBusy || maxed || out;
            r.btn.textContent = isBusy ? (drink ? 'Drinking…' : 'Taking…') : out ? 'None left' : (drink ? 'Drink' : 'Take');
        });
    }

    // ---------- init ----------
    Object.keys(GROUPS).forEach((n) => restoreCooldown(GROUPS[n])); // instant readout from last known; seeds reconcile
    buildUI();
    renderRows();
    snapshotTrainButtons(); // capture pristine "Train" labels before a click can flip them to "Please wait"
    document.addEventListener('submit', onTrainSubmit, true); // intercept the native workout POSTs
    // bootstrap can lag document-idle — wait for it (≤5s), then seed both cooldown groups
    (function waitBoot(tries) {
        if (window.bootstrap && bootstrap.Popover) { seedCooldown(GROUPS.drug); seedCooldown(GROUPS.booster); return; }
        if (tries > 0) setTimeout(() => waitBoot(tries - 1), 500);
    })(10);
    setInterval(render, 1000);
    setInterval(reconcileAll, RECONCILE_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconcileAll(); });
})();
