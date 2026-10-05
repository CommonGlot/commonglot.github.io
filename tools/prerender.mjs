// Prerender the JavaScript-rendered top-level pages of _site/ into static HTML.
// Crawlers and social previews get the full content; main.js re-renders it on load.
//
// Usage: node tools/prerender.mjs [_site]
//   needs the `playwright` package and a Chromium (set CHROMIUM_PATH to use a preinstalled one).

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const root = process.argv[2] || '_site';
const site = JSON.parse(await readFile(join(root, 'data', 'site.json'), 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 900 } });
// Only same-origin requests: fonts, tiles and CDN files are not needed for the HTML snapshot,
// except Leaflet, which is served from node_modules when available.
await context.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  if (/leaflet(\.min)?\.js$/.test(url)) {
    try { return route.fulfill({ path: require.resolve('leaflet/dist/leaflet.js') }); } catch { /* fall through */ }
  }
  return route.abort();
});

let failed = 0;
for (const p of site.pages) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/${p.path}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('main .loading'), null, { timeout: 15000 }).catch(() => errors.push('content did not finish loading'));
  const html = await page.evaluate(() => {
    // Leaflet DOM is rebuilt on load; keep only the empty container.
    document.querySelectorAll('.leaflet-container').forEach(el => {
      el.innerHTML = '';
      el.className = [...el.classList].filter(c => !c.startsWith('leaflet')).join(' ');
      el.removeAttribute('style'); el.removeAttribute('tabindex');
    });
    // Per-visitor state that must not be baked into the HTML.
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('nav-open');
    document.querySelectorAll('link[href*="fonts.googleapis.com/css2"][href*="text="]').forEach(el => el.remove());
    document.querySelectorAll('[data-font]').forEach(el => el.style.removeProperty('font-family'));
    return '<!doctype html>\n' + document.documentElement.outerHTML + '\n';
  });
  const headings = () => [...document.querySelectorAll('main h1, main h2')].map(h => h.textContent.trim());
  const rendered = await page.evaluate(headings);
  await page.close();
  if (errors.length) { failed++; console.error(`✗ /${p.path}: ${errors.join('; ')}`); continue; }
  await writeFile(join(root, p.path, 'index.html'), html);

  // Load the saved HTML again: main.js must re-render it in place, not duplicate or drop content.
  const check = await context.newPage();
  await check.goto(`${origin}/${p.path}`, { waitUntil: 'networkidle' });
  await check.waitForFunction(() => !document.querySelector('main .loading'), null, { timeout: 15000 }).catch(() => {});
  const hydrated = await check.evaluate(headings);
  await check.close();
  if (JSON.stringify(rendered) !== JSON.stringify(hydrated)) {
    failed++;
    console.error(`✗ /${p.path}: headings change when the prerendered page loads\n    saved:    ${rendered.join(' | ')}\n    reloaded: ${hydrated.join(' | ')}`);
  } else console.log(`✓ /${p.path} (${(html.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
server.close();
if (failed) process.exit(1);
