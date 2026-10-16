import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { projects } from '../dist/projects.js';
import { videos } from '../dist/videos.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const files=await readdir(root);
assert.equal(new Set(videos.map(item=>item.id)).size,videos.length,'Video IDs must be unique');
for(const video of videos){
  assert.ok(Boolean(video.src)!==Boolean(video.youtubeId),'Choose one video source');
  if(video.youtubeId)assert.match(video.youtubeId,/^[\w-]{11}$/);
  for(const asset of [video.src,video.poster].filter(item=>item&&!item.startsWith('https://')))assert.ok((await stat(path.join(root,asset))).isFile(),asset);
}
for(const name of files.filter(name=>name.endsWith('.js')))execFileSync(process.execPath,['--check',path.join(root,name)]);
assert.equal(new Set(projects.map(item=>item.id)).size,projects.length,'Project IDs must be unique');
for(const project of projects){
  assert.match(project.id,/^[a-z0-9-]+$/);
  assert.ok(['website','product','presentation'].includes(project.category));
  assert.ok(project.gallery.length);
  if(project.demoUrl){assert.match(project.demoUrl,/^demos\/[a-z0-9-]+\/$/);assert.ok((await stat(path.join(root,project.demoUrl,'index.html'))).isFile());}
  for(const asset of [project.image,...project.gallery.map(item=>item.src)])assert.ok((await stat(path.join(root,asset))).isFile(),asset);
  for(const url of [project.url,project.repository].filter(Boolean))assert.equal(new URL(url).protocol,'https:');
}
const demos=JSON.parse(await readFile(path.join(root,'demos/catalog.json'),'utf8'));
assert.equal(new Set(demos.map(item=>item.id)).size,demos.length,'Demo IDs must be unique');
for(const demo of demos){
  assert.match(demo.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(demo.path,`${demo.id}/`);
  assert.ok((await stat(path.join(root,'demos',demo.path,'index.html'))).isFile());
}
for(const name of [...files.filter(name=>name.endsWith('.html')),'demos/index.html']){
  const html=await readFile(path.join(root,name),'utf8');
  assert.match(html,/<html lang="ru"/);
  assert.match(html,/<meta name="viewport"/);
  for(const [,target] of html.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/g)){
    if(/^(https?:|mailto:|tel:)/.test(target)||target==='./')continue;
    let resolved=path.resolve(root,path.dirname(name),target);
    if((await stat(resolved)).isDirectory())resolved=path.join(resolved,'index.html');
    assert.ok((await stat(resolved)).isFile(),`${name}: ${target}`);
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
console.log(`Checked JavaScript syntax, local HTML references, ${projects.length} projects, ${demos.length} hosted demos and identical logo geometry.`);
