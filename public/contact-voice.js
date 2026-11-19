import { createVoice } from './voice.js';

// «Ооо, спасибааа» in Korney's own voice when a visitor presses «Связаться».
// See assets/voice/SOURCE.txt.
const contactLinks = document.querySelectorAll('.nav-contact');

if (contactLinks.length) {
  const voice = createVoice([new URL('./assets/voice/contact-thanks.mp3', import.meta.url).href]);
  for (const link of contactLinks) {
    link.addEventListener('click', event => {
      // A modified click opens the link elsewhere; the thanks belongs to this page's jump to the contacts.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      voice.play();
    });
  }
  window.addEventListener('pagehide', event => { if (!event.persisted) voice.destroy(); });
}
