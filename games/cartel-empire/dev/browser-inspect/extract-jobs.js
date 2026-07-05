// Extract a readable summary of interactive elements on the Jobs page.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const pages = browser.contexts().flatMap((c) => c.pages());
  const page = pages.find((p) => p.url().includes('cartelempire.online'));
  if (!page) { console.error('No cartelempire tab'); process.exit(1); }

  const summary = await page.evaluate(() => {
    const out = [];
    // Buttons and links
    document.querySelectorAll('button, a[href], [role="button"]').forEach((el) => {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!text) return;
      out.push({
        tag: el.tagName.toLowerCase(),
        text,
        id: el.id || null,
        class: el.className && typeof el.className === 'string' ? el.className.slice(0, 80) : null,
        href: el.getAttribute('href') || null,
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true' || null,
      });
    });
    return out;
  });

  console.log(`Found ${summary.length} interactive elements:\n`);
  summary.forEach((s, i) => {
    console.log(`[${i}] <${s.tag}> "${s.text}"`);
    if (s.id) console.log(`     id=${s.id}`);
    if (s.class) console.log(`     class=${s.class}`);
    if (s.href) console.log(`     href=${s.href}`);
    if (s.disabled) console.log(`     DISABLED`);
  });
  await browser.close();
})();
