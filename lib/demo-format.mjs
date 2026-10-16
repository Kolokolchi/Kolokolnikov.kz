export const LIMITS={files:2000,fileBytes:25*1024*1024,totalBytes:250*1024*1024,zipBytes:100*1024*1024};
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif',gif:'image/gif',ico:'image/x-icon',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',mp4:'video/mp4',webm:'video/webm',pdf:'application/pdf',txt:'text/plain; charset=utf-8',xml:'application/xml',wasm:'application/wasm',webmanifest:'application/manifest+json'};
const reserved=new Set(['admin','api','catalog','index','v','assets','signin-with-chatgpt','signout-with-chatgpt']);
export function validSlug(value){return typeof value==='string'&&value.length<=60&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&!reserved.has(value);}
export function validPath(value){return typeof value==='string'&&value.length<=240&&!/[\\\x00-\x1f%?#:]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!part.startsWith('.'))&&!value.split('/').some(part=>['node_modules','__MACOSX'].includes(part));}
export function contentType(name){return mime[name.split('.').pop().toLowerCase()]||null;}
export function allowedFile(name){return validPath(name)&&Boolean(contentType(name))&&!/(^|\/)(?:package(?:-lock)?\.json|demo-info\.json|_headers|_redirects)$/i.test(name);}
export function validateManifest(files){
 if(!Array.isArray(files)||!files.length||files.length>LIMITS.files)throw Error(`В сборке должно быть от 1 до ${LIMITS.files} файлов.`);
 let total=0;const seen=new Set();
 for(const file of files){if(!allowedFile(file.path))throw Error(`Недопустимый файл: ${file.path}`);if(seen.has(file.path.toLowerCase()))throw Error(`Повторяющийся путь: ${file.path}`);seen.add(file.path.toLowerCase());if(!Number.isSafeInteger(file.size)||file.size<0||file.size>LIMITS.fileBytes)throw Error(`Файл ${file.path} превышает 25 МБ.`);if(!/^[a-f0-9]{64}$/.test(file.hash))throw Error('Не удалось проверить контрольную сумму файла.');total+=file.size;}
 if(total>LIMITS.totalBytes)throw Error('Сборка превышает 250 МБ.');if(!files.some(f=>f.path==='index.html'))throw Error('В корне сборки нужен index.html.');return total;
}
export async function sha256(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function adaptFile(bytes,name,{prefix,basePath='',roots=[]}){
 if(!/\.(html|css|js|mjs|json|svg|xml|txt|webmanifest)$/i.test(name))return bytes;
 let text=new TextDecoder().decode(bytes);
 if(basePath&&basePath!=='/')text=text.replaceAll(basePath.replace(/\/?$/,'/'),prefix);
 const entries=roots.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
 if(entries){const expression=new RegExp('([\x22\x27\x60(=])/(?:'+entries+')(?=[/\\?\x22\x27\x60)#\\s])','g');text=text.replace(expression,m=>m[0]+prefix+m.slice(2));}
 if(name.endsWith('.html')){
  text=text.replace(/<base\b[^>]*>/gi,'').replace(/<meta\s+name=["']robots["'][^>]*>/gi,'').replace(/(<a\b[^>]*\bhref=["'])\/(?=["'])/gi,`$1${prefix}`);
  const base=`<base href="${prefix}"><meta name="robots" content="noindex,nofollow">`;
  if(/<head\b[^>]*>/i.test(text))text=text.replace(/<head\b[^>]*>/i,m=>m+base);else text=base+text;
 }
 return new TextEncoder().encode(text);
}
