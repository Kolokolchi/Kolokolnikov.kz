// Crawlable static pages for the portfolio (static prerender, no framework).
// The browser scripts render cases and videos from public/projects.js and public/videos.js;
// this script renders the same data into plain HTML that search engines and link previews read
// without JavaScript: case pages, video pages, two hub pages, 404, sitemap.xml and robots.txt.
//
//   node scripts/build-seo.mjs                 writes into public/ (also run by prebuild)
//   SITE_URL=https://example.kz/ node scripts/build-seo.mjs
//
// build-github-pages.mjs calls generateSeo() again for the export, so GitHub Pages always gets
// pages for the current data and the deployment address (repository variable SITE_URL).
// Dependency-free on purpose: the Pages workflow runs without npm install.

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_SITE_URL = 'https://kolokolchi.github.io/Kolokolnikov.kz/';
export const PERSON_NAME = 'Корней Колокольников';
export const BRAND_NAME = 'Korney Kolokolnikov';
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 160;
const OG_HOME = 'assets/og/home.jpg';
const SOCIAL = ['https://github.com/Kolokolchi', 'https://www.youtube.com/@korneykolokolnikov5150'];
const GENERATED_DIRS = ['projects', 'video'];

export function resolveSiteUrl(value = process.env.SITE_URL) {
  const url = new URL(value?.trim() || DEFAULT_SITE_URL);
  if (url.protocol !== 'https:') throw new Error(`SITE_URL must use https: ${url}`);
  if (url.search || url.hash) throw new Error(`SITE_URL must not contain a query or fragment: ${url}`);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

// --- text helpers -------------------------------------------------------------------------------
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const jsonLd = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const lowerFirst = text => /^\p{Lu}\p{Ll}/u.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
// Russian plural: plural(14, ['проект', 'проекта', 'проектов']) → '14 проектов'.
const plural = (count, [one, few, many]) => {
  const mod10 = count % 10, mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${count} ${word}`;
};
// Sentence boundaries: punctuation + space + capital/quote/digit, so "Three.js" stays whole.
const sentences = text => text.split(/(?<=[.!?…]["»”]?)\s+(?=[«"„(\p{Lu}\d])/u).map(item => item.trim()).filter(Boolean);

export function pageTitle(...candidates) {
  const title = candidates.find(item => item.length <= TITLE_MAX) ?? candidates.at(-1);
  return title.length <= TITLE_MAX ? title : `${title.slice(0, TITLE_MAX - 1).replace(/\s+\S*$/, '')}…`;
}

// "Name — type": the type is left out when the name already has a dash or repeats it.
function namedTitle(name, type) {
  const repeats = name.includes(' — ') || name.toLowerCase().includes(type.split(/[\s/]+/)[0].toLowerCase());
  const head = repeats ? name : `${name} — ${lowerFirst(type)}`;
  return pageTitle(`${head} | ${PERSON_NAME}`, `${head} | Колокольников`, head, `${name} | ${PERSON_NAME}`);
}

// Meta description of 120–160 characters. Sentences keep their order: the lead, then the body
// while it fits. A long next sentence is cut at a word when there is room for it; otherwise the
// first closing tail that fits completes the text.
export function metaDescription(lead, body = [], tails = []) {
  const pool = [...sentences(lead), ...body.flatMap(sentences)];
  let text = '';
  const join = sentence => (text ? `${text} ${sentence}` : sentence);
  const cut = sentence => `${join(sentence).slice(0, DESCRIPTION_MAX - 1).replace(/[\s,;:—–-]+\S*$/, '').replace(/[\s,;:—–-]+$/, '')}…`;
  for (const sentence of pool) {
    if (join(sentence).length <= DESCRIPTION_MAX) {
      text = join(sentence);
      if (text.length >= DESCRIPTION_MIN + 15) break;
      continue;
    }
    if (text.length < DESCRIPTION_MIN && DESCRIPTION_MAX - text.length >= 50) text = cut(sentence);
    break;
  }
  const tail = text.length < DESCRIPTION_MIN && tails.find(item => join(item).length <= DESCRIPTION_MAX);
  return tail ? join(tail) : text;
}

// ISO 8601 duration from "m:ss" or "h:mm:ss".
const isoDuration = value => {
  const parts = value.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s}S`;
};

// --- image dimensions (JPEG, PNG, WebP) without dependencies ----------------------------------------
export function imageSize(buffer) {
  if (buffer.toString('ascii', 1, 4) === 'PNG') return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const [b0, b1, b2, b3] = buffer.subarray(21, 25);
      return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  throw new Error('Unsupported image format');
}

// --- shared page parts ---------------------------------------------------------------------------
function createContext({ publicDir, siteUrl }) {
  const sizes = new Map();
  const abs = relative => new URL(relative, siteUrl).href;
  return {
    siteUrl, abs,
    personId: `${siteUrl}#person`,
    websiteId: `${siteUrl}#website`,
    async size(relative) {
      if (!sizes.has(relative)) sizes.set(relative, imageSize(await readFile(path.join(publicDir, relative))));
      return sizes.get(relative);
    },
    async exists(relative) {
      return stat(path.join(publicDir, relative)).then(info => info.isFile(), () => false);
    },
  };
}

// Title, description, canonical, Open Graph, Twitter card and JSON-LD of one indexable page.
function seoMeta(ctx, { title, description, pagePath, image, type = 'website', data, verification }) {
  const url = ctx.abs(pagePath);
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${url}">`,
  ];
  // Search Console / Yandex.Webmaster ownership tokens come from the build environment.
  if (verification?.google) lines.push(`<meta name="google-site-verification" content="${escapeHtml(verification.google)}">`);
  if (verification?.yandex) lines.push(`<meta name="yandex-verification" content="${escapeHtml(verification.yandex)}">`);
  lines.push(
    `<meta property="og:site_name" content="${BRAND_NAME}">`,
    '<meta property="og:locale" content="ru_RU">',
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${escapeHtml(image.url)}">`,
    `<meta property="og:image:width" content="${image.width}">`,
    `<meta property="og:image:height" content="${image.height}">`,
    `<meta property="og:image:alt" content="${escapeHtml(image.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image.url)}">`,
  );
  if (data) lines.push(jsonLd(data));
  return lines;
}

