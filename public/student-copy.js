// Presentation only: keep grades, identifiers, timing and persistence contracts intact.
export const studentCopy = Object.freeze({
  login: 'Connexion', password: 'Mot de passe', signIn: 'Se connecter',
  empty: 'Aucune séance pour le moment.', save: 'Enregistrer', submit: 'Rendre mon travail',
  saved: 'Travail enregistré.', submitted: 'Travail envoyé.',
  localSaved: 'Enregistré sur cet appareil.',
  diagnosticGate: 'Rends ton travail avant de continuer. Tu peux rendre une réponse incomplète.',
});

const legacyTitles = new Map([
  ['Ateliers de remédiation', 'Entraînement'],
  ['Ateliers différenciés · une preuve par critère', 'Entraînement'],
  ['Maintenant, construis sans le modèle.', 'À toi de construire'],
  ['Ce que tu emportes aujourd’hui.', 'Bilan'],
]);
export const studentBlockTitle = b => b.type === 'Diagnostic' ? 'Évaluation'
  : b.type === 'Pause' ? 'Pause' : legacyTitles.get(b.title) || b.title;
// Old remediation bundles put group IDs and criterion codes in the transition.
// The actual exercises, instructions and evidence remain rendered below it.
export const studentBlockContent = b => /^G[0-3]\s*·\s*BC\w*-C\d/i.test(String(b.content).trim()) ? '' : b.content;

// Exact server-authored feedback only; teacher-written feedback is kept verbatim.
const feedbackLabels = new Map([
  ...['Fixture SQL invalide.', 'Table de test invalide.', 'Ligne invalide.', 'Tests SQL absents ou trop nombreux.', 'Test HTML non pris en charge.', 'Test CSS invalide.', 'Configuration ou taille non prise en charge.', 'Production ou tests non interprétables : relecture requise.'].map(text=>[text,'Les tests ne sont pas disponibles. Le professeur doit relire ton travail.']),
  ['Résultats comparés sur une base SQLite éphémère, sans accès à la base EDEN.', 'Résultats des tests SQL.'],
  ['Comparaison déterministe avec la réponse attendue.', ''],
  ['Comparaison structurée par élément ; relecture de la démarche requise.', 'Le professeur doit encore relire ta démarche.'],
  ['Réponse ou référence structurée illisible ; relecture requise.', 'Le professeur doit relire cette réponse.'],
  ['Tests de référence illisibles : relecture requise.', 'Les tests ne sont pas disponibles. Le professeur doit relire ton code.'],
  ['Syntaxe ou construction non prise en charge : relecture requise, aucun zéro automatique.', 'Ce code nécessite une relecture par le professeur.'],
  ['Résultats des tests bornés. Vérifier la démarche.', 'Le professeur doit encore relire ta démarche.'],
  ['Production ouverte : appliquer la rubrique et relire les preuves.', 'Le professeur doit relire ton travail.'],
  ['Tests structurels sans exécution de scripts. Vérifier aussi la présentation et la démarche.', 'Vérifie aussi la présentation et ta démarche.'],
  ['Production absente dans la copie remise.', 'Aucune réponse rendue pour cet exercice.'],
  ['Pré-correction disponible, en attente de validation professeur.', 'Résultat provisoire, à confirmer par le professeur.'],
  ['Une relecture est nécessaire avant de déterminer la note.', 'Le professeur doit relire ton travail avant de donner une note.'],
  ['Pré-correction par rubrique proposée. Relisez chaque preuve avant validation.', 'Résultat provisoire, à confirmer par le professeur.'],
]);
export const studentFeedback = text => feedbackLabels.get(text) ?? text ?? '';

const usefulErrors = new Map([
  ['Identifiants incorrects.', 'Identifiant ou mot de passe incorrect.'],
  ['Copie déjà figée.', 'Ce travail a déjà été rendu.'],
  ['Copie déjà remise.', 'Ce travail a déjà été rendu.'],
  ['Séance non ouverte.', 'Cette séance n’est pas disponible.'],
  ['Copie trop volumineuse.', 'Ton travail est trop volumineux pour être envoyé. Réduis sa taille, puis réessaie.'],
  ['Code limité à 10 000 caractères.', 'Le code est limité à 10 000 caractères.'],
  ['Monde verrouillé : terminer le monde préalable ou demander une ouverture au professeur.', 'Ce monde est verrouillé. Demande au professeur comment y accéder.'],
  ['Terminez l’activité autonome avant de lancer la mission.', 'Termine l’activité en autonomie avant de jouer.'],
  ['Limite d’essais atteinte.', 'Tu as atteint la limite d’essais.'],
  ['La séance a changé. Actualisez le parcours.', 'La séance a changé. Actualise la page.'],
  [studentCopy.diagnosticGate, studentCopy.diagnosticGate],
]);
export function studentError(error, path = error.path || '') {
  if (error.status === 401) return path === '/api/login' ? usefulErrors.get('Identifiants incorrects.') : 'Reconnecte-toi pour continuer.';
  if (error.status === 429) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (usefulErrors.has(error.message)) return usefulErrors.get(error.message);
  // A transport failure may follow a successful write: never claim it was lost.
  if (path.endsWith('/submit')) return 'L’envoi n’a pas pu être confirmé. Réessaie.';
  if (path.endsWith('/save') || path === '/api/events' || path.endsWith('/progress')) return 'L’enregistrement n’a pas pu être confirmé. Réessaie.';
  if (path.startsWith('/api/game/')) return 'Cette mission n’est pas disponible pour le moment.';
  if (error.status === 403) return 'Tu n’as pas accès à cette activité.';
  if (error.status === 404) return 'Ce contenu n’est pas disponible.';
  return 'Impossible de terminer cette action. Réessaie.';
}

export const testSummary = (passed,total) => `${passed} test${passed>1?'s':''} réussi${passed>1?'s':''} sur ${total}.`;

export function studentResultStatus(result) {
  if (result.status === 'approved') return 'Correction validée.';
  if (result.score == null) return 'Correction en attente.';
  return result.status ? 'Résultat provisoire, à confirmer par le professeur.' : '';
}
