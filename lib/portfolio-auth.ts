type User={userId:string;email:string;displayName?:string};
export async function ownerAllowed(user:User|null,env:any){
 if(!user)return false;
 let row=await env.DB.prepare('SELECT subject FROM portfolio_admins WHERE role = ?').bind('owner').first();
 if(!row){
  // The verified invitation email bootstraps the permanent Site user ID once.
  const bootstrap=import.meta.env.DEV?'seedy@sites.test':env.PORTFOLIO_OWNER_EMAIL;
  if(!bootstrap||user.email.toLowerCase()!==bootstrap.toLowerCase())return false;
  await env.DB.prepare('INSERT OR IGNORE INTO portfolio_admins (role,subject,created_at) VALUES (?,?,?)').bind('owner',user.userId,new Date().toISOString()).run();
  row=await env.DB.prepare('SELECT subject FROM portfolio_admins WHERE role = ?').bind('owner').first();
 }
 return row?.subject===user.userId;
}
export async function authorize(request:Request,env:any){
 const supplied=request.headers.get('X-Portfolio-Key');
 if(supplied&&env.PORTFOLIO_UPLOAD_KEY){
  const encode=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(supplied)),crypto.subtle.digest('SHA-256',encode.encode(env.PORTFOLIO_UPLOAD_KEY))]);
  let difference=0;const other=new Uint8Array(b);new Uint8Array(a).forEach((value,i)=>difference|=value^other[i]);if(difference===0)return true;
 }
 const userId=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!userId||!email)return false;
 if(!['GET','HEAD'].includes(request.method)){
  if(request.headers.get('Origin')!==new URL(request.url).origin)return false;
  if(request.headers.get('Sec-Fetch-Site')==='cross-site')return false;
 }
 return ownerAllowed({userId,email},env);
}
