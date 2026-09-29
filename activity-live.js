/* Shared live refresh for activity tables in both roles. */
for (const name of ['Review', 'Jam', 'Khatma']) {
  const module = window[name];
  if (!module || !window.LiveData) continue;
  const mount = module.mount.bind(module), logout = module.logout?.bind(module);
  let context, watch, key, pending = false;
  const editing = () => document.querySelector('dialog[open]') ||
    (document.activeElement?.matches('input,select,textarea') &&
     document.activeElement.closest('.review-panel,.jam-panel,.khatma-panel'));
  const refresh = () => {
    if (!context) return;
    if (editing()) { pending = true; return; }
    pending = false;
    const visibility = [...context.host.children].map(node => [node, node.hidden]);
    const navigation = [...context.host.querySelectorAll('.jam-navigation button')].map(node => [node, node.getAttribute('aria-pressed')]);
    mount(context);
    for (const [node, hidden] of visibility) node.hidden = hidden;
    for (const [node, pressed] of navigation) if (pressed !== null) node.setAttribute('aria-pressed', pressed);
  };
  document.addEventListener('focusout', () => { if (pending) setTimeout(refresh, 0); });
  document.addEventListener('close', () => { if (pending) setTimeout(refresh, 0); }, true);
  module.mount = next => {
    context = next;
    mount(next);
    const nextKey = JSON.stringify([next.storageId, next.name, next.role, next.local, next.ready]);
    if (key === nextKey) return;
    key = nextKey;
    watch?.stop();
    watch = null;
    if (next.ready !== false && !next.local) watch = LiveData.watch({
      urls: () => [context?.firebaseUrl?.()].filter(Boolean), change: refresh
    });
  };
  module.logout = () => {
    watch?.stop(); watch = null; context = null; key = null; pending = false;
    logout?.();
  };
}
