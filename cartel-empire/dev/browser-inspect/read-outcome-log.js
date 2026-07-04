// Reads localStorage.CEOutcomeLog from the live Cartel Empire tab over CDP.
// Usage: node cartel-empire/dev/browser-inspect/read-outcome-log.js
const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch (e) {
    console.error('Could not connect to Chrome on port 9222.');
    process.exit(1);
  }
  const pages = browser.contexts().flatMap((c) => c.pages());
  const page = pages.find((p) => p.url().includes('cartelempire'));
  if (!page) {
    console.error('No cartelempire tab open.');
    await browser.close();
    process.exit(1);
  }
  const raw = await page.evaluate(() => localStorage.getItem('CEOutcomeLog'));
  if (!raw) {
    console.log('(CEOutcomeLog is empty or unset)');
  } else {
    try {
      console.log(JSON.stringify(JSON.parse(raw), null, 2));
    } catch {
      console.log(raw);
    }
  }
  await browser.close();
})();
