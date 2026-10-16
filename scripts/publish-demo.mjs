import {readdir,lstat,readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {allowedFile,validateManifest,validSlug,sha256} from '../lib/demo-format.mjs';
const DEFAULT_ORIGIN='https://korney-kolokolnikov-portfolio.cocoacrow256.chatgpt.site';
const configDir=path.join(os.homedir(),'.codex','portfolio-publisher');
const configPath=path.join(configDir,'connection.json');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){if(!args[i].startsWith('--'))throw Error('Use --from build-directory --id project --title Title [--version Label] [--draft]');const key=args[i].slice(2);options[key]=['draft','configure','dry-run','list'].includes(key)?true:args[++i];}
function powershell(code,input){return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{input,encoding:'utf8',windowsHide:true}).trim();}
function encrypt(value){if(process.platform!=='win32')throw Error('Secure setup currently supports Windows only.');return powershell('$ErrorActionPreference="Stop"; $null=[Reflection.Assembly]::LoadWithPartialName("System.Security"); $value=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($value,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))',value);}
function decrypt(value){return powershell('$ErrorActionPreference="Stop"; $null=[Reflection.Assembly]::LoadWithPartialName("System.Security"); $value=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($value,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))',value);}
async function readHidden(){
 process.stdout.write('Ready for portfolio connection JSON on stdin (input is hidden).\n');
 if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let line='';function finish(){process.stdin.off('data',receive);process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);try{resolve(JSON.parse(line));}catch{reject(Error('Expected a JSON line.'));}}function receive(chunk){for(const char of chunk.toString()){if(char==='\r'||char==='\n'){finish();return;}if(char==='\u0003'){reject(Error('Cancelled'));return;}line+=char;}}process.stdin.on('data',receive);});
}
async function collect(source){const files=[];async function visit(relative=''){for(const entry of await readdir(path.join(source,relative),{withFileTypes:true})){if(entry.name.startsWith('.')||['node_modules','__MACOSX'].includes(entry.name))continue;const rel=relative?`${relative}/${entry.name}`:entry.name,full=path.join(source,rel),stat=await lstat(full);if(stat.isSymbolicLink())throw Error(`Symbolic links are not supported: ${rel}`);if(entry.isDirectory())await visit(rel);else if(allowedFile(rel)){const bytes=await readFile(full);files.push({path:rel,size:bytes.length,hash:await sha256(bytes),full});}}}await visit();files.sort((a,b)=>a.path.localeCompare(b.path));return files;}
async function main(){
 if(options.configure){const input=await readHidden();if(input.origin!==DEFAULT_ORIGIN||typeof input.key!=='string'||input.key.length<32)throw Error('Invalid connection settings.');await mkdir(configDir,{recursive:true});await writeFile(configPath,JSON.stringify({origin:input.origin,encryptedKey:encrypt(input.key)},null,2));console.log('Portfolio connection saved with Windows DPAPI.');return;}
 if(!options.list&&(!validSlug(options.id)||!options.from||!path.isAbsolute(options.from)))throw Error('Specify --id using lowercase Latin letters and --from as an absolute build path.');
 const files=options.list?[]:await collect(path.resolve(options.from));if(!options.list)validateManifest(files);
 if(options['dry-run']){console.log(JSON.stringify({project:options.id,files:files.length,bytes:files.reduce((s,f)=>s+f.size,0),paths:files.map(f=>f.path)},null,2));return;}
 const input=await readHidden();let key,origin;
 if(options.origin&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(options.origin)){origin=options.origin;key=input.key;}
 else{const connection=JSON.parse(await readFile(configPath,'utf8'));origin=connection.origin;if(origin!==DEFAULT_ORIGIN)throw Error('Unexpected destination in connection settings.');key=decrypt(connection.encryptedKey);}
 if(!key)throw Error('Upload key is missing.');
 const headers={'X-Portfolio-Key':key,...(input.siteToken?{'OAI-Sites-Authorization':`Bearer ${input.siteToken}`}:{})};
 async function request(endpoint,{method='GET',body,json:jsonBody}={}){
  if(!endpoint.includes('/files/'))endpoint+='/';
  const response=await fetch(`${origin}/api/portfolio/${endpoint}`,{method,headers:{...headers,...(jsonBody?{'Content-Type':'application/json'}:body?{'Content-Type':'application/octet-stream'}:{})},body:jsonBody?JSON.stringify(jsonBody):body,redirect:'error'});
  let data;try{data=await response.json();}catch{throw Error(`Portfolio access unavailable (HTTP ${response.status}). Refresh get_site service access.`);}if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;
 }
 if(options.list){console.log(JSON.stringify(await request('projects'),null,2));return;}
 const id=options['upload-id']||randomUUID(),label=options.version||new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date());
 console.log(`Uploading ${options.id}: ${files.length} files. Upload ID: ${id}`);
 const prepared=await request('uploads',{method:'POST',json:{id,project:options.id,title:options.title||options.id,description:options.description||'',label,basePath:options['base-path']||'',source:'codex',files:files.map(({path,size,hash})=>({path,size,hash}))}});
 if(prepared.status==='uploading')for(let i=0;i<files.length;i++){
  const file=files[i],body=await readFile(file.full);let failure;
  for(let attempt=0;attempt<3;attempt++){try{await request(`uploads/${id}/files/${file.path.split('/').map(encodeURIComponent).join('/')}`,{method:'PUT',body});failure=null;break;}catch(error){failure=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));}}
  if(failure)throw failure;if(i===files.length-1||(i+1)%25===0)console.log(`Uploaded ${i+1}/${files.length}`);
 }
 const complete=await request(`uploads/${id}/complete`,{method:'POST'});
 let result=complete;if(!options.draft)result=await request(`projects/${options.id}/publish`,{method:'POST',json:{versionId:id,makeCurrent:true}});
 const verification=await request('projects'),project=verification.projects.find(p=>p.slug===options.id),version=project?.versions.find(v=>v.id===id);
 if(version?.status!=='ready'||(!options.draft&&project?.active_version!==id))throw Error('Server read-back did not confirm the requested state.');
 let checkUrl=new URL(result.url,origin),checked=false;
 for(let redirect=0;redirect<5;redirect++){
  if(checkUrl.origin!==origin)throw Error('Unexpected cross-origin preview redirect.');
  const response=await fetch(checkUrl,{headers,redirect:'manual'});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('Location');if(!location)throw Error('Missing preview redirect.');checkUrl=new URL(location,checkUrl);continue;}
  if(response.status!==200||!response.headers.get('Content-Type')?.includes('text/html'))throw Error(`Preview did not load as HTML (HTTP ${response.status}).`);
  await response.body?.cancel();checked=true;break;
 }
 if(!checked)throw Error('Preview redirect limit exceeded.');
 console.log(JSON.stringify({project:options.id,versionId:id,status:options.draft?'draft':'published',url:new URL(result.url,origin).href,versionUrl:new URL(complete.url,origin).href,reviewUrl:`${origin}/showcase.html?demo=${options.id}`,adminUrl:`${origin}/admin`},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
