# Cours de programmation interactifs

Extension explicite `programming-1` de `DailyLessonSpec` 1.0, transportée dans le ZIP natif `.tweenteach.zip` version 1. La famille existante `Programmation` et le profil d’atelier `algorithm` sont réutilisés. La famille seule ne sélectionne jamais le nouveau lecteur.

## Choisir le type dans TweenTeach

Le champ **Type de séance** propose **Conception web** et **Programmation** lors de l’insertion ou de la modification d’un créneau, dans la fenêtre **Préparer une séance** et sur la page de préparation. Le choix est enregistré dans la planification. Il reste distinct de la catégorie historique du classeur.

Pour créer le cours fourni directement depuis TweenTeach :

1. Ouvrir **Préparer** sur un créneau de la planification et choisir **Programmation**.
2. Choisir **Tableaux, parcours et fonctions · parcours complet** (360 minutes), **Séance 1 · tableaux, for et fonctions** (180 minutes), ou **Séance 2 · while, forEach et décomposition** (180 minutes).
3. Vérifier la durée du créneau, puis préparer la séance. Le contenu choisi est copié dans un brouillon modifiable avec ses ressources et ses interactions. Cette création utilise le corpus fourni, sans appel IA.
4. Relire l’aperçu élève, adapter le brouillon si nécessaire, puis publier avec l’action habituelle.

Le parcours complet conserve ses deux séances internes de 180 minutes ; il ne crée pas automatiquement deux dates dans la planification. Pour deux créneaux distincts, préparer la séance 1 sur le premier, puis la séance 2 sur le second. La durée des ateliers n’est pas réduite pour faire entrer le corpus dans un créneau trop court. **Conception web** conserve le parcours de préparation web existant.

## Importer l’archive fournie

1. Démarrer TweenTeach avec `npm run dev`, puis ouvrir l’espace professeur.
2. Dans **Séances**, choisir **Importer des séances** et sélectionner `Tableaux_Parcours_Fonctions_TweenTeach (2).zip`.
3. Cliquer **Analyser le fichier**. Le récapitulatif affiche Programmation, 2 séances de 180 minutes, 28 activités, les ressources, les capacités et les conversions.
4. Garder **Ajouter**, puis confirmer le récapitulatif. Le cours est créé en **brouillon**. Aucun cours n’est publié par l’import.
5. Ouvrir **Aperçu élève** : choisir la séance dans la barre latérale, puis l’un de ses cinq repères et un atelier. Le bilan de la séance 2 permet d’ouvrir le transfert différé, hors des 360 minutes obligatoires.
6. Après relecture, utiliser la publication habituelle. La publication reste une action explicite du professeur. Ce diagnostic est une réactivation formative ; il ne produit pas de note automatique.

Le fichier source doit correspondre à la famille examinée `eden-tableaux-1`. Le comparatif est lu comme des données littérales dans `wireComparison` : programmes, fonction appelée et arguments. Une modification de l’interface, des commentaires ou des fins de ligne ne bloque plus cet import. Les expressions calculées ou ambiguës sont refusées ; déclarer alors les données dans `07_SOURCES_EDEN/lesson.json` → `programming.comparisons`, ou produire un paquet canonique. Cette déclaration explicite est prioritaire. Les tailles et empreintes du manifeste restent vérifiées. Il n’y a aucune exécution des scripts du ZIP pendant l’import.

Un réimport identique ne crée pas de version. Un remplacement de brouillon crée une nouvelle version et conserve l’historique. Pour un cours déjà publié, le récapitulatif demande d’ajouter une préparation distincte : la nouvelle version doit être relue en brouillon. Les travaux existants restent rattachés à leur affectation/version.

## Interface et contenu du cours

Le lecteur reprend la palette bleue, les cartes, les repères latéraux et la disposition du document fourni : visualisation à gauche, éditeur à droite, puis lecture pas à pas, console, indices et tests. Les ouvertures réunissent la mission et les deux questions de départ. Les bilans réunissent le texte à trous, les décisions à expliquer et la question supplémentaire. Le mémo et le comparatif `for` / `while` / `forEach` sont disponibles dans le cours.

Les textes particuliers à ce corpus sont conservés dans `programming.presentation` : titres, introductions, données de mission, mémo, tableaux comparatifs, consignes et transitions. Ils voyagent avec le ZIP canonique et restent modifiables. Les styles sont limités au lecteur ; l’authentification, la navigation TweenTeach et la sauvegarde restent celles de l’application.

