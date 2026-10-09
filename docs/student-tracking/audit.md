# Audit et décisions — 9 octobre 2026

## Existant réutilisé

- Express et modules ES, store d’agrégats JSON SQLite/PostgreSQL dans `server/store.mjs`, sessions et mots de passe dans `server/auth.mjs`.
- Comptes `learners`/`teachers`, classe de connexion `classId`, table `enrollments` existante. Le périmètre professeur actuel est une classe ; aucun administrateur global opérationnel n’a été supposé.
- `lessons`, `lesson_versions`, `lesson_runs`, `lesson_publications`, éditeur riche et import/export. Les versions conservent les identifiants des activités, les consignes, le code et les ressources.
- `assessment_attempts`, `submissions`, `corrections`, `correction_revisions`, `evidence`, `teacher_observations`, `learning_progress`, `learning_events`.
- `work_submissions`, instantanés documentaires et fichiers de laboratoires, runners de programmation, DOM et shell existants. Aucun nouveau moteur d’exécution ni nouvelle dépendance.

## Écarts corrigés

L’accès élève aux séances dépendait du catalogue courant de sa classe. Une copie liée à une ancienne version pouvait devenir difficile à retrouver après édition/import. Les progressions identifiées par élève/version confondaient aussi plusieurs occurrences du même contenu. L’attribution stable rend maintenant explicites l’élève, l’occurrence et la version ; les anciennes correspondances ambiguës sont signalées.

La remise permettait auparavant d’accéder immédiatement à des résultats et au corrigé via la projection `submitted`. Une frontière serveur de publication remplace ce comportement. Les résultats privés ne sont plus projetés avant décision du professeur. La révision visible est indépendante de la correction en cours.

Les brouillons n’avaient pas tous un contrôle de concurrence et les données locales n’étaient pas uniformément isolées par compte et tentative. Des versions attendues, des requêtes idempotentes et une invalidation commune des sessions privées ont été ajoutées. Les remises figées refusent les sauvegardes tardives.

Les états distinguent désormais absence de copie, correction à effectuer, critère non observé et résultat évalué. Une observation dont la preuve ancienne manque conserve son résultat et porte une anomalie explicite. Les observations manuelles existantes sont également présentées, sans moyenne nouvelle.

## Données locales effectivement inspectées

Source : `.data/chatgpt-personal/courses.sqlite`, ouverte avec SQLite **en lecture seule** par `scripts/student-tracking-audit.mjs`. Aucun compte ni réponse n’a été exporté dans ce rapport et aucune migration n’a été appliquée à cette source.

| Ensemble | Nombre observé |
| --- | ---: |
| Élèves | 37 |
| Rattachements explicites | 0 |
| Séances / versions / occurrences | 2 / 10 / 1 |
| Tentatives / progressions | 2 / 1 |
| Copies diagnostiques / copies de séance | 0 / 0 |
| Corrections / preuves | 0 / 0 |
| Nouvelles attributions / publications de résultats | 0 / 0 |

L’audit n’a signalé aucune anomalie de correspondance sur ces lignes. Cela n’établit pas la qualité de données non accessibles ni la présence de copies remises : cette source n’en contient pas. Aucun compte n’a été supprimé ou classé arbitrairement comme démonstration. La chaîne saisie → sauvegarde serveur → rechargement → remise figée → correction → publication a été suivie sur les fixtures isolées de recette.

## Fichiers concernés

| Zone | Fichiers principaux |
| --- | --- |
| Modèle, droits, reprise | `server/student-tracking.mjs`, `server/student-tracking-routes.mjs`, `server/store.mjs`, `server/auth.mjs`, `database/schema.sql` |
| Corrections, sauvegardes, projections | `server/assessment.mjs`, `server/corpus.mjs`, `server/progress.mjs`, `server/work-submissions.mjs`, `server/generator.mjs`, `server/app.mjs` |
| Publication et import | `server/domain.mjs`, `server/lesson-transfer.mjs`, `server/lesson-transfer-routes.mjs` |
| Laboratoires et ressources | `server/pedagogy/{dom,labs,routes,visuals}.mjs` |
| Parcours et isolation du navigateur | `public/{app,student-tracking,private-session,lesson-renderer,work-receipt,dom-lab,terminal-lab}.js`, `public/suivi.html`, `public/style.css` |
| Éditeur compilé | `public/lesson-editor.bundle.js`, régénéré car il réutilise le rendu de séance |
| Vérification | `tests/student-tracking.test.mjs`, fixtures dédiées, tests existants adaptés au nouveau contrat de publication et d’attribution, tests de transfert renforcés |
| Recette et audit | `scripts/student-tracking-browser-check.mjs`, `scripts/student-tracking-audit.mjs`, scripts npm et présente documentation |

Les tests existants qui supposaient le corrigé visible dès la remise, ou la bascule automatique d’une participation vers la nouvelle version, ont été adaptés aux règles V1. Les fixtures qui publiaient en modifiant directement `status` reçoivent désormais une attribution de test explicite.

Opérations non exécutées : déploiement, migration de production, remise à zéro, envoi d’invitations, activation de services externes, transfert réel d’élèves ou modification des comptes de la base locale inspectée.
