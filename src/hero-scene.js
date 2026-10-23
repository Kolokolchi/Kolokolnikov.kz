import * as THREE from 'three';

const PALETTES = [
  { main: '#0094ff', light: '#57e3ff', deep: '#07223e' },
  { main: '#8ce900', light: '#d1ff50', deep: '#183009' },
  { main: '#ff690b', light: '#ffca52', deep: '#45190b' },
];

const svgPoint = (x, y) => [(x - 650) / 190, (570 - y) / 190];
const clamp = THREE.MathUtils.clamp;

// The original four contours, including the two quadratic curves. These are the
// very same paths used by scripts/brand.mjs, rather than a font approximation.
function makeBrandShapes() {
  const shapes = [];
  const shape = () => {
    const item = new THREE.Shape();
    const move = (x, y) => item.moveTo(...svgPoint(x, y));
    const line = (x, y) => item.lineTo(...svgPoint(x, y));
    const curve = (cx, cy, x, y) => item.quadraticCurveTo(...svgPoint(cx, cy), ...svgPoint(x, y));
    return { item, move, line, curve };
  };
  {
    const { item, move, line } = shape();
    move(155, 830); line(309, 481); line(552, 347); line(442, 565);
    item.closePath(); shapes.push(item);
  }
  {
    const { item, move, line, curve } = shape();
    move(117, 914); curve(240, 735, 445, 611);
    line(744, 912); line(580, 912); line(411, 739);
    item.closePath(); shapes.push(item);
  }
  {
    const { item, move, line } = shape();
    move(602, 688); line(695, 609); line(1005, 913); line(820, 913);
    item.closePath(); shapes.push(item);
  }
  {
    const { item, move, line, curve } = shape();
    move(155, 830); curve(570, 438, 1180, 225);
    line(601, 687); line(540, 626); line(820, 430);
    curve(450, 603, 155, 830);
    item.closePath(); shapes.push(item);
  }
  return shapes;
}

// cubic-bezier(.77, 0, .175, 1): deliberate acceleration and a precise landing.
function assemblyEase(value) {
  const x = clamp(value, 0, 1);
  if (x === 0 || x === 1) return x;
  let low = 0;
  let high = 1;
  let t = x;
  for (let i = 0; i < 13; i += 1) {
    const inverse = 1 - t;
    const position = 3 * inverse * inverse * t * 0.77 + 3 * inverse * t * t * 0.175 + t * t * t;
    if (position < x) low = t;
    else high = t;
    t = (low + high) * 0.5;
  }
  return t * t * (3 - 2 * t);
}

function makeEnvironment(renderer) {
  const environment = new THREE.Scene();
  environment.background = new THREE.Color('#17212e');
  const panels = [];
  const panel = (color, intensity, x, y, z, width, height) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    mesh.material.color.multiplyScalar(intensity);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    panels.push(mesh);
    environment.add(mesh);
  };
  // A purpose-built photographic studio: broad softboxes make the bevels read
  // as solid milled metal, while narrow strips create the long edge reflections.
  panel('#ffffff', 7, -3.8, 4.5, 4, 5, 5.5);
  panel('#dcecff', 3.6, 4.5, 1.5, 2.5, 1, 7);
  panel('#ffffff', 5, 0.2, -4, 4.5, 6, 0.6);
  panel('#a1b4cf', 1.7, -4, 0, -2.5, 3, 6);
  panel('#ffffff', 2.5, 0, 5, -3, 6, 2);
  panel('#e8f1ff', 2.1, 0, 0.5, 5.5, 5, 4);
  panel('#ffffff', 4, -5, -1.5, 4, 2.5, 6);
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(environment, 0.055, 0.1, 60);
  generator.dispose();
  for (const mesh of panels) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  return target;
}

