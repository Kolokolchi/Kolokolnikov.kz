import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';

const here = path => fileURLToPath(new URL(path, import.meta.url));

// Three.js scenes: the hero mark, the engineering model viewer and the 360° panorama.
// They share one Three.js chunk, so the viewers add only their own code to the page.
await rm(here('../public/chunks'), { recursive: true, force: true });
await build({
  entryPoints: {
    'hero-scene': here('../src/hero-scene.js'),
    'machine-viewer': here('../src/machine-viewer.js'),
    'pano-viewer': here('../src/pano-viewer.js'),
  },
  outdir: here('../public'),
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  minify: true,
  format: 'esm',
  target: ['es2022'],
  legalComments: 'linked',
  banner: { js: '// Generated from src/. Rebuild with npm run build:hero. Three.js MIT license: assets/three-LICENSE.txt.' },
});
await copyFile(
  fileURLToPath(new URL('../LICENSE', import.meta.resolve('three'))),
  here('../public/assets/three-LICENSE.txt'),
);
// Local Draco decoder (WebAssembly) for the compressed CAD models; no CDN at runtime.
const draco = fileURLToPath(new URL('../examples/jsm/libs/draco/gltf/', import.meta.resolve('three')));
await mkdir(here('../public/assets/draco'), { recursive: true });
for (const name of ['draco_wasm_wrapper.js', 'draco_decoder.wasm']) await copyFile(draco + name, here(`../public/assets/draco/${name}`));
const chunks = await readdir(here('../public/chunks'));
console.log(`Three.js scenes bundled (hero, machine viewer, panorama; shared chunks: ${chunks.filter(name => name.endsWith('.js')).length}).`);
