/** Seul fichier à modifier pour rattacher le parcours à ton Eden Hub. Aucune clé API ici. */
export default Object.freeze({
  school: 'EDEN School',
  teacher: 'Yacine',
  // Liens https réels de ton instance. Vides = aucun faux lien affiché.
  edenHubUrl: '',
  submissionUrl: '',
  submissionLabel: 'Ouvrir le dépôt Eden Hub',
  // La date n’est pas figée : les horaires du mardi sont des repères pédagogiques.
  // Les étapes avancent au signal du professeur, pas selon l’heure du téléphone.
  pauseMinutes: 15,
  diagnosticMinutes: 20,
  // Inter local en priorité. Inter via Google Fonts est optionnel, jamais nécessaire au parcours.
  loadGoogleInter: true,
  // API Vercel + Neon, même origine. Aucun secret dans ce fichier.
  simulatorApiBase: '/api/',
});