function head(ctx, { styles = [], prefix, ...meta }) {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="theme-color" content="#0c1016">',
    '<meta name="color-scheme" content="dark">',
    ...seoMeta(ctx, meta),
    `<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">`,
    `<link rel="preload" href="${prefix}assets/unbounded-400.ttf" as="font" type="font/ttf" crossorigin>`,
    `<link rel="stylesheet" href="${prefix}styles.css">`,
    ...styles.map(file => `<link rel="stylesheet" href="${prefix}${file}">`),
    `<script src="${prefix}theme.js"></script>`,
  ].join('\n');
}

// Hand-written pages keep their own markup; only the block between the seo markers is generated.
const STATIC_PAGES = [
  {
    file: 'index.html', pagePath: '',
    title: `${PERSON_NAME} — сайты, 3D, видео и инженерия`,
    description: 'Корней Колокольников — дизайнер и разработчик из Казахстана. Сайты и цифровые продукты, 3D и CGI, видео и анимация, инженерия оборудования для производства.',
    imageAlt: `${PERSON_NAME} — сайты, 3D, видео и инженерия`,
    data: (ctx, page, contact) => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ProfilePage', '@id': page.url, url: page.url, name: page.title, description: page.description, inLanguage: 'ru',
          isPartOf: { '@id': ctx.websiteId }, about: { '@id': ctx.personId }, mainEntity: { '@id': ctx.personId },
          primaryImageOfPage: { '@type': 'ImageObject', url: ctx.abs(OG_HOME), width: 1200, height: 630 },
        },
        {
          ...personData(ctx, contact),
          description: 'Создаёт сайты, цифровые продукты, видео и оборудование: интерфейсы и каталоги, CGI и AI-видео, 3D-модели станков и документацию для производства.',
          knowsAbout: ['Веб-разработка', 'Дизайн интерфейсов', '3D-визуализация', 'CGI', 'Unreal Engine', 'Blender', 'Видеомонтаж', 'Анимация логотипов', 'Брендинг', 'Fusion 360', 'CadQuery', 'Проектирование оборудования'],
        },
        { '@type': 'WebSite', '@id': ctx.websiteId, url: ctx.siteUrl, name: BRAND_NAME, alternateName: PERSON_NAME, inLanguage: 'ru', publisher: { '@id': ctx.personId } },
      ],
    }),
  },
  {
    file: 'brand.html', pagePath: 'brand.html',
    title: `Фирменный стиль и логотипы KK | ${PERSON_NAME}`,
    description: 'Монограмма KK Корнея Колокольникова: единая геометрия, три цветовые версии и роль каждого цвета на сайте. Логотипы и знак для светлого и тёмного фона в SVG.',
    imageAlt: `Монограмма KK — фирменный стиль ${BRAND_NAME}`,
    data: (ctx, page) => ({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': page.url, url: page.url, name: page.title, description: page.description, inLanguage: 'ru', isPartOf: { '@id': ctx.websiteId }, breadcrumb: { '@id': `${page.url}#breadcrumb` }, about: { '@id': ctx.personId } },
        breadcrumbData(ctx, page.url, [{ name: 'Главная', path: '' }, { name: 'Фирменный стиль', path: 'brand.html' }]),
        { '@type': 'WebSite', '@id': ctx.websiteId, url: ctx.siteUrl, name: BRAND_NAME, inLanguage: 'ru', publisher: { '@id': ctx.personId } },
      ],
    }),
  },
];
const SEO_BLOCK = /^([ \t]*)(<!-- seo:start[^\n]*-->)\r?\n[\s\S]*?^[ \t]*<!-- seo:end -->/m;

