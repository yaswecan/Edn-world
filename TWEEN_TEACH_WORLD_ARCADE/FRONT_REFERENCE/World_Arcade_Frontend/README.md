# EDEN — World Arcade

Front HTML / CSS / JavaScript autonome, construit à partir de la maquette cyberpunk de la conversation.

## Démarrer

**Sans installation :** ouvrir `WORLD_ARCADE_AUTONOME.html`, placé à côté du dossier du projet. Le CSS, le JavaScript, les illustrations et les avatars sont intégrés dans ce fichier.

**Modifier les sources :** ouvrir `World_Arcade_Frontend/index.html`. Les fichiers restent séparés :

```text
World_Arcade_Frontend/
  index.html
  css/styles.css
  js/data.js         # Catalogue de jeux, joueurs fictifs, grades et avatars
  js/app.js          # Navigation, panneaux, formulaires, préférences
  js/games.js        # Deux petites démos Canvas 2D
  assets/           # Illustrations WebP et 15 portraits pixel art
  integration/      # Contrat du lanceur et consigne d’intégration
  previews/         # Captures réelles du front exécuté dans Chromium
  tests/            # Tests d’interface et résultats
  build_standalone.py
```

Un petit serveur statique peut être lancé depuis `World_Arcade_Frontend` :

```sh
python3 -m http.server 8080
```

Ouvrir ensuite `http://localhost:8080`. Aucun build npm, framework, compte externe ou clé API n’est nécessaire.

## Parcours livrés

L’écran d’accueil ouvre la salle après « Commencer » ou Entrée. Les deux bornes lancent des mini-missions distinctes. Le Top 5 change selon la période ; la page Classement ajoute des filtres par monde et par groupe fictif. La galerie contient 18 joueurs de démonstration, une recherche, un tri et une fiche par joueur.

Le profil permet de changer le pseudo et de choisir parmi 15 avatars. Les réglages permettent de couper le son, de réduire les animations, de retirer la trame CRT et de réinitialiser les données locales. Le menu est adapté au bureau, à la tablette et au mobile. Les dialogues sont navigables au clavier et se ferment avec Échap. La réduction des animations système est prise en compte.

Grades présentés : Rookie, Explorer, Operator, Specialist, Vanguard, Elite, Phantom, Legend et Prestige, avec divisions I / II / III. Le catalogue reprend la proposition précédente, avec Explorer à la place de Scout. Aucun seuil XP approuvé n’est supposé : le front n’invente pas de promotions automatiques. Le grade ne représente pas une note scolaire.

## Les jeux du prototype

**Code Station :** déplace-toi avec les flèches, ZQSD ou WASD. Approche les trois terminaux puis appuie sur E. Chaque terminal propose une instruction à choisir, liée aux variables, aux conditions ou aux boucles. Après trois réparations, rejoins le sas du haut.

**Cyber Funk 3026 :** déplace-toi avec les flèches gauche/droite, saute avec Espace et récupère cinq fragments sur les toits. Le portail est à l’extrémité droite. Une chute ramène au dernier toit ; les fragments déjà récupérés restent acquis.

P met en pause, R recommence la partie. Les boutons tactiles complètent le clavier. Une réussite rapporte 200 XP **locaux de démonstration**, une seule fois par jeu après chaque réinitialisation. Cette valeur n’est pas une règle de production.

**Il ne s’agit pas des moteurs complets Code Station / Cyber Funk de ton dépôt.** Ces deux mini-jeux rendent le front testable et illustrent les points d’entrée. Le lanceur dispose d’un événement remplaçable pour ouvrir tes vrais jeux.

## Ce qui est simulé — important

Les joueurs, groupes, présences et scores du classement sont fictifs. Ils ne sont pas connectés aux comptes élèves. Il n’y a ni classement partagé, ni serveur multijoueur, ni évaluation certifiée.

Les formulaires de connexion et d’inscription sont des démonstrations d’interface. Une soumission valide ouvre un profil local ; elle ne vérifie pas l’identité, n’envoie pas d’e-mail et ne crée pas de compte en ligne. Utiliser des valeurs fictives. **Aucun e-mail ni mot de passe n’est transmis ou stocké par ce front.** Aucun service réseau d’authentification n’est appelé.

