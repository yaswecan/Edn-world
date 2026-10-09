# Élèves et suivi des apprentissages — V1

L’entrée **Élèves** de l’espace professeur ouvre `/suivi.html`. L’espace élève conserve **Aujourd’hui** et ajoute **Mes séances** et **Mes évaluations**. Ces écrans utilisent les comptes et les travaux du serveur ; les fixtures sont limitées aux tests.

## Utilisation professeur

1. Dans **Élèves**, ajouter un élève ou importer un CSV avec les colonnes `username,displayName`. L’aperçu signale les identifiants répétés, invalides ou associés à un autre nom. Deux homonymes avec des identifiants distincts restent deux comptes. Un mot de passe individuel aléatoire est affiché après création ; aucun message n’est envoyé.
2. Ouvrir une fiche pour modifier les informations autorisées, rétablir un accès, archiver le rattachement ou suspendre le compte. Un compte partagé avec une autre classe ne peut pas être suspendu, renommé ou réinitialisé par ce professeur.
3. Publier une séance par le parcours existant pour l’attribuer aux élèves actifs présents. Les élèves ajoutés ensuite doivent être explicitement attribués depuis **Évaluations de classe → Attribuer à des élèves**. **Nouvelle passation** crée une occurrence distincte, même pour un contenu identique.
4. Ouvrir une copie depuis la fiche ou la vue de classe. Relire chaque critère, saisir les points prévus au barème et l’appréciation, puis enregistrer. Un champ de points vide signifie « Non observé ».
5. Fermer les rendus de la passation, puis publier la correction. La publication groupée traite les copies de la page affichée et donne le résultat pour chacune. Une révision ultérieure reste privée jusqu’à republication.
6. **Autoriser une reprise** ouvre une nouvelle tentative individuelle. **Proposer une activité à reprendre** associe une difficulté à une activité existante ; si nécessaire, une nouvelle attribution individuelle ouverte est créée. Une révocation doit être levée explicitement avant cette action.

## Utilisation élève

- **Mes séances** permet de rechercher un titre ou une notion et de reprendre les réponses enregistrées. Une passation fermée reste consultable avec **Revoir**. « Fermée — travail non remis » conserve l’avancement réel.
- Les réponses sont enregistrées automatiquement. **Enregistrer mon travail** permet une sauvegarde explicite. « Enregistré » apparaît après acquittement serveur ; les erreurs conservent la saisie locale. En cas de conflit entre onglets, copier la saisie avant de recharger et de choisir la version à conserver.
- La remise fige les réponses. **Mes évaluations** présente le premier diagnostic, les reprises et les entraînements séparément. Les retours et le corrigé deviennent accessibles après publication professeur.
- Un entraînement utilise un espace distinct et ne remplace pas le diagnostic. Les copies de séance permettent de revoir les fichiers effectivement remis.

## Droits et transitions

| Objet | Règle |
| --- | --- |
| Compte et classe | La stack actuelle donne une classe de connexion par compte. Aucun rôle d’administrateur global ni droit implicite sur d’autres classes n’a été créé. |
| Rattachement | `enrollments` conserve l’état actif/archivé dans une classe. L’archivage retire des listes actives sans effacer les copies ni suspendre le compte. |
| Attribution | `lesson_assignments` relie un élève, une occurrence `lesson_runs` et une version immuable `lesson_versions`. L’historique personnel est indépendant de la classe de connexion actuelle. |
| Disponibilité | Ouverte, fermée ou archivée ; la révocation interdit aussi la lecture. La fermeture collective ne ferme pas une reprise individuelle autorisée. |
| Avancement | À commencer → En cours → Terminée. Une ouverture de page ne suffit pas. Pour une séance ordinaire : diagnostic remis et activités requises réalisées. Les activités optionnelles ne bloquent pas. |
| Réalisation | Une réponse enregistrée puis une validation d’activité, ou une remise contenant cette réponse, atteste une réalisation. Les composants de consultation disposent de leur validation explicite. Les fichiers shell remis sont attestés par l’instantané. Aucune de ces actions n’établit à elle seule une maîtrise. |
| Copie | `assessment_attempts` conserve le brouillon ; `submissions` fige la réponse et sa grille. `work_submissions` conserve les fichiers de séance et son reçu. Une seconde passation possède ses propres copies. |
| Correction | `corrections` est la révision de travail ; `correction_revisions` conserve les changements, leur auteur et leur justification. Les pré-corrections nécessitent une validation professeur. |
| Publication | `result_publications` contient la dernière révision explicitement publiée. Une modification de correction ne change pas ce que voit l’élève. Publication et remise sont idempotentes. |
| Reprise | Tentative `retake` ou `practice`, liée à la copie initiale, avec ouverture ciblée. Une reprise après publication est marquée « après corrigé » par précaution. |
| Compétences | Observations datées, source et preuve conservées, dernière observation signalée. Pas de nouvelle moyenne ni de conversion entre barèmes. Les entraînements ne créent pas de preuve diagnostique. |

