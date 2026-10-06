import {fail} from './store.mjs';

const quotaMessages = {
  credit_balance_exhausted: 'Crédits API OpenAI épuisés. Ajoutez des crédits dans la facturation du compte associé à la clé.',
  organization_spend_limit_exceeded: 'Plafond de dépenses OpenAI de l’organisation atteint. Vérifiez ce plafond dans OpenAI Platform.',
  project_spend_limit_exceeded: 'Plafond de dépenses OpenAI du projet atteint. Vérifiez le plafond du projet associé à la clé.',
  organization_usage_limit_exceeded: 'Limite d’utilisation OpenAI de l’organisation atteinte. Vérifiez vos limites dans OpenAI Platform et demandez une augmentation si nécessaire.',
  insufficient_quota: 'Quota API OpenAI insuffisant. Vérifiez les crédits, la facturation et les limites du projet associé à la clé dans OpenAI Platform.',
  usage_limit_exceeded: 'Limite d’utilisation API OpenAI atteinte. Vérifiez les crédits et les limites du projet et de l’organisation dans OpenAI Platform.'
};
const rateCodes = new Set(['rate_limit_exceeded', 'slow_down']);

function retryDelay(response) {
  const value = response.headers?.get('retry-after')?.trim();
  if (!value) return null;
  const seconds = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

// Never expose the raw provider message: it may contain credentials or input data.
export async function failOpenAI(response, {localDraftAvailable = false} = {}) {
  let error;
  try { error = (await response.json())?.error; } catch { /* Some upstream errors return HTML or an empty body. */ }
  const rawCode = typeof error?.code === 'string' ? error.code : null;
  const rawType = typeof error?.type === 'string' ? error.type : null;
  const knownCode = Object.hasOwn(quotaMessages, rawCode) || rateCodes.has(rawCode) ? rawCode : null;
  const knownType = ['insufficient_quota', 'rate_limit_error', 'rate_limit_exceeded'].includes(rawType) ? rawType : null;
  const details = {provider: 'openai', providerStatus: response.status, code: knownCode, type: knownType};
  const requestId = response.headers?.get('x-request-id');
  if (requestId && /^[A-Za-z0-9_-]{1,200}$/.test(requestId)) details.requestId = requestId;
  let message = `Génération OpenAI indisponible (${response.status}).`;
  if (response.status === 429) {
    // Specific codes take priority over the broader error type.
    const quotaCode = Object.hasOwn(quotaMessages, rawCode) ? rawCode : !rateCodes.has(rawCode) && rawType === 'insufficient_quota' ? 'insufficient_quota' : null;
    if (quotaCode) {
      message = quotaMessages[quotaCode];
      details.kind = 'quota';
    } else if (rateCodes.has(rawCode) || ['rate_limit_error', 'rate_limit_exceeded'].includes(rawType)) {
      const seconds = retryDelay(response);
      message = 'Limite temporaire de requêtes ou de tokens OpenAI atteinte. ' + (seconds === null ? 'Espacez les générations et réessayez plus tard.' : `Attendez au moins ${seconds} secondes avant de relancer une génération.`);
      details.kind = 'rate_limit';
      if (seconds !== null) details.retryAfterSeconds = seconds;
    } else {
      message = 'OpenAI a refusé la génération (429), sans préciser la cause. Vérifiez les crédits et les limites dans OpenAI Platform ; il peut aussi s’agir d’une limite temporaire de requêtes ou de tokens.';
      details.kind = 'unknown';
    }
  }
  if (localDraftAvailable) message += ' Le brouillon local peut être généré sans IA.';
  fail(502, message, details);
}
