// Validate the new scan logic against the live page.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const pages = browser.contexts().flatMap((c) => c.pages());
  const page = pages.find((p) => p.url().includes('cartelempire.online'));
  if (!page) { console.error('No tab'); process.exit(1); }

  const r = await page.evaluate(() => {
    const out = {};
    const cancelBtn = document.querySelector('#cancelButton');
    out.cancelBtnFound = !!cancelBtn;
    if (cancelBtn) {
      const card = cancelBtn.closest('.jobContainer') || cancelBtn.parentElement;
      out.cardClass = card ? card.className : null;
      const text = card ? (card.innerText || '') : '';
      const m = text.match(/\b(?:(\d+)h\s*)?(?:(\d+)m\s*)?(\d+)s\b/i);
      out.timeMatch = m ? m[0] : null;
      // job type detection
      out.jobText = text.replace(/\s+/g, ' ').slice(0, 60);
    }
    // How many elements would the banner observer consider "banner-like" right now?
    const BANNER = '[class*="alert-"],[class*="bg-danger"],[class*="bg-success"],[class*="bg-warning"],[class*="bg-info"],.toast';
    out.bannerMatchesOnPage = document.querySelectorAll(BANNER).length;
    return out;
  });

  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();
