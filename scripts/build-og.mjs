// Open Graph cards (1200×630 JPEG) for link previews: public/assets/og/home.jpg and one card per
// case in public/assets/og/projects/<id>.jpg. Run locally after adding or renaming a project:
//   node scripts/build-og.mjs [project-id …]
// The cards are committed, so the Pages workflow needs no browser. Playwright is not a dependency
// of this repository: the script uses PLAYWRIGHT_MODULE (path to a project that has it installed)
// or the copy in D:\Anti-Gravity\kinetic-equipment-matrix. build-seo.mjs falls back to the case
// screenshot when a card is missing.

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from './build-seo.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
// Assets are served from public/ through a routed fake origin (file:// blocks web fonts).
const base = 'https://og.portfolio.invalid/';
const host = process.env.PLAYWRIGHT_MODULE || 'D:/Anti-Gravity/kinetic-equipment-matrix';
const { chromium } = createRequire(path.join(host, 'package.json'))('playwright');

const escapeHtml = value => String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const frame = (content, extra = '') => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><base href="${base}"><style>
@font-face{font-family:Manrope;src:url(assets/manrope-400.ttf);font-weight:400}
@font-face{font-family:Manrope;src:url(assets/manrope-600.ttf);font-weight:600}
@font-face{font-family:Unbounded;src:url(assets/unbounded-400.ttf);font-weight:400}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden;background:#0c1016;color:#edf2f7;font-family:Manrope,Arial,sans-serif}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:radial-gradient(900px 520px at 88% 18%,#123257 0%,#0c1016 62%)}
.lines{position:absolute;inset:0;background:url(assets/field-lines.svg) center/cover no-repeat;opacity:.35}
.sign{position:absolute;left:64px;bottom:52px;display:flex;align-items:center;gap:16px;font-size:20px;font-weight:600;letter-spacing:.2px;color:#e3e9ef}
.sign img{width:58px;height:auto}
${extra}
</style></head><body><div class="card"><div class="lines"></div>${content}</div></body></html>`;

function homeCard() {
  return frame(`<img class="mark" src="assets/brand/mark-blue.svg" alt="">
<div class="copy"><p class="kicker">Портфолио</p><h1>Корней<br>Колокольников</h1><p class="lead">Сайты · 3D и CGI · Видео · Инженерия</p></div>
<div class="sign"><span>Korney Kolokolnikov</span><span class="dot">/</span><span>Казахстан</span></div>`, `
.mark{position:absolute;right:-40px;top:70px;width:640px;filter:drop-shadow(0 30px 80px #4aafff40)}
.copy{position:absolute;left:64px;top:92px;width:640px}
.kicker{font-size:22px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#a9d9ff}
h1{font-family:Unbounded,Arial,sans-serif;font-weight:400;font-size:76px;line-height:1.1;letter-spacing:-3px;margin-top:26px}
.lead{font-size:30px;font-weight:600;margin-top:34px;color:#e3e9ef}
.dot{color:#4aafff}`);
}

function projectCard(project) {
  return frame(`<div class="shot"><img src="${project.image}" alt=""></div>
<div class="copy"><p class="kicker">${escapeHtml(project.type)}</p><h1>${escapeHtml(project.name).replace(/_/g, '_<wbr>')}</h1><p class="lead">${escapeHtml(project.summary)}</p></div>
<div class="sign"><img src="assets/brand/mark-blue.svg" alt=""><span>Korney Kolokolnikov</span></div>`, `
.shot{position:absolute;left:600px;top:72px;width:680px;height:486px;border-radius:14px;overflow:hidden;border:1px solid #ffffff2e;box-shadow:0 40px 90px #000a;background:#121820}
.shot img{width:100%;height:100%;object-fit:cover;object-position:top}
.copy{position:absolute;left:64px;top:76px;width:500px}
.kicker{font-size:20px;font-weight:600;letter-spacing:2.4px;text-transform:uppercase;color:#a9d9ff}
h1{font-family:Unbounded,Arial,sans-serif;font-weight:400;font-size:64px;line-height:1.12;letter-spacing:-2px;margin-top:22px}
.lead{font-size:25px;line-height:1.45;margin-top:26px;color:#e3e9ef;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}`);
}

const { projects } = await loadData(publicDir);
const only = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.route(`${base}**`, route => {
    const file = path.join(publicDir, decodeURIComponent(new URL(route.request().url()).pathname));
    if (!file.startsWith(publicDir)) return route.abort();
    return route.fulfill({ path: file });
  });
  await page.route(url => !url.href.startsWith(base) && url.protocol !== 'data:' && url.href !== 'about:blank', route => route.abort());
  const render = async (html, target) => {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      // Shrink long names until no word overflows and the title takes at most three lines.
      const title = document.querySelector('.copy h1');
      for (let size = 64; title && size > 34; size -= 2) {
        title.style.fontSize = `${size}px`;
        if (title.scrollWidth <= title.clientWidth && title.offsetHeight <= size * 1.12 * 3 + 1) break;
      }
    });
    await mkdir(path.dirname(target), { recursive: true });
    await page.screenshot({ path: target, type: 'jpeg', quality: 86 });
    console.log(path.relative(publicDir, target));
  };
  if (!only.length) await render(homeCard(), path.join(publicDir, 'assets/og/home.jpg'));
  for (const project of projects.filter(item => !only.length || only.includes(item.id))) {
    await render(projectCard(project), path.join(publicDir, `assets/og/projects/${project.id}.jpg`));
  }
} finally {
  await browser.close();
}
