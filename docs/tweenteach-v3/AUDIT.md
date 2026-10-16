# Audit V3 — 16 octobre 2026

Périmètre : documents V3 fournis, dépôt existant, bases de recette isolées. Aucune inspection du contenu de la base scolaire ni opération de production. La modification préexistante de `TWEEN_TEACH_WORLD_ARCADE/FRONT_REFERENCE/World_Arcade_Frontend/js/app.js` est préservée.

## Architecture constatée

Node 22.14, modules ESM, Express 5.1, interface JavaScript/HTML et CSS du hub. SQLite natif en local ; adaptateur `pg` 8.16.3 pour PostgreSQL, schéma d’agrégats JSON commun dans `server/store.mjs`. Vercel/serverless existe ; aucune infrastructure nouvelle n’est nécessaire. CodeMirror, Tiptap, console isolée et laboratoires DOM/shell existants sont conservés. Les mécanismes d’archivage Git/S3, jobs de génération/publication et imports de classeur restent séparés du suivi.

L’authentification lit le compte à chaque requête (`server/auth.mjs`). Les habilitations ordinaires restent liées à la classe du professeur ; les inscriptions historiques et attributions sont dans `enrollments` et `lesson_assignments`. La V3 recontrôle le compte en transaction avant ses lectures et mutations.

## Matrice des écarts initiaux

| Exigence | État initial | Preuve fichier / flux | Risque | Adaptation et vérification |
|---|---|---|---|---|
| REF / ADM | Partielle | `competency-service.mjs::importFramework`, écran `competency-ui.js` | Import de snapshots, sans CRUD d’éléments ; deux types seulement | `framework-admin.mjs` : CRUD, sous-compétences, brouillons/révisions, usages, archivage et droit de publication partagée ; tests V3 |
| REF-03 / PLA | Partielle | Contrôle des parents dans `validateFramework` | Prérequis obligatoires non typés ; codes répétés rejetés même entre branches | Relations validées, détection de cycles, identité indépendante des codes ; tests V3 |
| IMP | Partielle | `importer.mjs`, `lesson-transfer.mjs`, `competency-transfer.mjs` | Écrasement ou rapprochement ambigu | Réutilisation des parseurs et transferts ; aperçu JSON V3, empreinte, conflits explicites, aucune suppression des absents |
| PLA / DAT | Partielle | `planning.mjs` et `lesson_runs` | Le planning importé, la passation et le réalisé n’ont pas les mêmes responsabilités | Occurrences versionnées, objectifs qualifiés, dates initiales, réalisé collectif et constats individuels ; tests V3 |
| EVI / PUB | Déjà substantielle | `student-tracking.mjs`, `assessment.mjs`, `work-submissions.mjs` | Régression de l’idempotence ou fuite d’une révision privée | Réutilisation des remises figées, brouillons avec révision, correction et publication exactes ; suites V1/V2 et navigateur |
| EVI-01 | Partielle | `teacher_observations` historiques, sans critères versionnés V2 | Observation orale non consolidable | `teacher-evidence.mjs` : source individuelle, révisions de critères, contexte de groupe, date nullable et publication séparée |
| MAS | Déjà substantielle | `competency-calculations.mjs::consolidate` | Grade global propagé / clones pris pour preuves indépendantes | Politique existante conservée, deux situations essentielles par défaut, échelles explicites, intégration des constats V3 ; tests V2/V3 |
| ANA | Partielle | Matrice V2 et `classReadiness` | Dénominateurs confondus ; grille configurée interprétée comme réalisé | Pilotage par critère, exclusions, modes séparés, couverture liée aux occurrences, alertes avec empreinte et états persistants |
| ACT | Déjà substantielle | `adaptive-paths.mjs` | Activation obsolète, accès insuffisant, boucle de reprises | Réutilisation du cycle suggestion/attribution/réalisation/vérification ; test V3 de bout en bout et tests V2 de concurrence |
| ELE | Partielle | `student-hub.js`, `student-tracking.js` | Compétences futures invisibles, absence de demande privée | Objectifs attribués neutres ; demandes liées à une révision publiée ; bilan personnel exportable |
| PRO / ELE | Partielle | Navigation du hub et pages `suivi.html` | Page nouvelle isolée ou perte des saisies sur erreur | Modules intégrés au shell ; erreurs de formulaire conservant la saisie ; tests 360/768/1440 px |
| ACC / SEC | Substantielle, à éprouver | `assignmentAccess`, `currentActor`, `private-session.js` | URL directe, changement de compte, session révoquée | Recontrôle serveur, listes de champs autorisés, no-store ; tests d’accès et navigateur sur poste partagé |
| EXP / MIG / TEC | Partielle | `database-snapshot.mjs`, `scripts/lib/database-migration.mjs` | Ancienne sauvegarde rejetée, faux historique ou effacement | Trois tables additives, compatibilité sauvegardes, simulation lecture seule et restauration isolée ; mesures sur 4 000 observations |
| AIA | Cœur indépendant existant | Routes de suivi sans appel au fournisseur | Dépendance ou publication d’une suggestion IA | Aucun nouveau fournisseur, appel payant ni automatisme activé ; services de suivi déterministes |

## État initial des tests

Le premier lancement des tests HTTP échouait sur `listen EPERM 127.0.0.1` dans le bac à sable. La relance autorisée avec serveurs locaux a passé les 29 tests V2 et les 48 tests de suivi/transfert/stockage. Ce blocage d’environnement n’a pas été traité comme un défaut produit.

La recette des laboratoires a identifié un script de test ancien qui omettait `draftVersion` à la remise et ignorait l’erreur HTTP. Le script transmet maintenant la révision reçue et l’attribution, et vérifie chaque réponse HTTP ; la règle de verrouillage serveur n’a pas été assouplie.

Résultats finaux et limites : [RECETTE.md](RECETTE.md).
