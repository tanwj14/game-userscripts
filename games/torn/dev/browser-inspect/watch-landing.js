// Watch a live Torn flight until it lands, logging the header travel-link flip and
// capturing the moment torn_flight_* clears and the title resets to native.
// Usage: node torn/dev/browser-inspect/watch-landing.js
const { chromium } = require('playwright');

const snap = () => {
  const link = document.querySelector('a[href*="sid=travel"][aria-label]');
  return {
    t: new Date().toISOString().slice(11, 19),
    url: location.href,
    title: document.title,
    link: !!link,
    aria: link ? link.getAttribute('aria-label') : null,
    landing: localStorage.getItem('torn_flight_landing'),
    dest: localStorage.getItem('torn_flight_destination'),
  };
};

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const pages = browser.contexts().flatMap((c) => c.pages());
  const page = pages.find((p) => p.url().includes('torn.com') && !p.url().includes('/builds/'));
  if (!page) { console.error('No torn.com tab'); process.exit(1); }

  let prevLink = null, cleared = false;
  const deadline = Date.now() + 20 * 60 * 1000; // 20-min cap
  while (Date.now() < deadline) {
    let s;
    try { s = await page.evaluate(snap); }
    catch (e) { console.log('eval err (nav?):', e.message); await new Promise((r) => setTimeout(r, 3000)); continue; }

    if (s.link !== prevLink) {
      console.log(`[LINK ${prevLink}->${s.link}] ${s.t} title="${s.title}" landing=${s.landing} dest=${s.dest} aria="${s.aria}"`);
      prevLink = s.link;
    }
    // Link gone + flight cache cleared => the landing->home branch fired.
    if (!s.link && !s.landing && !s.dest && !cleared) {
      console.log(`[CLEARED] ${s.t} title="${s.title}" url=${s.url}`);
      cleared = true;
      await new Promise((r) => setTimeout(r, 2500)); // let the title reset settle
      const f = await page.evaluate(snap);
      console.log(`[FINAL] ${f.t} title="${f.title}" landing=${f.landing} dest=${f.dest} link=${f.link}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  await browser.close();
  console.log('watcher done');
})();
