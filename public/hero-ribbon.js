// A single folded surface: the brand's rising gesture, expressed as material and light.
const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec3 aCenter;
in vec3 aTangent;
in vec2 aUv;
in float aWidth;
uniform float uTime;
uniform float uNarrow;
uniform float uAspect;
uniform float uPass;
out vec3 vPosition;
out vec3 vTangent;
out vec2 vUv;
const float TAU = 6.28318530718;
void main() {
  float s = aUv.x;
  float across = aUv.y * mix(1.2, 1.0, uPass);
  vec3 tangent = normalize(aTangent);
  vec3 side = normalize(vec3(-tangent.y, tangent.x, 0.0));
  vec3 back = normalize(cross(tangent, side));
  // Three deliberate changes of plane rather than a uniformly twisted tube.
  float fold = 0.18 + 0.95 * smoothstep(0.20, 0.35, s)
    - 1.9 * smoothstep(0.48, 0.58, s)
    + 2.2 * smoothstep(0.67, 0.78, s);
  fold += 0.23 * sin(uTime * TAU / 24.0 + s * 8.0)
    + 0.08 * sin(uTime * TAU / 12.0 - s * 13.0);
  vec3 acrossDirection = side * cos(fold) + back * sin(fold);
  vec3 faceDirection = normalize(cross(tangent, acrossDirection));
  float width = aWidth * mix(1.0, 1.55, uNarrow);
  // The shallow central crease gives each broad face its own reflection.
  float crease = max(0.0, 1.0 - abs(across)) * width * 0.19;
  vec3 position = aCenter + acrossDirection * across * width + faceDirection * crease;
  float breathing = sin(uTime * TAU / 24.0 + s * 7.0);
  position.xy += vec2(0.026 * breathing, 0.035 * sin(uTime * TAU / 24.0 + s * 9.0));
  position.z += 0.045 * breathing;
  position.x += mix(0.66, -0.65, uNarrow);
  position.y += mix(0.0, -0.04, uNarrow);
  float perspective = 5.2 / (5.2 - position.z);
  gl_Position = vec4(position.x * perspective / (1.88 * uAspect),
    position.y * perspective / 1.88, -position.z / 3.0, 1.0);
  vPosition = position;
  vTangent = tangent;
  vUv = aUv;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uPass;
in vec3 vPosition;
in vec3 vTangent;
in vec2 vUv;
out vec4 outColor;
const float TAU = 6.28318530718;
// The six chromatic values are the actual SVG brand palette.
const vec3 BLUE = vec3(0.0, 148.0, 255.0) / 255.0;
const vec3 BLUE_LIGHT = vec3(87.0, 227.0, 255.0) / 255.0;
const vec3 LIME = vec3(140.0, 233.0, 0.0) / 255.0;
const vec3 LIME_LIGHT = vec3(209.0, 255.0, 80.0) / 255.0;
const vec3 ORANGE = vec3(255.0, 105.0, 11.0) / 255.0;
const vec3 ORANGE_LIGHT = vec3(255.0, 202.0, 82.0) / 255.0;
float spot(float value, float center, float spread) {
  float distance = (value - center) / spread;
  return exp(-distance * distance);
}
void main() {
  float s = vUv.x;
  float edgeDistance = abs(vUv.y);
  float blueSpot = spot(s, 0.59 + 0.075 * sin(uTime * TAU / 24.0), 0.23);
  float limeSpot = spot(s, 0.24 + 0.055 * sin(uTime * TAU / 24.0 + 2.0), 0.16);
  float orangeSpot = spot(s, 0.87 + 0.035 * cos(uTime * TAU / 24.0), 0.15);
  vec3 reflectedColour = BLUE * (0.08 + blueSpot * 0.95)
    + LIME * limeSpot * 0.55 + ORANGE * orangeSpot * 0.88;
  vec3 rimColour = mix(BLUE, BLUE_LIGHT, 0.7) * (0.04 + blueSpot * 0.95)
    + mix(LIME, LIME_LIGHT, 0.55) * limeSpot * 0.72
    + mix(ORANGE, ORANGE_LIGHT, 0.35) * orangeSpot * 1.08;
  if (uPass < 0.5) {
    float halo = spot(edgeDistance, 0.81, 0.13)
      * (1.0 - smoothstep(0.80, 1.0, edgeDistance));
    outColor = vec4(rimColour, halo * 0.12);
    return;
  }
  vec3 normal = normalize(cross(dFdx(vPosition), dFdy(vPosition)));
  vec3 view = normalize(vec3(0.0, 0.0, 5.2) - vPosition);
  if (dot(normal, view) < 0.0) normal = -normal;
  vec3 reflectedView = reflect(-view, normal);
  vec3 keyLight = normalize(vec3(-0.45 + 0.14 * sin(uTime * TAU / 24.0), 0.55, 1.1));
  vec3 softLight = normalize(vec3(0.7, -0.45, 0.7));
  float diffuse = 0.4 + 0.6 * max(dot(normal, keyLight), 0.0);
  float broadReflection = pow(max(dot(reflectedView, keyLight), 0.0), 9.0);
  float whiteReflection = pow(max(dot(reflectedView, keyLight), 0.0), 75.0);
  float underReflection = pow(max(dot(reflectedView, softLight), 0.0), 14.0);
  vec3 halfVector = normalize(view + keyLight);
  float silk = pow(max(1.0 - abs(dot(normalize(vTangent), halfVector)), 0.0), 25.0)
    * pow(max(dot(normal, halfVector), 0.0), 8.0);
  float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 2.7);
  // Derivative attenuation keeps the fine longitudinal threads quiet at small sizes.
  float threadCoordinate = (vUv.y * 0.5 + 0.5) * 48.0;
  float threadAA = max(fwidth(threadCoordinate), 0.025);
  float threadDistance = abs(fract(threadCoordinate - 0.5) - 0.5);
  float resolvedThread = 1.0 - smoothstep(0.24 - threadAA, 0.24 + threadAA, threadDistance);
  float thread = mix(0.48, resolvedThread, 1.0 - smoothstep(0.4, 1.0, threadAA));
  float coverage = mix(0.12, 0.98, thread);
  float rim = pow(edgeDistance, 28.0);
  float innerCrease = exp(-abs(vUv.y) * 100.0);
  float travelingLight = pow(0.5 + 0.5 * cos(s * TAU - uTime * TAU / 8.0), 12.0);
  vec3 titanium = vec3(0.065, 0.085, 0.115) * diffuse;
  vec3 colour = titanium + reflectedColour * (0.10 + broadReflection * 0.46 + silk * 0.2)
    + rimColour * underReflection * 0.16;
  colour += vec3(0.91, 0.95, 1.0) * (whiteReflection * 0.81 + silk * 0.13);
  colour += rimColour * (rim * (0.48 + travelingLight * 0.42)
    + innerCrease * 0.15 + fresnel * 0.13);
  colour += (rimColour * 0.62 + vec3(0.08)) * thread * (0.8 + broadReflection + travelingLight * 0.7);
  outColor = vec4(colour, coverage);
}`;

const CONTROL_POINTS = [
  [-4.4, -1.15, 0.1], [-2.3, -1.55, 0.2], [-0.4, -1.35, 0.1],
  [1.1, -0.75, 0.2], [2.0, -0.1, 0.0], [1.3, 0.3, 0.5],
  [1.1, 0.8, 0.6], [2.25, 1.45, 0.2], [3.0, 1.75, -0.2]
];

function pointOnRibbon(progress) {
  const scaled = Math.max(0, Math.min(1, progress)) * (CONTROL_POINTS.length - 1);
  const index = Math.min(CONTROL_POINTS.length - 2, Math.floor(scaled));
  const t = scaled - index;
  const p0 = CONTROL_POINTS[Math.max(0, index - 1)];
  const p1 = CONTROL_POINTS[index];
  const p2 = CONTROL_POINTS[index + 1];
  const p3 = CONTROL_POINTS[Math.min(CONTROL_POINTS.length - 1, index + 2)];
  return p1.map((value, axis) => 0.5 * (
    2 * value + (-p0[axis] + p2[axis]) * t
    + (2 * p0[axis] - 5 * value + 4 * p2[axis] - p3[axis]) * t * t
    + (-p0[axis] + 3 * value - 3 * p2[axis] + p3[axis]) * t * t * t
  ));
}

function createMesh() {
  const lengthSegments = 360;
  const widthSegments = 32;
  const vertices = [];
  const indices = [];
  for (let along = 0; along <= lengthSegments; along += 1) {
    const progress = along / lengthSegments;
    const center = pointOnRibbon(progress);
    const before = pointOnRibbon(progress - 0.001);
    const after = pointOnRibbon(progress + 0.001);
    const tangent = after.map((value, axis) => value - before[axis]);
    const tangentLength = Math.hypot(...tangent) || 1;
    const taper = Math.min(1, progress / 0.075, (1 - progress) / 0.09);
    const width = (0.19 + 0.115 * Math.sin(progress * Math.PI)
      + 0.035 * Math.exp(-Math.pow((progress - 0.64) / 0.1, 2))) * Math.max(0.008, taper);
    for (let across = 0; across <= widthSegments; across += 1) {
      vertices.push(...center, ...tangent.map(value => value / tangentLength),
        progress, across / widthSegments * 2 - 1, width);
      if (along < lengthSegments && across < widthSegments) {
        const start = along * (widthSegments + 1) + across;
        const next = start + widthSegments + 1;
        indices.push(start, next, start + 1, start + 1, next, next + 1);
      }
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

/** Returns null when the static SVG should remain the active presentation. */
export function createHeroRibbon(canvas) {
  if (!canvas?.getContext) return null;
  let gl;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true, antialias: true, depth: true, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power'
    });
  } catch { return null; }
  if (!gl) return null;

  const parent = canvas.parentElement;
  const mesh = createMesh();
  let resources;
  let destroyed = false;
  let contextLost = false;
  let paused = false;
  let frame = 0;
  let previousTime = null;
  let elapsed = 5.8;
  let width = 0;
  let height = 0;
  let narrow = false;

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Ribbon shader unavailable');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Ribbon shader could not compile');
    }
    return shader;
  }

  function releaseResources() {
    if (!resources) return;
    gl.deleteBuffer(resources.vertexBuffer);
    gl.deleteBuffer(resources.indexBuffer);
    gl.deleteVertexArray(resources.vertexArray);
    gl.deleteProgram(resources.program);
    resources = null;
  }

  function initializeResources() {
    let vertexShader;
    let fragmentShader;
    let program;
    try {
      vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      fragmentShader = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error('Ribbon program unavailable');
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Ribbon program could not link');
    } catch (error) {
      if (program) gl.deleteProgram(program);
      throw error;
    } finally {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
    }
    const vertexArray = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexArray || !vertexBuffer || !indexBuffer) {
      if (vertexArray) gl.deleteVertexArray(vertexArray);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      if (indexBuffer) gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
      throw new Error('Ribbon geometry unavailable');
    }
    resources = {
      program, vertexArray, vertexBuffer, indexBuffer,
      time: gl.getUniformLocation(program, 'uTime'),
      narrow: gl.getUniformLocation(program, 'uNarrow'),
      aspect: gl.getUniformLocation(program, 'uAspect'),
      pass: gl.getUniformLocation(program, 'uPass')
    };
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    const stride = 9 * Float32Array.BYTES_PER_ELEMENT;
    for (const [name, size, offset] of [['aCenter', 3, 0], ['aTangent', 3, 3], ['aUv', 2, 6], ['aWidth', 1, 8]]) {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) continue;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * Float32Array.BYTES_PER_ELEMENT);
    }
    gl.bindVertexArray(null);
  }

  function draw() {
    if (destroyed || contextLost || !resources || !width || !height) return false;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(resources.program);
    gl.bindVertexArray(resources.vertexArray);
    gl.uniform1f(resources.time, elapsed);
    gl.uniform1f(resources.narrow, narrow ? 1 : 0);
    gl.uniform1f(resources.aspect, width / height);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(resources.pass, 0);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.uniform1f(resources.pass, 1);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    parent?.classList.add('ribbon-ready');
    return true;
  }

  function resize() {
    if (destroyed || contextLost) return;
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    narrow = width <= 760;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5);
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    draw();
  }

  function tick(timestamp) {
    frame = 0;
    if (destroyed || contextLost || paused) return;
    if (previousTime !== null) elapsed += Math.min((timestamp - previousTime) / 1000, 0.05);
    previousTime = timestamp;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function stopFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
  }

  function setPaused(value) {
    if (destroyed) return;
    paused = Boolean(value);
    if (paused) stopFrame();
    else if (!frame && !contextLost) frame = requestAnimationFrame(tick);
  }

  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    stopFrame();
    parent?.classList.remove('ribbon-ready');
    resources = null;
  }

  function onContextRestored() {
    if (destroyed) return;
    contextLost = false;
    try {
      initializeResources();
      resize();
      if (!paused && !frame) frame = requestAnimationFrame(tick);
    } catch {
      releaseResources();
      contextLost = true;
      parent?.classList.remove('ribbon-ready');
    }
  }

  try {
    initializeResources();
    resize();
    if (gl.getError() !== gl.NO_ERROR) throw new Error('Ribbon first frame unavailable');
  } catch {
    releaseResources();
    parent?.classList.remove('ribbon-ready');
    return null;
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  frame = requestAnimationFrame(tick);

  return {
    setPaused,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopFrame();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (!contextLost) releaseResources();
      parent?.classList.remove('ribbon-ready');
    }
  };
}
