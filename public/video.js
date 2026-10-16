import {videos} from './videos.js';
const video=videos.find(item=>item.id===new URLSearchParams(location.search).get('video'));
const main=document.querySelector('#video-content');
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;}
function link(text,url,style,external=false){const a=el('a',style,text);a.href=url;if(external){a.target='_blank';a.rel='noopener noreferrer';}return a;}
main.replaceChildren();
const intro=el('div','page-intro');
if(!video){intro.append(el('h1','','Видео не найдено'),el('p','','Выберите работу в разделе видео.'));main.append(intro,link('К видеоработам','./#video','button button-primary'));}
else{
 document.title=`${video.title} — видео | Korney Kolokolnikov`;
 intro.append(el('p','section-kicker',`${video.type} · ${video.duration}`),el('h1','',video.title),el('p','',video.description));
 const stage=el('div','video-stage');
 if(video.src){
  const player=el('video');Object.assign(player,{src:video.src,poster:video.poster,controls:true,preload:'none',playsInline:true});player.setAttribute('aria-label',video.title);stage.append(player);
  const error=el('p','video-error','Не удалось загрузить превью. Попробуйте открыть файл отдельно.');error.hidden=true;player.addEventListener('error',()=>error.hidden=false);stage.append(error);
 }else{
  const a=link(`Смотреть на YouTube ↗`,`https://www.youtube.com/watch?v=${video.youtubeId}`,'youtube-watch',true);
  const img=el('img');Object.assign(img,{src:video.poster,alt:video.title,width:1280,height:720});
  const label=el('span','youtube-watch-label','▶ Смотреть на YouTube ↗');a.replaceChildren(img,label);stage.append(a);
 }
 const caption=el('p','case-visual-caption',video.note||'Полная версия откроется на авторском YouTube-канале.');
 const actions=el('div','case-actions video-actions');
 const share=el('button','button button-primary','Скопировать ссылку');share.type='button';
 const shareField=el('input','video-share-field');Object.assign(shareField,{type:'url',readOnly:true,value:location.href,hidden:true});shareField.setAttribute('aria-label','Ссылка на видеоработу');
 share.addEventListener('click',async()=>{const status=document.querySelector('#video-status');status.hidden=false;try{await navigator.clipboard.writeText(location.href);status.textContent='Ссылка на видеоработу скопирована';}catch{shareField.hidden=false;shareField.focus();shareField.select();status.textContent='Ссылка выделена — скопируйте её.';}setTimeout(()=>status.hidden=true,4000);});
 actions.append(share);
 const discuss=link('Обсудить видео ↗',`mailto:kolokolnikovk@gmail.com?subject=${encodeURIComponent(`Видео: ${video.title}`)}`,'button button-outline action-link');discuss.dataset.accent='orange';actions.append(discuss);
 if(video.src)actions.append(link('Открыть превью отдельно ↗',video.src,'button button-outline',true));
 if(video.relatedProject){const related=link('Посмотреть сайт Ankor ↗',`project.html?project=${video.relatedProject}`,'button button-outline');related.dataset.accent='blue';actions.append(related);}
 main.append(intro,stage,caption,actions,shareField);
}
