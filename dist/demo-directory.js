const list=document.querySelector('#demo-list');
function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;}
function link(text,url,style){const a=el('a',style,text);a.href=url;return a;}
try{
 const response=await fetch('catalog.json');if(!response.ok)throw Error('Catalog unavailable');const demos=await response.json();
 list.replaceChildren(...demos.map(demo=>{
  const article=el('article','demo-row'),copy=el('div');copy.append(el('h2','',demo.title),el('p','',demo.description));
  const actions=el('div','demo-actions');const open=link('Открыть сайт ↗',demo.path,'button button-primary');
  const review=link('Просмотр и комментарии',`../showcase.html?demo=${encodeURIComponent(demo.id)}`,'button button-outline');
  const share=el('button','text-link','Скопировать ссылку');share.type='button';
  const field=el('input','demo-share');field.type='url';field.readOnly=true;field.hidden=true;field.setAttribute('aria-label',`Ссылка на ${demo.title}`);
  share.addEventListener('click',async()=>{const url=new URL(demo.path,location.href).href;const status=document.querySelector('#demo-status');status.hidden=false;try{await navigator.clipboard.writeText(url);status.textContent='Ссылка на сайт скопирована';}catch{field.hidden=false;field.value=url;field.focus();field.select();status.textContent='Ссылка выделена — скопируйте её.';}setTimeout(()=>status.hidden=true,4000);});
  actions.append(open,review,share);article.append(copy,actions,field);return article;
 }));
 if(!demos.length)list.replaceChildren(el('p','','Пока нет опубликованных демонстраций.'));
}catch{list.replaceChildren(el('p','','Не удалось загрузить список. Обновите страницу или свяжитесь с Корнеем.'));}
