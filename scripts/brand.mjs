import { mkdir, writeFile } from 'node:fs/promises';

// V2 master: the 14:28 reference set, with paired vertical pillars and swept wings.
// Every colour, size and lockup uses these exact same outlines.
export const paths = [
  'M174 422H363L494 528V590L430 626Z',
  'M95 850 357 591 416 637 213 850Z',
  'M494 431 606 357V522L494 587Z',
  'M494 669 606 583V874L494 779Z',
  'M625 357 728 421V461L625 509Z',
  'M625 602 728 681V798L625 874Z',
  'M739 657 853 578 1131 856H954Z',
  'M213 850Q650 483 1210 274L702 663 625 602 970 409Q650 536 213 850Z'
];
const palettes = {blue:['#07223e','#0094ff','#57e3ff'],lime:['#183009','#8ce900','#d1ff50'],orange:['#45190b','#ff690b','#ffca52']};
const destination = new URL('../dist/assets/brand/', import.meta.url);
await mkdir(destination, {recursive:true});
for (const [name, colours] of Object.entries(palettes)) {
  const definitions = `<defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b3bdc8"/><stop offset=".38" stop-color="#202a34"/><stop offset=".7" stop-color="#101820"/><stop offset="1" stop-color="#8a949f"/></linearGradient><linearGradient id="colour" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${colours[2]}"/><stop offset=".27" stop-color="${colours[1]}"/><stop offset=".53" stop-color="${colours[0]}"/><stop offset=".82" stop-color="${colours[1]}"/><stop offset="1" stop-color="${colours[2]}"/></linearGradient></defs>`;
  const geometry = paths.map((d,i)=>`<path d="${d}" fill="url(#${i < 4 ? 'metal':'colour'})" stroke="${i < 4 ? '#a9b5c3':colours[2]}" stroke-opacity=".55" stroke-width="2"/>`).join('');
  const start = `<svg xmlns="http://www.w3.org/2000/svg" role="img"`;
  await writeFile(new URL(`mark-${name}.svg`,destination),`${start} viewBox="60 235 1180 680"><title>Korney Kolokolnikov V2 — ${name}</title>${definitions}${geometry}</svg>`);
  for (const surface of ['light','dark']) {
    const ink = surface === 'dark' ? '#f1f4f7':'#101820';
    await writeFile(new URL(`logo-${name}-${surface}.svg`,destination),`${start} viewBox="0 0 1300 1170"><title>Korney Kolokolnikov V2</title>${definitions}<g transform="translate(0 45)">${geometry}</g><text x="650" y="1050" text-anchor="middle" textLength="1070" lengthAdjust="spacing" font-family="Arial,Helvetica,sans-serif" font-size="49" font-weight="400" fill="${ink}">KORNEY KOLOKOLNIKOV</text></svg>`);
  }
}
const mono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 235 1180 680"><title>Korney Kolokolnikov V2</title>${paths.map(d=>`<path d="${d}" fill="#f1f4f7"/>`).join('')}</svg>`;
await writeFile(new URL('mark-white.svg',destination),mono);
await writeFile(new URL('mark-black.svg',destination),mono.replaceAll('#f1f4f7','#101820'));
await writeFile(new URL('../dist/favicon.svg',import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1300"><rect width="1300" height="1300" rx="250" fill="#0c1016"/><g transform="translate(0 70)">${paths.map((d,i)=>`<path d="${d}" fill="${i < 4 ? '#e0e8f0':'#36a7ff'}"/>`).join('')}</g></svg>`);
console.log('Brand: 3 colourways, identical paths and lockup dimensions, 2 monochrome marks, favicon.');
