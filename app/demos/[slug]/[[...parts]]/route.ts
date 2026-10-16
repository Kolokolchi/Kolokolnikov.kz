import {env} from 'cloudflare:workers';
import {authorize} from '../../../../lib/portfolio-auth';
import {validSlug,validPath,contentType} from '../../../../lib/demo-format.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request,{params}:any){
 const {slug,parts=[]}=await params;if(!validSlug(slug))return new Response('Страница не найдена',{status:404});
 const bindings:any=env,project=await bindings.DB.prepare('SELECT * FROM demo_projects WHERE slug=?').bind(slug).first();
 if(!project){if(bindings.ASSETS){const legacyUrl=new URL(request.url);legacyUrl.pathname=`/_legacy-demos/${slug}/${parts.join('/')}`;return bindings.ASSETS.fetch(new Request(legacyUrl,request));}return new Response('Проект не найден',{status:404});}
 const explicit=parts[0]==='v',versionId=explicit?parts[1]:project.active_version;
 const version=await bindings.DB.prepare('SELECT id,status,visible FROM demo_versions WHERE id=? AND project=?').bind(versionId||'',slug).first();
 if(!version||version.status!=='ready'||((project.hidden||!version.visible)&&!await authorize(request,bindings)))return new Response('Эта версия пока недоступна',{status:404});
 if(!explicit){const url=new URL(request.url);url.pathname=`/demos/${slug}/v/${version.id}/${parts.map(encodeURIComponent).join('/')}`;return new Response(null,{status:302,headers:{Location:url.href,'Cache-Control':'private, no-store'}});}
 let path=(explicit?parts.slice(2):parts).join('/');
 if(!path){if(!new URL(request.url).pathname.endsWith('/'))return Response.redirect(new URL(new URL(request.url).pathname+'/'+new URL(request.url).search,request.url),308);path='index.html';}
 if(!validPath(path))return new Response('Страница не найдена',{status:404});
 const rangeHeader=request.headers.get('Range');let requestedRange:{offset:number;length:number}|undefined;
 if(rangeHeader){
  const metadata=await bindings.BUCKET.head(`versions/${version.id}/files/${path}`);if(!metadata)return new Response('Файл не найден',{status:404});
  const match=/^bytes=(\d*)-(\d*)$/.exec(rangeHeader);const invalid=()=>new Response(null,{status:416,headers:{'Content-Range':`bytes */${metadata.size}`}});
  if(!match||(!match[1]&&!match[2]))return invalid();const start=match[1]?Number(match[1]):Math.max(0,metadata.size-Number(match[2])),end=match[1]&&match[2]?Math.min(metadata.size-1,Number(match[2])):metadata.size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=metadata.size)return invalid();requestedRange={offset:start,length:end-start+1};
 }
 let object=await bindings.BUCKET.get(`versions/${version.id}/files/${path}`,requestedRange?{range:requestedRange}:undefined);
 if(!object&&!path.split('/').pop()?.includes('.')){path='index.html';object=await bindings.BUCKET.get(`versions/${version.id}/files/index.html`);}
 if(!object)return new Response('Файл не найден',{status:404});
 const headers=new Headers({'Content-Type':contentType(path)||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Robots-Tag':'noindex, nofollow','Accept-Ranges':'bytes'});
 const range=requestedRange;if(range){headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${object.size}`);headers.set('Content-Length',String(range.length));}else headers.set('Content-Length',String(object.size));
 return new Response(request.method==='HEAD'?null:object.body,{status:range?206:200,headers});
}
export {handle as GET,handle as HEAD};