async function patchStaticPage(ctx, outDir, config, contact, verification) {
  const file = path.join(outDir, config.file);
  const html = await readFile(file, 'utf8');
  const match = html.match(SEO_BLOCK);
  if (!match) throw new Error(`${config.file}: missing <!-- seo:start --> … <!-- seo:end --> markers`);
  const [, indent, start] = match;
  const pageInfo = { url: ctx.abs(config.pagePath), title: config.title, description: config.description };
  const lines = seoMeta(ctx, {
    title: config.title, description: config.description, pagePath: config.pagePath,
    image: { url: ctx.abs(OG_HOME), width: 1200, height: 630, alt: config.imageAlt },
    data: config.data(ctx, pageInfo, contact), verification: config.file === 'index.html' ? verification : undefined,
  });
  const block = [`${indent}${start}`, ...lines.map(line => `${indent}${line}`), `${indent}<!-- seo:end -->`].join('\n');
  await writeFile(file, html.replace(SEO_BLOCK, () => block));
  return { file: config.file, title: config.title, description: config.description };
}

const brandLink = (prefix, accent = 'blue') => `<a class="brand" href="${prefix}" aria-label="${BRAND_NAME} — главная"><img src="${prefix}assets/brand/mark-${accent}.svg" data-brand-mark width="57" height="39" alt=""><span>Korney<br>Kolokolnikov.</span></a>`;

function breadcrumbs(items) {
  const links = items.map((item, index) => index === items.length - 1
    ? `<li aria-current="page">${escapeHtml(item.name)}</li>`
    : `<li><a href="${item.href}">${escapeHtml(item.name)}</a></li>`);
  return `<nav class="breadcrumbs" aria-label="Навигация по сайту"><ol>${links.join('')}</ol></nav>`;
}

const breadcrumbData = (ctx, pageUrl, items) => ({
  '@type': 'BreadcrumbList', '@id': `${pageUrl}#breadcrumb`,
  itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: ctx.abs(item.path) })),
});

function footer(prefix, contact, action) {
  return `<footer class="site-footer wrap"><span>${BRAND_NAME} · <span data-year>2026</span></span><nav class="footer-links" aria-label="Разделы портфолио"><a href="${prefix}projects/">Проекты</a><a href="${prefix}video/">Видео</a><a href="${prefix}brand.html">Фирменный стиль</a></nav><a class="action-link" data-accent="orange" href="mailto:${contact.email}${action.subject ? `?subject=${encodeURIComponent(action.subject)}` : ''}">${escapeHtml(action.label)} ↗</a></footer>`;
}

const personData = (ctx, contact) => ({
  '@type': 'Person', '@id': ctx.personId, name: PERSON_NAME, alternateName: BRAND_NAME, url: ctx.siteUrl,
  jobTitle: 'Дизайнер, разработчик и инженер', email: `mailto:${contact.email}`, telephone: contact.phone,
  address: { '@type': 'PostalAddress', addressCountry: 'KZ' }, sameAs: SOCIAL,
});

const page = ({ headHtml, bodyAttrs = '', body, scripts = [] }) => `<!doctype html>
<html lang="ru" data-theme="blue">
<head>
${headHtml}
</head>
<body${bodyAttrs}>
${body}
${scripts.map(src => `<script type="module" src="${src}"></script>`).join('\n')}
</body>
</html>
`;

// --- project pages -------------------------------------------------------------------------------
async function projectOgImage(ctx, project) {
  const card = `assets/og/projects/${project.id}.jpg`;
  if (await ctx.exists(card)) return { url: ctx.abs(card), width: 1200, height: 630, alt: `${project.name} — ${lowerFirst(project.type)}` };
  const { width, height } = await ctx.size(project.image);
  return { url: ctx.abs(project.image), width, height, alt: `${project.name} — экран проекта` };
}

