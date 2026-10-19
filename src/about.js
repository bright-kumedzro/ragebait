import './analytics.js';

// About page: the public play counts from /api/stats. The panel stays hidden if they can't load.
const stats = document.getElementById('stats');
fetch('./api/stats').then(r => (r.ok ? r.json() : Promise.reject())).then(s => {
  const num = new Intl.NumberFormat('en-GB');
  for (const b of stats.querySelectorAll('[data-k]')) b.textContent = num.format(s[b.dataset.k] || 0);
  const since = s.since && new Date(`${s.since}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  document.getElementById('statsNote').innerHTML = `Anonymous counts${since ? ` since ${since}` : ''}. Players are devices that have opened the game; this week starts on Monday. <a href="./privacy#counts">How we count</a>`;
  stats.hidden = false;
}).catch(() => {});
