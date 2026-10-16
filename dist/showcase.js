import { projects, contact } from './projects.js';
const $ = selector=>document.querySelector(selector);
const project=projects.find(item=>item.id===new URLSearchParams(location.search).get('project'));
let mode='live',device='desktop',screen=0,frameStarted=false,toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
function fitFrame(){
  if(mode!=='live'||!project)return;
  const stage=$('#viewer-stage'), viewport=$('#frame-viewport'),frame=$('#project-frame');
  const width={desktop:1440,tablet:768,mobile:390}[device];
  const space=window.innerWidth<=760?24:48;
  const availableWidth=Math.max(1,stage.clientWidth-space),availableHeight=Math.max(1,stage.clientHeight-space);
  const scale=Math.min(1,availableWidth/width);
  const height=Math.min(device==='mobile'?844:1050,availableHeight/scale);
  Object.assign(viewport.style,{width:`${width*scale}px`,height:`${height*scale}px`});
  Object.assign(frame.style,{width:`${width}px`,height:`${height}px`,transform:`scale(${scale})`});
  $('#device-size').textContent=`${width} px`;
}
function renderGallery(){
  const item=project.gallery[screen];
  $('#gallery-image').src=item.src;$('#gallery-image').alt=item.caption;
  $('#screen-count').textContent=`${screen+1} / ${project.gallery.length}`;
  $('#previous-screen').disabled=screen===0;$('#next-screen').disabled=screen===project.gallery.length-1;
  $('#viewer-caption').textContent=item.caption;
}
function setMode(value){
  mode=value;
  if(!project.url)mode='gallery';
  document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
  $('#frame-viewport').hidden=mode!=='live';$('#gallery-view').hidden=mode!=='gallery';
  document.querySelectorAll('[data-device]').forEach(button=>button.disabled=mode!=='live');
  if(mode==='live'){
    if(!frameStarted){$('#project-frame').src=project.url;frameStarted=true;}
    $('#viewer-caption').textContent='Работающая версия проекта. Если сайт не отображается, нажмите «Открыть отдельно» или выберите «Экраны».';
    requestAnimationFrame(fitFrame);
  }else{renderGallery();$('#device-size').textContent='Снимки';}
}
if(!project){
  $('#viewer-name').textContent='Проект не найден';$('#viewer-status').textContent='Проверьте ссылку';$('#viewer-error').hidden=false;
  document.querySelector('.viewer-toolbar').hidden=true;document.querySelector('.viewer-actions').hidden=true;$('.viewer-footer').hidden=true;
}else{
  document.title=`${project.name} — презентация | Korney Kolokolnikov`;
  $('#viewer-name').textContent=project.name;$('#viewer-status').textContent=`${project.type} · ${project.status}`;
  $('#back-link').href=`project.html?project=${project.id}`;
  $('#external-link').hidden=!project.url;if(project.url)$('#external-link').href=project.url;
  $('[data-mode="live"]').disabled=!project.url;
  $('#project-frame').title=`${project.name} — работающий сайт`;
  if(window.innerWidth<=600){device='mobile';document.querySelectorAll('[data-device]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.device===device)));}
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  document.querySelectorAll('[data-device]').forEach(button=>button.addEventListener('click',()=>{device=button.dataset.device;document.querySelectorAll('[data-device]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));fitFrame();}));
  $('#previous-screen').addEventListener('click',()=>{if(screen>0){screen--;renderGallery();}});
  $('#next-screen').addEventListener('click',()=>{if(screen<project.gallery.length-1){screen++;renderGallery();}});
  document.addEventListener('keydown',event=>{if(mode!=='gallery'||document.querySelector('dialog[open]')||['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;if(event.key==='ArrowLeft')$('#previous-screen').click();if(event.key==='ArrowRight')$('#next-screen').click();});
  new ResizeObserver(fitFrame).observe($('#viewer-stage'));
  setMode(project.url?'live':'gallery');
  $('#about-title').textContent=project.name;$('#about-type').textContent=project.type;$('#about-description').textContent=project.description;
  $('#about-features').replaceChildren(...project.features.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));$('#case-link').href=`project.html?project=${project.id}`;
  $('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());
  $('#share-button').addEventListener('click',()=>{
    const url=new URL(location.href);url.hash='';$('#share-url').value=url.href;
    $('#copy-status').textContent='';$('#share-dialog').showModal();$('#share-url').select();
  });
  $('#copy-link').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('#share-url').value);$('#copy-status').textContent='Ссылка скопирована.';toast('Ссылка на проект скопирована');}
    catch{$('#share-url').focus();$('#share-url').select();$('#copy-status').textContent='Ссылка выделена. Нажмите Ctrl+C или выберите «Копировать».';}
  });
  $('#feedback-button').addEventListener('click',()=>$('#feedback-dialog').showModal());
  $('#feedback-form').addEventListener('submit',event=>{
    event.preventDefault();if(!event.currentTarget.reportValidity())return;
    const name=$('#feedback-name').value.trim();const comment=$('#feedback-text').value.trim();
    const subject=`Комментарий к проекту «${project.name}»`;
    const body=`Проект: ${project.name}\nСсылка: ${location.href}\nРежим: ${mode==='live'?`сайт, ${device}`:`экран ${screen+1}`}\n${name?`От: ${name}\n`:''}\n${comment}`;
    const mailto=`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const anchor=document.createElement('a');anchor.href=mailto;anchor.hidden=true;document.body.append(anchor);anchor.click();anchor.remove();
    toast('Письмо подготовлено для почтовой программы');
  });
  $('#fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#viewer-stage').requestFullscreen)await $('#viewer-stage').requestFullscreen();else toast('Полноэкранный режим недоступен в этом браузере');}catch{toast('Полноэкранный режим недоступен в этом браузере');}});
}
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
