# Recette de l’éditeur — 9 octobre 2026

Fonctionnalité implémentée et vérifiée dans le dépôt local. Aucun déploiement ni modification de données de production n’a été effectué. Les recettes utilisent des comptes et séances synthétiques, des bases séparées et les moteurs existants.

## Résultats exécutés

| Vérification | Résultat |
| --- | --- |
| `npm run build` | Réussi : bundle de l’éditeur, syntaxe, exports des schémas, DDL et préservation des primitives Drive. |
| `node --import tsx --test --test-concurrency=2 tests/lesson-editor.test.mjs tests/lesson-revision.test.mjs tests/publication.test.mjs tests/lesson-transfer.test.mjs tests/workshops.test.mjs` | **52 tests réussis**, aucun échec. |
| `npm run test:editor:browser` | **15 contrôles réussis** dans Chrome, sur l’application réelle. |
| `npm run test:editor:labs` | **6 contrôles réussis** avec les images Docker DOM et shell installées. Les tests de la correction DOM réussissent aussi. |
| Suite générale `node --import tsx --test tests/*.test.mjs` | 313 réussites sur 315 ; deux délais de démarrage dépassés dans `chatgpt-launcher.test.mjs`. Une reprise avec une concurrence limitée à 2, incluant ce fichier et les tests éditeur/révisions/transferts, a réussi : **39/39**. La suite générale n’a pas été relancée intégralement après cette reprise. |
| `git diff --check` | Réussi. |

Les rapports générés sont `test-results/lesson-editor/report.json` et `labs-report.json`. Les captures `rich-editor.png`, `preview.png`, `mobile.png` et `dom-live.png` permettent d’inspecter les parcours. Ces artefacts locaux sont exclus du suivi Git ; les scripts les recréent.

## Parcours demandés

| Parcours | Preuves exécutées |
| --- | --- |
| A — Contenu riche | Ouverture par **Modifier**, changement du titre de section et du texte, gras, liste, lien et image durable ; sauvegarde puis rechargement dans Chrome. Vérification du rendu et de l’aperçu partagé. |
| B — Réorganisation | Déplacement par boutons et poignée dans Chrome ; ordre conservé après sauvegarde. Les tests d’intégration vérifient les identités et le code de l’activité déplacée. |
| C — Suppression et annulation | Suppression d’un bloc, annulation/rétablissement puis rechargement dans Chrome. Tests d’intégration : duplication, suppression de sections, suppression du diagnostic et brouillon entièrement vide ; anciennes réponses conservées. Publication incomplète refusée sans perdre le brouillon. |
| D — Résistance aux pertes | Erreur HTTP 503 simulée puis nouvelle sauvegarde réussie, conflit réel et résolution explicite dans Chrome. Test du client avec réponse retardée : la dernière saisie est renvoyée et ne peut pas être acquittée par une ancienne réponse. Sauvegardes concurrentes : un seul jeton accepté. Fermeture puis réouverture d’un fichier SQLite : contenu retrouvé. |
| E — Version publiée | Le brouillon reste privé jusqu’à la mise à jour explicite. Même lien élève après publication ; la saisie de l’élève déjà engagé est conservée. Pas de crédit hérité ni de correction privée dans la nouvelle révision. Refus de publication : version active inchangée. |
| F — Aller-retour | Export du brouillon confirmé, import dans une seconde base indépendante puis réouverture par le service de l’éditeur. Comparaison de l’ordre, du contenu riche, des images et du code. L’image est stockée sur la destination et ne dépend plus du serveur source. Un remplacement retire le pointeur de l’ancien brouillon et provoque un conflit dans l’édition restée ouverte. |
| G — Code de départ | JavaScript visible exécuté avec ses nouveaux logs dans Chrome, CSS visible rendu dans le bac à sable. HTML/CSS/JS modifiés exécutés dans le vrai laboratoire Docker ; fichier CSS volontairement vide et script avec retours initiaux conservés. Les fichiers shell modifiés avant sauvegarde arrivent dans le laboratoire professeur. Publication, lecture élève sans solution privée, réinitialisation et export/import des fichiers DOM vérifiés. Tests spécifiques de conservation des tabulations, fins de ligne LF/CRLF mixtes et chaînes vides. |

## Contrôles complémentaires

Les tests couvrent les refus d’accès sans authentification ou hors classe, la suppression des corrections privées dans la projection élève, le rejet de nœuds et liens injectés, la conservation d’une séance ouverte puis enregistrée sans changement et les contrôles de révision des propositions IA. Le parcours mobile ne déborde pas horizontalement.

Les laboratoires ont utilisé ces images exactes :

- DOM : `sha256:3aa6f98e3b8fd8930471503592ccb79929f451b51e75696e6c833aff026c7c81`, Chromium `141.0.7390.37`.
- Shell : `sha256:4e65bd33f7ed9a09c9f176f2f8d8538f994eba24d6aced637a4307f25c28a8a4`.

## Limites et accès

Aucun accès à l’instance déployée n’a été utilisé : la persistance et les parcours n’y ont pas été testés. L’aller-retour a été exécuté entre deux environnements locaux indépendants, pas vers la production. Les vérifications de stockage ont utilisé SQLite ; aucune instance PostgreSQL distante n’a été utilisée.

Les moteurs DOM et shell nécessitent la configuration de laboratoire déjà prévue par l’application. Sans elle, les fichiers restent éditables et enregistrables, mais leur exécution est indisponible. La recette a bien utilisé Docker, sans simulation de ces moteurs.

Le cours HTML et l’archive portable conservent le contenu riche. Les PDF et présentations du compilateur existant conservent leurs projections textuelles ; leur mise en page n’a pas été remplacée par un moteur de texte riche. Les règles de publication continuent à refuser les séances incomplètes. Une préparation IA incomplète peut nécessiter la reprise professeur déjà proposée dans le hub.
