# Recette V2 — 10 octobre 2026

Recette sur bases isolées, comptes synthétiques et application Express réelle. Les données `DEMO-*` viennent exclusivement des fixtures de la section 20 ; aucune donnée d’établissement n’a été remplacée. Les tests contrôlent aussi les réponses JSON, les copies figées, les révisions et les attributions persistantes.

## Résultats de la livraison

- `npm test` : **368 tests réussis, 0 échec, 0 ignoré**.
- `npm run build` : compilation de l’éditeur, contrôles de syntaxe, schémas et DDL réussis.
- `npm run test:tracking:browser` : **PASS**, y compris le changement de compte et les réponses retardées.
- `npm run test:tracking:v2:browser` : **PASS**, parcours professeur/élève et mobile.
- `git diff --check` : réussi.

## Verdicts AC01–AC40

| Scénario | Verdict | Vérification |
| --- | --- | --- |
| AC01 — Administration et CSV | Vérifié | Création, import idempotent, homonymes, erreurs et aperçu : suite V1 de suivi conservée. |
| AC02 — Accès aux copies | Vérifié | Refus par autre élève/professeur, fichiers et URL directes ; refus des observations V2 hors périmètre. |
| AC03 — Transfert et révocation | Vérifié en environnement isolé | Historique dans la classe d’origine ; droits retirés ; aucun transfert réel effectué. |
| AC04 — Archivage | Vérifié | Archivage de rattachement, conservation des copies, suspension et compte partagé. |
| AC05 — État individuel | Vérifié | Ancienne séance, brouillon fermé, réalisation requise et activités optionnelles distinctes. |
| AC06 — Reprise exacte | Vérifié | API et Chrome : brouillon, panne simulée, reconnexion/rechargement et reprise adaptée sauvegardée sur le serveur. |
| AC07 — Poste partagé | Vérifié | Chrome : deux comptes successifs, plusieurs onglets, réponse réseau et retour d’exécution retardés, purge et retrait du runner. |
| AC08 — Remise et concurrence | Vérifié | Répétition idempotente, versions de brouillon, refus des sauvegardes après remise. |
| AC09 — Données manquantes | Vérifié | Aucun rendu, à corriger, non observé et résultat présent distincts ; aucun zéro pour une copie absente. |
| AC10 — Correction et source | Vérifié | Points/observations professeur, provenance, score client non officiel ; tests existants de runners et stockage. |
| AC11 — Publication et absence de fuite | Vérifié | Copies privées avant publication, solutions absentes du JSON élève, fermeture obligatoire du mode standard. |
| AC12 — Correction après publication | Vérifié | Ancien résultat visible jusqu’à republication ; révisions de preuves publiées conservées. |
| AC13 — Tentatives et entraînement | Vérifié | Diagnostic initial préservé, reprise ciblée après clôture et entraînement séparé. |
| AC14 — Édition et ordre | Vérifié | Versions, identifiants, copies et contexte conservés ; grille reprise ou signalée à compléter lors de l’édition. |
| AC15 — Remplacement import | Vérifié | Transferts réels entre stores, remplacement cohérent, anciens travaux conservés, réimport sans duplication. |
| AC16 — Frontière des exports | Vérifié | Archive professeur, absence de comptes/copies/progressions ; contenu pédagogique V2 transporté sans observations, décisions ni autorisations automatiques. |
| AC17 — Reprise pédagogique | Vérifié | Attribution accessible à l’élève dans Chrome ; travail persisté, aucune maîtrise créée par simple réalisation. |
| AC18 — Migration et vide | Vérifié localement | Reprise V1 additive avec ambiguïtés signalées ; tables V2 additives ; sources et observations non rattachées conservées. |
| AC19 — Vue et publication groupée | Vérifié | Statuts de copies, échecs détaillés et publication partielle ; décisions V2 traitées individuellement dans un lot. |
| AC20 — Parcours et non-régression | Vérifié localement | Parcours professeur/élève, liens, clavier, mobile 390 px, suite existante ; services distants non sollicités. |
| AC21 — Identité du référentiel | Vérifié | Codes avec zéros/ponctuation, hiérarchie, source, collisions de version et mêmes codes dans deux référentiels. Attendu N2 distinct du grade. |
| AC22 — Prévu, travaillé, évalué | Vérifié | Liens prévus/travaillés sans observation ; seules les correspondances de critères produisent une observation. |
| AC23 — Points et rattachements | Vérifié | Rattachements multiples sans duplication du total, origine commune conservant une seule situation. |
| AC24 — Grade global et fragilité | Vérifié | Fixture 8/8 + 1/4 + 5/8 : 14/20, grade EC expliqué par Q2 essentielle, observations A1 et EC. API et Chrome. |
| AC25 — Seuils et règles manquantes | Vérifié | Seuils inclusifs/exclusifs, coefficients, arrondis, dénominateur complet, grille ordinale sans note ni moyenne, grade manuel motivé avec échelle explicite. |
| AC26 — Couverture | Vérifié | Trois critères sur sept, doublons éliminés, subdivisions locales exclues du dénominateur officiel, absence de total inventé. |
| AC27 — Indépendance | Vérifié | Dix répétitions d’une origine ne confirment pas ; deux situations explicitement indépendantes démontrant les résultats peuvent proposer un niveau. |
| AC28 — Autonomie et demande | Vérifié | Aide autorisée compatible avec autonomie démontrée, autonomie inconnue insuffisante, plafond du niveau de demande. |
| AC29 — Chronologie | Vérifié | Date du travail, correction tardive, égalité départagée de manière stable, date inconnue exclue du calcul automatique. |
| AC30 — Contradiction | Vérifié | Dernière observation contradictoire à examiner, sélection récente et niveau publié conservé. |
| AC31 — Visibilité des synthèses | Vérifié | Propositions privées, preuves hors périmètre refusées, décision publiée après ses preuves exactes ; ancienne décision conservée sous correction privée, révocation effective, dernière révision publiée affichée. |
| AC32 — Nouvelle version | Vérifié | Pas de réutilisation sur code identique ; correspondance de critères validée nécessaire pour consolider dans la nouvelle version. |
| AC33 — Recalcul | Vérifié | Révision concurrente et nouvelle observation indépendante bloquent une décision obsolète ; nouvelle proposition et révisions originales conservées. |
| AC34 — Diagnostic manquant | Vérifié | Absence de copie ou critère inexploitable → preuves insuffisantes, jamais NA ni attribution automatique fragile. |
| AC35 — Prochaine activité | Vérifié | Seul le prérequis de combinaison influe sur la proposition ; aucune observation sur les boucles non évaluées. |
| AC36 — Proposition et activation | Vérifié | Raison, preuves, cible et condition conservées ; absence d’attribution sans validation/autorisation ; parcours élève ouvert sans modification du diagnostic. |
| AC37 — Publication et formatif | Vérifié | Révisions privées bloquées malgré une ancienne publication ; mode formatif fixé avant tentative, sans solution ni résultat d’une autre passation ; activation rétroactive refusée. |
| AC38 — Automatisme borné | Vérifié | Autorisation explicite et expirante, versions/budget, déclenchement à la publication, idempotence, révocation concurrente avant enregistrement, réexamen avant démarrage et droits retirés même après démarrage ; aucun transport d’autorisation. |
| AC39 — Vérification et sortie | Vérifié | Réalisation réelle avant vérification ; nouvelle situation indépendante, correction publiée, réussite ouvrant une attribution du parcours commun ; échec renvoyant au professeur, ressource absente et dépendance circulaire refusées. |
| AC40 — Décision collective | Vérifié | Effectif, rendus, preuves interprétables, difficultés et preuves manquantes distincts ; proposition de rappel sans mutation du calendrier. |

