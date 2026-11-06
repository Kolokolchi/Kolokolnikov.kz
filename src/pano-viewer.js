import * as THREE from 'three';

/*
 * Equirectangular 360° viewer for the SAF Avenue lobby panorama.
 * Drag (or swipe) to look around, wheel/pinch to zoom; idles with a slow pan unless the
 * visitor prefers reduced motion. The poster image stays until the first draw.
 */
export function createPanoViewer(root, { src } = {}) {
  const canvas = root.querySelector('canvas');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!canvas || !src) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 100);
  const geometry = new THREE.SphereGeometry(10, 64, 40);
  geometry.scale(-1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x111111 });
  scene.add(new THREE.Mesh(geometry, material));

  let lon = 180, lat = 0, targetLon = 180, targetLat = 0, fov = 72;
  let dragging = false, last = null, visible = false, running = false, interacted = false, ready = false;
  const pointers = new Map();
  let pinch = 0;

  new THREE.TextureLoader().load(src, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    material.map = texture;
    material.color.set(0xffffff);
    material.needsUpdate = true;
    ready = true;
    wake();
  });

  function resize() {
    const width = root.clientWidth, height = root.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    wake();
  }
  function frame(time) {
    if (!interacted && !reducedMotion.matches) targetLon += 0.012 * 16;
    lon += (targetLon - lon) * 0.12;
    lat += (targetLat - lat) * 0.12;
    camera.fov += (fov - camera.fov) * 0.15;
    camera.updateProjectionMatrix();
    const phi = THREE.MathUtils.degToRad(90 - lat), theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    renderer.render(scene, camera);
    if (ready && !root.classList.contains('pano-ready')) root.classList.add('pano-ready');
    const settled = Math.abs(targetLon - lon) < 0.01 && Math.abs(targetLat - lat) < 0.01 && Math.abs(fov - camera.fov) < 0.01;
    if (settled && (interacted || reducedMotion.matches) && !dragging) stop();
    void time;
  }
  function wake() {
    if (running || !visible || document.hidden) return;
    running = true;
    renderer.setAnimationLoop(frame);
  }
  function stop() { running = false; renderer.setAnimationLoop(null); }

  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    dragging = true; interacted = true; last = { x: event.clientX, y: event.clientY };
    root.classList.add('pano-touched');
    wake();
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) fov = THREE.MathUtils.clamp(fov - (distance - pinch) * 0.12, 35, 90);
      pinch = distance;
      wake();
      return;
    }
    if (!dragging || !last) return;
    targetLon -= (event.clientX - last.x) * 0.14;
    targetLat = THREE.MathUtils.clamp(targetLat + (event.clientY - last.y) * 0.14, -80, 80);
    last = { x: event.clientX, y: event.clientY };
    wake();
  });
  const release = event => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (!pointers.size) { dragging = false; last = null; }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', event => {
    // Plain wheel keeps scrolling the page; pinch (ctrl+wheel) or a focused viewer zooms.
    if (!event.ctrlKey && document.activeElement !== canvas) return;
    event.preventDefault();
    interacted = true;
    fov = THREE.MathUtils.clamp(fov + event.deltaY * 0.03, 35, 90);
    wake();
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    const step = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[event.key];
    if (!step) return;
    event.preventDefault();
    interacted = true;
    targetLon += step[0];
    targetLat = THREE.MathUtils.clamp(targetLat + step[1], -80, 80);
    wake();
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stop(); root.classList.remove('pano-ready'); });

  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) wake(); else stop(); }, { threshold: 0.05 });
  observer.observe(root);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(root);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else wake(); });
  resize();
  return { dispose() { stop(); observer.disconnect(); renderer.dispose(); } };
}
