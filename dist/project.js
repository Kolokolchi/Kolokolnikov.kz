import { projects } from './projects.js';
const project = projects.find(item=>item.id===new URLSearchParams(location.search).get('project'));
const main = document.querySelector('#case-content');
function node(tag, className, text) { const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el; }
function link(text, href, style, external=false) { const a=node('a',style,text);a.href=href;if(external){a.target='_blank';a.rel='noopener noreferrer';}return a; }
main.replaceChildren();
if(!project) {
  const intro=node('div','page-intro');intro.append(node('h1','','Проект не найден'),node('p','','Возможно, ссылка изменилась. Выберите проект в портфолио.'));main.append(intro,link('Открыть портфолио','./#work','button button-primary'));
} else {
  document.title=`${project.name} — Korney Kolokolnikov`;
  const intro=node('div','page-intro');intro.append(node('p','section-kicker',project.type),node('h1','',project.name),node('p','',project.summary));
  const metadata=node('div','case-metadata');
  for(const [label,value] of [['Формат',project.type],['Статус',project.status],['В проекте',project.tags.join(' / ')]]) {const block=node('div','',label);block.append(node('strong','',value));metadata.append(block);}
  intro.append(metadata);
  const image=node('img','case-hero');Object.assign(image,{src:project.image,alt:`${project.name} — экран проекта`,width:1440,height:1000});
  const caption=node('p','case-visual-caption',project.gallery.find(item=>item.src===project.image)?.caption || project.type);
  const details=node('div','case-details');const about=node('section');about.append(node('h2','','О проекте'),node('p','',project.description));
  const features=node('section');const list=node('ul');list.append(...project.features.map(text=>node('li','',text)));features.append(node('h2','','Что внутри'),list);details.append(about,features);
  const actions=node('div','case-actions');actions.append(link('Открыть презентацию ↗',`showcase.html?project=${project.id}`,'button button-primary'));
  if(project.url)actions.append(link('Открыть сайт ↗',project.url,'button button-outline',true));
  if(project.repository)actions.append(link('Репозиторий GitHub ↗',project.repository,'button button-outline',true));
  main.append(intro,image,caption,details,actions);
}
