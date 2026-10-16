import {LIMITS,allowedFile,validPath} from './demo-format.mjs';
const decoder=new TextDecoder('utf-8',{fatal:true});
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let value=0xffffffff;for(const b of bytes)value=crcTable[(value^b)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
export async function readZip(file){
 if(file.size>LIMITS.zipBytes)throw Error('ZIP должен быть не больше 100 МБ.');
 const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer()),tailView=new DataView(tail.buffer);let eocd=-1;
 for(let i=tail.length-22;i>=0;i--)if(tailView.getUint32(i,true)===0x06054b50&&i+22+tailView.getUint16(i+20,true)===tail.length){eocd=i;break;}
 if(eocd<0)throw Error('Не удалось прочитать ZIP. Упакуйте готовую папку сайта в обычный ZIP.');
 const count=tailView.getUint16(eocd+10,true),size=tailView.getUint32(eocd+12,true),offset=tailView.getUint32(eocd+16,true);
 if(tailView.getUint16(eocd+4,true)||tailView.getUint16(eocd+6,true)||count===65535||size===0xffffffff||offset===0xffffffff)throw Error('Многотомные архивы и ZIP64 не поддерживаются.');
 if(count>LIMITS.files+100||size>2*1024*1024||offset+size>file.size)throw Error('В архиве слишком много файлов или повреждён список.');
 const bytes=new Uint8Array(await file.slice(offset,offset+size).arrayBuffer()),view=new DataView(bytes.buffer);let at=0,total=0;const entries=[];
 for(let i=0;i<count;i++){
  if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error('Повреждён список файлов ZIP.');
  const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),compressed=view.getUint32(at+20,true),uncompressed=view.getUint32(at+24,true),nameSize=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),attributes=view.getUint32(at+38,true),local=view.getUint32(at+42,true);
  if(at+46+nameSize+extra+comment>bytes.length)throw Error('Повреждён ZIP.');
  const name=decoder.decode(bytes.slice(at+46,at+46+nameSize));at+=46+nameSize+extra+comment;
  if(name.endsWith('/'))continue;
  if((attributes>>>16&0xf000)===0xa000)throw Error('В архиве есть символические ссылки. Загрузите обычные файлы.');
  if(flags&1||![0,8].includes(method))throw Error('Нужен ZIP без пароля со стандартным сжатием.');
  if(name.split('/').some(x=>x.startsWith('.')||x==='__MACOSX'))continue;
  if(!validPath(name))throw Error(`Недопустимый путь в ZIP: ${name}`);
  if(uncompressed>LIMITS.fileBytes||compressed>LIMITS.fileBytes||local+30+compressed>offset)throw Error(`Файл ${name} слишком большой или повреждён.`);
  total+=uncompressed;if(total>LIMITS.totalBytes)throw Error('Распакованная сборка превышает 250 МБ.');
  entries.push({name,method,crc,compressed,size:uncompressed,local});
 }
 const index=entries.find(e=>e.name==='index.html')||entries.find(e=>/^[^/]+\/index\.html$/.test(e.name));
 if(!index)throw Error('В ZIP нужен index.html в корне или внутри одной папки, например dist.');
 const prefix=index.name.slice(0,-'index.html'.length);
 const seen=new Set();const files=[];
 for(const entry of entries){
  if(!entry.name.startsWith(prefix))continue;const path=entry.name.slice(prefix.length);if(!allowedFile(path))continue;
  if(seen.has(path.toLowerCase()))throw Error(`Повторяющийся файл: ${path}`);seen.add(path.toLowerCase());
  files.push({path,size:entry.size,async read(){
   const header=new DataView(await file.slice(entry.local,entry.local+30).arrayBuffer());if(header.getUint32(0,true)!==0x04034b50)throw Error(`Повреждён файл ${path}.`);
   const start=entry.local+30+header.getUint16(26,true)+header.getUint16(28,true);if(start+entry.compressed>offset)throw Error('Повреждён ZIP.');
   let stream=file.slice(start,start+entry.compressed).stream();if(entry.method===8)stream=stream.pipeThrough(new DecompressionStream('deflate-raw'));
   const reader=stream.getReader(),chunks=[];let size=0;try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>entry.size){await reader.cancel();throw Error(`Размер ${path} не совпадает.`);}chunks.push(chunk.value);}}catch(e){throw Error(`Не удалось распаковать ${path}: ${e.message}`);}
   if(size!==entry.size)throw Error(`Файл ${path} загружен не полностью.`);const result=new Uint8Array(size);let cursor=0;for(const chunk of chunks){result.set(chunk,cursor);cursor+=chunk.length;}
   if(crc32(result)!==entry.crc)throw Error(`Файл ${path} повреждён.`);return result;
  }});
 }
 if(!files.length)throw Error('В архиве нет файлов сайта.');return files;
}
