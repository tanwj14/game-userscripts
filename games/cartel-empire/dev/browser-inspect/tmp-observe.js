// TEMP long-running observer: instruments the /Gym page in the debug Chrome while the user
// plays for real. Captures use/train requests+responses, ceGym localStorage writes, popover
// texts, per-second widget state, JS errors. Re-arms after navigation. Appends JSONL to argv[2].
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'cartel-empire-gym-energy.user.js'), 'utf8');
const OUT = process.argv[2];
const HOURS = 4;

const write = (obj) => fs.appendFileSync(OUT, JSON.stringify(obj) + '\n');

const INSTRUMENT = `(() => {
  if (window.__obsArmed) return 'already-armed';
  window.__obsArmed = true;
  window.__obs = [];
  const log = (type, data) => window.__obs.push({ t: new Date().toISOString(), type, data });
  log('armed', { url: location.href });

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (url, opts) {
    const u = String(url);
    const watch = u.includes('/Inventory/Use') || /\\/gym\\/train\\//i.test(u);
    if (watch) log('request', { url: u, method: (opts && opts.method) || 'GET' });
    const r = await realFetch(url, opts);
    if (watch) {
      try { log('response', { url: u, status: r.status, body: (await r.clone().text()).slice(0, 3000) }); }
      catch (e) { log('response-readfail', { url: u, err: String(e) }); }
    }
    return r;
  };
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__obsUrl = String(u); return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    const u = this.__obsUrl || '';
    if (u.includes('/Inventory/Use') || /\\/gym\\/train\\//i.test(u)) {
      this.addEventListener('loadend', () => log('xhr-response', { url: u, status: this.status, body: String(this.responseText || '').slice(0, 3000) }));
      log('xhr-request', { url: u });
    }
    return XS.apply(this, arguments);
  };

  const realSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (/^ceGym/.test(k)) log('localStorage', { key: k, value: String(v).slice(0, 300) });
    return realSet.apply(this, arguments);
  };

  new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType === 1 && n.classList && n.classList.contains('popover')) {
        setTimeout(() => log('popover', { text: (n.innerText || '').slice(0, 200) }), 400);
        setTimeout(() => log('popover-late', { text: (n.innerText || '').slice(0, 200) }), 1500);
      }
    }));
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('error', (e) => log('js-error', { msg: String(e.message), src: String(e.filename) + ':' + e.lineno }));

  let last = '';
  setInterval(() => {
    const q = (s) => { const el = document.querySelector(s); return el ? el.textContent : null; };
    const btn = (g) => { const b = document.querySelector('#ceGym .ce-group[data-group="' + g + '"] .ce-rowbtn'); return b ? { label: b.textContent, disabled: b.disabled } : null; };
    const snap = JSON.stringify({
      drugCd: q('#ceGym .ce-group[data-group="drug"] .ce-cdval'),
      boosterCd: q('#ceGym .ce-group[data-group="booster"] .ce-cdval'),
      drugBtn: btn('drug'), boosterBtn: btn('booster'),
      energy: q('#ceGym .ce-energyval'), pageEnergy: q('#currentEnergy'),
      msg: q('#ceGym .ce-msg'),
      boxMax: (document.querySelector('input[name="energyToUse"]') || { getAttribute: () => null }).getAttribute('max'),
    });
    if (snap !== last) { last = snap; log('state', JSON.parse(snap)); }
  }, 1000);
  return 'armed';
})()`;

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];

  const arm = async (page) => {
    try {
      if (!page.url().includes('cartelempire.online')) return;
      const armed = await page.evaluate(INSTRUMENT);
      if (armed === 'armed') {
        // give a Tampermonkey copy a moment, then inject 2.0.1 only if no widget exists
        await page.waitForTimeout(2500);
        const has = await page.evaluate(() => !!document.getElementById('ceGym'));
        if (!has && page.url().includes('/Gym')) {
          await page.evaluate((src) => { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); }, SRC);
          write({ t: new Date().toISOString(), type: 'observer', data: 'injected 2.0.1 (no widget present)' });
        } else {
          write({ t: new Date().toISOString(), type: 'observer', data: has ? 'widget already present (Tampermonkey copy)' : 'not on /Gym, instrumented only' });
        }
      }
    } catch (e) { write({ t: new Date().toISOString(), type: 'observer-error', data: String(e.message).slice(0, 200) }); }
  };

  const hook = (page) => {
    page.on('framenavigated', async (f) => {
      if (f !== page.mainFrame()) return;
      write({ t: new Date().toISOString(), type: 'navigated', data: f.url() });
      await page.waitForTimeout(1500);
      await arm(page);
    });
  };

  for (const p of ctx.pages()) { hook(p); await arm(p); }
  ctx.on('page', async (p) => { hook(p); await p.waitForLoadState('domcontentloaded').catch(() => {}); await arm(p); });

  write({ t: new Date().toISOString(), type: 'observer', data: 'observation started' });

  const end = Date.now() + HOURS * 3600 * 1000;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 5000));
    for (const p of ctx.pages()) {
      try {
        if (!p.url().includes('cartelempire.online')) continue;
        const batch = await p.evaluate(() => { const b = window.__obs || []; window.__obs = []; return b; });
        batch.forEach(write);
      } catch (e) { /* page navigating — next cycle */ }
    }
  }
  write({ t: new Date().toISOString(), type: 'observer', data: 'observation window ended' });
  await browser.close();
})().catch((e) => { write({ t: new Date().toISOString(), type: 'observer-fatal', data: String(e.message) }); process.exit(1); });
