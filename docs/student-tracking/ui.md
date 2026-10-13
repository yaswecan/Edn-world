# Conventions de l’espace élève

## Audit des routes (avant harmonisation)

La référence est `/today`, rendu par `app.js` et `renderLessonPage` : logo EDEN, header blanc, palette turquoise de `brand.css`, police locale de `fonts.css`, surfaces et boutons de `lesson.css`. Le parcours latéral appartient à la séance, pas à la navigation principale du Hub. Il doit rester disponible.

| Route / vue | État initial | Écart constaté |
| --- | --- | --- |
| `/`, `/index.html`, `/today`, `/teacher` avec un compte élève | Partiellement conforme | Accueil de référence ; navigation dupliquée, sans état actif ni accès direct aux compétences |
| `/today?lesson=…`, `?assignment=…`, `&attempt=…`, `&activity=…`, `?date=…` | Partiellement conforme | Même parcours ; retour vers l’historique absent |
| `/suivi.html`, `?view=lessons` (recherche, état, pagination) | Non conforme | Header, largeur, boutons et typographie distincts |
| `/suivi.html?view=evaluations` | Non conforme | Même divergence ; compétences accessibles seulement ici |
| `/suivi.html?assignment=…` | Non conforme | Détail du travail sans retour contextuel |
| `/suivi.html?attempt=…` | Non conforme | Copies, diagnostics, reprises, entraînements et retours hors du shell de référence |
| `/suivi.html?view=competencies` | Non conforme | Compétences, observations, preuves, historique des décisions et prochaines activités dans le layout de suivi |
| `/work-receipt.html?id=…` | Non conforme | Layout de préparation, sans navigation principale |
| `/arcade`, `/world-arcade/index.html` et fragments `#arcade`, `#joueurs`, `#classement`, `#profil`, `#personnaliser`, `#compte`, `#collection`, `#badges`, `#reglages` | Partiellement conforme | Univers immersif avec retour à la séance, mais sans navigation du Hub |
| `/play/:world/:mission` | Partiellement conforme | Alias existant du contrôleur de l’accueil |
| `/game/`, jeux embarqués dans Arcade, consoles et ateliers embarqués | Exception technique | Canvas, workers, iframes et éditeurs avec leur propre cycle de vie ; conserver les retours vers leur hôte |
| `/lesson-demo.html`, `/code-runner-frame.html`, ressources publiques et laboratoires | Hors périmètre | Aperçu public ou document embarqué, pas une route du compte élève |
| Préparation, éditeur, réglages IA ; suivi `student`, `run`, `work`, `framework`, `adaptation` | Professeur | Conserver les contrôles serveur et le layout professeur |

## Architecture et règles

- `StudentHubLayout` et `StudentHubHeader` dans `public/student-hub.js` sont les points d’entrée communs. Réutiliser le shell pour toute nouvelle vue élève ; ne pas écrire de header ou de navigation dans une vue métier.
- La table `studentHubRoute` définit la rubrique active et les retours contextuels. Le contrôleur de suivi enveloppe toutes ses vues élèves, y compris chargement et erreur. Le renderer de séance utilise le même shell pour une session élève ; l’aperçu public reste indépendant.
- Garder le libellé existant **Aujourd’hui** pour l’accueil, puis **Mes séances**, **Mes évaluations**, **Mes compétences**, et **Mode arcade** si activé par le serveur. Utiliser `aria-current="page"` et des liens natifs.
- Les vues de suivi se naviguent avec l’History API, y compris filtres, pagination et retour navigateur. Les transitions vers les éditeurs et les jeux restent des transitions de document : elles isolent les workers, les sauvegardes et les requêtes privées (contrat de `private-session.js`).
- Les tokens restent dans `brand.css` ; `student-hub.css` centralise les dimensions du shell et les adaptations responsive. Les pages utilisent les cartes, boutons, pastilles et typographies existants du Hub.
- `SessionIdentity` et `competencyBadges` affichent l’identité pédagogique canonique. Les cartes partagées `StudentSessionCard`, `StudentEvaluationCard` et `StudentCompetencyCard` ne calculent aucun résultat. Afficher seulement les niveaux, preuves et résultats renvoyés par les API autorisées.
- Les états secondaires passent par `StudentHubState`. Ne pas afficher d’erreur réseau brute, de trace ou d’identifiant interne. L’absence de résultat reste neutre.
- Arcade garde sa navigation de jeu et son thème à l’intérieur de son espace. Le header du Hub appartient à l’hôte ; les jeux en plein écran et leurs iframes gardent le bouton de sortie existant.

## Vérification

`npm run test:hub:browser` vérifie les vues élèves à 1440, 768 et 390 px, les liens, les états actifs, l’absence de double header et de débordement, les états secondaires, les retours et la séparation professeur/élève. Les captures et le rapport sont dans `test-results/student-hub/`.

## Livraison du 13 octobre 2026

Les routes du Hub, les trois rubriques du suivi, leurs détails et les reçus utilisent désormais le shell commun. L’hôte Arcade affiche le même header pour les comptes élèves, sur toutes ses vues. Les pages professeur restent dans leur contrôleur existant. Aucun endpoint, droit d’accès, calcul de note ou mécanisme de publication n’a changé. Les mentions « Résultat publié » et « Retour formatif disponible » reflètent maintenant les statuts déjà renvoyés par le serveur.

Les captures `before-*.png` et `after-*.png` utilisent des comptes fictifs. Comparer notamment `before-lessons-1440.png` / `after-lessons-1440.png`, puis les variantes `768` et `390`. Les copies de référence et de recette utilisent deux fixtures pédagogiques distinctes ; ces captures permettent une comparaison visuelle du layout, pas une comparaison pixel à pixel des contenus.

| Vérification exécutée | Résultat |
| --- | --- |
| `npm test` | 381 réussis, 2 ignorés, aucun échec |
| `npm run check` | Syntaxe, schémas et primitives Drive validés |
| `npm run test:hub:browser` | 9 vues × 3 largeurs ; navigation, focus, chargement, erreurs, publication, droits et déconnexion |
| `npm run test:tracking:browser` | Sauvegardes, publication, reprise et invalidation des données privées validées |
| `npm run test:tracking:v2:browser` | Référentiels, décisions publiées et reprises validés |
| `npm run test:identity:browser` | Titres canoniques, codes et pastilles dépliables validés |
| `scripts/arcade-browser-check.mjs` | Jeux réels, sauvegardes, erreurs, responsive et dix allers-retours Hub / Arcade validés |
| `scripts/arcade-account-browser-check.mjs` | Profil, personnalisation, badges, compte et changements de session validés |
| `tests/student-copy.test.mjs` | 8 tests réussis, dont les libellés publié / formatif / provisoire |

Les scripts Arcade ont été exécutés avec `ARCADE_REPORT_DIRECTORY=test-results/student-hub/...` pour conserver leurs artefacts hors des références versionnées. La seule exception de layout conservée concerne l’intérieur des jeux, consoles et éditeurs embarqués ; leur hôte et leurs boutons de retour restent en place. Les visites publiques conservent leur comportement existant. Aucune migration de données n’est nécessaire.