Seuls le pseudo, l’avatar, les préférences et les deux missions terminées sont sérialisés dans la clé `eden.world-arcade.front.v1` de `localStorage`. Si ce stockage est bloqué, l’interface affiche un message et continue de fonctionner pendant la session. Les données locales sont modifiables par le joueur : elles ne doivent jamais faire autorité pour les grades ou classements réels.

## Intégrer à TweenTweach

Lire `integration/PROMPT_INTEGRATION_TWEENTWEACH.md` et `integration/launcher-example.js`.

Le clic Jouer émet un événement annulable :

```js
window.addEventListener('worldarcade:launch', (event) => {
  const { gameId } = event.detail;
  // Résoudre ici la route réelle du dépôt, puis appeler preventDefault()
  // pour empêcher le lancement de la mini-démo.
});
```

Identifiants : `code-station` et `cyber-funk`. L’API UI expose également `WorldArcade.navigate(route)`, `WorldArcade.launch(gameId)` et `WorldArcade.notify(message)`.

Le CSS de cette livraison est conçu pour une page autonome. **Ne pas l’importer globalement dans l’interface pédagogique existante.** Choisir un layout dédié, un iframe maîtrisé ou adapter les sélecteurs sous un conteneur `.world-arcade` lors du portage.

L’inscription réelle, la vérification d’e-mail, les sessions, la récupération de mot de passe, les permissions, la validation des scores et les profils publics doivent être reliés au backend existant. Ne pas remplacer les comptes élèves ni leur progression par les fixtures de ce prototype. Les listes de classe et les données scolaires doivent rester dans leur périmètre autorisé ; un compte externe ne devient pas un compte élève ou professeur.

## Illustrations, polices et dépendances

Les illustrations et portraits proviennent de recadrages de la maquette générée jointe à la conversation, pas des photos de stock filigranées. Les bornes, boutons, panneaux, textes, bordures et lumières sont de véritables éléments HTML/CSS. La capture complète n’est jamais utilisée comme interface cliquable.

Les polices Google Fonts Barlow Condensed, Space Grotesk et Silkscreen sont chargées **facultativement** par une feuille de style distante. Aucune police n’est embarquée. Sans réseau, les polices système prennent le relais ; les fonctions, visuels WebP et logos pixel vectoriels restent disponibles. Pour une exploitation avec élèves, supprimer ces liens ou appliquer la politique de chargement de polices de l’établissement. Les tests et captures joints utilisent les polices de secours, les accès externes étant bloqués dans l’environnement de test.

Aucune bibliothèque JavaScript externe. Les deux démos utilisent Canvas 2D ; le son utilise Web Audio, uniquement après une action du joueur. Aucun son ni asset n’est téléchargé au lancement d’une partie.

## Tests et limites de vérification

Le rapport détaillé est dans `tests/results.json`. Les captures de `previews/` sont produites par le navigateur à partir du HTML livré.

Les parcours d’interface ont été vérifiés sous Chromium : accueil, jeux, galerie, recherche et filtres, classements limités à cinq, grades, formulaire d’inscription, choix d’avatar, absence de secrets dans les données sérialisées, réglages, ouverture des deux démos, terminal et correction, pause, reprise, fermeture et commandes mobiles. Vérifications de débordement horizontal à 1440 × 1050 et 390 × 844.

Le banc de test injecte le HTML autonome dans `about:blank`, car la navigation réseau est interdite dans l’environnement de vérification. Un adaptateur de stockage en mémoire vérifie la sérialisation applicative. **La persistance native sous `file://`, Safari sur iPhone réel, l’authentification serveur, les API du projet et le plein écran natif n’ont pas été validés dans ce banc.** Ce n’est pas un audit complet d’accessibilité ni de sécurité.

Pour relancer :

```sh
pip install playwright
playwright install chromium
python3 tests/smoke_test.py
# Ou avec un Chromium déjà installé :
python3 tests/smoke_test.py --chromium /chemin/vers/chromium
```

Pour reconstruire le HTML autonome après modification des sources :

```sh
python3 build_standalone.py
```

Le script écrit `WORLD_ARCADE_AUTONOME.html` dans le dossier parent.
