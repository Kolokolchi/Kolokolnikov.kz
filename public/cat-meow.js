// Five real-cat CC0 recordings. See assets/cat/audio/ATTRIBUTION.txt.
const recordings = Array.from({ length: 5 }, (_, index) =>
  new URL(`./assets/cat/audio/meow-${index + 1}.mp3`, import.meta.url).href
);
const VOLUME = .6;

// Start 15 ms before a recording gets loud, so no quiet lead-in delays the meow.
function onsetOf(buffer) {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let index = 0; index < data.length; index++) peak = Math.max(peak, Math.abs(data[index]));
  let index = 0;
  while (index < data.length && Math.abs(data[index]) < peak * .08) index++;
  return Math.max(0, index / buffer.sampleRate - .015);
}

export function createCatVoice() {
  // Used only until the recordings are decoded, or where Web Audio is missing.
  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.volume = VOLUME;
  audio.setAttribute('aria-hidden', 'true');
  audio.className = 'scroll-cat__audio';
  const webAudio = typeof window.AudioContext === 'function' && typeof window.OfflineAudioContext === 'function';
  const voices = [];
  let context;
  let gain;
  let source;
  let loading;
  let idleHandle;
  let destroyed = false;
  let remaining = [];
  let previous = -1;

  // The five files (~65 KB) are fetched and decoded ahead of the first tap: a tap then only starts
  // a decoded buffer, so the sound begins with the click instead of after a network round trip.
  // Nothing plays here; audio still starts only on deliberate activation.
  function warm() {
    if (loading || destroyed || !webAudio) return;
    const decoder = new OfflineAudioContext(1, 1, 44100);
    loading = Promise.all(recordings.map((url, index) => fetch(url)
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status))))
      .then(data => decoder.decodeAudioData(data))
      .then(buffer => { voices[index] = { buffer, offset: onsetOf(buffer) }; })
      .catch(() => {})));
  }
  if (webAudio) {
    idleHandle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 3000 })
      : window.setTimeout(warm, 1200);
  }

  // Opening the audio device takes ~0.2 s the first time. That happens at the visitor's first click,
  // tap or key press anywhere on the page (silently), so the first meow is as quick as the rest.
  // After a quiet minute the context sleeps; the next meow wakes it inside its own click.
  const primer = new AbortController();
  let sleepTimer;
  function ensureContext() {
    if (!context) {
      context = new AudioContext({ latencyHint: 'interactive' });
      gain = context.createGain();
      gain.gain.value = VOLUME;
      gain.connect(context.destination);
      primer.abort();
    }
    window.clearTimeout(sleepTimer);
    sleepTimer = window.setTimeout(() => { if (context?.state === 'running') context.suspend().catch(() => {}); }, 60000);
    return context;
  }
  function prime(event) {
    if (context || destroyed || !event.isTrusted) return;
    // Only inside a real activation, so the context is allowed to start and the browser logs no warning.
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    ensureContext();
  }
  if (webAudio) {
    for (const type of ['pointerdown', 'keydown', 'touchend']) {
      window.addEventListener(type, prime, { capture: true, passive: true, signal: primer.signal });
    }
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
      if (remaining[0] === previous) [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
    }
    // A rapid second tap replaces the current sound instead of layering audio.
    stop();
    previous = remaining.shift();
    audio.dataset.meow = String(previous + 1);
    const voice = voices[previous];
    if (voice) {
      // Resumed inside the click/keyboard event, so browsers let it start, including on touch.
      ensureContext();
      if (context.state !== 'running') context.resume().catch(() => {});
      source = context.createBufferSource();
      source.buffer = voice.buffer;
      source.connect(gain);
      source.start(0, voice.offset);
      return;
    }
    warm();
    audio.src = recordings[previous];
    audio.play().catch(() => {});
  }

  function destroy() {
    destroyed = true;
    primer.abort();
    window.clearTimeout(sleepTimer);
    if (idleHandle !== undefined) {
      if (window.cancelIdleCallback && window.requestIdleCallback) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    }
    stop();
    context?.close().catch(() => {});
    context = null;
    voices.length = 0;
    audio.removeAttribute('src');
    audio.load();
    audio.remove();
  }

  return { audio, play, stop, destroy };
}
