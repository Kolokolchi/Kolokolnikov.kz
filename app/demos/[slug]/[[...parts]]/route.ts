import {env} from 'cloudflare:workers';
import {authorize,database} from '../../../../lib/portfolio-auth';
import {validSlug,validPath,contentType} from '../../../../lib/demo-format.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request,{params}:{params:Promise<{slug:string;parts?:string[]}>}){
 const {slug,parts=[]}=await params;if(!validSlug(slug))return new Response('Страница не найдена',{status:404});
 const explicit=parts[0]==='v',url=new URL(request.url);
 // One query for the project and its requested (/v/<id>/) or current version: every file of a demo comes through here
 const found=await database(env).prepare('SELECT p.hidden,v.id,v.status,v.visible FROM demo_projects p LEFT JOIN demo_versions v ON v.project=p.slug AND v.id=COALESCE(?,p.active_version) WHERE p.slug=?').bind(explicit?parts[1]||'':null,slug).first<{hidden:number;id:string|null;status:string|null;visible:number|null}>();
 if(!found)return new Response('Проект не найден',{status:404});
 if(!found.id||found.status!=='ready'||((found.hidden||!found.visible)&&!await authorize(request,env)))return new Response('Эта версия пока недоступна',{status:404});
 if(!explicit){url.pathname=`/demos/${slug}/v/${found.id}/${parts.map(encodeURIComponent).join('/')}`;return new Response(null,{status:302,headers:{Location:url.href,'Cache-Control':'private, no-store'}});}
 const slash=()=>Response.redirect(new URL(url.pathname+'/'+url.search,request.url),308);
 let path=parts.slice(2).join('/');
 if(!path){if(!url.pathname.endsWith('/'))return slash();path='index.html';}
 if(!validPath(path))return new Response('Страница не найдена',{status:404});
 const store=env.BUCKET;if(!store)throw new Error('The portfolio storage binding (BUCKET) is missing.');
 const key=(file:string)=>`versions/${found.id}/files/${file}`;
 let object:R2ObjectBody|null,requestedRange:{offset:number;length:number}|undefined;
 if(path.split('/').pop()?.includes('.')){
  const rangeHeader=request.headers.get('Range');
  if(rangeHeader){
   const metadata=await store.head(key(path));if(!metadata)return new Response('Файл не найден',{status:404});
   const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader);const invalid=()=>new Response(null,{status:416,headers:{'Content-Range':`bytes */${metadata.size}`}});
   if(!match||(!match[1]&&!match[2]))return invalid();const start=match[1]?Number(match[1]):Math.max(0,metadata.size-Number(match[2])),end=match[1]&&match[2]?Math.min(metadata.size-1,Number(match[2])):metadata.size-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=metadata.size)return invalid();requestedRange={offset:start,length:end-start+1};
  }
  object=await store.get(key(path),requestedRange?{range:requestedRange}:undefined);
 }else{
  // An address without an extension is never a stored file (uploads keep only known file types). It is a folder
  // with a page of its own (/about/ → about/index.html: a multi-page site) or, failing that, an SPA route (→ index.html).
  object=await store.get(key(`${path}/index.html`));
  if(object){if(!url.pathname.endsWith('/')){await object.body.cancel();return slash();}path=`${path}/index.html`;} // its relative links resolve from the folder
  else{path='index.html';object=await store.get(key(path));}
 }
 if(!object)return new Response('Файл не найден',{status:404});
 // A version's files never change (a fix is a new version), so everything but the pages is cached for good. Pages are
 // revalidated on every visit — access (a hidden project, a draft) is checked above before a 304 is given.
 const headers=new Headers({'Content-Type':contentType(path)||'application/octet-stream','Cache-Control':path.endsWith('.html')?'private, no-cache':'private, max-age=31536000, immutable','ETag':object.httpEtag,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Robots-Tag':'noindex, nofollow','Accept-Ranges':'bytes'});
 const range=requestedRange;
 if(!range&&request.headers.get('If-None-Match')===object.httpEtag){await object.body.cancel();return new Response(null,{status:304,headers});}
 if(range){headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${object.size}`);headers.set('Content-Length',String(range.length));}else headers.set('Content-Length',String(object.size));
 return new Response(request.method==='HEAD'?null:object.body,{status:range?206:200,headers});
}
export {handle as GET,handle as HEAD};
