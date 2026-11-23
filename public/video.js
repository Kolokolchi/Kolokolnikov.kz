// Legacy address video.html?video=<id>. Video pages now live at video/<id>/ as static HTML
// (scripts/build-seo.mjs); old links shared before the move are forwarded there.
import { videos } from './videos.js';
const id = new URLSearchParams(location.search).get('video');
const video = videos.find(item => item.id === id);
if (video) location.replace(new URL(`video/${encodeURIComponent(video.id)}/`, location.href));
else {
  const main = document.querySelector('#video-content');
  const intro = document.createElement('div');
  intro.className = 'page-intro';
  const title = document.createElement('h1');
  title.textContent = 'Видео не найдено';
  const text = document.createElement('p');
  text.textContent = 'Выберите работу в списке видео.';
  const link = document.createElement('a');
  link.className = 'button button-primary';
  link.href = 'video/';
  link.textContent = 'Все видеоработы';
  intro.append(title, text);
  main.replaceChildren(intro, link);
}
