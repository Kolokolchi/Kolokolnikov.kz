import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { copyFile } from 'node:fs/promises';

await build({
  entryPoints: [fileURLToPath(new URL('../src/hero-scene.js', import.meta.url))],
  outfile: fileURLToPath(new URL('../public/hero-scene.js', import.meta.url)),
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022'],
  legalComments: 'linked',
  banner: { js: '// Generated from src/hero-scene.js. Rebuild with npm run build:hero. Three.js MIT license: assets/three-LICENSE.txt.' },
});
await copyFile(
  fileURLToPath(new URL('../LICENSE', import.meta.resolve('three'))),
  fileURLToPath(new URL('../public/assets/three-LICENSE.txt', import.meta.url)),
);
console.log('Hero: local Three.js scene bundled for server hosting and GitHub Pages.');
