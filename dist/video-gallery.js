import {videos} from './videos.js';
const grid=document.querySelector('#video-grid');
const more=document.querySelector('#more-videos');
let filter='all',expanded=false;
function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;}
function render(){
 const matching=videos.filter(item=>filter==='all'||item.category===filter);
 const visible=filter==='all'&&!expanded?matching.slice(0,4):matching;
 grid.replaceChildren(...visible.map(item=>{
  const article=element('article','video-card');
  const a=element('a','video-cover');a.href=`video.html?video=${item.id}`;a.setAttribute('aria-label',`Смотреть: ${item.title}`);
  const image=element('img');Object.assign(image,{src:item.poster,alt:item.title,loading:'lazy',width:1280,height:720});
  const play=element('span','video-play','▶');play.setAttribute('aria-hidden','true');
  a.append(image,play,element('span','video-duration',item.duration));
  const info=element('div','video-info');
  const title=element('a');title.href=a.href;title.append(element('h3','',item.title));
  info.append(title,element('span','',item.type));
  article.append(a,info,element('p','video-summary',item.description));return article;
 }));
 more.hidden=expanded||filter!=='all';more.textContent=`Все видеоработы (${videos.length}) ↓`;
}
document.querySelectorAll('[data-video-filter]').forEach(button=>button.addEventListener('click',()=>{
 filter=button.dataset.videoFilter;
 document.querySelectorAll('[data-video-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});render();
}));
more.addEventListener('click',()=>{expanded=true;render();grid.querySelectorAll('.video-cover')[4]?.focus({preventScroll:true});});
render();
