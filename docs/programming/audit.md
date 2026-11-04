# Audit et migration du paquet EDEN

## Refus initial confirmé dans le dépôt

- `server/lesson-package.mjs` n’acceptait que `manifest.json`, `lessons/<id>.json` et `files/<sha256>`. Les chemins du corpus `00_MANIFEST/…`, `07_SOURCES_EDEN/…` étaient donc rejetés avant lecture. Un unique dossier enveloppant n’est pas dangereux en soi.
- Le manifeste du corpus a `schemaVersion: 2` ; le contrat natif de transport a `format: tweenteach`, `version: 1`, des séances portables et des fichiers adressés par empreinte. Ce ne sont pas deux versions interchangeables du même document.
- `server/contracts.mjs` exigeait un diagnostic objet, `planEntryId` chaîne, `planVersion` entier et des métadonnées sources typées. Le cours fourni a `diagnostic: null` et plusieurs métadonnées nulles.
- Les activités `FillBlank` étaient typées ainsi même lorsque les JSON auteur décrivaient des choix avec feedbacks. Les données nécessaires à l’expérience — démos, appels, diagrammes, segments, variantes — n’existaient pas dans le contrat du lecteur natif.
- `server/safe-js.mjs` ne prenait pas en charge `while` et `forEach`, essentiels aux ateliers fournis.
- L’application possède déjà une classification `Programmation` et un profil `algorithm`, un transport transactionnel, des versions, une projection élève en liste blanche, des ressources protégées et des sauvegardes avec conflit optimiste. Ces mécanismes sont réutilisés.

## Adaptation déterministe

L’adaptateur `server/programming/adapter.mjs`, identifié `eden-tableaux-1`, lit les JSON sans exécuter les scripts. Les 64 fichiers sont contrôlés : 63 fichiers inventoriés plus le manifeste. Chemins, collisions après normalisation NFC, liens, en-têtes ZIP, quotas, tailles et SHA-256 sont vérifiés avant transformation. Une racine directe ou un unique dossier enveloppant sont acceptés. Les bornes existantes restent 64 Mio compressés, 128 Mio décompressés, 16 Mio par fichier et 1 000 entrées.

`lesson.json` et `activity-specs.json` doivent contenir les mêmes activités. Les programmes de départ, références et tests auteur sont comparés par identifiant. Les choix et mots attendus doivent rester cohérents entre sources. Les identités, versions, rattachements et durées sont vérifiés. Les erreurs donnent un fichier, un pointeur, la valeur reçue, la contrainte et une action ; les erreurs de schéma riches conservent aussi les détails AJV.

Résultat : 10 CodeEditor, 12 Quiz et 2 Quiz de rappel avec leurs propres identifiants, 2 vrais FillBlank segmentés, 2 Reflection. Les 54 tests et les erreurs volontaires des départs sont conservés. `a10-transfert` reste facultatif, conserve sa durée et n’ajoute aucun bloc au déroulé de 360 minutes.

Le diagnostic séparé devient un diagnostic natif formatif avec `activityIds: [q1-indice, q2-for]`, `tasks: []` et `rubric: []`. Ses questions sont les activités existantes et leurs réponses utilisent le suivi de séance. Il n’y a ni copie d’activité ni tentative diagnostique notée artificielle. Les diagnostics évaluatifs historiques restent inchangés.

Le comparatif extrait après lecture de `lesson.js` est devenu `programming.comparisons`. L’adaptateur reconnaît l’empreinte du script examiné ; un script différent exige une migration déclarative explicite. `course-data.js` n’est pas nécessaire : aucune extraction de JavaScript et aucune évaluation ne sont réalisées.

Les ressources originales restent dans le corpus professeur pour l’audit, y compris les HTML autonomes et les scripts qui contiennent des corrections. Seuls le mémo PDF, les consignes et les départs sont exposés comme ressources élèves. La projection `studentSpec` expose les démonstrations et feedbacks formatifs voulus, mais masque `reference`, les tests privés et les guides. Les URL de fichier sont autorisées uniquement si elles figurent dans une version affectée au compte élève. Les sources originales ne deviennent jamais des fichiers publics.

## Transactions, versions et compatibilité

L’adaptateur produit le même objet portable que le décodeur natif ; le précontrôle, la confirmation, l’écriture des ressources et de la version, les correspondances de réimport et les reçus utilisent le transfert existant. Une erreur avant ou pendant la transaction ne crée pas de cours partiel. Aucun schéma SQL supplémentaire.

Le lecteur est sélectionné seulement par `programming.format === programming-1` après validation des capacités et du moteur. Une activité ou capacité inconnue est refusée, sans repli silencieux. Les anciens cours sans cette extension conservent leur lecteur et leurs moteurs. Les sources auteur ne servent plus au rendu après conversion : le format canonique est autonome.

Le corpus fourni reste complet lors de l’export, de la publication ou d’un changement d’intitulé ; il n’est pas remplacé par une reconstruction qui perdrait ses supports. Les nouveaux fichiers de correction restent protégés par les API professeur. Export canonique puis réimport conserve les données riches.

## Limites explicites

- Cet adaptateur concerne cette famille source et son comparatif vérifié. Les prochains cours doivent utiliser le format canonique ; il ne s’agit pas d’un importeur universel d’HTML ou de JavaScript.
- Le diagnostic de ce corpus est formatif, pas une conversion arbitraire en évaluation sur 20.
- Les tests navigateur automatisés utilisent Chrome local et des bases isolées. Ils ne prouvent pas une publication sur l’instance de production ni une synchronisation dans votre base réelle.
- Les contrôles clavier, focus, largeur et préférences de mouvement ne remplacent pas un audit complet avec lecteurs d’écran.
- L’assistant IA peut modifier un brouillon riche depuis un modèle importé. Le générateur historique de squelettes n’a pas été remplacé et aucun résultat d’appel IA réel n’est revendiqué.
- Les programmes dépassant les budgets ou utilisant un JavaScript hors sous-ensemble nécessitent une adaptation de contenu ou un futur moteur applicatif déclaré, jamais un script privilégié fourni par le paquet.