const projectTitle = project => namedTitle(project.name, project.type);
const projectDescription = project => metaDescription(project.summary, [project.description], [`${project.type} в портфолио Корнея Колокольникова.`, 'Кейс из портфолио Корнея Колокольникова.']);

async function projectPage(ctx, project, index, list, contact) {
  const prefix = '../../';
  const pagePath = `projects/${project.id}/`;
  const pageUrl = ctx.abs(pagePath);
  const title = projectTitle(project);
  const description = projectDescription(project);
  const crumbs = [{ name: 'Главная', path: '', href: prefix }, { name: 'Проекты', path: 'projects/', href: '../' }, { name: project.name, path: pagePath }];
  const hero = await ctx.size(project.image);
  const heroCaption = project.gallery.find(item => item.src === project.image)?.caption || project.type;
  const gallery = project.gallery.filter(item => item.src !== project.image);
  const images = [project.image, ...gallery.map(item => item.src)].map(ctx.abs);
  const og = await projectOgImage(ctx, project);
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': pageUrl, url: pageUrl, name: title, description, inLanguage: 'ru',
        isPartOf: { '@id': ctx.websiteId }, breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        primaryImageOfPage: { '@type': 'ImageObject', url: ctx.abs(project.image), width: hero.width, height: hero.height },
        mainEntity: { '@id': `${pageUrl}#work` },
      },
      {
        '@type': 'CreativeWork', '@id': `${pageUrl}#work`, name: project.name, headline: project.summary,
        description: project.description, genre: project.type, keywords: project.tags.join(', '), inLanguage: 'ru',
        image: images, author: { '@id': ctx.personId }, creator: { '@id': ctx.personId }, mainEntityOfPage: pageUrl,
        ...(project.url ? { url: project.url } : {}),
      },
      breadcrumbData(ctx, pageUrl, crumbs),
      personData(ctx, contact),
      { '@type': 'WebSite', '@id': ctx.websiteId, url: ctx.siteUrl, name: BRAND_NAME, inLanguage: 'ru', publisher: { '@id': ctx.personId } },
    ],
  };

  const metadata = [['Формат', project.type], ['Статус', project.status], ['В проекте', project.tags.join(' / ')]]
    .map(([label, value]) => `<div>${escapeHtml(label)}<strong>${escapeHtml(value)}</strong></div>`).join('');
  const actions = [`<a class="button button-primary" data-accent="lime" href="${prefix}showcase.html?project=${project.id}">Открыть презентацию ↗</a>`];
  if (project.demoUrl) actions.push(`<a class="button button-outline" href="${prefix}${project.demoUrl}">Открыть сайт ↗</a>`);
  else if (project.url) actions.push(`<a class="button button-outline" href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">Открыть сайт ↗</a>`);
  if (project.repository) actions.push(`<a class="button button-outline" href="${escapeHtml(project.repository)}" target="_blank" rel="noopener noreferrer">Репозиторий GitHub ↗</a>`);

  const figures = await Promise.all(gallery.map(async item => {
    const { width, height } = await ctx.size(item.src);
    return `<figure${height > width ? ' class="is-portrait"' : ''}><a href="${prefix}${item.src}"><img src="${prefix}${item.src}" alt="${escapeHtml(item.caption)}" width="${width}" height="${height}" loading="lazy" decoding="async"></a><figcaption>${escapeHtml(item.caption)}</figcaption></figure>`;
  }));
  const previous = list[(index - 1 + list.length) % list.length];
  const next = list[(index + 1) % list.length];

  const body = `<a class="skip-link" href="#case-content">К содержимому</a>
<header class="site-header simple-header wrap">${brandLink(prefix)}<a class="text-link" href="${prefix}#work">← Все проекты</a></header>
<main id="case-content" class="wrap">
<div class="page-intro">${breadcrumbs(crumbs)}<p class="section-kicker">${escapeHtml(project.type)}</p><h1>${escapeHtml(project.name)}</h1><p>${escapeHtml(project.summary)}</p><div class="case-metadata">${metadata}</div></div>
<img class="case-hero" src="${prefix}${project.image}" alt="${escapeHtml(`${project.name} — ${heroCaption}`)}" width="${hero.width}" height="${hero.height}" fetchpriority="high" decoding="async">
<p class="case-visual-caption">${escapeHtml(heroCaption)}</p>
<div class="case-details"><section><h2>О проекте</h2><p>${escapeHtml(project.description)}</p></section><section><h2>Что внутри</h2><ul>${project.features.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section></div>
<div class="case-actions">${actions.join('')}</div>
${figures.length ? `<section class="case-gallery" aria-labelledby="gallery-title"><h2 id="gallery-title">Экраны проекта</h2><div class="case-gallery-grid">${figures.join('')}</div></section>` : ''}
<nav class="case-pager" aria-label="Другие проекты"><a href="../${previous.id}/" rel="prev"><span>← Предыдущий проект</span><strong>${escapeHtml(previous.name)}</strong></a><a href="../" class="case-pager-all"><span>Все кейсы</span><strong>${plural(list.length, ['проект', 'проекта', 'проектов'])}</strong></a><a href="../${next.id}/" rel="next"><span>Следующий проект →</span><strong>${escapeHtml(next.name)}</strong></a></nav>
</main>
${footer(prefix, contact, { label: 'Обсудить похожий проект', subject: `Проект: ${project.name}` })}`;

  return {
    file: `${pagePath}index.html`,
    html: page({ headHtml: head(ctx, { title, description, pagePath, image: og, type: 'article', data, prefix }), body }),
    sitemap: { path: pagePath, images },
    meta: { title, description },
  };
}

