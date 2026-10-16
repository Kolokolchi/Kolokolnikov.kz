import {authorize} from './portfolio-auth';
import {validSlug,validPath,validateManifest,sha256,adaptFile,contentType,LIMITS} from '../lib/demo-format.mjs';
const idPattern=/^[a-f0-9-]{36}$/;
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
async function input(request:Request,limit=800000){const text=await request.text();if(text.length>limit)fail('Слишком большой запрос.',413);try{return JSON.parse(text);}catch{fail('Некорректный запрос.');}}
async function manifest(env:any,id:string){const item=await env.BUCKET.get(`versions/${id}/manifest.json`);if(!item)fail('Загрузка не найдена.',404);return item.json();}
export async function portfolioApi(request:Request,env:any,parts:string[]){
 try{
  const [resource,id,action,...rest]=parts,method=request.method;
  if(resource==='catalog'&&method==='GET'){
   const {results}=await env.DB.prepare('SELECT slug,title,description,hidden,active_version FROM demo_projects').all();
   const catalog=results.filter((p:any)=>!p.hidden&&p.active_version).map((p:any)=>({id:p.slug,title:p.title,description:p.description,path:`${p.slug}/`}));
   return json(catalog);
  }
  if(!await authorize(request,env))return json({error:'Войдите в аккаунт владельца.',code:'unauthorized'},401);
  if(resource==='session'&&method==='GET')return json({authorized:true});
  if(resource==='projects'&&method==='GET'&&!id){
   const [{results:projects},{results:versions}]=await Promise.all([env.DB.prepare('SELECT * FROM demo_projects ORDER BY updated_at DESC').all(),env.DB.prepare('SELECT id,project,label,status,visible,source,file_count,total_bytes,created_at FROM demo_versions ORDER BY created_at DESC').all()]);
   return json({projects:projects.map((p:any)=>({...p,versions:versions.filter((v:any)=>v.project===p.slug)}))});
  }
  if(resource==='uploads'&&method==='POST'&&!id){
   const data=await input(request);if(!validSlug(data.project))fail('Адрес: латинские буквы, цифры и дефисы, до 60 символов.');
   if(!idPattern.test(data.id))fail('Некорректный идентификатор загрузки.');
   if(typeof data.title!=='string'||!data.title.trim()||data.title.length>120)fail('Укажите название проекта, до 120 символов.');
   if(typeof data.label!=='string'||!data.label.trim()||data.label.length>80)fail('Укажите название версии, до 80 символов.');
   const description=typeof data.description==='string'?data.description.trim():'';if(description.length>500)fail('Описание слишком длинное.');
   const basePath=data.basePath||'';if(typeof basePath!=='string'||basePath.length>120||(basePath&&(!basePath.startsWith('/')||basePath.startsWith('//')||/[.\\?#]/.test(basePath))))fail('Некорректный базовый путь.');
   let total:number;try{total=validateManifest(data.files);}catch(e:any){fail(e.message);}
   const hash=await sha256(new TextEncoder().encode(JSON.stringify({project:data.project,files:data.files,basePath}))),now=new Date().toISOString();
   const existing=await env.DB.prepare('SELECT manifest_hash,status FROM demo_versions WHERE id=?').bind(data.id).first();
   if(existing){if(existing.manifest_hash!==hash)fail('Эта загрузка уже содержит другую сборку.',409);return json({id:data.id,status:existing.status});}
   await env.BUCKET.put(`versions/${data.id}/manifest.json`,JSON.stringify({files:data.files,basePath,project:data.project,roots:[...new Set(data.files.map((f:any)=>f.path.split('/')[0]))]}),{httpMetadata:{contentType:'application/json'}});
   await env.DB.batch([
    env.DB.prepare('INSERT INTO demo_projects(slug,title,description,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title,description=excluded.description,updated_at=excluded.updated_at').bind(data.project,data.title.trim(),description,now,now),
    env.DB.prepare('INSERT INTO demo_versions(id,project,label,status,source,manifest_hash,file_count,total_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(data.id,data.project,data.label.trim(),'uploading',data.source==='codex'?'codex':'panel',hash,data.files.length,total!,now)
   ]);
   return json({id:data.id,status:'uploading'},201);
  }
  if(resource==='uploads'&&idPattern.test(id||'')){
   const version=await env.DB.prepare('SELECT * FROM demo_versions WHERE id=?').bind(id).first();if(!version)fail('Версия не найдена.',404);
   if(method==='PUT'&&action==='files'){
    if(version.status!=='uploading')fail('Завершённую версию нельзя изменять. Создайте новую.',409);
    const filePath=rest.join('/');if(!validPath(filePath))fail('Недопустимый путь файла.');
    const expected=await manifest(env,id),file=expected.files.find((f:any)=>f.path===filePath);if(!file)fail('Файла нет в сборке.',404);
    if(Number(request.headers.get('Content-Length'))>LIMITS.fileBytes)fail('Файл превышает 25 МБ.',413);
    const chunks:Uint8Array[]=[];let size=0;const reader=request.body?.getReader();if(reader){while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>file.size||size>LIMITS.fileBytes){await reader.cancel();fail('Размер файла не совпадает.',413);}chunks.push(item.value);}}
    if(size!==file.size)fail('Файл загружен не полностью.');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(await sha256(bytes)!==file.hash)fail('Контрольная сумма не совпадает. Повторите загрузку.');
    const adapted=adaptFile(bytes,filePath,{...expected,prefix:`/demos/${version.project}/v/${id}/`});
    await env.BUCKET.put(`versions/${id}/files/${filePath}`,adapted,{httpMetadata:{contentType:contentType(filePath)}});
    await env.DB.prepare('INSERT INTO demo_files(version,path,size,hash) VALUES (?,?,?,?) ON CONFLICT(version,path) DO UPDATE SET size=excluded.size,hash=excluded.hash').bind(id,filePath,file.size,file.hash).run();
    return json({ok:true});
   }
   if(method==='POST'&&action==='complete'){
    const expected=await manifest(env,id),{results}=await env.DB.prepare('SELECT path,size,hash FROM demo_files WHERE version=?').bind(id).all();
    const received=new Map(results.map((f:any)=>[f.path,f]));
    if(expected.files.some((f:any)=>{const r:any=received.get(f.path);return !r||r.size!==f.size||r.hash!==f.hash;}))fail('Не все файлы загружены. Повторите загрузку недостающих файлов.',409);
    await env.DB.prepare('UPDATE demo_versions SET status=? WHERE id=?').bind('ready',id).run();
    return json({id,status:'ready',url:`/demos/${version.project}/v/${id}/`});
   }
  }
  if(resource==='projects'&&validSlug(id)){
   const project=await env.DB.prepare('SELECT * FROM demo_projects WHERE slug=?').bind(id).first();if(!project)fail('Проект не найден.',404);
   if(action==='publish'&&method==='POST'){
    const data=await input(request);if(typeof data.versionId!=='string'||!idPattern.test(data.versionId))fail('Укажите версию.');
    const version=await env.DB.prepare('SELECT * FROM demo_versions WHERE id=? AND project=?').bind(data.versionId,id).first();
    if(!version||version.status!=='ready')fail('Сначала завершите загрузку версии.',409);
    const statements=[env.DB.prepare('UPDATE demo_versions SET visible=1 WHERE id=?').bind(version.id)];
    if(data.makeCurrent!==false)statements.push(env.DB.prepare('UPDATE demo_projects SET active_version=?,hidden=0,updated_at=? WHERE slug=?').bind(version.id,new Date().toISOString(),id));
    await env.DB.batch(statements);return json({url:data.makeCurrent===false?`/demos/${id}/v/${version.id}/`:`/demos/${id}/`});
   }
   if(method==='PATCH'&&!action){const data=await input(request);if(typeof data.hidden!=='boolean')fail('Укажите видимость проекта.');await env.DB.prepare('UPDATE demo_projects SET hidden=?,updated_at=? WHERE slug=?').bind(data.hidden?1:0,new Date().toISOString(),id).run();return json({ok:true});}
  }
  return json({error:'Действие не найдено.'},404);
 }catch(error:any){console.error('Portfolio API:',error.status||500,error.message);return json({error:error.status?error.message:'Не удалось выполнить действие. Повторите попытку.'},error.status||500);}
}
