import './style.css';
import './analytics.js';
import { showFatal } from './fatal.js';

// Any error while starting lands on a full-screen message instead of a blank page.
import('./game.js').then(m => m.boot()).catch(e => { console.error(e); showFatal(); });

// Offline support and home-screen install. Skipped in dev and when embedded in another page.
if ('serviceWorker' in navigator && !import.meta.env.DEV && window.self === window.top && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
