# EDEN — langage de séance, version 2

## Sources et arbitrage

Audit du 4 octobre 2026. Sources réellement disponibles : `EDEN_HUB_ELEVE_VERCEL_NEON_COMPLET(2).zip` et `EDEN_HUB_01_OCTOBRE_DIAGNOSTIC_CODE_V6_COMPLET(2).zip`, extraites dans `legacy/eden-core` et `legacy/eden-october`. La version élève (4) et le corpus BIOS V4 (2) ne sont pas présents. Aucune équivalence avec ces deux archives n’est présumée.

Mise à jour du 5 octobre : les références explicites sont désormais le [hub Logique & JavaScript](https://eden-hub-algo-logique-wskw.vercel.app/) et le [hub Flexbox local](http://127.0.0.1:4173/), tous deux inspectés dans Chrome. La demande de fidélité à ces références remplace l’ancien arbitrage indigo/navy. Le logo PNG et les quatre illustrations proviennent sans modification de `EDEN_HUB_05_OCTOBRE_FLEXBOX_COMPLET/docs/assets`.

La palette est centralisée dans `public/brand.css`. Le logo est partagé via `public/brand.js` entre connexion, espace professeur et séances. Les supports de code générés et les exports PDF/PPTX/XLSX/HTML reprennent cette identité. Les séances existantes utilisent immédiatement le nouveau renderer ; les corpus déjà exportés restent attachés à leur version.

## Tokens et composition

| Usage | Valeur |
| --- | --- |
| Texte / boutons principaux | #162b32 |
| Turquoise / fond léger | #62c6c7 / #eaf7f7 |
| Texte accent / focus | #246165 / #147e83 |
| Repères numérotés | #d9effb |
| Fond / papier | #f4f7f7 / #ffffff |
| Secondaire / bordure | #53676d / #cfdddd |
| Méthode / validation | #eaf7f7 avec bord turquoise / #edf7f1 avec #216443 |
| Console | #132b35 avec #f2fcfc |
| Typographie | Inter local, puis Arial/sans-serif comme les références ; aucun CDN |
| Titres | graisse 800, interlettrage −0,04em, interligne 1,08–1,2 |
| Texte courant | 16px, interligne 1,65 ; consignes au moins 15px |
| Espacement | 4, 8, 12, 16, 24, 32, 48px |
| Rayons | 10px boutons, 22px cartes ; tableaux au trait légèrement irrégulier |
| Grille | navigation 240px + contenu flexible ; largeur totale max 1440px |

En dessous de 900px, navigation repliable et colonne unique. Pas de contenu masqué sur mobile. À 390px et à 200 % de zoom, pas de débordement de page. Les longues lignes de code défilent dans leur panneau. Cibles tactiles ≥44px, focus visible, labels explicites, ordre de lecture logique, réduction des mouvements respectée.

## Parcours stable

1. Hero + « Aujourd’hui tu vas… » : situation concrète, objectifs et repères.
2. Rappel / diagnostic : réponse initiale autonome, remise et reçu conservés.
3. Comprendre : vraie notion, reformulation, schéma, point d’attention.
4. Observer : exemple commenté, résultat attendu, question de lecture.
5. Faire avec aide : petites étapes, indice à la demande, critère de vérification.
6. Faire seul : nouveau cas, trace explicite, autonomie.
7. Aller plus loin : mission PédagoLab si affectée ; sinon transfert explicite.
8. Bilan : notions à retenir et ticket de sortie.

Une pause s’insère après le travail guidé pour les créneaux longs. Plusieurs notions peuvent occuper plusieurs blocs d’une même phase, sans modifier l’ordre des phases. Objectifs intégrés au hero, sans étape vide supplémentaire.

## Contrat contenu / présentation

`DailyLessonSpec` reste le contrat de persistance. `phase` et `teaching` enrichissent les blocs sans casser la lecture des versions anciennes. La structure est assemblée par le serveur. `LessonContentSpec` est un contrat distinct pour le modèle : texte, objectifs et contenu des identifiants déjà alloués. Aucun HTML, CSS, type de composant, ordre, timing, diagnostic, mission ou événement ne vient du modèle. Les identifiants et leur ordre sont vérifiés avant fusion. Les activités corrigées automatiquement restent déterministes.

Les composants purs de `public/lesson-renderer.js` rendent du texte échappé. Les schémas proviennent de chaînes de nœuds ou d’assets locaux explicitement autorisés. Même renderer pour /today, aperçu professeur et démonstration. Les réponses/corrections restent dans les circuits existants. Les indices d’entraînement ne dévoilent pas les corrigés du diagnostic.

## Composants

| Composant | Responsabilité fixe |
| --- | --- |
| LessonHero | titre avec soulignement turquoise, situation, repères, tableau avec illustrations locales |
| SessionTimeline | phases, étape active, durées, navigation accessible |
| ObjectiveCard | objectifs formulés comme actions observables |
| BlackboardSchema | schéma feutre noir, légende et alternative textuelle |
| DiagnosticIntro | cadre rassurant, consigne autonome et remise |
| FillBlankBlock / QuizBlock | champs ou choix natifs, labels et états sélectionnés |
| ObservationBlock / LiveCodeBlock | exemple, lecture pas à pas, résultat à interpréter |
| CodeExerciseBlock / TerminalExerciseBlock | consigne, éditeur sombre, vérification |
| ReflectionBlock | justification courte et trace personnelle |
| CorrectionFlashBlock | méthode de relecture, sans correction privée anticipée |
| CodeStationLaunchBlock | mission native et règle de réussite, lancement existant |
| ExitTicketBlock / SummaryBlock | auto-explication et synthèse notionnelle |

## Ton

Tutoiement, verbes concrets, phrases courtes. « Prévois le résultat. Change une entrée. Compare. » Expliquer pourquoi on change d’activité. Distinguer observation, hypothèse et preuve. Un indice aide à démarrer sans donner la réponse. Ne pas dire « acquis » parce qu’un écran a été visité.

## Acceptation

- [ ] Hero lisible, objectifs visibles, une action de continuation identifiable.
- [ ] Logo EDEN School original, encre dominante, blanc généreux, turquoise pour les accents.
- [ ] Schéma réellement relié à la notion ; aucun visuel décoratif arbitraire généré.
- [ ] Notion, exemple, aide, autonomie, transfert et synthèse présents et ordonnés.
- [ ] Diagnostic remis, réponses persistées, runtime PédagoLab inchangé.
- [ ] Indices au clavier, champs nommés, focus visible, pas de scroll horizontal de page.
- [ ] Captures desktop/mobile et snapshots de composants comparés aux baselines relues.
- [ ] Comparaison visuelle avec les deux hubs désignés le 5 octobre ; les anciennes archives manquantes ne définissent plus la cible graphique.
