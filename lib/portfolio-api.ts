import {authorize,database} from './portfolio-auth';
import {validSlug,validPath,validateManifest,sha256,adaptFile,contentType,LIMITS} from '../lib/demo-format.mjs';
// Rows as the queries below read them (drizzle/0000_productive_shatterstar.sql)
type ProjectRow={slug:string;title:string;description:string;active_version:string|null;hidden:number;created_at:string;updated_at:string};
type VersionRow={id:string;project:string;label:string;status:string;visible:number;source:string;manifest_hash:string;file_count:number;total_bytes:number;created_at:string};
type FileRow={path:string;size:number;hash:string};
type ManifestFile={path:string;size:number;hash:string};
type StoredManifest={files:ManifestFile[];basePath:string;project:string;roots:string[]};
// A JSON request body: every field is checked before it is used
type Body={[field:string]:unknown};
class ApiError extends Error{constructor(message:string,readonly status:number){super(message);}}
const idPattern=/^[a-f0-9-]{36}$/;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function fail(message:string,status=400):never{throw new ApiError(message,status);}
async function input(request:Request,limit=800000):Promise<Body>{const text=await request.text();if(text.length>limit)fail('Слишком большой запрос.',413);let data:unknown;try{data=JSON.parse(text);}catch{fail('Некорректный запрос.');}if(!data||typeof data!=='object'||Array.isArray(data))fail('Некорректный запрос.');return data as Body;}
function bucket(env:Cloudflare.Env):R2Bucket{if(!env.BUCKET)throw new Error('The portfolio storage binding (BUCKET) is missing.');return env.BUCKET;}
// A version's manifest never changes once written, so the last few stay parsed in the isolate, files keyed by path:
// every file PUT used to read and parse it from R2 again and search it linearly (2 000 files: 2 000 reads).
type LoadedManifest={files:Map<string,ManifestFile>;basePath:string;roots:string[]};
const manifests=new Map<string,LoadedManifest>();
async function manifest(env:Cloudflare.Env,id:string):Promise<LoadedManifest>{
 const known=manifests.get(id);if(known)return known;
 const item=await bucket(env).get(`versions/${id}/manifest.json`);if(!item)fail('Загрузка не найдена.',404);
 const stored=await item.json<StoredManifest>(),loaded={files:new Map(stored.files.map(f=>[f.path,f] as const)),basePath:stored.basePath,roots:stored.roots};
 if(manifests.size>=4){const oldest=manifests.keys().next().value;if(oldest!==undefined)manifests.delete(oldest);}
 manifests.set(id,loaded);return loaded;
}
export async function portfolioApi(request:Request,env:Cloudflare.Env,parts:string[]){
 try{
  const [resource,id,action,...rest]=parts,method=request.method,db=database(env);
  if(resource==='catalog'&&method==='GET'){
   const {results}=await db.prepare('SELECT slug,title,description,hidden,active_version FROM demo_projects').all<Pick<ProjectRow,'slug'|'title'|'description'|'hidden'|'active_version'>>();
   const catalog=results.filter(p=>!p.hidden&&p.active_version).map(p=>({id:p.slug,title:p.title,description:p.description,path:`${p.slug}/`}));
   return json(catalog);
  }
  if(!await authorize(request,env))return json({error:'Войдите в аккаунт владельца.',code:'unauthorized'},401);
  if(resource==='session'&&method==='GET')return json({authorized:true});
  if(resource==='projects'&&method==='GET'&&!id){
   const [{results:projects},{results:versions}]=await Promise.all([db.prepare('SELECT * FROM demo_projects ORDER BY updated_at DESC').all<ProjectRow>(),db.prepare('SELECT id,project,label,status,visible,source,file_count,total_bytes,created_at FROM demo_versions ORDER BY created_at DESC').all<Omit<VersionRow,'manifest_hash'>>()]);
   return json({projects:projects.map(p=>({...p,versions:versions.filter(v=>v.project===p.slug)}))});
  }
  if(resource==='uploads'&&method==='POST'&&!id){
   const data=await input(request);if(typeof data.project!=='string'||!validSlug(data.project))fail('Адрес: латинские буквы, цифры и дефисы, до 60 символов.');
   if(typeof data.id!=='string'||!idPattern.test(data.id))fail('Некорректный идентификатор загрузки.');
   // Title and description are optional: left out, an existing project keeps what the catalogue shows (a new
   // version, a draft above all, used to overwrite both at once) and a new project is named after its address.
   const title=typeof data.title==='string'?data.title.trim():undefined;if(data.title!==undefined&&(!title||title.length>120))fail('Укажите название проекта, до 120 символов.');
   if(typeof data.label!=='string'||!data.label.trim()||data.label.length>80)fail('Укажите название версии, до 80 символов.');
   const description=typeof data.description==='string'?data.description.trim():undefined;if(description&&description.length>500)fail('Описание слишком длинное.');
   const basePath=data.basePath||'';if(typeof basePath!=='string'||basePath.length>120||(basePath&&(!basePath.startsWith('/')||basePath.startsWith('//')||/[.\\?#]/.test(basePath))))fail('Некорректный базовый путь.');
   let total:number;try{total=validateManifest(data.files);}catch(e){fail(e instanceof Error?e.message:String(e));}
   const files=data.files as ManifestFile[]; // validateManifest has checked each path, size and hash
   const hash=await sha256(new TextEncoder().encode(JSON.stringify({project:data.project,files,basePath}))),now=new Date().toISOString();
   const existing=await db.prepare('SELECT manifest_hash,status FROM demo_versions WHERE id=?').bind(data.id).first<Pick<VersionRow,'manifest_hash'|'status'>>();
   if(existing){if(existing.manifest_hash!==hash)fail('Эта загрузка уже содержит другую сборку.',409);return json({id:data.id,status:existing.status});}
   await bucket(env).put(`versions/${data.id}/manifest.json`,JSON.stringify({files,basePath,project:data.project,roots:[...new Set(files.map(f=>f.path.split('/')[0]))]}),{httpMetadata:{contentType:'application/json'}});
   await db.batch([
    db.prepare('INSERT INTO demo_projects(slug,title,description,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=COALESCE(?,title),description=COALESCE(?,description),updated_at=excluded.updated_at').bind(data.project,title??data.project,description??'',now,now,title??null,description??null),
    db.prepare('INSERT INTO demo_versions(id,project,label,status,source,manifest_hash,file_count,total_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(data.id,data.project,data.label.trim(),'uploading',data.source==='codex'?'codex':'panel',hash,files.length,total!,now)
   ]);
   return json({id:data.id,status:'uploading'},201);
  }
  if(resource==='uploads'&&idPattern.test(id||'')){
   const version=await db.prepare('SELECT * FROM demo_versions WHERE id=?').bind(id).first<VersionRow>();if(!version)fail('Версия не найдена.',404);
   if(version.status==='deleting'&&method!=='DELETE')fail('Версия удаляется. Повторите удаление, если оно прервалось.',409);
   if(!action&&(method==='DELETE'||method==='PATCH')){
    // PATCH {visible:false}: a published variant becomes a draft again (only the owner can open it)
    if(method==='PATCH'){const data=await input(request);if(data.visible!==false)fail('Укажите visible: false, чтобы снять вариант с публикации.');}
    // The current version of a project that visitors can open is not taken away under them: another version is
    // made current first, or the project is hidden (then it simply has no current version any more).
    const owner=await db.prepare('SELECT active_version,hidden FROM demo_projects WHERE slug=?').bind(version.project).first<Pick<ProjectRow,'active_version'|'hidden'>>(),current=owner?.active_version===id;
    if(current&&!owner?.hidden)fail('Это основная версия проекта. Сначала сделайте основной другую версию или скройте проект.',409);
    if(current)await db.prepare('UPDATE demo_projects SET active_version=NULL,updated_at=? WHERE slug=?').bind(new Date().toISOString(),version.project).run();
    if(method==='PATCH'){await db.prepare('UPDATE demo_versions SET visible=0 WHERE id=?').bind(id).run();return json({ok:true});}
    // DELETE: out of sight first (only «ready» versions are served), then the files, then the rows — an interrupted
    // deletion leaves a «deleting» version that the same request finishes.
    await db.prepare('UPDATE demo_versions SET status=?,visible=0 WHERE id=?').bind('deleting',id).run();
    const store=bucket(env);let cursor:string|undefined;
    do{const page=await store.list({prefix:`versions/${id}/`,cursor});if(page.objects.length)await store.delete(page.objects.map(item=>item.key));cursor=page.truncated?page.cursor:undefined;}while(cursor);
    manifests.delete(id);
    // a project whose last version is gone goes with it: nothing is left to show, and its address is free again
    await db.batch([db.prepare('DELETE FROM demo_files WHERE version=?').bind(id),db.prepare('DELETE FROM demo_versions WHERE id=?').bind(id),db.prepare('DELETE FROM demo_projects WHERE slug=? AND NOT EXISTS (SELECT 1 FROM demo_versions WHERE project=?)').bind(version.project,version.project)]);
    return json({ok:true,deleted:id});
   }
   if(method==='PUT'&&action==='files'){
    if(version.status!=='uploading')fail('Завершённую версию нельзя изменять. Создайте новую.',409);
    const filePath=rest.join('/');if(!validPath(filePath))fail('Недопустимый путь файла.');
    const expected=await manifest(env,id),file=expected.files.get(filePath);if(!file)fail('Файла нет в сборке.',404);
    if(Number(request.headers.get('Content-Length'))>LIMITS.fileBytes)fail('Файл превышает 25 МБ.',413);
    const chunks:Uint8Array[]=[];let size=0;const reader=request.body?.getReader();if(reader){while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>file.size||size>LIMITS.fileBytes){await reader.cancel();fail('Размер файла не совпадает.',413);}chunks.push(item.value);}}
    if(size!==file.size)fail('Файл загружен не полностью.');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(await sha256(bytes)!==file.hash)fail('Контрольная сумма не совпадает. Повторите загрузку.');
    const adapted=adaptFile(bytes,filePath,{basePath:expected.basePath,roots:expected.roots,prefix:`/demos/${version.project}/v/${id}/`});
    await bucket(env).put(`versions/${id}/files/${filePath}`,adapted,{httpMetadata:{contentType:contentType(filePath)}});
    await db.prepare('INSERT INTO demo_files(version,path,size,hash) VALUES (?,?,?,?) ON CONFLICT(version,path) DO UPDATE SET size=excluded.size,hash=excluded.hash').bind(id,filePath,file.size,file.hash).run();
    return json({ok:true});
   }
   if(method==='POST'&&action==='complete'){
    const expected=await manifest(env,id),{results}=await db.prepare('SELECT path,size,hash FROM demo_files WHERE version=?').bind(id).all<FileRow>();
    const received=new Map(results.map(f=>[f.path,f] as const));
    if([...expected.files.values()].some(f=>{const r=received.get(f.path);return !r||r.size!==f.size||r.hash!==f.hash;}))fail('Не все файлы загружены. Повторите загрузку недостающих файлов.',409);
    await db.prepare('UPDATE demo_versions SET status=? WHERE id=?').bind('ready',id).run();
    return json({id,status:'ready',url:`/demos/${version.project}/v/${id}/`});
   }
  }
  if(resource==='projects'&&validSlug(id)){
   const project=await db.prepare('SELECT * FROM demo_projects WHERE slug=?').bind(id).first<ProjectRow>();if(!project)fail('Проект не найден.',404);
   if(action==='publish'&&method==='POST'){
    const data=await input(request);if(typeof data.versionId!=='string'||!idPattern.test(data.versionId))fail('Укажите версию.');
    const version=await db.prepare('SELECT * FROM demo_versions WHERE id=? AND project=?').bind(data.versionId,id).first<VersionRow>();
    if(!version||version.status!=='ready')fail('Сначала завершите загрузку версии.',409);
    const statements=[db.prepare('UPDATE demo_versions SET visible=1 WHERE id=?').bind(version.id)];
    if(data.makeCurrent!==false)statements.push(db.prepare('UPDATE demo_projects SET active_version=?,hidden=0,updated_at=? WHERE slug=?').bind(version.id,new Date().toISOString(),id));
    await db.batch(statements);return json({url:data.makeCurrent===false?`/demos/${id}/v/${version.id}/`:`/demos/${id}/`});
   }
   if(method==='PATCH'&&!action){const data=await input(request);if(typeof data.hidden!=='boolean')fail('Укажите видимость проекта.');await db.prepare('UPDATE demo_projects SET hidden=?,updated_at=? WHERE slug=?').bind(data.hidden?1:0,new Date().toISOString(),id).run();return json({ok:true});}
  }
  return json({error:'Действие не найдено.'},404);
 }catch(error){const known=error instanceof ApiError;console.error('Portfolio API:',known?error.status:500,error instanceof Error?error.message:error);return json({error:known?error.message:'Не удалось выполнить действие. Повторите попытку.'},known?error.status:500);}
}