Les ateliers autonomes et le transfert différé conservent le code de départ, sans démonstration de leur solution. Les autres ateliers proposent **Voir l’exemple** et **Mon code**. Modifier le code ou les arguments invalide la trace précédente. Le bouton **Exporter .js** conserve le programme affiché ; **Exporter mon travail** conserve l’ensemble des réponses et brouillons du cours.

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

Importer ensuite le paquet par la même interface. Les corrections restent dans `reference`, distinctes de `interactive.demo`, volontairement visible. Laisser `interactive.demo` vide lorsqu’une solution ne doit pas être proposée, notamment pour un atelier autonome. Ne placer ni code privilégié, ni moteur personnalisé, ni corrigé privé dans une ressource élève. `programming.presentation` est facultatif ; ses références de blocs, de comparatifs et de programmes sont validées comme celles du cours.

L’outil existant de modification par prompt accepte les champs riches d’un brouillon importé ou créé depuis le parcours fourni et valide les relations après application. Le prompt de révision décrit les interactions à conserver. Le choix **Programmation** crée le parcours explicitement sélectionné ; il n’adapte pas automatiquement son sujet à une demande libre. Pour un autre cours, partir d’un modèle canonique ou réviser le brouillon. Les générateurs historiques de squelettes web/algorithm ne sont pas automatiquement convertis.

## Contrats et sauvegarde

- [ProgrammingCourse.json](../../schemas/ProgrammingCourse.json) : sélection du lecteur, famille, versions, moteur, capacités obligatoires, séances, prolongements, comparaisons, présentation facultative, provenance.
- [ProgrammingActivity.json](../../schemas/ProgrammingActivity.json) : variantes `code`, `quiz`, `cloze`. `Reflection` conserve son type natif.
- [DailyLessonSpec.json](../../schemas/DailyLessonSpec.json) : contrat complet existant, avec l’extension optionnelle.
- [engine.md](engine.md) : langage, budgets, trace et visualisations.
- [audit.md](audit.md) : refus initial, adaptation et limites de validation.

Les données de travail suivent `programming-work-1` : code, texte des arguments (même en cours de saisie), prédiction, réponses, indices consultés, réflexion, tentatives, résultats associés au code et aux arguments. La validation partagée est dans `public/programming/work.js`.

La sauvegarde réutilise `learning_progress`, `learning_events`, les affectations et le contrôle optimiste `progressVersion`. Le stockage local existant est séparé par compte et affectation/version. « Enregistrement demandé » n’annonce pas une synchronisation réussie ; le statut serveur est affiché dans **Mon travail**. Un conflit ne remplace pas automatiquement le travail distant.

**Exporter mon travail** produit `programming-course-work-1`, avec l’identité du cours et de sa version ainsi que les travaux des activités consultées ou renseignées. **Reprendre un fichier** accepte ce format et les anciens exports par activité `programming-work-1`. Il vérifie le cours, la version et les identifiants d’activités avant de demander le remplacement des brouillons présents dans le fichier. Les résultats et compteurs de tentatives importés sont réinitialisés ; ils ne deviennent jamais une note certifiée. La remise habituelle conserve le JSON complet et extrait le vrai fichier `main.js`, avec un reçu serveur.

Aucune migration SQL ni variable d’environnement supplémentaire. Les nouvelles données utilisent les tables et droits existants. Déployer les fichiers serveur, `public/programming/` et `data/programming/tableaux-source.zip` ensemble ; ce dernier fournit les modèles de création. Ne pas purger les versions historiques lors d’une mise à jour.

## Exemples et commandes de vérification

[examples/tableaux.tweenteach.zip](examples/tableaux.tweenteach.zip) est la conversion canonique riche du corpus fourni ; [examples/tableaux.lesson.json](examples/tableaux.lesson.json) expose son contrat pédagogique. Les fichiers originaux d’auteur restent présents dans le ZIP avec une audience professeur, pour conserver la traçabilité. Ils ne sont jamais une seconde source de rendu canonique.

```sh
npm run examples:programming
npm run test:programming
npm run test:programming:browser
node --import tsx --test tests/session-types.test.mjs
node --import tsx scripts/session-types-browser-check.mjs
npm run check
```

La recette navigateur utilise un stockage SQLite temporaire et Chrome/Chromium via Playwright ; elle ne touche pas aux cours de votre base de travail. Elle écrit son rapport et ses captures dans `test-results/programming/`. Voir [verification.md](verification.md) pour les résultats réellement obtenus.
