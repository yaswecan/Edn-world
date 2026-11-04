# Cours de programmation interactifs

Extension explicite `programming-1` de `DailyLessonSpec` 1.0, transportée dans le ZIP natif `.tweenteach.zip` version 1. La famille existante `Programmation` et le profil d’atelier `algorithm` sont réutilisés. La famille seule ne sélectionne jamais le nouveau lecteur.

## Importer l’archive fournie

1. Démarrer TweenTeach avec `npm run dev`, puis ouvrir l’espace professeur.
2. Dans **Séances**, choisir **Importer des séances** et sélectionner `Tableaux_Parcours_Fonctions_TweenTeach (2).zip`.
3. Cliquer **Analyser le fichier**. Le récapitulatif affiche Programmation, 2 séances de 180 minutes, 28 activités, les ressources, les capacités et les conversions.
4. Garder **Ajouter**, puis confirmer le récapitulatif. Le cours est créé en **brouillon**. Aucun cours n’est publié par l’import.
5. Ouvrir **Aperçu élève** : changer de bloc avec le sélecteur, d’atelier avec les boutons. Le transfert facultatif est accessible dans le dernier bloc, hors des 360 minutes obligatoires.
6. Après relecture, utiliser la publication habituelle. La publication reste une action explicite du professeur. Ce diagnostic est une réactivation formative ; il ne produit pas de note automatique.

Le fichier source doit correspondre à la famille examinée `eden-tableaux-1`. Un script de comparaison différent est refusé avec un diagnostic : produire alors un paquet canonique déclaratif. Il n’y a aucune exécution des scripts du ZIP pendant l’import.

Un réimport identique ne crée pas de version. Un remplacement de brouillon crée une nouvelle version et conserve l’historique. Pour un cours déjà publié, le récapitulatif demande d’ajouter une préparation distincte : la nouvelle version doit être relue en brouillon. Les travaux existants restent rattachés à leur affectation/version.

## Créer le prochain cours

Le modèle minimal est [examples/bibliotheque.lesson.json](examples/bibliotheque.lesson.json). Il utilise un autre contexte, les variables `stocks`, `position`, `total`, deux blocs et une séance de 35 minutes. [examples/minimal.tweenteach.zip](examples/minimal.tweenteach.zip) est directement importable.

1. Copier le JSON dans votre dossier de création. Changer `lessonId` pour une nouvelle identité, le titre, les objectifs et les compétences.
2. Définir les activités, les blocs, leurs identifiants et les séances. Conserver les liens `activityIds`, `studentFlow`, `timeline` et `programming.sessions` cohérents.
3. Écrire les départs, démonstrations, références privées, tests, prédictions, indices et réflexions. Toute activité doit être liée à un bloc ou déclarée facultative. Choisir les capacités réellement utilisées.
4. Modifier `programming.contentVersion` lors d’une révision de contenu. `lessonVersion` et les versions d’affectation sont gérés par l’application lors de l’import.
5. Construire et valider le paquet :

```sh
node --import tsx scripts/programming-package.mjs mon-cours.lesson.json mon-cours.tweenteach.zip
```

Les fichiers sont facultatifs. Pour en joindre, fournir un quatrième argument `resources.json`, tableau d’objets `{ "file": "memo.pdf", "path": "01_ELEVE/memo.pdf", "audience": "student", "mimeType": "application/pdf" }`. Les fichiers doivent rester sous le dossier de ce manifeste. Les liens du cours utilisent `tweenteach-file:<sha256>:<mimeType>` ; l’import les transforme en URL authentifiées. Aucun support professeur ne doit être référencé dans la projection élève. La commande calcule l’inventaire et refuse ces fuites.

Importer ensuite le paquet par la même interface. Les corrections restent dans `reference`, distinctes de `interactive.demo`, volontairement visible. Ne placer ni code privilégié, ni moteur personnalisé, ni corrigé privé dans une ressource élève.

L’outil existant de modification par prompt accepte les champs riches d’un brouillon importé et valide les relations après application. Le prompt de révision décrit les interactions à conserver. Les générateurs historiques de squelettes web/algorithm ne sont pas automatiquement convertis : partir du modèle canonique pour produire un cours avec ce lecteur. Aucun appel réel à un fournisseur IA n’a été nécessaire pour cette livraison ; les contrats et routes de révision sont testés avec les doubles de test du dépôt.

## Contrats et sauvegarde

- [ProgrammingCourse.json](../../schemas/ProgrammingCourse.json) : sélection du lecteur, famille, versions, moteur, capacités obligatoires, séances, prolongements, comparaisons, provenance.
- [ProgrammingActivity.json](../../schemas/ProgrammingActivity.json) : variantes `code`, `quiz`, `cloze`. `Reflection` conserve son type natif.
- [DailyLessonSpec.json](../../schemas/DailyLessonSpec.json) : contrat complet existant, avec l’extension optionnelle.
- [engine.md](engine.md) : langage, budgets, trace et visualisations.
- [audit.md](audit.md) : refus initial, adaptation et limites de validation.

Les données de travail suivent `programming-work-1` : code, texte des arguments (même en cours de saisie), prédiction, réponses, indices consultés, réflexion, tentatives, résultats associés au code et aux arguments. La validation partagée est dans `public/programming/work.js`.

La sauvegarde réutilise `learning_progress`, `learning_events`, les affectations et le contrôle optimiste `progressVersion`. Le stockage local existant est séparé par compte et affectation/version. « Enregistrement demandé » n’annonce pas une synchronisation réussie ; le statut serveur est affiché dans **Mon travail**. Un conflit ne remplace pas automatiquement le travail distant.

L’export JSON d’activité contient le cours, la version et l’activité ; le réimport vérifie ces identités et demande explicitement de remplacer le brouillon. Ses résultats sont invalidés et ne deviennent jamais une note certifiée. La remise habituelle conserve le JSON complet et extrait le vrai fichier `main.js`, avec un reçu serveur.

Aucune migration SQL ni variable d’environnement supplémentaire. Les nouvelles données utilisent les tables et droits existants. Déployer les fichiers serveur et `public/programming/` ensemble. Ne pas purger les versions historiques lors d’une mise à jour.

## Exemples et commandes de vérification

[examples/tableaux.tweenteach.zip](examples/tableaux.tweenteach.zip) est la conversion canonique riche du corpus fourni ; [examples/tableaux.lesson.json](examples/tableaux.lesson.json) expose son contrat pédagogique. Les fichiers originaux d’auteur restent présents dans le ZIP avec une audience professeur, pour conserver la traçabilité. Ils ne sont jamais une seconde source de rendu canonique.

```sh
npm run examples:programming
npm run test:programming
npm run test:programming:browser
npm run check
```

La recette navigateur utilise un stockage SQLite temporaire et Chrome/Chromium via Playwright ; elle ne touche pas aux cours de votre base de travail. Elle écrit son rapport et ses captures dans `test-results/programming/`. Voir [verification.md](verification.md) pour les résultats réellement obtenus.
