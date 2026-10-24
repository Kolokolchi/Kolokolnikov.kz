// Five real CC0 recordings. See assets/cat/audio/ATTRIBUTION.txt.
const recordings = Array.from({ length: 5 }, (_, index) =>
  new URL(`./assets/cat/audio/meow-${index + 1}.mp3`, import.meta.url).href
);

export function createCatVoice() {
  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.volume = .6;
  audio.setAttribute('aria-hidden', 'true');
  audio.className = 'scroll-cat__audio';
  let remaining = [];
  let previous = -1;

  function stop() {
    audio.pause();
    if (audio.readyState) audio.currentTime = 0;
  }

  function play() {
    if (!remaining.length) {
      remaining = recordings.map((_, index) => index);
      for (let index = remaining.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [remaining[index], remaining[other]] = [remaining[other], remaining[index]];
      }
      // The first sound of a new set differs from the previous set's last one.
      if (remaining[0] === previous) [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
    }
    stop();
    previous = remaining.shift();
    audio.src = recordings[previous];
    audio.dataset.meow = String(previous + 1);
    // Invoke play directly in the click/keyboard event, including the first tap.
    // A rapid second tap replaces the current sound instead of layering audio.
    audio.play().catch(() => {});
  }

  function destroy() {
    stop();
    audio.removeAttribute('src');
    audio.load();
    audio.remove();
  }

  return { audio, play, stop, destroy };
}
