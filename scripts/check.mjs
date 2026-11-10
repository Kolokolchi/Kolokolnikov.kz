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
// the story player lives in a subfolder (and ESLint's Next config does not flag a redeclared const in it)
for(const name of ['story/story.js'])execFileSync(process.execPath,['--check',path.join(root,name)]);
assert.equal(new Set(projects.map(item=>item.id)).size,projects.length,'Project IDs must be unique');
for(const project of projects){
  const assembly=assemblyDesigns[project.id];
  assert.ok(assembly,`Missing assembly: ${project.id}`);
  const scene=await readFile(path.join(root,assembly.scene),'utf8');
  assert.ok([...scene.matchAll(/data-assembly-layer\b/g)].length>=6,`Missing native layers: ${project.id}`);
  assert.doesNotMatch(scene,/(?:assets\/projects\/|<script\b|<iframe\b|clipPath)/i,`Scene must use native source layers: ${project.id}`);
  for(const match of scene.matchAll(/(?:src|href)=["']([^"'#]+)["']|url\(["']?([^\s)'"#]+)["']?\)/g)){
    const asset=match[1]||match[2];
    if(!asset||/^(?:https?:|data:)/.test(asset))continue;
    assert.ok((await stat(path.resolve(root,path.dirname(assembly.scene),asset))).isFile(),`${project.id}: ${asset}`);
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

// Extended portfolio: every referenced media id resolves to files that exist, models are present.
const work=await import('../public/work-data.js');
const {media}=await import('../public/work-media.js');
const isFile=async relative=>(await stat(path.join(root,relative))).isFile();
let mediaFiles=0;
for(const item of Object.values(media))for(const file of [item.src,item.sm,item.video,item.poster,...(item.pages||[]).flatMap(page=>[page.src,page.sm])].filter(Boolean)){assert.ok(await isFile(file),file);mediaFiles++;}
const referenced=[...work.machines.map(item=>item.poster),...work.engineeringGallery,...work.cgiItems,...work.motionReel.filter(item=>!item.src),...work.reels,...work.brands,...work.decks,...work.marquee.map(([id])=>id)].map(item=>typeof item==='string'?item:item.id);
for(const id of referenced)assert.ok(media[id],`Missing media for ${id}`);
for(const item of work.motionReel.filter(item=>item.src))for(const file of [item.src,item.poster])assert.ok(await isFile(file),file);
for(const machine of work.machines){assert.ok(await isFile(machine.file),machine.file);assert.ok(machine.facts.length&&machine.summary&&machine.status,machine.id);}
const youtubeIds=work.youtubeGroups.flatMap(group=>group.items.map(([id])=>id));
for(const id of youtubeIds)assert.match(id,/^[\w-]{11}$/);
for(const id of work.youtubeNoEmbed)assert.ok(youtubeIds.includes(id),`Unused no-embed id ${id}`);
for(const file of ['machine-viewer.js','pano-viewer.js','assets/draco/draco_wasm_wrapper.js','assets/draco/draco_decoder.wasm'])assert.ok(await isFile(file),file);
console.log(`Checked JavaScript syntax, local HTML references, ${projects.length} projects, ${demos.length} demo links and identical logo geometry. Uploaded demos are stored independently in D1/R2.`);
console.log(`Checked ${referenced.length} gallery references, ${mediaFiles} media files, ${work.machines.length} WebGL models and ${new Set(youtubeIds).size} YouTube videos.`);
