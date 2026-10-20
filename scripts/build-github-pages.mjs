import assert from 'node:assert/strict';
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contact, projects } from '../public/projects.js';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const source = path.join(root, 'public');
const outputParent = path.join(root, 'out');
const output = path.join(outputParent, 'github-pages');
const adminUrl = 'https://korney-kolokolnikov-portfolio.cocoacrow256.chatgpt.site/admin/';

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Symbolic links are not supported: ${filename}`);
    if (entry.isDirectory()) files.push(...await filesIn(filename));
    else {
      assert.ok(entry.isFile(), `Expected a regular file: ${filename}`);
      files.push(filename);
    }
  }
  return files;
}

function replaceOnce(contents, before, after, filename) {
  assert.ok(contents.includes(before), `Missing expected source in ${filename}`);
  assert.equal(contents.indexOf(before), contents.lastIndexOf(before), `Ambiguous source in ${filename}`);
  return contents.replace(before, after);
}

const sourceFiles = await filesIn(source);
const catalog = projects.filter(project => project.demoUrl).map(project => {
  assert.equal(new URL(project.url).protocol, 'https:', `Expected an original HTTPS URL for ${project.id}`);
  return { id: project.id, title: project.name, description: project.description, path: project.url };
});
const staticProjects = projects.map(original => {
  const project = { ...original };
  delete project.demoUrl;
  return project;
});
const catalogFetch = "fetch(new URL('demos/catalog.json', import.meta.url))";
const directoryScript = replaceOnce(
  await readFile(path.join(source, 'demo-directory.js'), 'utf8'),
  "fetch('/api/portfolio/catalog/')", catalogFetch, 'demo-directory.js',
);
let showcaseScript = replaceOnce(
  await readFile(path.join(source, 'showcase.js'), 'utf8'),
  "fetch('/api/portfolio/catalog/')", catalogFetch, 'showcase.js',
);
showcaseScript = replaceOnce(showcaseScript, 'demoUrl:`demos/${demo.path}`', 'demoUrl:demo.path', 'showcase.js');

// This script may clean only the fixed, ordinary directory inside this repository.
assert.equal(path.relative(root, output), path.join('out', 'github-pages'));
const parentInfo = await lstat(outputParent).catch(error => {
  if (error.code === 'ENOENT') return undefined;
  throw error;
});
if (parentInfo) assert.ok(parentInfo.isDirectory() && !parentInfo.isSymbolicLink(), 'out must be an ordinary directory');
else await mkdir(outputParent);
assert.equal(await realpath(outputParent), outputParent, 'Refusing a redirected output parent');
const outputInfo = await lstat(output).catch(error => {
  if (error.code === 'ENOENT') return undefined;
  throw error;
});
if (outputInfo) {
  assert.ok(outputInfo.isDirectory() && !outputInfo.isSymbolicLink(), 'The export target must be an ordinary directory');
  assert.equal(await realpath(output), output, 'Refusing a redirected export target');
  await rm(output, { recursive: true });
}
await cp(source, output, { recursive: true, errorOnExist: true, force: false });

await writeFile(path.join(output, 'demo-directory.js'), directoryScript);
await writeFile(path.join(output, 'showcase.js'), showcaseScript);
await writeFile(path.join(output, 'projects.js'),
  `// Generated for GitHub Pages; edit public/projects.js instead.\nexport const projects = ${JSON.stringify(staticProjects, null, 2)};\nexport const contact = ${JSON.stringify(contact)};\n`);
await mkdir(path.join(output, 'demos'), { recursive: true });
await writeFile(path.join(output, 'demos', 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(path.join(output, '.nojekyll'), '');

for (const filename of sourceFiles.filter(filename => filename.endsWith('.html'))) {
  const relative = path.relative(source, filename);
  const html = await readFile(filename, 'utf8');
  const staticHtml = html.replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])\/admin\/?\2/gi,
    (_match, prefix, quote) => `${prefix}${quote}${adminUrl}${quote}`);
  await writeFile(path.join(output, relative), staticHtml);
}

const outputFiles = await filesIn(output);
const assetCount = outputFiles.filter(filename => path.relative(output, filename).startsWith(`assets${path.sep}`)).length;
const htmlCount = outputFiles.filter(filename => filename.endsWith('.html')).length;
console.log(`GitHub Pages export: out/github-pages (${outputFiles.length} files, ${htmlCount} HTML pages, ${assetCount} assets).`);
console.log(`Preserved ${staticProjects.length} projects; ${catalog.length} demos use their original HTTPS sites. Public and server sources are unchanged.`);