async function projectsHub(ctx, list, contact) {
  const prefix = '../';
  const pagePath = 'projects/';
  const pageUrl = ctx.abs(pagePath);
  const title = pageTitle(`Проекты: сайты, интерфейсы и продукты | ${PERSON_NAME}`, 'Проекты: сайты, интерфейсы и продукты');
  const description = metaDescription(`${plural(list.length, ['кейс', 'кейса', 'кейсов'])} Корнея Колокольникова: корпоративные сайты, каталоги, 3D-конфигураторы, туры 360° и приложения. Задачи, решения и экраны каждого проекта.`);
  const crumbs = [{ name: 'Главная', path: '', href: prefix }, { name: 'Проекты', path: pagePath }];
  const cards = await Promise.all(list.map(async project => {
    const { width, height } = await ctx.size(project.image);
    return `<li><a href="${project.id}/"><img src="${prefix}${project.image}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async"><span class="hub-kicker">${escapeHtml(project.type)}</span><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.summary)}</p></a></li>`;
  }));
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': pageUrl, url: pageUrl, name: title, description, inLanguage: 'ru', isPartOf: { '@id': ctx.websiteId }, breadcrumb: { '@id': `${pageUrl}#breadcrumb` }, mainEntity: { '@id': `${pageUrl}#list` } },
      { '@type': 'ItemList', '@id': `${pageUrl}#list`, numberOfItems: list.length, itemListElement: list.map((project, index) => ({ '@type': 'ListItem', position: index + 1, url: ctx.abs(`projects/${project.id}/`), name: project.name })) },
      breadcrumbData(ctx, pageUrl, crumbs),
      { '@type': 'WebSite', '@id': ctx.websiteId, url: ctx.siteUrl, name: BRAND_NAME, inLanguage: 'ru', publisher: personData(ctx, contact) },
    ],
  };
  const body = `<a class="skip-link" href="#hub-content">К содержимому</a>
<header class="site-header simple-header wrap">${brandLink(prefix)}<a class="text-link" href="${prefix}#work">← На главную</a></header>
<main id="hub-content" class="wrap">
<div class="page-intro">${breadcrumbs(crumbs)}<p class="section-kicker">Избранные проекты</p><h1>Сайты, интерфейсы и продукты</h1><p>От идеи до работающего результата: ${plural(list.length, ['кейс', 'кейса', 'кейсов'])} с задачами, решениями и экранами.</p></div>
<ol class="hub-grid">${cards.join('')}</ol>
</main>
${footer(prefix, contact, { label: 'Обсудить проект' })}`;
  return {
    file: `${pagePath}index.html`,
    html: page({ headHtml: head(ctx, { title, description, pagePath, image: { url: ctx.abs(OG_HOME), width: 1200, height: 630, alt: `${PERSON_NAME} — портфолио` }, data, prefix }), body }),
    sitemap: { path: pagePath, images: [] },
    meta: { title, description },
  };
}

// --- video pages ---------------------------------------------------------------------------------
const videoTitle = video => namedTitle(video.title, video.type);
const videoDescription = video => metaDescription(video.description, [], [`${video.type}, ${video.duration}. Видео Корнея Колокольникова.`, 'Видео Корнея Колокольникова.', `${video.type}, ${video.duration}.`]);

