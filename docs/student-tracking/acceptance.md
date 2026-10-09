# Recette V1 — 9 octobre 2026

Les tests utilisent des comptes synthétiques, des bases isolées et l’application Express réelle. Aucun rendu de production ni service externe n’a été utilisé pour fabriquer les résultats ci-dessous.

Résultats de la livraison :

- `npm test` : **342 tests réussis, 0 échec, 0 ignoré**.
- `npm run build` : éditeur compilé, syntaxe, schémas et DDL vérifiés.
- `scripts/student-tracking-browser-check.mjs` : **PASS**, Chrome headless, parcours élèves/professeur, panne de sauvegarde, publication, reprise, mobile et poste partagé.
- `scripts/code-runner-browser-check.mjs` : **PASS**, 13 contrôles couvrant console, erreurs, boucle infinie, panne du Worker, annulation, isolation et affichage mobile.
- `git diff --check` : réussi.

## Scénarios

| Scénario | Verdict | Preuve et portée |
| --- | --- | --- |
| AC01 Administration et CSV | Vérifié | API de création/import avec aperçu, lignes invalides et ambiguës, réimport sans doublon, mots de passe distincts et homonymes conservés. `student-tracking.test.mjs`. |
| AC02 Accès aux copies | Vérifié | Autre élève/professeur refusés, contrôle des URL directes, reçus et fichiers ; révocation retirant aussi Today et l’historique des reçus. Tests de suivi et de stockage documentaire. |
| AC03 Transfert et révocation | Vérifié | Changement de classe simulé sur un compte isolé : historique personnel conservé dans la classe d’origine, nouveau professeur refusé, ancienne session enseignante révoquée. Aucun transfert réel effectué. |
| AC04 Archivage | Vérifié | Archivage du rattachement sans perte de copie ; suspension empêchant la connexion ; refus de suspension et réinitialisation globale d’un compte partagé. |
| AC05 État individuel | Vérifié | Séance ancienne visible, simple ouverture sans réalisation, brouillon fermé consultable, activités optionnelles non bloquantes, travail incomplet non déclaré terminé, occurrences indépendantes. |
| AC06 Reprise exacte | Vérifié | Réponses et ensemble HTML/CSS/JS conservés côté serveur après déconnexion/reconnexion ; instantanés DOM/shell couverts par les tests documentaires ; navigateur : rechargement, panne de sauvegarde visible, saisie conservée et nouvelle tentative d’enregistrement. |
| AC07 Poste partagé | Vérifié | Même contexte Chrome, plusieurs onglets : changement Alice → Bob, purge des brouillons, ancienne réponse réseau retenue puis libérée ; véritable exécution dans le runner dont le retour privé est retenu, puis retrait du runner au changement de compte. Ancien acteur refusé côté API. |
| AC08 Remise et concurrence | Vérifié | Sauvegarde répétée idempotente, version obsolète refusée, double remise sans duplication, autosave tardive refusée, reçu d’une autre occurrence rejeté. |
| AC09 Données manquantes | Vérifié | Aucun rendu, À corriger et résultats publiés distincts ; grille sans note sans score inventé ; observations existantes conservées même si la preuve manque, anomalie affichée et dates préservées. |
| AC10 Correction et source | Vérifié | Critères et appréciation modifiables, source professeur explicite, points limités au barème, score client ignoré ; panne réelle du Worker testée dans le navigateur, sans transformation en maîtrise/échec officiel. |
| AC11 Publication et fuite | Vérifié | JSON élève sans corrigé, consignes privées ni résultats privés avant publication ; publication refusée avant clôture ; corrigé et révision autorisée accessibles ensuite. Projections à liste explicite testées. |
| AC12 Republication | Vérifié | Correction modifiée sans changement de l’ancienne révision visible ; republication puis lecture de la nouvelle version ; publication répétée sans duplication. API et navigateur. |
| AC13 Tentatives | Vérifié | Reprise ciblée après clôture, occurrence collective inchangée, entraînement distinct, première copie et résultat préservés. Reprise réellement éditable dans le navigateur. |
| AC14 Édition et ordre | Vérifié | Identifiants, consignes, grille, réponses et version initiale préservés après édition/réordonnancement. Tests de suivi, éditeur et API. |
| AC15 Remplacement import | Vérifié | Import réel sur deux stores : ancienne activité retirée du contenu courant mais consultable dans l’attribution initiale, copie remise et grille conservées ; nouvel ensemble d’attributions séparé ; réimport sans duplication ; conflits traités par le mécanisme existant. |
| AC16 Exports | Vérifié | Export de contenu excluant les tables élèves ; corrections réservées au professeur ; archives et téléchargements enseignant refusés à l’élève. Tests de transfert et de suivi. |
| AC17 Reprise pédagogique | Vérifié | Difficulté et activité existante attribuées ; contexte individuel ouvert après clôture ; aucun ajout de preuve de maîtrise ; accès révoqué non contourné. |
| AC18 Migration et vide | Vérifié | Migration additive relançable, orphelins signalés et réponses conservées, classe vide utilisable. Audit local en lecture seule séparé ; aucune version historique inventée. |
| AC19 Vue de classe | Vérifié | Statuts déduits des copies ; publication groupée avec un succès et un refus, comptes exacts et détails par élève. Parcours navigateur depuis la fiche. |
| AC20 Parcours et non-régression | Vérifié sur les parcours locaux | Liens Aujourd’hui/historique/fiche/copie, correction et reprise, clavier, captures bureau/mobile sans débordement ; runner JavaScript réel ; suite éditeur/import/stockage/arcade existante. Les services distants restent hors de cette recette. |

Les tests associés se trouvent dans `tests/student-tracking.test.mjs`, `tests/lesson-transfer.test.mjs`, `tests/documentary-storage.test.mjs`, `tests/lesson-editor.test.mjs` et les suites API existantes. Les assertions vérifient aussi les données reçues et les enregistrements figés, pas uniquement les libellés affichés.

## Preuves navigateur et vérifications non exécutées

Le script écrit `test-results/student-tracking/report.json`, `student-mobile.png` et `teacher-copy.png`. Ces artefacts de test sont ignorés par Git et reproductibles avec `npm run test:tracking:browser`. Les captures ont été inspectées pendant la recette. Le test de poste partagé retient volontairement les retours pour vérifier l’invalidation ; cela ne modifie pas le runner livré.

Non vérifiés sur infrastructure réelle : serveur PostgreSQL distant, charge avec de gros effectifs, services DOM/shell distants, Drive et archivage externes. Les contrats de fichiers et de permissions sont testés localement, et les tests de transfert incluent le schéma PostgreSQL sous PGlite. La recette ne prétend pas restaurer une machine ou un processus distant.

Non exécutés : déploiement, migration de production, invitations, mutation de comptes réels. Voir [audit.md](audit.md) pour la source locale effectivement inspectée et [README.md](README.md) pour les procédures d’utilisation et d’activation.
