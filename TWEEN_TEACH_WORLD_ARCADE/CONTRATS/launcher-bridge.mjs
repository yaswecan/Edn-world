/**
 * Pont facultatif pour le front HTML de référence.
 * Aucun branchement automatique : à installer explicitement dans le module hôte.
 * NE FOURNIT PAS d'authentification, de contrôle d'accès serveur ou de validation de score.
 * Les callbacks doivent adapter des opérations hôtes inspectées et des routes autorisées.
 */
const GAME_IDS = new Set(['code-station', 'cyber-funk']);

/**
 * @param {object} options
 * @param {EventTarget} options.eventTarget Généralement window dans le module monté.
 * @param {string} options.origin Origine réelle de l'application (pas un champ utilisateur).
 * @param {(gameId:string, signal:AbortSignal)=>Promise<object>} options.resolveLaunch
 * @param {(gameId:string, target:URL)=>boolean} options.isAllowedRoute Liste blanche hôte explicite.
 * @param {(destination:string)=>void|Promise<void>} options.navigate Routeur existant.
 * @param {(message:string)=>void} options.notify Texte court, sans dump d'erreur.
 * @param {(gameId:string)=>void|Promise<void>} options.onAuthRequired
 * @param {(gameId:string)=>void|Promise<void>} options.onVerificationRequired
 * @returns {()=>void} Fonction de démontage, à appeler au départ du module.
 */
export function installLauncherBridge(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Launcher options are required.');
  const { eventTarget, origin, resolveLaunch, isAllowedRoute, navigate, notify,
    onAuthRequired, onVerificationRequired } = options;
  if (!eventTarget || typeof eventTarget.addEventListener !== 'function' ||
      typeof eventTarget.removeEventListener !== 'function') {
    throw new TypeError('An EventTarget is required.');
  }
  for (const [name, value] of Object.entries({ resolveLaunch, isAllowedRoute, navigate,
    notify, onAuthRequired, onVerificationRequired })) {
    if (typeof value !== 'function') throw new TypeError(`${name} must be a function.`);
  }
  let base;
  try { base = new URL(origin); } catch { throw new TypeError('A valid application origin is required.'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      base.pathname !== '/' || base.search || base.hash) {
    throw new TypeError('Use the application HTTP(S) origin, without a path, query or credentials.');
  }
  let disposed = false;
  let busy = false;
  let controller = null;

  const fail = () => notify('Le jeu n’a pas pu s’ouvrir. Réessaie.');
  const handler = (event) => {
    // Mandatory BEFORE any await: prevent the original script from launching its Canvas demo.
    event.preventDefault();
    if (disposed || busy) return;
    if (!event.cancelable) {
      notify('Le lancement ne peut pas être pris en charge depuis cet écran.');
      return;
    }
    const gameId = event.detail?.gameId;
    if (!GAME_IDS.has(gameId)) {
      notify('Ce monde n’est pas disponible pour le moment.');
      return;
    }
    busy = true;
    controller = new AbortController();
    const signal = controller.signal;

    void (async () => {
      try {
        const decision = await resolveLaunch(gameId, signal);
        if (disposed || signal.aborted) return;
        if (!decision || typeof decision.kind !== 'string') throw new Error('Invalid launch response.');
        switch (decision.kind) {
          case 'auth_required':
            await onAuthRequired(gameId);
            return;
          case 'verification_required':
            await onVerificationRequired(gameId);
            return;
          case 'locked':
            // Deliberately do not display arbitrary server/debug text from decision.hint here.
            notify('Ce monde n’est pas encore accessible.');
            return;
          case 'unavailable':
            notify('Ce monde n’est pas disponible pour le moment.');
            return;
          case 'ready': {
            if (typeof decision.destination !== 'string') throw new Error('Missing destination.');
            const target = new URL(decision.destination, base.origin);
            if (target.origin !== base.origin || !['http:', 'https:'].includes(target.protocol) ||
                target.username || target.password || isAllowedRoute(gameId, target) !== true) {
              throw new Error('Destination is outside the host allowlist.');
            }
            if (disposed || signal.aborted) return;
            await navigate(target.pathname + target.search + target.hash);
            return;
          }
          default:
            throw new Error('Unsupported launch response.');
        }
      } catch {
        // No raw error/log payload and, crucially, NO fallback to the demo.
        if (!disposed && !signal.aborted) fail();
      } finally {
        busy = false;
        controller = null;
      }
    })();
  };

  eventTarget.addEventListener('worldarcade:launch', handler);
  return () => {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    eventTarget.removeEventListener('worldarcade:launch', handler);
  };
}
