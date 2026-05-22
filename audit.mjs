import { chromium } from 'playwright';

const BASE = 'https://espada-tarrif-tracker22.vercel.app/';
const issues = [];
const shots = [];

function log(category, msg) {
  issues.push({ category, msg });
  console.log(`[${category}] ${msg}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') log('JS Error', m.text()); });
page.on('pageerror', e => log('JS Exception', e.message));
const failedRequests = [];
page.on('requestfailed', r => failedRequests.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`));

// ── 1. Initial load ────────────────────────────────────────────────────────
console.log('\n=== Loading page ===');
const resp = await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
log('HTTP', `Initial load status: ${resp.status()}`);

await page.screenshot({ path: '/tmp/audit_01_initial.png', fullPage: true });

// ── 2. DOM / layout checks ─────────────────────────────────────────────────
console.log('\n=== DOM checks ===');

const title = await page.title();
log('Meta', `Page title: "${title}"`);

// Check for missing alt text on images
const imgsNoAlt = await page.$$eval('img', imgs =>
  imgs.filter(i => !i.alt).map(i => i.src)
);
if (imgsNoAlt.length) log('Accessibility', `${imgsNoAlt.length} image(s) missing alt text: ${imgsNoAlt.slice(0,3).join(', ')}`);

// Check buttons with no accessible label
const unlabelledBtns = await page.$$eval('button', btns =>
  btns.filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'))
    .map(b => b.outerHTML.slice(0, 80))
);
if (unlabelledBtns.length) log('Accessibility', `${unlabelledBtns.length} button(s) have no label: ${unlabelledBtns.slice(0,2).join(' | ')}`);

// Check for elements overflowing viewport
const overflow = await page.evaluate(() => {
  const w = document.documentElement.scrollWidth;
  const vw = document.documentElement.clientWidth;
  return w > vw ? `Horizontal scroll detected (scrollWidth ${w} > clientWidth ${vw})` : null;
});
if (overflow) log('Layout', overflow);

// ── 3. Visible text / content checks ──────────────────────────────────────
console.log('\n=== Content checks ===');

const h1s = await page.$$eval('h1', els => els.map(e => e.textContent.trim()));
log('Content', `H1 tags: ${JSON.stringify(h1s)}`);

// Look for placeholder/lorem text
const bodyText = await page.evaluate(() => document.body.innerText);
if (/lorem ipsum/i.test(bodyText)) log('Content', 'Lorem ipsum placeholder text found');
if (/undefined|NaN|null/i.test(bodyText)) log('Content', 'Raw undefined/NaN/null visible in page');

// ── 4. Interactive elements ────────────────────────────────────────────────
console.log('\n=== Interactive elements ===');

const buttons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()).filter(Boolean));
log('UI', `Buttons found: ${JSON.stringify(buttons.slice(0, 20))}`);

const links = await page.$$eval('a', as => as.map(a => ({ text: a.textContent.trim(), href: a.href })).filter(a => a.text));
log('UI', `Nav links: ${links.slice(0,10).map(l => l.text).join(', ')}`);

// ── 5. Network failures ────────────────────────────────────────────────────
await page.waitForTimeout(3000);
if (failedRequests.length) {
  log('Network', `${failedRequests.length} failed request(s):`);
  failedRequests.forEach(r => log('Network', `  ↳ ${r}`));
}

// ── 6. Try navigating to different pages/tabs ─────────────────────────────
console.log('\n=== Exploring navigation ===');

// Click all nav items and check for errors
const navItems = await page.$$('nav a, [role=navigation] a, header a');
const navTexts = [];
for (const item of navItems) {
  const t = await item.textContent();
  navTexts.push(t?.trim());
}
log('Nav', `Nav items: ${navTexts.filter(Boolean).join(', ')}`);

// Try clicking sidebar/tab items
const sidebarItems = await page.$$('[class*="sidebar"] button, [class*="tab"] button, [class*="nav"] button');
log('Nav', `Sidebar/tab buttons: ${sidebarItems.length}`);

for (let i = 0; i < Math.min(sidebarItems.length, 5); i++) {
  try {
    const label = await sidebarItems[i].textContent();
    await sidebarItems[i].click();
    await page.waitForTimeout(1000);
    const errAfter = await page.$('[class*="error"], [class*="Error"]');
    if (errAfter) log('UI', `Error element visible after clicking "${label?.trim()}"`);
    await page.screenshot({ path: `/tmp/audit_nav_${i}.png`, fullPage: false });
  } catch {}
}

// ── 7. Mobile viewport check ──────────────────────────────────────────────
console.log('\n=== Mobile viewport ===');
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);

const mobileOverflow = await page.evaluate(() => {
  const w = document.documentElement.scrollWidth;
  const vw = document.documentElement.clientWidth;
  return w > vw ? `Horizontal scroll on mobile (scrollWidth ${w} > clientWidth ${vw})` : null;
});
if (mobileOverflow) log('Mobile', mobileOverflow);
await page.screenshot({ path: '/tmp/audit_mobile.png', fullPage: true });

// ── 8. Full-page desktop screenshot ───────────────────────────────────────
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/audit_desktop.png', fullPage: true });

await browser.close();

console.log('\n\n=== SUMMARY ===');
issues.forEach(i => console.log(`[${i.category}] ${i.msg}`));
