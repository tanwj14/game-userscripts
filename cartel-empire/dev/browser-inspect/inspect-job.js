// Inspect the active-job DOM: the CANCEL button, its container, countdown, progress bars.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const pages = browser.contexts().flatMap((c) => c.pages());
  const page = pages.find((p) => p.url().includes('cartelempire.online'));
  if (!page) { console.error('No tab'); process.exit(1); }

  const data = await page.evaluate(() => {
    const result = {};

    // Find the CANCEL element the script keys off
    const all = [...document.querySelectorAll('div,span,p,button,a')];
    const cancelEl = all.find((el) => (el.innerText || '').trim().toUpperCase() === 'CANCEL');
    if (cancelEl) {
      result.cancel = {
        tag: cancelEl.tagName, id: cancelEl.id, class: cancelEl.className,
      };
      // Walk up to the card that holds the countdown
      let card = cancelEl.parentElement;
      const chain = [];
      while (card && card.tagName !== 'BODY' && chain.length < 6) {
        chain.push({
          tag: card.tagName, id: card.id || null,
          class: typeof card.className === 'string' ? card.className : null,
          textSnippet: (card.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140),
        });
        card = card.parentElement;
      }
      result.cancelAncestors = chain;
    } else {
      result.cancel = 'NO CANCEL FOUND (no job running?)';
    }

    // Any element whose text looks like a countdown mm:ss or 1h 2m 3s
    result.timerCandidates = all
      .filter((el) => el.children.length === 0)
      .map((el) => (el.innerText || '').trim())
      .filter((t) => /^\d{1,2}:\d{2}(:\d{2})?$/.test(t) || /^\d+h\s*\d+m\s*\d+s$/.test(t) || /^\d+[ms]$/.test(t))
      .slice(0, 15);

    const jp = document.querySelector('#job-progress-bar');
    if (jp) result.jobProgressBar = { text: jp.innerText.trim(), outer: jp.outerHTML.slice(0, 200) };
    const en = document.querySelector('#energyProgressBar');
    if (en) result.energy = en.innerText.trim();

    return result;
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
