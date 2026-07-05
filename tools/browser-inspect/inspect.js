// Connects to a Chrome started with --remote-debugging-port=9222
// Usage: node tools/browser-inspect/inspect.js [command] [args]
//   tabs              -> list all open tabs (title + url)
//   dom <urlpart>     -> dump outerHTML of the tab whose URL contains <urlpart>
//   html <urlpart> <selector> -> dump outerHTML of a specific element
const { chromium } = require('playwright');

(async () => {
  const [cmd = 'tabs', arg1, arg2] = process.argv.slice(2);
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch (e) {
    console.error('Could not connect to Chrome on port 9222.');
    console.error('Make sure Chrome was launched with --remote-debugging-port=9222.');
    process.exit(1);
  }

  const contexts = browser.contexts();
  const pages = contexts.flatMap((c) => c.pages());

  if (cmd === 'tabs') {
    for (const p of pages) {
      console.log(`${p.url()}\n   title: ${await p.title()}`);
    }
  } else if (cmd === 'dom') {
    const page = pages.find((p) => p.url().includes(arg1));
    if (!page) return console.error(`No tab matching "${arg1}"`);
    const html = await page.content();
    console.log(html);
  } else if (cmd === 'html') {
    const page = pages.find((p) => p.url().includes(arg1));
    if (!page) return console.error(`No tab matching "${arg1}"`);
    const el = await page.$(arg2);
    if (!el) return console.error(`No element matching selector "${arg2}"`);
    console.log(await el.evaluate((n) => n.outerHTML));
  }

  await browser.close();
})();