async function videoImage(ctx, video) {
  if (/^https:/.test(video.poster)) return { url: video.poster, width: 1280, height: 720, alt: video.title };
  const { width, height } = await ctx.size(video.poster);
  return { url: ctx.abs(video.poster), width, height, alt: video.title };
}

async function videoPage(ctx, video, list, contact, projects) {
  const prefix = '../../';
  const pagePath = `video/${video.id}/`;
  const pageUrl = ctx.abs(pagePath);
  const title = videoTitle(video);
  const description = videoDescription(video);
  const crumbs = [{ name: 'Главная', path: '', href: prefix }, { name: 'Видео', path: 'video/', href: '../' }, { name: video.title, path: pagePath }];
  const image = await videoImage(ctx, video);
  const work = video.src
    ? { '@type': 'VideoObject', '@id': `${pageUrl}#video`, name: video.title, description: video.description, thumbnailUrl: [image.url], contentUrl: ctx.abs(video.src), uploadDate: video.published, duration: isoDuration(video.duration), inLanguage: 'ru', creator: { '@id': ctx.personId }, keywords: video.tags.join(', ') }
    : { '@type': 'CreativeWork', '@id': `${pageUrl}#video`, name: video.title, description: video.description, genre: video.type, image: image.url, url: `https://www.youtube.com/watch?v=${video.youtubeId}`, creator: { '@id': ctx.personId }, keywords: video.tags.join(', ') };
  if (video.src && !/^\d{4}-\d{2}-\d{2}$/.test(video.published ?? '')) throw new Error(`Local video ${video.id} needs published: 'YYYY-MM-DD'`);
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': pageUrl, url: pageUrl, name: title, description, inLanguage: 'ru', isPartOf: { '@id': ctx.websiteId }, breadcrumb: { '@id': `${pageUrl}#breadcrumb` }, mainEntity: { '@id': `${pageUrl}#video` } },
      work,
      breadcrumbData(ctx, pageUrl, crumbs),
      personData(ctx, contact),
      { '@type': 'WebSite', '@id': ctx.websiteId, url: ctx.siteUrl, name: BRAND_NAME, inLanguage: 'ru', publisher: { '@id': ctx.personId } },
    ],
  };
  let stage;
  if (video.src) {
    const { width, height } = await ctx.size(video.poster);
    stage = `<video src="${prefix}${video.src}" poster="${prefix}${video.poster}" width="${width}" height="${height}" controls preload="none" playsinline aria-label="${escapeHtml(video.title)}"></video><p class="video-error" data-video-error hidden>Не удалось загрузить превью. Попробуйте открыть файл отдельно.</p>`;
  } else {
    stage = `<a class="youtube-watch" href="https://www.youtube.com/watch?v=${video.youtubeId}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(video.poster)}" alt="${escapeHtml(video.title)}" width="1280" height="720" fetchpriority="high" decoding="async"><span class="youtube-watch-label">▶ Смотреть на YouTube ↗</span></a>`;
  }
  const related = video.relatedProject && projects.find(item => item.id === video.relatedProject);
  const actions = [
    '<button class="button button-primary" type="button" data-share-link>Скопировать ссылку</button>',
    `<a class="button button-outline action-link" data-accent="orange" href="mailto:${contact.email}?subject=${encodeURIComponent(`Видео: ${video.title}`)}">Обсудить видео ↗</a>`,
  ];
  if (video.src) actions.push(`<a class="button button-outline" href="${prefix}${video.src}" target="_blank" rel="noopener noreferrer">Открыть превью отдельно ↗</a>`);
  if (related) actions.push(`<a class="button button-outline" data-accent="blue" href="${prefix}projects/${related.id}/">Посмотреть сайт ${escapeHtml(related.name)} ↗</a>`);
  const others = list.filter(item => item !== video).map(item => `<li><a href="../${item.id}/"><span>${escapeHtml(item.type)} · ${escapeHtml(item.duration)}</span><strong>${escapeHtml(item.title)}</strong></a></li>`).join('');
  const body = `<header class="site-header simple-header wrap">${brandLink(prefix, 'lime')}<a class="text-link" href="${prefix}#video">← Все видеоработы</a></header>
<main id="video-content" class="wrap">
<div class="page-intro">${breadcrumbs(crumbs)}<p class="section-kicker">${escapeHtml(video.type)} · ${escapeHtml(video.duration)}</p><h1>${escapeHtml(video.title)}</h1><p>${escapeHtml(video.description)}</p></div>
<div class="video-stage">${stage}</div>
<p class="case-visual-caption">${escapeHtml(video.note || 'Полная версия откроется на авторском YouTube-канале.')}</p>
<div class="case-actions video-actions">${actions.join('')}</div>
<input class="video-share-field" type="url" readonly hidden aria-label="Ссылка на видеоработу" data-share-field>
<section class="more-links" aria-labelledby="more-title"><h2 id="more-title">Другие видеоработы</h2><ul>${others}</ul></section>
</main>
${footer(prefix, contact, { label: 'Обсудить видео', subject: `Видео: ${video.title}` })}
<div id="video-status" class="toast" role="status" hidden></div>`;
  return {
    file: `${pagePath}index.html`,
    html: page({ headHtml: head(ctx, { title, description, pagePath, image, type: video.src ? 'video.other' : 'article', data, styles: ['video.css'], prefix }), bodyAttrs: ' data-accent="lime"', body, scripts: [`${prefix}video-page.js`] }),
    sitemap: { path: pagePath, images: [image.url] },
    meta: { title, description },
  };
}

