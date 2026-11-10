import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function videoResponse(request:Request,bindings:Cloudflare.Env){
 const assets=bindings.ASSETS,range=request.headers.get('Range');
 if(!assets)throw new Error('The static assets binding (ASSETS) is missing.');
 // The Range goes to the static assets as it came: a host that answers it (206) is passed through untouched.
 // Only a host that replies 200 with the whole file gets the slice below (which holds the file in memory).
 const response=await assets.fetch(new Request(request.url,{method:range?'GET':request.method,headers:request.headers}));
 if(!range||response.status!==200){
  if(range&&request.method==='HEAD'&&response.body){await response.body.cancel();return new Response(null,{status:response.status,headers:response.headers});}
  return response;
 }
 const bytes=await response.arrayBuffer(),size=bytes.byteLength,match=/^bytes=(\d*)-(\d*)$/.exec(range);
 const invalid=()=>new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 if(!match||(!match[1]&&!match[2]))return invalid();
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return invalid();
 const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');headers.set('Cache-Control','private, no-store');
 return new Response(request.method==='HEAD'?null:bytes.slice(start,end+1),{status:206,headers});
}
const handle=(request:Request)=>videoResponse(request,env);
export {handle as GET,handle as HEAD};
