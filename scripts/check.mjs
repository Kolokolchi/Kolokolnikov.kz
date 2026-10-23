import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { projects } from '../public/projects.js';
import { assemblyDesigns } from '../public/project-assembly-data.js';
import { videos } from '../public/videos.js';

const root=fileURLToPath(new URL('../public/',import.meta.url));
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
  const assembly=assemblyDesigns[project.id];
  assert.ok(assembly,`Missing assembly: ${project.id}`);
  assert.ok(assembly.pieces.length>=6,`Missing content layers: ${project.id}`);
  assert.ok((await stat(path.join(root,assembly.source.src))).isFile(),assembly.source.src);
  for(const piece of assembly.pieces){
    const points=piece.poly||[[piece.rect[0],piece.rect[1]],[piece.rect[0]+piece.rect[2],piece.rect[1]+piece.rect[3]]];
    assert.ok(points.flat().every(value=>value>=0&&value<=100),`${project.id}: ${piece.name} is outside the image`);
  }
  assert.match(project.id,/^[a-z0-9-]+$/);
  assert.ok(['website','product','presentation'].includes(project.category));
  assert.ok(project.gallery.length);
  if(project.demoUrl)assert.match(project.demoUrl,/^demos\/[a-z0-9-]+\/$/);
  for(const asset of [project.image,...project.gallery.map(item=>item.src)])assert.ok((await stat(path.join(root,asset))).isFile(),asset);
  for(const url of [project.url,project.repository].filter(Boolean))assert.equal(new URL(url).protocol,'https:');
}
const demos=projects.filter(project=>project.demoUrl);
for(const name of [...files.filter(name=>name.endsWith('.html')),'demos/index.html']){
  const html=await readFile(path.join(root,name),'utf8');
  assert.match(html,/<html lang="ru"/);
  assert.match(html,/<meta name="viewport"/);
  for(const [,target] of html.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/g)){
    if(/^(https?:|mailto:|tel:)/.test(target)||target==='./')continue;
    if(target==='/admin/')continue; // Protected server-rendered route.
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
console.log(`Checked JavaScript syntax, local HTML references, ${projects.length} projects, ${demos.length} demo links and identical logo geometry. Uploaded demos are stored independently in D1/R2.`);