async function videoHub(ctx, list, contact) {
  const prefix = '../';
  const pagePath = 'video/';
  const pageUrl = ctx.abs(pagePath);
  const title = pageTitle(`Видео, CGI и анимация | ${PERSON_NAME}`);
  const description = metaDescription('Видеоработы Корнея Колокольникова: CGI-шоурил, фильмы о брендах и местах, AI-видео, анимация логотипов и панорамные визуалы для сцен и LED-экранов.');
  const crumbs = [{ name: 'Главная', path: '', href: prefix }, { name: 'Видео', path: pagePath }];
  const cards = await Promise.all(list.map(async video => {
    const local = !/^https:/.test(video.poster);
    const size = local ? await ctx.size(video.poster) : { width: 1280, height: 720 };
    return `<li><a href="${video.id}/"><img src="${local ? prefix : ''}${escapeHtml(video.poster)}" alt="" width="${size.width}" height="${size.height}" loading="lazy" decoding="async"><span class="hub-kicker">${escapeHtml(video.type)} · ${escapeHtml(video.duration)}</span><h2>${escapeHtml(video.title)}</h2><p>${escapeHtml(video.description)}</p></a></li>`;
  }));
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': pageUrl, url: pageUrl, name: title, description, inLanguage: 'ru', isPartOf: { '@id': ctx.websiteId }, breadcrumb: { '@id': `${pageUrl}#breadcrumb` }, mainEntity: { '@id': `${pageUrl}#list` } },
      { '@type': 'ItemList', '@id': `${pageUrl}#list`, numberOfItems: list.length, itemListElement: list.map((video, index) => ({ '@type': 'ListItem', position: index + 1, url: ctx.abs(`video/${video.id}/`), name: video.title })) },
      breadcrumbData(ctx, pageUrl, crumbs),
      { '@type': 'WebSite', '@id': ctx.websiteId, url: ctx.siteUrl, name: BRAND_NAME, inLanguage: 'ru', publisher: personData(ctx, contact) },
    ],
  };
  const body = `<a class="skip-link" href="#hub-content">К содержимому</a>
<header class="site-header simple-header wrap">${brandLink(prefix, 'lime')}<a class="text-link" href="${prefix}#video">← На главную</a></header>
<main id="hub-content" class="wrap">
<div class="page-intro">${breadcrumbs(crumbs)}<p class="section-kicker">Идеи в движении</p><h1>Видео, CGI и анимация</h1><p>Фильмы о брендах и местах, компьютерная графика, AI-видео и анимация логотипов. Полные фильмы — на <a class="action-link" href="${SOCIAL[1]}" target="_blank" rel="noopener noreferrer">YouTube-канале ↗</a></p></div>
<ol class="hub-grid hub-grid-video">${cards.join('')}</ol>
</main>
${footer(prefix, contact, { label: 'Обсудить видео' })}`;
  return {
    file: `${pagePath}index.html`,
    html: page({ headHtml: head(ctx, { title, description, pagePath, image: { url: ctx.abs(OG_HOME), width: 1200, height: 630, alt: `${PERSON_NAME} — видеоработы` }, data, prefix }), bodyAttrs: ' data-accent="lime"', body }),
    sitemap: { path: pagePath, images: [] },
    meta: { title, description },
  };
}