## Preuves reproductibles

- `tests/student-tracking.test.mjs` : socle AC01–AC20.
- `tests/competency-v2.test.mjs` : 26 tests de calcul, droits et parcours V2, via le serveur et les transactions réels.
- `tests/lesson-transfer.test.mjs`, `lesson-editor.test.mjs`, `documentary-storage.test.mjs`, suites existantes : conservation des fichiers, versionnement, transferts, schéma PostgreSQL sous PGlite et non-régression.
- `npm run test:tracking:browser` : rapport `test-results/student-tracking/report.json`, statut PASS.
- `npm run test:tracking:v2:browser` : rapport `test-results/competency-v2/report.json`, statut PASS ; captures `competencies-mobile.png` et `teacher-adaptation.png`, inspectées pendant la recette.

Les artefacts de test sont ignorés par Git et régénérables. Les assertions du test historique sans grille ont été adaptées au contrat V2 « Grade à déterminer » ; son acteur professeur est désormais enregistré dans la fixture pour exercer la revérification transactionnelle des droits.

## Limites et opérations non exécutées

Aucun test sur PostgreSQL distant, charge à gros effectifs, laboratoires DOM/shell distants, Drive ou archivage externe. La compatibilité du schéma et les contrats locaux sont testés ; cela ne garantit pas le fonctionnement d’une infrastructure non configurée. La matrice lit encore des agrégats en mémoire.

Aucune migration de production, publication du site, remise à zéro, invitation, mutation des comptes réels ou import automatique des fixtures. La source locale auditée ne contient aucune copie remise : les conclusions sur les parcours utilisent donc les fixtures isolées, sans prétendre avoir réconcilié des copies authentiques inexistantes dans cette source.
