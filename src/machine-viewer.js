import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/*
 * Interactive viewer for the owner's CAD exports (ANKOR V05 machines).
 * Every GLB node may carry extras {part, group, step, material}; the viewer replays the
 * assembly order from them. The poster image stays visible until the first successful draw
 * and returns on context loss, so the section never depends on WebGL.
 */
const clamp = THREE.MathUtils.clamp;
const ease = t => 1 - Math.pow(1 - t, 3);

const GROUP_NAMES = {
  fixed: 'Рама и крепёж', shell: 'Корпус', table: 'Стол подачи', cartridge: 'Картридж', cassette: 'Кассета',
  piston: 'Поршень', niche_door: 'Дверца ниши', service_door: 'Сервисная дверца', lid: 'Крышка', valve: 'Клапан',
  cap: 'Колпак', tank: 'Бак', stirrer: 'Мешалка', press_head: 'Прессовая головка', press_drawer: 'Выдвижной ящик',
  strip: 'Блистерная полоса',
};

export function createMachineViewer(root, { models, dracoPath = 'assets/draco/', onModel } = {}) {
  const canvas = root.querySelector('canvas');
  const stage = root.querySelector('[data-lab-stage]');
  const tooltip = root.querySelector('[data-lab-tooltip]');
  const slider = root.querySelector('[data-lab-step]');
  const stepLabel = root.querySelector('[data-lab-step-label]');
  const playButton = root.querySelector('[data-lab-play]');
  const status = root.querySelector('[data-lab-status]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!canvas || !stage) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    stage.classList.add('lab-no-webgl');
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.autoRotateSpeed = 0.55;
  // Never hijack page scrolling: wheel zoom only after the visitor engages with the model,
  // and on touch screens a vertical swipe still scrolls the page (horizontal swipe rotates).
  controls.enableZoom = false;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
  canvas.addEventListener('focus', () => { controls.enableZoom = true; });
  stage.addEventListener('pointerleave', () => { if (!document.fullscreenElement) controls.enableZoom = false; });

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -2;
  key.shadow.camera.right = key.shadow.camera.top = 2;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key, new THREE.HemisphereLight(0xcfe7ff, 0x1a2230, 0.65));
  const rim = new THREE.DirectionalLight(0x4aafff, 1.4);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.PolarGridHelper(2.2, 12, 6, 64, 0x2a3b4f, 0x1b2735);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoPath);
  loader.setDRACOLoader(draco);

  const cache = new Map();
  let current = null; // {model, group, parts, maxStep}
  let progress = 0, target = 0, visible = false, running = false, interacted = false;
  let cut = 0, cutTarget = 0, shellMode = 'solid';
  let hovered = null, firstDraw = false, disposed = false, loadToken = 0;
  const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
  let pointerDirty = false, pointerInside = false, lastPointer = { x: 0, y: 0 };
  const ghost = new THREE.MeshStandardMaterial({ color: 0x9fd2ff, transparent: true, opacity: 0.1, depthWrite: false, metalness: 0, roughness: 0.2 });
  const highlight = new THREE.MeshStandardMaterial({ color: 0xb1ed45, emissive: 0x3a5a10, metalness: 0.2, roughness: 0.4 });

  function setStatus(text) { if (status) status.textContent = text; }

  function prepare(model, gltf) {
    const group = gltf.scene;
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2.15 / Math.max(size.x, size.y, size.z);
    const wrapper = new THREE.Group();
    group.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    wrapper.add(group);
    wrapper.scale.setScalar(scale);
    wrapper.updateMatrixWorld(true);
    const parts = [];
    const modelCenter = new THREE.Box3().setFromObject(wrapper).getCenter(new THREE.Vector3());
    let maxStep = 0;
    group.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.clippingPlanes = [clipPlane];
          material.clipShadows = true;
          material.side = THREE.DoubleSide;
          if (material.transparent) material.depthWrite = false;
        }
      }
      const data = object.userData || {};
      if (data.step === undefined || object === group) return;
      const bounds = new THREE.Box3().setFromObject(object);
      if (bounds.isEmpty()) return;
      const partCenter = bounds.getCenter(new THREE.Vector3());
      const direction = partCenter.clone().sub(modelCenter);
      direction.y = Math.max(direction.y, 0) + 0.35;
      if (direction.lengthSq() < 1e-6) direction.set(0, 1, 0);
      direction.normalize();
      // Offsets are in the object's parent space, so convert the world push back.
      const parentInverse = new THREE.Matrix4().copy(object.parent.matrixWorld).invert();
      const worldFrom = partCenter.clone();
      const worldTo = partCenter.clone().addScaledVector(direction, 0.9 + (data.step % 5) * 0.08);
      const localOffset = worldTo.applyMatrix4(parentInverse).sub(worldFrom.applyMatrix4(parentInverse));
      parts.push({ object, step: Number(data.step) || 0, group: data.group || '', home: object.position.clone(), offset: localOffset, original: object.material });
      maxStep = Math.max(maxStep, Number(data.step) || 0);
    });
    // Assembly steps may skip numbers (e.g. 99 for consumables): replay them as consecutive ranks.
    const ranks = [...new Set(parts.map(part => part.step).filter(step => step > 0))].sort((a, b) => a - b);
    parts.forEach(part => { part.step = part.step > 0 ? ranks.indexOf(part.step) + 1 : 0; });
    maxStep = ranks.length;
    // Parts without a step stay assembled; with several parts the slider works as an explode control.
    if (!ranks.length && parts.length > 1) { parts.forEach((part, index) => { part.step = 1 + index; }); maxStep = parts.length; }
    return { model, wrapper, parts, maxStep, radius: Math.max(size.x, size.y, size.z) * scale, height: size.y * scale };
  }

  function applyShell() {
    if (!current) return;
    for (const part of current.parts) {
      if (part.group !== 'shell') continue;
      part.object.traverse(object => {
        if (!object.isMesh) return;
        object.userData.solidMaterial ||= object.material;
        object.material = shellMode === 'ghost' ? ghost : object.userData.solidMaterial;
        object.visible = shellMode !== 'hidden';
        object.castShadow = shellMode === 'solid';
      });
    }
  }

  function applyProgress() {
    if (!current) return;
    const max = current.maxStep || 1;
    for (const part of current.parts) {
      const local = current.maxStep ? clamp(progress - (part.step - 1), 0, 1) : 1;
      const t = ease(local);
      part.object.position.copy(part.home).addScaledVector(part.offset, 1 - t);
      part.object.visible = local > 0.001 && !(part.group === 'shell' && shellMode === 'hidden');
    }
    if (slider && document.activeElement !== slider) slider.value = String(progress);
    if (stepLabel) {
      const step = Math.round(clamp(progress, 0, max));
      const names = [...new Set(current.parts.filter(part => part.step === Math.max(1, step)).map(part => GROUP_NAMES[part.group] || ''))].filter(Boolean);
      stepLabel.textContent = current.maxStep ? `Шаг ${step} / ${max}${names.length ? ' · ' + names.slice(0, 2).join(', ') : ''}` : 'Модель целиком';
    }
  }

  function frameCamera(entry) {
    const radius = entry.radius;
    // Narrow (portrait) stages need more distance so the model fits horizontally too.
    const fit = camera.aspect < 1.3 ? Math.pow(1.3 / camera.aspect, 0.9) : 1;
    const distance = (radius * 1.7 + 1.1) * fit;
    const lookY = entry.height * 0.46;
    camera.position.set(distance * 0.72, lookY + distance * 0.34, distance * 0.82);
    controls.target.set(0, lookY, 0);
    controls.minDistance = radius * 0.8;
    controls.maxDistance = radius * 4;
    controls.update();
  }

  async function show(id) {
    const model = models.find(item => item.id === id);
    if (!model) return;
    const token = ++loadToken;
    root.dataset.model = id;
    onModel?.(model);
    setStatus('Загрузка модели…');
    stage.classList.add('lab-loading');
    try {
      let entry = cache.get(id);
      if (!entry) {
        const gltf = await loader.loadAsync(model.file);
        entry = prepare(model, gltf);
        cache.set(id, entry);
      }
      if (token !== loadToken || disposed) return;
      if (current) scene.remove(current.wrapper);
      current = entry;
      scene.add(current.wrapper);
      if (hovered) hovered.object.traverse(o => { if (o.isMesh && o.userData.hoverMaterial) { o.material = o.userData.hoverMaterial; delete o.userData.hoverMaterial; } });
      hovered = null;
      tooltip?.setAttribute('hidden', '');
      applyShell();
      if (slider) {
        slider.max = String(current.maxStep || 1);
        slider.disabled = !current.maxStep;
        slider.closest('[data-lab-assembly]')?.toggleAttribute('hidden', !current.maxStep);
      }
      frameCamera(current);
      const animate = !reducedMotion.matches;
      progress = animate && current.maxStep ? 0 : current.maxStep;
      target = current.maxStep;
      applyProgress();
      setStatus(model.status || '');
      stage.classList.remove('lab-loading');
      wake();
    } catch (error) {
      console.warn('Model unavailable', error);
      stage.classList.remove('lab-loading');
      setStatus('Модель недоступна — показан рендер.');
      stage.classList.remove('lab-ready');
    }
  }

  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2));
    renderer.setSize(width, height, false);
    const narrowChanged = (camera.aspect < 1.3) !== (width / height < 1.3);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (current && (!interacted || narrowChanged)) frameCamera(current);
    wake();
  }

  function pick() {
    if (!current || !pointerInside) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(current.wrapper, true).filter(hit => hit.object.visible && hit.object.material !== ghost && (!cut || clipPlane.distanceToPoint(hit.point) > 0));
    let part = null;
    if (hits.length) {
      let object = hits[0].object;
      while (object && object.userData?.step === undefined && object.parent) object = object.parent;
      part = current.parts.find(item => item.object === object) || null;
    }
    if (part === hovered) return positionTooltip();
    if (hovered) hovered.object.traverse(o => { if (o.isMesh && o.userData.hoverMaterial) { o.material = o.userData.hoverMaterial; delete o.userData.hoverMaterial; } });
    hovered = part;
    if (!part) { tooltip?.setAttribute('hidden', ''); canvas.style.cursor = ''; return; }
    part.object.traverse(o => { if (o.isMesh) { o.userData.hoverMaterial = o.material; o.material = highlight; } });
    canvas.style.cursor = 'help';
    if (tooltip) {
      const data = part.object.userData;
      const code = String(part.object.name || data.part || '').replace(/_\d+$/, '').replace(/_/g, ' ');
      tooltip.querySelector('strong').textContent = code;
      tooltip.querySelector('span').textContent = [GROUP_NAMES[part.group], data.material].filter(Boolean).join(' · ');
      tooltip.removeAttribute('hidden');
      positionTooltip();
    }
  }
  function positionTooltip() {
    if (!tooltip || tooltip.hasAttribute('hidden')) return;
    const x = clamp(lastPointer.x + 16, 8, stage.clientWidth - tooltip.offsetWidth - 8);
    const y = clamp(lastPointer.y + 16, 8, stage.clientHeight - tooltip.offsetHeight - 8);
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }

  let lastTime = 0, idleFrames = 0;
  function frame(time) {
    const dt = Math.min(0.05, (time - (lastTime || time)) / 1000);
    lastTime = time;
    let busy = controls.update();
    if (current) {
      if (Math.abs(progress - target) > 0.001) {
        const speed = Math.max(2.2, (current.maxStep || 1) / 7);
        progress += Math.sign(target - progress) * Math.min(Math.abs(target - progress), speed * dt);
        applyProgress();
        busy = true;
      }
      const cutDelta = cutTarget - cut;
      if (Math.abs(cutDelta) > 0.001) {
        cut += cutDelta * Math.min(1, dt * 6);
        busy = true;
      } else cut = cutTarget;
      clipPlane.constant = cut > 0.001 ? THREE.MathUtils.lerp(current.radius * 0.7, 0, ease(cut)) : 10;
    }
    if (pointerDirty) { pointerDirty = false; pick(); }
    renderer.render(scene, camera);
    if (!firstDraw) { firstDraw = true; stage.classList.add('lab-ready'); }
    controls.autoRotate = !interacted && !reducedMotion.matches && !hovered;
    idleFrames = busy || controls.autoRotate ? 0 : idleFrames + 1;
    if (idleFrames > 30) stop();
  }
  function wake() {
    if (running || !visible || document.hidden || disposed) return;
    running = true;
    idleFrames = 0;
    lastTime = 0;
    renderer.setAnimationLoop(frame);
  }
  function stop() { running = false; renderer.setAnimationLoop(null); }

  controls.addEventListener('start', () => { interacted = true; wake(); });
  controls.addEventListener('change', wake);
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    lastPointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    pointer.set((lastPointer.x / rect.width) * 2 - 1, -(lastPointer.y / rect.height) * 2 + 1);
    pointerInside = event.pointerType === 'mouse';
    pointerDirty = true;
    wake();
  });
  canvas.addEventListener('pointerleave', () => { pointerInside = false; pointerDirty = true; wake(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); stop(); stage.classList.remove('lab-ready'); firstDraw = false; });
  canvas.addEventListener('webglcontextrestored', () => { cache.clear(); const id = root.dataset.model; current = null; show(id); });

  slider?.addEventListener('input', () => { target = progress = Number(slider.value); applyProgress(); wake(); });
  playButton?.addEventListener('click', () => {
    if (!current?.maxStep) return;
    progress = reducedMotion.matches ? current.maxStep : 0;
    target = current.maxStep;
    applyProgress();
    wake();
  });
  root.querySelectorAll('[data-lab-model]').forEach(button => button.addEventListener('click', () => {
    root.querySelectorAll('[data-lab-model]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    show(button.dataset.labModel);
  }));
  root.querySelectorAll('[data-lab-shell]').forEach(button => button.addEventListener('click', () => {
    shellMode = button.dataset.labShell;
    root.querySelectorAll('[data-lab-shell]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    applyShell();
    applyProgress();
    wake();
  }));
  root.querySelector('[data-lab-cut]')?.addEventListener('click', event => {
    cutTarget = cutTarget ? 0 : 1;
    event.currentTarget.setAttribute('aria-pressed', String(Boolean(cutTarget)));
    wake();
  });
  root.querySelector('[data-lab-reset]')?.addEventListener('click', () => { if (current) frameCamera(current); interacted = false; wake(); });
  root.querySelector('[data-lab-fullscreen]')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 50));

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(stage);
  window.addEventListener('resize', resize, { passive: true });
  const visibility = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) wake(); else stop();
  }, { threshold: 0.05 });
  visibility.observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else wake(); });
  resize();
  show(models[0].id);

  return {
    show,
    dispose() {
      disposed = true; stop(); visibility.disconnect(); resizeObserver?.disconnect();
      renderer.dispose(); pmrem.dispose(); draco.dispose();
    },
  };
}