// --- 404, sitemap, robots ------------------------------------------------------------------------
function notFoundPage(ctx, contact) {
  // GitHub Pages serves this file with status 404 at any depth, so links resolve from <base>.
  const base = new URL(ctx.siteUrl).pathname;
  const title = `Страница не найдена — ${BRAND_NAME}`;
  const headHtml = [
    '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<base href="${base}">`, '<meta name="robots" content="noindex">', '<meta name="theme-color" content="#0c1016">',
    `<title>${title}</title>`, '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    '<link rel="stylesheet" href="styles.css">', '<script src="theme.js"></script>',
  ].join('\n');
  const body = `<header class="site-header simple-header wrap">${brandLink('')}<a class="text-link" href="">← На главную</a></header>
<main class="wrap"><div class="page-intro"><p class="section-kicker">Ошибка 404</p><h1>Страница не найдена</h1><p>Возможно, адрес изменился или в ссылке опечатка. Начните с главной или откройте нужный раздел.</p></div>
<div class="case-actions"><a class="button button-primary" href="">На главную</a><a class="button button-outline" href="projects/">Все проекты</a><a class="button button-outline" href="video/">Видеоработы</a></div></main>
${footer('', contact, { label: 'Написать Корнею' })}`;
  return { file: '404.html', html: page({ headHtml, body }) };
}

function sitemapXml(ctx, entries) {
  const urls = entries.map(entry => {
    const images = [...new Set(entry.images)].map(url => `\n    <image:image><image:loc>${escapeHtml(url)}</image:loc></image:image>`).join('');
    return `  <url>\n    <loc>${escapeHtml(ctx.abs(entry.path))}</loc>${images}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
}

const robotsTxt = ctx => `# ${BRAND_NAME} — портфолио. Индексация открыта для всех поисковиков.\n# Служебные страницы (презентации, демо, 404) закрыты метатегом robots, а не здесь,\n# чтобы поисковик мог прочитать этот метатег.\nUser-agent: *\nAllow: /\n\nSitemap: ${ctx.abs('sitemap.xml')}\n`;

// --- entry point ---------------------------------------------------------------------------------
export function readVerification(env = process.env) {
  return { google: env.GOOGLE_SITE_VERIFICATION?.trim() || '', yandex: env.YANDEX_VERIFICATION?.trim() || '' };
}

export async function generateSeo({ publicDir, outDir = publicDir, siteUrl = resolveSiteUrl(), projects, videos, contact, verification = readVerification() }) {
  const ctx = createContext({ publicDir, siteUrl });
  const pages = [
    await projectsHub(ctx, projects, contact),
    ...await Promise.all(projects.map((project, index, list) => projectPage(ctx, project, index, list, contact))),
    await videoHub(ctx, videos, contact),
    ...await Promise.all(videos.map(video => videoPage(ctx, video, videos, contact, projects))),
    notFoundPage(ctx, contact),
  ];
  const staticPages = [
    { path: '', images: [ctx.abs(OG_HOME)] },
    { path: 'brand.html', images: ['assets/brand/logo-blue-light.svg', 'assets/brand/logo-lime-light.svg', 'assets/brand/logo-orange-light.svg'].map(ctx.abs) },
  ];
  const sitemapEntries = [staticPages[0], ...pages.filter(item => item.sitemap).map(item => item.sitemap), staticPages[1]];

  // Generated folders are owned by this script: stale pages of removed projects must not survive.
  for (const dir of GENERATED_DIRS) await rm(path.join(outDir, dir), { recursive: true, force: true });
  for (const item of pages) {
    const target = path.join(outDir, item.file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, item.html);
  }
  const patched = [];
  for (const config of STATIC_PAGES) patched.push(await patchStaticPage(ctx, outDir, config, contact, verification));
  await writeFile(path.join(outDir, 'sitemap.xml'), sitemapXml(ctx, sitemapEntries));
  await writeFile(path.join(outDir, 'robots.txt'), robotsTxt(ctx));
  return {
    siteUrl,
    pages: [...patched, ...pages.filter(item => item.meta).map(item => ({ file: item.file, ...item.meta }))],
    sitemap: sitemapEntries.map(entry => ctx.abs(entry.path)),
  };
}

export async function loadData(publicDir) {
  const load = file => import(`${pathToFileURL(path.join(publicDir, file)).href}?t=${Date.now()}`);
  const [{ projects, contact }, { videos }] = await Promise.all([load('projects.js'), load('videos.js')]);
  return { projects, contact, videos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const result = await generateSeo({ publicDir, ...await loadData(publicDir) });
  const generated = (await readdir(publicDir, { recursive: true })).filter(name => /^(projects|video)[\\/].*index\.html$/.test(name)).length;
  console.log(`SEO pages for ${result.siteUrl}: ${generated} pages in projects/ and video/, 404.html, sitemap.xml (${result.sitemap.length} URLs), robots.txt.`);
}
