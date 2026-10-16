import {readdir,readFile,writeFile,mkdir,copyFile,lstat,rename,rm,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Import only a finished static build. Source projects remain untouched.
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1]||args[i+1].startsWith('--'))throw Error('Use --id name --from absolute-build-directory [--title Title] [--base-path /old-prefix/]');options[args[i].slice(2)]=args[i+1];}
const {id,from}=options;
if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id||''))throw Error('--id must contain lowercase Latin letters, digits and hyphens');
if(!from||!path.isAbsolute(from))throw Error('--from must be an absolute path to a finished static build');
const root=path.resolve(fileURLToPath(new URL('../dist/demos/',import.meta.url)));
const source=path.resolve(from),destination=path.join(root,id),stage=path.join(root,`.import-${id}-${Date.now()}`);
function confined(target){const relative=path.relative(root,path.resolve(target));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Destination must stay inside dist/demos');return target;}
confined(destination);confined(stage);
if(source===root||source.startsWith(root+path.sep)||root.startsWith(source+path.sep))throw Error('Source and destination must be separate directories');
await access(path.join(source,'index.html'));
await mkdir(root,{recursive:true});
let exists=false;
try{await access(destination);exists=true;}catch{}
if(exists){const marker=JSON.parse(await readFile(path.join(destination,'demo-info.json'),'utf8'));if(marker.importedBy!=='portfolio'||marker.id!==id)throw Error('Existing folder was not created by the demo importer');}
const prefix=`/demos/${id}/`;
const oldBase=options['base-path'];
if(oldBase&&(!oldBase.startsWith('/')||oldBase.startsWith('//')||oldBase.includes('..')))throw Error('Invalid --base-path');
const entries=await readdir(source);
const escaped=entries.filter(name=>!name.startsWith('.')).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
const rootReference=new RegExp('([\x22\x27\x60(=])/(?:'+escaped+')(?=[/\\?\x22\x27\x60)#\\s])','g');
const allowed=new Set(['.html','.css','.js','.mjs','.json','.svg','.webp','.png','.jpg','.jpeg','.avif','.gif','.ico','.pdf','.woff','.woff2','.ttf','.otf','.mp4','.webm','.txt','.xml','.wasm']);
const textual=new Set(['.html','.css','.js','.mjs','.json','.svg','.txt','.xml']);
let fileCount=0,bytes=0;
await mkdir(stage);
try{
 async function copy(relative=''){
  for(const item of await readdir(path.join(source,relative),{withFileTypes:true})){
   if(item.name.startsWith('.')||['node_modules','package.json','package-lock.json','demo-info.json','_headers','_redirects'].includes(item.name))continue;
   const rel=path.join(relative,item.name),input=path.join(source,rel),output=path.join(stage,rel);
   const stat=await lstat(input);if(stat.isSymbolicLink())throw Error(`Symlinks are not supported: ${rel}`);
   if(item.isDirectory()){await mkdir(output,{recursive:true});await copy(rel);continue;}
   if(!allowed.has(path.extname(item.name).toLowerCase()))continue;
   if(textual.has(path.extname(item.name).toLowerCase())){
    let text=await readFile(input,'utf8');
    if(oldBase&&oldBase!=='/')text=text.replaceAll(oldBase.replace(/\/?$/,'/'),prefix).replaceAll(oldBase.replace(/\/$/,''),prefix.slice(0,-1));
    text=text.replace(rootReference,match=>match[0]+prefix+match.slice(2));
    if(path.extname(item.name)==='.html'){
     text=text.replace(/(<(?:a|base)\b[^>]*\bhref=["'])\/(?=["'])/gi,`$1${prefix}`);
     text=text.replace(/<meta\s+name=["']robots["'][^>]*>/gi,'').replace('</head>','<meta name="robots" content="noindex,nofollow">\n</head>');
    }
    await writeFile(output,text);
   }else await copyFile(input,output);
   fileCount++;bytes+=(await lstat(output)).size;
  }
 }
 await copy();
 if(!fileCount)throw Error('No static files found');
 const importedAt=new Date().toISOString();
 await writeFile(path.join(stage,'demo-info.json'),JSON.stringify({importedBy:'portfolio',id,importedAt,fileCount},null,2)+'\n');
 // Both paths are checked before replacement; never remove source files or an unmanaged directory.
 if(exists)await rm(confined(destination),{recursive:true});
 await rename(confined(stage),confined(destination));
 const catalogPath=path.join(root,'catalog.json');let catalog=[];
 try{catalog=JSON.parse(await readFile(catalogPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const previous=catalog.find(item=>item.id===id);
 const item={id,title:options.title||previous?.title||id,description:options.description||previous?.description||'Интерактивный просмотр сайта.',path:`${id}/`,updatedAt:importedAt};
 const index=catalog.findIndex(item=>item.id===id);if(index<0)catalog.push(item);else catalog[index]=item;
 await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
 console.log(JSON.stringify({id,path:prefix,files:fileCount,megabytes:Number((bytes/1048576).toFixed(2))}));
}catch(error){await rm(confined(stage),{recursive:true,force:true});throw error;}
