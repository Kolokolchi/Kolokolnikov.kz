import { projects } from './projects.js';
import { createProjectAssembly, mountProjectAssemblies } from './project-assembly.js';
const grid = document.querySelector('#projects-grid');
let selectedFilter = 'all';
let disposeAssemblies;
const create = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
function renderProjects() {
  disposeAssemblies?.();
  const matching = projects.filter(project => selectedFilter === 'all' || project.category === selectedFilter);
  grid.replaceChildren(...matching.map((project, index) => {
    const article = create('article','project-card');
    const presentation = create('div','project-presentation');
    const sequence = create('div','project-sequence');
    sequence.append(create('span','',`${String(index + 1).padStart(2,'0')} / ${String(matching.length).padStart(2,'0')}`),create('span','',project.type));
    const link = createProjectAssembly(project);
    const caption = create('div','project-caption');
    const meta = create('div','project-meta');
    const titleLink = create('a'); titleLink.href = link.href;
    titleLink.append(create('h3','',project.name));
    meta.append(titleLink);
    const tags = create('div','project-tags');
    tags.append(...project.tags.map(tag => create('span','',tag)));
    caption.append(meta,create('p','project-description',project.summary),tags);
    presentation.append(sequence,link,caption);
    article.append(presentation);
    return article;
  }));
  disposeAssemblies = mountProjectAssemblies(grid);
}
document.querySelector('#project-count').textContent = projects.length;
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',()=>{
  selectedFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item=>{
    const active = item === button;
    item.classList.toggle('active',active);
    item.setAttribute('aria-pressed',String(active));
  });
  renderProjects();
}));
renderProjects();

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
function closeMenu(restoreFocus=false) {
  menuButton.setAttribute('aria-expanded','false'); menuButton.setAttribute('aria-label','Открыть меню');
  nav.classList.remove('open'); document.body.classList.remove('menu-open');
  if(restoreFocus) menuButton.focus();
}
menuButton.addEventListener('click',()=>{
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded',String(open));
  menuButton.setAttribute('aria-label',open ? 'Закрыть меню':'Открыть меню');
  nav.classList.toggle('open',open); document.body.classList.toggle('menu-open',open);
  if(open) nav.querySelector('a').focus();
});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>closeMenu()));
document.addEventListener('keydown',event=>{
  if(!nav.classList.contains('open')) return;
  if(event.key==='Escape') closeMenu(true);
  if(event.key==='Tab') {
    const links = [...nav.querySelectorAll('a')];
    if(!event.shiftKey && document.activeElement===links.at(-1)) {event.preventDefault();menuButton.focus();}
    else if(event.shiftKey && document.activeElement===menuButton) {event.preventDefault();links.at(-1).focus();}
  }
});
window.matchMedia('(min-width:761px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