function frontLine(points, z, color, opacity) {
  const vertices = points.map(([x, y]) => new THREE.Vector3(...svgPoint(x, y), z));
  const curve = new THREE.QuadraticBezierCurve3(...vertices);
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

/**
 * Cinematic four-piece KK sculpture. No downloaded models, textures or images.
 * The caller owns visibility/reduced-motion policy through setPaused().
 */
export function createHeroScene(canvas, { hero = canvas?.parentElement } = {}) {
  if (!canvas || !hero) return null;
  let renderer;
  let environmentTarget;
  let resizeObserver;
  let destroyed = false;
  let contextLost = false;
  let paused = false;
  let animationFrame = 0;
  let previousTime = null;
  let elapsed = 0;
  let width = 0;
  let height = 0;
  let narrow = false;
  let scrollTarget = 0;
  let scrollPosition = 0;
  let ready = false;
  let removeListeners = () => {};
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, targetX: 0, targetY: 0 };
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const resources = new Set();

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(0, 0, 11.2);
    environmentTarget = makeEnvironment(renderer);
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 0.85;

    const sculpture = new THREE.Group();
    scene.add(sculpture);

    const silver = new THREE.MeshPhysicalMaterial({
      color: '#b3becb', metalness: 1, roughness: 0.20,
      clearcoat: 0.45, clearcoatRoughness: 0.2, envMapIntensity: 1.3,
    });
    const graphite = new THREE.MeshPhysicalMaterial({
      color: '#3a4655', metalness: 0.96, roughness: 0.27,
      clearcoat: 0.25, clearcoatRoughness: 0.23, envMapIntensity: 1.2,
    });
    const chrome = new THREE.MeshPhysicalMaterial({
      color: PALETTES[0].main, metalness: 0.92, roughness: 0.2,
      clearcoat: 0.65, clearcoatRoughness: 0.16, envMapIntensity: 1.35,
      emissive: PALETTES[0].deep, emissiveIntensity: 0.12,
    });
    const colorSide = new THREE.MeshPhysicalMaterial({
      color: PALETTES[0].deep, metalness: 0.93, roughness: 0.24,
      clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.2,
    });
    [silver, graphite, chrome, colorSide].forEach(item => resources.add(item));

    const explodeVectors = [
      new THREE.Vector3(-0.035, 0.02, -0.055),
      new THREE.Vector3(-0.025, -0.015, 0.025),
      new THREE.Vector3(0.015, 0.025, 0.07),
      new THREE.Vector3(0.015, 0.025, 0.07),
    ];
    const explodeRotations = [
      new THREE.Vector3(-0.006, -0.01, 0),
      new THREE.Vector3(0.008, -0.006, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ];
    const parts = makeBrandShapes().map((shape, index) => {
      const depth = 0.48;
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth, steps: 1, bevelEnabled: true, bevelThickness: 0.045,
        bevelSize: 0.025, bevelSegments: 4, curveSegments: 48,
      });
      geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      resources.add(geometry);
      const group = new THREE.Group();
      const home = new THREE.Vector3(center.x, center.y, index < 2 ? index * 0.02 : 0.05);
      group.position.copy(home);
      const mesh = new THREE.Mesh(geometry, index < 2 ? [silver, graphite] : [chrome, colorSide]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      sculpture.add(group);
      return { group, home, center, depth, explode: explodeVectors[index], tilt: explodeRotations[index] };
    });

    // Two quiet machining scores, cut along the long ascending face. They stay
    // attached to their own component throughout the mechanical assembly.
    const scoredBlade = parts[3];
    const scoreZ = scoredBlade.depth / 2 + 0.039;
    const scores = [
      frontLine([[820, 403], [920, 350], [1055, 292]], scoreZ, '#c5e9ff', 0.21),
      frontLine([[839, 418], [930, 365], [1034, 311]], scoreZ, '#020711', 0.5),
    ];
    for (const line of scores) {
      line.position.set(-scoredBlade.center.x, -scoredBlade.center.y, 0);
      scoredBlade.group.add(line);
      resources.add(line.geometry);
      resources.add(line.material);
    }

    scene.add(new THREE.HemisphereLight('#dceaff', '#151c28', 1.15));
    const key = new THREE.DirectionalLight('#ffffff', 3.5);
    key.position.set(-3, 6, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#d9e8ff', 0.7);
    fill.position.set(4, -2, 5);
    scene.add(fill);
    const rim = new THREE.PointLight(PALETTES[0].light, 38, 17, 2);
    rim.position.set(5, 0.5, 1.5);
    scene.add(rim);
    const lowerRim = new THREE.PointLight(PALETTES[0].main, 19, 14, 2);
    lowerRim.position.set(-3, -3, 0.8);
    scene.add(lowerRim);

    const color = new THREE.Color();
    const lightColor = new THREE.Color();
    const deepColor = new THREE.Color();
    const whiteColor = new THREE.Color('#ffffff');
    const paletteColors = PALETTES.map(item => ({
      main: new THREE.Color(item.main), light: new THREE.Color(item.light), deep: new THREE.Color(item.deep),
    }));
    const composition = { x: 0, y: 0, scale: 1 };

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(bounds.width));
      const nextHeight = Math.max(1, Math.round(bounds.height));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      narrow = width < 760;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const worldHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const worldWidth = worldHeight * camera.aspect;
      composition.scale = narrow ? Math.min(0.94, worldWidth * 0.86 / 5.6) : Math.min(1.22, worldWidth * 0.46 / 5.6);
      composition.x = narrow ? 0 : worldWidth * 0.23;
      composition.y = narrow ? worldHeight * 0.28 : worldHeight * 0.025;
      sculpture.scale.setScalar(composition.scale);
      key.shadow.mapSize.set(narrow ? 512 : 1024, narrow ? 512 : 1024);
      key.shadow.needsUpdate = true;
    }

    function updateScene(dt) {
      // A critically damped physical response: mass 1, stiffness 100, damping 20.
      if (dt > 0) {
        const stepCount = Math.max(1, Math.ceil(dt / 0.016));
        const step = dt / stepCount;
        for (let i = 0; i < stepCount; i += 1) {
          pointer.vx += ((pointer.targetX - pointer.x) * 100 - pointer.vx * 20) * step;
          pointer.vy += ((pointer.targetY - pointer.y) * 100 - pointer.vy * 20) * step;
          pointer.x += pointer.vx * step;
          pointer.y += pointer.vy * step;
        }
        scrollPosition = THREE.MathUtils.damp(scrollPosition, scrollTarget, 4, dt);
      }

      const phase = elapsed % 18;
      const breathing = Math.sin(elapsed * Math.PI * 2 / 12);
      sculpture.position.set(
        composition.x + pointer.x * 0.07,
        composition.y + breathing * 0.035 - scrollPosition * 0.22,
        0,
      );
      sculpture.rotation.set(
        0.15 + pointer.y * 0.075 + Math.sin(elapsed * Math.PI * 2 / 18) * 0.018,
        -0.46 + pointer.x * 0.12 + Math.sin(elapsed * Math.PI * 2 / 16) * 0.055 + scrollPosition * 0.13,
        -0.035 + Math.sin(elapsed * Math.PI * 2 / 18) * 0.015,
      );
      sculpture.scale.setScalar(composition.scale * (1 - scrollPosition * 0.035));

      parts.forEach((part, index) => {
        const stage = Math.min(index, 2);
        const opening = assemblyEase((phase - 4.2 - stage * 0.18) / 1.7);
        const closing = assemblyEase((phase - 7.3 - stage * 0.13) / 2.1);
        const separation = opening * (1 - closing);
        part.group.position.copy(part.home).addScaledVector(part.explode, separation);
        part.group.rotation.set(part.tilt.x * separation, part.tilt.y * separation, part.tilt.z * separation);
      });

      // Each colour owns six seconds, with a two-second cinematic light change.
      const state = Math.floor(elapsed / 8) % 3;
      const next = (state + 1) % 3;
      const transition = assemblyEase(((elapsed % 8) - 6) / 2);
      color.copy(paletteColors[state].main).lerp(paletteColors[next].main, transition);
      lightColor.copy(paletteColors[state].light).lerp(paletteColors[next].light, transition);
      deepColor.copy(paletteColors[state].deep).lerp(paletteColors[next].deep, transition);
      chrome.color.copy(color);
      chrome.emissive.copy(deepColor);
      colorSide.color.copy(deepColor);
      rim.color.copy(lightColor);
      lowerRim.color.copy(color);
      scores[0].material.color.copy(lightColor).lerp(whiteColor, 0.55);
    }

    function draw() {
      if (destroyed || contextLost) return;
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        hero.classList.add('scene-ready');
      }
    }

    function frame(time) {
      animationFrame = 0;
      if (paused || destroyed || contextLost) return;
      const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      elapsed += dt;
      updateScene(dt);
      draw();
      animationFrame = window.requestAnimationFrame(frame);
    }

    function pointerMove(event) {
      if (paused || destroyed || contextLost || !finePointer.matches || event.pointerType === 'touch') return;
      const bounds = hero.getBoundingClientRect();
      pointer.targetX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
      pointer.targetY = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
    }

    function pointerLeave() {
      if (paused) return;
      pointer.targetX = 0;
      pointer.targetY = 0;
    }

    function scroll() {
      if (paused || destroyed) return;
      const bounds = hero.getBoundingClientRect();
      scrollTarget = clamp(-bounds.top / Math.max(bounds.height, 1), 0, 1);
    }

    function resized() {
      if (destroyed || contextLost) return;
      resize();
      updateScene(0);
      if (paused) draw();
    }

    function lost(event) {
      event.preventDefault();
      contextLost = true;
      previousTime = null;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      ready = false;
      hero.classList.remove('scene-ready');
    }

    function restored() {
      if (destroyed) return;
      contextLost = false;
      try {
        environmentTarget.dispose();
        environmentTarget = makeEnvironment(renderer);
        scene.environment = environmentTarget.texture;
        resize();
        updateScene(0);
        draw();
        if (!paused) animationFrame = window.requestAnimationFrame(frame);
      } catch {
        contextLost = true;
        hero.classList.remove('scene-ready');
      }
    }

    hero.addEventListener('pointermove', pointerMove, { passive: true });
    hero.addEventListener('pointerleave', pointerLeave, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', resized, { passive: true });
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    removeListeners = () => {
      hero.removeEventListener('pointermove', pointerMove);
      hero.removeEventListener('pointerleave', pointerLeave);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', resized);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resized);
      resizeObserver.observe(canvas);
    }

    resize();
    scroll();
    updateScene(0);
    draw();
    animationFrame = window.requestAnimationFrame(frame);

    return {
      setPaused(value) {
        if (destroyed) return;
        const next = Boolean(value);
        if (next === paused) return;
        paused = next;
        previousTime = null;
        if (paused) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        } else if (!contextLost) {
          resize();
          scroll();
          animationFrame = window.requestAnimationFrame(frame);
        }
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        removeListeners();
        hero.classList.remove('scene-ready');
        for (const resource of resources) resource.dispose();
        key.shadow.dispose();
        environmentTarget.dispose();
        renderer.dispose();
      },
    };
  } catch (error) {
    window.cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    removeListeners();
    for (const resource of resources) resource.dispose();
    environmentTarget?.dispose();
    renderer?.dispose();
    hero.classList.remove('scene-ready');
    console.warn('The hero uses its static brand fallback because WebGL is unavailable.', error);
    return null;
  }
}
