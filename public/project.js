// Legacy address project.html?project=<id>. Case pages now live at projects/<id>/ as static HTML
// (scripts/build-seo.mjs); old links shared before the move are forwarded there.
import { projects } from './projects.js';
const id = new URLSearchParams(location.search).get('project');
const project = projects.find(item => item.id === id);
if (project) location.replace(new URL(`projects/${encodeURIComponent(project.id)}/`, location.href));
else {
  const main = document.querySelector('#case-content');
  const intro = document.createElement('div');
  intro.className = 'page-intro';
  const title = document.createElement('h1');
  title.textContent = 'Проект не найден';
  const text = document.createElement('p');
  text.textContent = 'Возможно, ссылка изменилась. Выберите проект в списке.';
  const link = document.createElement('a');
  link.className = 'button button-primary';
  link.href = 'projects/';
  link.textContent = 'Все проекты';
  intro.append(title, text);
  main.replaceChildren(intro, link);
}
