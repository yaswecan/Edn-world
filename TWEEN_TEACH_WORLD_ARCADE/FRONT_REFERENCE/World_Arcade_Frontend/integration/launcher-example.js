/**
 * EXAMPLE ONLY — intentionally not included by index.html.
 * Install after inspecting and supplying the actual same-origin game routes.
 * Do not pass arbitrary user-controlled URLs into this mapping.
 */
function installWorldArcadeLauncher(routes) {
  if (!routes || typeof routes !== 'object') {
    throw new TypeError('A mapping of game ids to real application routes is required.');
  }
  const allowedIds = new Set(['code-station', 'cyber-funk']);
  const handler = (event) => {
    const id = event.detail && event.detail.gameId;
    if (!allowedIds.has(id) || !routes[id]) return; // Keep standalone demo fallback.
    const target = new URL(routes[id], window.location.href);
    if (target.origin !== window.location.origin || !['http:', 'https:'].includes(target.protocol)) {
      event.preventDefault();
      window.WorldArcade.notify('Ce monde ne peut pas être ouvert depuis cette adresse.');
      return;
    }
    // Permission checks and saved progress belong to the host application/server.
    event.preventDefault();
    window.location.assign(target.href);
  };
  window.addEventListener('worldarcade:launch', handler);
  return () => window.removeEventListener('worldarcade:launch', handler);
}

// Call with VERIFIED routes from your actual repository, for example:
// const uninstall = installWorldArcadeLauncher(actualGameRoutes);
