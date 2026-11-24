import assert from 'node:assert/strict';

// Content-Security-Policy of the GitHub Pages copy. Pages cannot send HTTP headers, so the policy goes into
// every exported page as <meta http-equiv>, right after the charset: a meta policy covers only what follows it.
// A meta policy ignores frame-ancestors, report-uri and sandbox; protection against framing needs a real
// header (an own domain behind a proxy such as Cloudflare).
export function contentSecurityPolicy({ frameOrigins = [] } = {}) {
  for (const origin of frameOrigins) assert.match(origin, /^https:\/\/[a-z0-9.-]+$/, `Not an HTTPS origin: ${origin}`);
  const directives = {
    'default-src': ["'self'"],
    // Only the site's own script files. 'wasm-unsafe-eval' lets the Draco decoder (assets/draco, used by
    // machine-viewer.js) compile WebAssembly; it does not allow eval() or new Function().
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    // The assembly scenes carry their own <style> blocks and brand.html uses style attributes.
    'style-src': ["'self'", "'unsafe-inline'"],
    // YouTube covers; GLTFLoader turns textures embedded in a .glb into blob: URLs.
    'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
    'font-src': ["'self'"],
    'media-src': ["'self'"],
    // GLTFLoader reads those blob: textures back with fetch (ImageBitmapLoader).
    'connect-src': ["'self'", 'blob:'],
    // DRACOLoader starts its decoder worker from a Blob.
    'worker-src': ["'self'", 'blob:'],
    // Video embeds and the live project sites opened in the showcase.
    'frame-src': ["'self'", 'https://www.youtube-nocookie.com', ...frameOrigins],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'manifest-src': ["'self'"],
    'upgrade-insecure-requests': [],
  };
  return Object.entries(directives)
    .map(([name, sources]) => [name, ...new Set(sources)].join(' '))
    .join('; ');
}

// Anything the policy would block without a trace in the page: inline code runs only through script files.
const dataScriptTypes = new Set(['application/ld+json', 'application/json']);
function inlineCode(html) {
  const problems = [];
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (/\ssrc\s*=/i.test(tag)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1]?.toLowerCase();
    if (!type || !dataScriptTypes.has(type)) problems.push(`inline script ${tag}`);
  }
  for (const [match] of html.matchAll(/<[a-z][^>]*?\son[a-z]+\s*=\s*["']/gi)) problems.push(`event handler attribute in ${match.slice(0, 80)}`);
  for (const [match] of html.matchAll(/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/gi)) problems.push(`javascript: URL in ${match.trim()}`);
  return problems;
}

export function applyContentSecurityPolicy(html, policy, filename) {
  assert.ok(!/http-equiv\s*=\s*["']?content-security-policy/i.test(html), `${filename} already has a Content-Security-Policy`);
  const problems = inlineCode(html);
  assert.deepEqual(problems, [], `${filename} has code the Content-Security-Policy would block:\n${problems.join('\n')}`);
  const charsets = [...html.matchAll(/<meta\s+charset\s*=\s*["']?[\w-]+["']?\s*\/?>/gi)];
  assert.equal(charsets.length, 1, `${filename} needs exactly one <meta charset> to place the Content-Security-Policy after`);
  const [charset] = charsets;
  const end = charset.index + charset[0].length;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  return `${html.slice(0, end)}${meta}${html.slice(end)}`;
}
