# Audit V2 — 10 octobre 2026

## Périmètre observé

Le dépôt était sans modification au début de l’intervention. Aucun `AGENTS.md` ne s’applique aux chemins modifiés ; celui du corpus World Arcade reste limité à son sous-dossier. Les deux documents V2 ont été lus intégralement comme spécifications fonctionnelles de la demande.

Le socle V1 est présent dans `server/student-tracking.mjs`, ses routes et `public/student-tracking.js`. Il couvre attributions, versions, archivage, comptes, copies, corrections publiées et reprise. L’import/export et l’éditeur conservent déjà les identités et versions. Le store est partagé entre SQLite et PostgreSQL, avec transactions sérialisées.

La source `.data/chatgpt-personal/courses.sqlite` a été ouverte en **lecture seule**. Constat : 37 élèves ; 2 séances, 10 versions, 1 occurrence ; 2 tentatives, 1 progression ; aucune copie remise, correction ou preuve ; aucun rattachement V1 matérialisé dans cette source. L’audit de liens existant ne signale pas d’anomalie. Aucune donnée authentique n’a été utilisée comme fixture ou modifiée.

Le référentiel existant provient d’une version de classeur et comporte 105 entrées N3, avec codes N2/N3, intitulés, feuille, lignes source, critères observables et règles pédagogiques textuelles. Les codes exacts peuvent donc être repris par un import professeur explicite. Les colonnes ne constituent pas un ensemble officiel exhaustif de sous-critères ni une grille universelle de conversion en grades. Aucun attendu N2 n’a été converti en A1.

Complément après désignation de la source par l’utilisateur : l’onglet `02 Référentiel A1` de `Planification_A1_2026-2027_Yacine_FULL_DejeunersPro.xlsx` est désormais embarqué comme référentiel par défaut. Son empreinte est `f2db14a110b726eb8b75adb20f1f8f8be39973b6aaec83f3e25bd35b54e6a880`. L’extraction comprend uniquement les 48 regroupements N2 et 105 entrées N3 de cet onglet (101 positionnées A1, 4 préfigurations A2). Elle conserve les indications pédagogiques et ne transforme pas les statuts de planification en grades. L’ajout par classe est automatique et relançable ; les anciennes grilles restent intactes.

## Écarts identifiés et intégration

- Le catalogue `competency_n3` remplace ses lignes lors d’un nouvel import ; `curriculum_versions` conserve les sources. La V2 crée des versions immuables distinctes et autorise leur import depuis ces sources conservées.
- La correction historique contient des seuils locaux par critère, mais le grade global était déduit implicitement d’une note sur 20. Les nouvelles copies sans grille explicite affichent désormais **Grade à déterminer**. Les résultats historiques enregistrés ne sont pas réécrits.
- `mastery()` et les groupes historiques utilisent un calcul pondéré hérité. La V2 dispose d’une règle explicite sans moyenne ordinale ; les observations V2 ne sont pas injectées dans ces anciens groupes. Ces anciennes fonctions sont conservées pour les parcours historiques.
- Les correspondances prévues/travaillées/évaluées sont désormais distinctes. Une occurrence publiée ne prouve ni la réalisation ni la maîtrise. Les anciennes observations sans rattachement fiable restent dans la fiche V1, sans conversion automatique.
- Les nouveaux calculs conservent origine d’exercice, date de travail, révision exacte, critères, niveau de demande et autonomie. L’origine est conservée lors des clones/imports ; sa qualification indépendante appartient au professeur.
- La reprise V1 est réutilisée pour ouvrir des travaux individuels persistants. L’automatisme est une autorisation locale bornée, séparée des règles de contenu et de la publication.

## Reprise et migrations

Neuf tables additives sont déclarées dans le store et le schéma commun. L’ouverture du store crée les tables manquantes sans toucher les lignes historiques. Les tests utilisent des bases en mémoire et temporaires ; aucune migration n’a été exécutée sur la source inspectée.

Les correspondances de version inconnues restent à compléter. Une grille modifiée par édition devient explicitement non résolue si ses items ne correspondent plus. L’import refuse les conflits de contenu sous une identité/version identique. Aucun résultat réel n’a été déclaré réconcilié à partir d’un titre, prénom ou index de section.

## Fichiers principaux

- Calculs : `server/competency-calculations.mjs`.
- Référentiel, corrections, décisions et accès : `server/competency-service.mjs`, `server/competency-routes.mjs`, intégrations dans `assessment.mjs` et `student-tracking.mjs`.
- Parcours : `server/adaptive-paths.mjs`.
- Édition/import : `server/competency-transfer.mjs`, `lesson-editor.mjs`, `lesson-transfer*.mjs`, `lesson-package.mjs`.
- Interface : `public/competency-ui.js`, `student-tracking.js`, `lesson-renderer.js`, `style.css`.
- Stockage : `server/store.mjs`, `database/schema.sql`.
- Recette : `tests/competency-v2.test.mjs`, fixture dédiée, script navigateur et rapport sous `test-results/competency-v2/`.

La chaîne saisie → sauvegarde serveur → remise → correction → publication → consolidation → attribution → reprise a été exercée sur des données fictives isolées. Les verdicts et limites sont dans [acceptance-v2.md](acceptance-v2.md).