Les droits sont contrôlés côté serveur, y compris pour les ressources et les fichiers remis. Une mutation administrative externe de classe ne réattribue pas les copies à cette nouvelle classe. Les informations globales d’un compte partagé restent réservées à un acteur disposant de tous les droits nécessaires ; cette interface ne crée pas un workflow de transfert interclasses sans ces droits.

Les brouillons diagnostiques portent `draftVersion` ; les réponses d’activité portent `progressVersion`. Les transactions du store existant arbitrent les écritures. Une requête obsolète renvoie `409`. Les routes élève utilisent une projection explicite des champs autorisés. Les tests d’exemple autorisés et la console restent des retours d’exercice, sans valeur de résultat publié.

Les clés locales incluent le compte, l’attribution et la tentative. Un changement de compte purge les données privées, invalide les requêtes en cours et retire les éditeurs, rendus et runners de la page ; les autres onglets sont avertis. Les réponses API portent `Cache-Control: no-store`.

## Contrats principaux

| Routes | Acteur et préconditions |
| --- | --- |
| `/api/tracking/students`, `/:id`, `/classes` | Professeur ; périmètre déduit de la session ; recherche et pagination. |
| `/api/tracking/students/preview`, `/import` | Professeur ; aperçu valide et jeton inchangé avant import. |
| `/api/tracking/students/:id/access` | Professeur habilité à agir sur tout le compte ; rotation de l’accès existant. |
| `/api/tracking/runs`, `/:id`, `/:id/assign` | Professeur ; séance de sa classe et élèves autorisés ; occurrence et attribution explicites. |
| `/api/tracking/mine`, `/assignments/:id`, `/attempts/:id` | Élève propriétaire ou professeur de la classe d’origine ; aucun accès accordé par un identifiant client. |
| `/api/assessments/:id/save`, `/submit` | Élève propriétaire ; version attendue ; occurrence ouverte ou reprise ciblée ouverte ; copie non figée. |
| `/api/teacher/submissions/:id/correction` | Professeur ; version de correction attendue, critères de la grille, justification. |
| `/api/tracking/submissions/:id/publish`, `/runs/:id/publish` | Professeur ; correction finalisée et occurrence fermée ; échecs groupés détaillés. |
| `/api/teacher/submissions/:id/reopen`, `/tracking/submissions/:id/practice` | Respectivement professeur ou élève propriétaire ; nouvelle tentative indépendante. |
| `/api/tracking/reprises` | Professeur ; activité existante, difficulté renseignée et accès effectif. |
| `/api/work-submissions/:id`, `/:id/file` | Propriétaire de la remise et attribution encore consultable. |

Erreurs : `401` session absente, expirée ou remplacée ; `403` rôle/droit global insuffisant ; `404` objet non accessible ; `400` contenu invalide ; `409` version concurrente ou passation fermée. Une liste vide est une réponse réussie distincte d’un refus ou d’une panne.

## Reprise des données et exploitation

Quatre tables additives sont déclarées dans `server/store.mjs` et `database/schema.sql` : attributions, publications de résultats, reprises et marqueurs de migration. L’initialisation du store crée le schéma de manière idempotente. Au premier accès aux parcours concernés, la classe reçoit une reprise additive `tracking-v1:<classe>` dans une transaction.

L’ancienne publication implicitement collective est matérialisée pour le registre de classe présent au moment de la reprise et porte la provenance `legacy-roster`. Les travaux sont rattachés uniquement par identifiants fiables et occurrence explicite ou unique. Les identités, versions et correspondances manquantes sont conservées et signalées dans **Rapport de reprise des données**. La migration ne publie aucun résultat ancien automatiquement et ne supprime aucune donnée.

Avant une activation sur une autre base : sauvegarder par le mécanisme existant, exécuter l’audit en lecture seule, puis vérifier une copie isolée avec le rapport de migration et les parcours de recette. L’audit local effectué et les limites sont décrits dans [audit.md](audit.md). Aucune migration ou activation de production n’a été exécutée dans cette livraison.

```sh
npm run audit:tracking -- CHEMIN_SQLITE
npm run test:tracking
npm run test:tracking:browser
npm test
npm run build
```

Le script navigateur utilise Chrome installé sur macOS, ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, sinon Chromium Playwright. Il lance une base en mémoire avec comptes synthétiques, bloque les appels externes et écrit ses preuves dans `test-results/student-tracking/`.

Les services distants DOM/shell, Drive, archivage et PostgreSQL de production restent dépendants de leur configuration existante. Cette V1 conserve les réponses et instantanés disponibles ; elle ne promet pas la restauration d’un processus ou d’une machine distante. Les listes sont paginées ; le store d’agrégats charge encore des collections en mémoire côté serveur, sans objectif de charge mesuré. Voir la [recette AC01–AC20](acceptance.md).
