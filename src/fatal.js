// A full-screen message for when the game can't start. Always offers a way forward.
export function showFatal() {
  if (document.getElementById('fatal')) return;
  const el = document.createElement('section');
  el.id = 'fatal'; el.className = 'modal'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-labelledby', 'fatalTitle');
  el.innerHTML = '<div class="card"><h3 id="fatalTitle">Well, that’s embarrassing</h3>'
    + '<p class="card-sub">The game hit a problem while starting. For once, it isn’t a trap. Reloading usually fixes it.</p>'
    + '<button class="btn" id="fatalReload">Reload</button></div>';
  document.body.appendChild(el);
  document.getElementById('fatalReload').onclick = () => location.reload();
}
