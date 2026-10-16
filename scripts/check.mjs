import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { projects } from '../dist/projects.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const files=await readdir(root);
for(const name of files.filter(name=>name.endsWith('.js')))execFileSync(process.execPath,['--check',path.join(root,name)]);
assert.equal(new Set(projects.map(item=>item.id)).size,projects.length,'Project IDs must be unique');
for(const project of projects){
  assert.match(project.id,/^[a-z0-9-]+$/);
  assert.ok(['website','product','presentation'].includes(project.category));
  assert.ok(project.gallery.length);
  for(const asset of [project.image,...project.gallery.map(item=>item.src)])assert.ok((await stat(path.join(root,asset))).isFile(),asset);
  for(const url of [project.url,project.repository].filter(Boolean))assert.equal(new URL(url).protocol,'https:');
}
for(const name of files.filter(name=>name.endsWith('.html'))){
  const html=await readFile(path.join(root,name),'utf8');
  assert.match(html,/<html lang="ru"/);
  assert.match(html,/<meta name="viewport"/);
  for(const [,target] of html.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/g)){
    if(/^(https?:|mailto:|tel:)/.test(target)||target==='./')continue;
    assert.ok((await stat(path.join(root,target))).isFile(),`${name}: ${target}`);
  }
}
const shapes=[];
for(const colour of ['blue','lime','orange']){
  const svg=await readFile(path.join(root,`assets/brand/logo-${colour}-light.svg`),'utf8');
  shapes.push([...svg.matchAll(/<path d="([^"]+)"/g)].map(match=>match[1]));
  assert.match(svg,/viewBox="0 0 1300 1170"/);
  assert.match(svg,/x="650" y="1050"/);
}
assert.deepEqual(shapes[0],shapes[1]);assert.deepEqual(shapes[1],shapes[2]);
console.log(`Checked JavaScript syntax, local HTML references, ${projects.length} project records and identical logo geometry.`);
