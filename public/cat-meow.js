import { createVoice } from './voice.js';

// Five real-cat CC0 recordings. See assets/cat/audio/ATTRIBUTION.txt.
const recordings = Array.from({ length: 5 }, (_, index) =>
  new URL(`./assets/cat/audio/meow-${index + 1}.mp3`, import.meta.url).href
);

export function createCatVoice() {
  return createVoice(recordings, { volume: .6, className: 'scroll-cat__audio' });
}
