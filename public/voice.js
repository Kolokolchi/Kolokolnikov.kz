// Short sounds that answer a click: the cat's meows (cat-meow.js) and the «спасибо» on «Связаться»
// (contact-voice.js). Every voice on the page shares one audio context.
const webAudio = typeof window.AudioContext === 'function' && typeof window.OfflineAudioContext === 'function';

let context;
let sleepTimer;
let primer;
let voiceCount = 0;

// Opening the audio device takes ~0.2 s the first time. That happens at the visitor's first click,
// tap or key press anywhere on the page (silently), so the first sound is as quick as the rest.
// After a quiet minute the context sleeps; the next sound wakes it inside its own click.
function wake() {
  if (!context) {
    context = new AudioContext({ latencyHint: 'interactive' });
    primer?.abort();
  }
  window.clearTimeout(sleepTimer);
  sleepTimer = window.setTimeout(() => { if (context?.state === 'running') context.suspend().catch(() => {}); }, 60000);
  return context;
}

function prime(event) {
  if (context || !event.isTrusted) return;
  // Only inside a real activation, so the context is allowed to start and the browser logs no warning.
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  wake();
}

function join() {
  voiceCount++;
  if (!webAudio || context || primer) return;
  primer = new AbortController();
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(type, prime, { capture: true, passive: true, signal: primer.signal });
  }
}

function leave() {
  if (--voiceCount > 0) return;
  primer?.abort();
  primer = undefined;
  window.clearTimeout(sleepTimer);
  context?.close().catch(() => {});
  context = undefined;
}

// Start 15 ms before a recording gets loud, so no quiet lead-in delays the sound.
function onsetOf(buffer) {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let index = 0; index < data.length; index++) peak = Math.max(peak, Math.abs(data[index]));
  let index = 0;
  while (index < data.length && Math.abs(data[index]) < peak * .08) index++;
  return Math.max(0, index / buffer.sampleRate - .015);
}

// Plays one of `recordings` per call: a shuffled bag, so none repeats until all have played.
export function createVoice(recordings, { volume = .6, className } = {}) {
  // Used only until the recordings are decoded, or where Web Audio is missing.
  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.volume = volume;
  audio.setAttribute('aria-hidden', 'true');
  if (className) audio.className = className;
  const clips = [];
  let gain;
  let source;
  let loading;
  let idleHandle;
  let destroyed = false;
  let remaining = [];
  let previous = -1;
  join();

  // The files are fetched and decoded ahead of the first tap: a tap then only starts a decoded
  // buffer, so the sound begins with the click instead of after a network round trip.
  // Nothing plays here; audio still starts only on deliberate activation.
  function warm() {
    if (loading || destroyed || !webAudio) return;
    const decoder = new OfflineAudioContext(1, 1, 44100);
    loading = Promise.all(recordings.map((url, index) => fetch(url)
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status))))
      .then(data => decoder.decodeAudioData(data))
      .then(buffer => { clips[index] = { buffer, offset: onsetOf(buffer) }; })
      .catch(() => {})));
  }
  if (webAudio) {
    idleHandle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 3000 })
      : window.setTimeout(warm, 1200);
  }

  function stop() {
    if (source) {
      try { source.stop(); } catch {}
      source.disconnect();
      source = null;
    }
    audio.pause();
    if (audio.readyState) audio.currentTime = 0;
  }

  function play() {
    if (destroyed) return;
    if (!remaining.length) {
      remaining = recordings.map((_, index) => index);
      for (let index = remaining.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [remaining[index], remaining[other]] = [remaining[other], remaining[index]];
      }
      // The first sound of a new set differs from the previous set's last one.
      if (remaining.length > 1 && remaining[0] === previous) [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
    }
    // A rapid second tap replaces the current sound instead of layering audio.
    stop();
    previous = remaining.shift();
    audio.dataset.clip = String(previous + 1);
    const clip = clips[previous];
    if (clip) {
      // Resumed inside the click/keyboard event, so browsers let it start, including on touch.
      const output = wake();
      if (output.state !== 'running') output.resume().catch(() => {});
      if (gain?.context !== output) {
        gain = output.createGain();
        gain.gain.value = volume;
        gain.connect(output.destination);
      }
      source = output.createBufferSource();
      source.buffer = clip.buffer;
      source.connect(gain);
      source.start(0, clip.offset);
      return;
    }
    warm();
    audio.src = recordings[previous];
    audio.play().catch(() => {});
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (idleHandle !== undefined) {
      if (window.cancelIdleCallback && window.requestIdleCallback) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    }
    stop();
    gain?.disconnect();
    gain = null;
    clips.length = 0;
    audio.removeAttribute('src');
    audio.load();
    audio.remove();
    leave();
  }

  return { audio, play, stop, destroy };
}
