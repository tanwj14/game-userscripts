// Snapshot the live Torn tab's flight state over CDP: title, header travel-status
// aria-label, logo title, and the cached torn_flight_* localStorage keys.
// Usage: node torn/dev/browser-inspect/inspect-flight.js
const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch (e) {
    console.error('Could not connect to Chrome on port 9222.');
    console.error('Launch Chrome with --remote-debugging-port=9222 (see shared README).');
    process.exit(1);
  }

  const pages = browser.contexts().flatMap((c) => c.pages());
  // Pick the Torn page, skipping /builds/ asset frames.
  const page = pages.find((p) => p.url().includes('torn.com') && !p.url().includes('/builds/'));
  if (!page) { console.error('No torn.com tab'); process.exit(1); }

  const info = await page.evaluate(() => {
    const link = document.querySelector('a[href*="sid=travel"][aria-label]');
    const body = document.body ? document.body.innerText : '';
    return {
      url: location.href,
      title: document.title,
      travelLinkPresent: !!link,
      aria: link ? link.getAttribute('aria-label') : null,
      logoTitle: (document.getElementById('tcLogo') || {}).title || null,
      ls_landing: localStorage.getItem('torn_flight_landing'),
      ls_dest: localStorage.getItem('torn_flight_destination'),
      bodyHasRemaining: /Remaining Flight Time/i.test(body),
      bodyHasTravelHome: /Travel home/i.test(body),
      bodyHasWelcomeBack: /welcome back to torn/i.test(body),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
