// Records MouseHunt ajax request/response pairs to a JSONL file while you play.
// Usage: node games/mousehunt/dev/browser-inspect/record-ajax.js [outfile]
const fs = require('fs');
const { chromium } = require('playwright');

const out = process.argv[2] || 'mh-ajax.jsonl';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const seen = new WeakSet();
  const watch = (page) => {
    if (seen.has(page)) return;
    seen.add(page);
    page.on('response', async (res) => {
      const req = res.request();
      if (!/mousehuntgame\.com\/managers\/ajax\//.test(req.url())) return;
      let body;
      try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
      const rec = { t: new Date().toISOString(), url: req.url(), post: req.postData(), body };
      fs.appendFileSync(out, JSON.stringify(rec) + '\n');
      console.log(rec.t, req.url().split('/managers/ajax/')[1], (req.postData() || '').slice(0, 200));
    });
  };
  for (const ctx of browser.contexts()) {
    ctx.pages().forEach(watch);
    ctx.on('page', watch);
  }
  console.log(`Recording to ${out}. Ctrl+C to stop.`);
})();
