# Code Station — exploration des cinq mondes

Recette locale du 8 octobre 2026. Les 20 missions du catalogue ont été parcourues dans Chrome jusqu’à leur victoire, par les vrais lanceurs et avec des déplacements clavier. Le jeu du jour a aussi été parcouru depuis le bouton « Jouer » de la séance. État de publication : **aucun déploiement effectué**.

## Essayer

```sh
npm run preview:exploration -- --source .data/chatgpt-personal/courses.sqlite --date 2026-10-08
```

Ouvrir <http://arcade.localhost:4187/arcade#arcade>. Connexion : élève `student-a`, classe `A1`, mot de passe `synthetic-test-password`. Choisir une mission dans le sélecteur de la borne Code Station. L’option `--source` est facultative ; sans elle, le script utilise une séance synthétique. `EDEN_EXPLORATION_PORT` permet de changer le port.

Cette recette monte l’application réelle avec 20 affectations de test, une base en mémoire et des comptes synthétiques. Elle ne charge pas `.env.local`. La source du jour est ouverte en lecture seule ; aucun compte, réponse ou session réel n’est importé. Les parties de recette disparaissent à l’arrêt. Le lien direct de la séance copiée est affiché dans le terminal.

Commandes : flèches, ZQSD/WASD, clic sur le sol ou pavé tactile ; E ou le bouton contextuel pour interagir. Rejoindre le relais, réparer la commande au poste indiqué, puis marcher jusqu’à la destination finale et l’activer. « Exécuter » montre les résultats et les logs ; « Vérifier et appliquer » contrôle tous les scénarios. Échap ferme le poste et rend le contrôle au personnage.

## Inventaire et cause

Le catalogue métier `data/game-catalog.json` contient cinq mondes et quatre missions par monde. Avant cette modification, **les cinq mondes lançaient le même lecteur plat** de `public/game/runtime.js` : éditeur, scénarios et liste de missions, sans personnage, carte, déplacement ni conclusion spatiale. Le jeu du jour n’avait pas un moteur distinct : le générateur affectait une mission de ce catalogue, puis le bouton Jouer ouvrait ce même runtime. C’était la cause commune du problème.

| Entrée réelle | Parcours et autorisation | Runtime après modification |
| --- | --- | --- |
| `/arcade` → Commencer → Code Station | Sélection d’une mission affectée, `POST /api/arcade/launch`, hash `#jeu/<runId>` | Contexte autorisé puis `/game/index.html` |
| Sélecteur de la borne : Code Station, Assault, Bunker, Rocket, Infiltration | Même API, avec la séance et la mission choisies | Même moteur, carte propre au monde |
| Mon espace → Reprendre | Nouvelle autorisation de l’affectation et sauvegarde du joueur | Même moteur et même mission |
| Lien `/arcade#jeu/<runId>` ou rafraîchissement | `GET /api/game/runs/:id/context`, contrôle élève/classe/version/affectation | Même moteur et état restauré |
| Séance `/today?lesson=…` → Jouer | `POST /api/game/runs`, puis même endpoint de contexte | Même iframe dans le dialogue de la séance |
| Briefing → Commencer la mission / Reprendre | Ouverture du monde déjà autorisé | Personnage et carte ; aucun poste distant |

Le jeu du **8 octobre 2026**, séance **« Ne laisser aucun secteur »**, est réellement affecté à **Assault / Inventaire drones** (`A1:assault:array:v1`). Sa copie de recette emploie `assault-recovery`. Les autres jours suivent leur propre affectation ; aucun thème Assault n’est imposé au générateur.

Cyber Funk est une autre borne, déjà indisponible côté métier : aucun jeu absent n’a été créé. Les mini-jeux de démonstration du pack World Arcade ne sont pas des substituts au catalogue.

### Sources retrouvées et décisions

La référence jouable est `legacy/pedagolab/public/legacy/code-station-v6.html`. Elle contient quatre decks et son propre ancien shell. Elle n’était pas montée par les lanceurs de l’application actuelle. Le premier deck a été ouvert avec un compte local synthétique ; le déplacement et l’accès physique au terminal énergie ont été vérifiés. Son dessin Canvas, son personnage orange animé, ses PC et ses principes de collision constituent le socle réutilisé. Le fichier original est inchangé.

L’archive accessible `PEDAGOLAB_WORLDS_V7_1_CURRICULUM 2.zip` contient cette même référence et l’ancienne application. Aucun autre moteur cartographique adapté à Assault, Bunker, Rocket ou Infiltration n’a été trouvé dans les sources et archives du projet. Les branches accessibles sont `main` et `origin/main`. Les decks archivés ne sont pas des campagnes affectables dans le catalogue actuel : leur ancien système de comptes/XP n’a pas été réintroduit.

| Monde | État avant | Décision et carte livrée |
| --- | --- | --- |
| Code Station | Lecteur plat ; deck historique non raccordé | Réutiliser la géométrie, les obstacles et le dessin du premier deck ; ajouter les accès et étapes de la mission affectée : `station-deck-01` |
| Assault | Challenges de drones sans carte | Créer `assault-recovery` avec accès endommagé, relais, poste central, baie de drones ; conserver tableaux, conditions, formation et contrôleur |
| Bunker | Commandes et healthcheck sans carte | Créer `bunker-services` : chemin coudé entre accès souterrain, local technique, services et sas de surface |
| Rocket | Exercices de lancement sans carte | Créer `rocket-launch` : préparation, télémétrie, commande et pas de tir disposés en U |
| Infiltration | Analyse HTTP/logs sans carte | Créer `infiltration-trace` : réseau en boucle, archives et deux accès de confinement verrouillés |

Les quatre nouvelles cartes utilisent les composants Canvas extraits de la référence. Leurs géométries, obstacles, portes et destinations diffèrent. Aucun asset distant ou nouveau paquet n’est nécessaire. Les effets allument les postes, animent les installations et ouvrent les accès ; Assault montre les drones et leurs états de recharge/déploiement.

## Matrice jouée jusqu’à la victoire

Chaque ligne utilise **StationRenderer / Expedition**, chargé par `/game/index.html`. Identifiant canonique : `<classe>:<monde>:<mission>:v1`. Pour chaque ligne : lancement réel depuis la borne, marche jusqu’au relais et au poste, mauvais résultat sans déblocage, essai sans déblocage, validation répétée sans double progression, marche vers la destination et action finale. La progression n’est jamais écrite ni le personnage téléporté par le test.

| Monde / mission | Nom | Carte | Objectif | Victoire physique | Résultat |
| --- | --- | --- | --- | --- | --- |
| code-station / battery | Énergie critique | station-deck-01 | Rétablir la réserve | Activer le sas de transit | PASS |
| code-station / motors | Relancer les moteurs | station-deck-01 | Relancer les modules | Activer le sas de transit | PASS |
| code-station / access-card | Badge d’accès | station-deck-01 | Réparer le badge HTML/CSS | Activer le sas de transit | PASS |
| code-station / station-final | Réparer la station | station-deck-01 | Réparer la propulsion | Activer le sas de transit | PASS |
| assault / array | Inventaire drones | assault-recovery | Recenser les drones actifs | Sécuriser la baie | PASS |
| assault / energy | Décision énergie | assault-recovery | Rétablir la recharge | Sécuriser la baie | PASS |
| assault / formation | Formation | assault-recovery | Organiser les drones actifs | Sécuriser la baie | PASS |
| assault / assault-final | Contrôleur d’escouade | assault-recovery | Réparer le contrôleur | Sécuriser la baie | PASS |
| bunker / shell | SHELL MAZE | bunker-services | Localiser la console | Activer la remontée en surface | PASS |
| bunker / service | Service vital | bunker-services | Diagnostiquer la ventilation | Activer la remontée en surface | PASS |
| bunker / network | Liaison interne | bunker-services | Diagnostiquer la liaison | Activer la remontée en surface | PASS |
| bunker / bunker-final | Healthcheck | bunker-services | Réparer la surveillance | Activer la remontée en surface | PASS |
| rocket / pythagore | La diagonale oubliée | rocket-launch | Calibrer la trajectoire | Autoriser le décollage au pas de tir | PASS |
| rocket / sequence | Séquence de lancement | rocket-launch | Rétablir la séquence | Autoriser le décollage au pas de tir | PASS |
| rocket / countdown | Compte à rebours | rocket-launch | Synchroniser l’horloge | Autoriser le décollage au pas de tir | PASS |
| rocket / rocket-final | Contrôleur de lancement | rocket-launch | Réparer le contrôleur | Autoriser le décollage au pas de tir | PASS |
| infiltration / http | Trace HTTP | infiltration-trace | Identifier la trace | Sceller l’incident au confinement | PASS |
| infiltration / logs | Journal d’événements | infiltration-trace | Retrouver les erreurs | Sceller l’incident au confinement | PASS |
| infiltration / anomaly | Anomalie de session | infiltration-trace | Détecter les sessions suspectes | Sceller l’incident au confinement | PASS |
| infiltration / infiltration-final | Rapport incident | infiltration-trace | Reconstituer l’incident | Sceller l’incident au confinement | PASS |
| Jeu du jour, 08/10/2026 | Inventaire drones | assault-recovery | Recenser les drones de secours | Sécuriser la baie depuis la séance | PASS |

La [matrice JSON exécutée](EXPLORATION_PREUVES/missions.json) conserve aussi le moteur et l’objectif pour chaque variante. La [recette du jour](EXPLORATION_PREUVES/daily.json) vérifie la reprise de la partie de la séance depuis l’arcade et le rendu mobile à 390 px.

## Architecture et fichiers

| Fichiers | Responsabilité |
| --- | --- |
| `public/game/mission-model.js` | Cartes, géométrie, navigation, compilation contrôlée des missions, effets, graphe et signatures de reprise ; partagé avec le serveur |
| `public/game/world-renderer.js` | Dessin extrait de la référence, caméra, personnage, objets, portes, mini-carte et transformations |
| `public/game/runtime.js`, `index.html`, `style.css` | Boucle d’exploration, briefing, objectifs, clavier/tactile, proximité, poste, aides et victoire |
| `public/game/challenge-runner.js` | Worker jetable pour JavaScript, vrais logs/erreurs, comparaison des résultats, limites de temps et de sortie |
| `public/game/layout-frame.js` | Aperçu HTML/CSS inerte dans une iframe opaque, validation de la géométrie visible ; alternatives flex/grid acceptées |
| `server/game.mjs`, `server/app.mjs` | Validation commune avant lancement/contexte/événements ; définition d’exploration dans le contexte autorisé ; CSP du jeu |
| `server/generator.mjs`, `server/mission-authoring.mjs` | Sélection et affectation de missions compatibles ; mission invalide écartée avec motif dans le guide professeur |
| `server/contracts.mjs`, `schemas/DailyLessonSpec.json` | Métadonnées facultatives `mapId` / `missionSignature`, compatibles avec les séances sauvegardées |
| `public/world-arcade/app.js`, `public/app.js`, `public/style.css` | Deux lanceurs conservés, même runtime, sauvegarde du dernier brouillon avant fermeture, suppression de l’iframe, dialogue de séance agrandi |
| `scripts/exploration-*.mjs`, `tests/exploration*.test.mjs`, `tests/fixtures/exploration.mjs` | Audit, aperçu jouable, tests de données/API et parcours navigateur |
| Scripts navigateur arcade/compte/élève/hôte, `package.json`, `README.md` | Recettes adaptées à l’accès physique aux postes et commandes documentées |

Les missions sont composées à partir du catalogue approuvé : point de départ, relais, poste/challenge, effet sur les machines et portes, puis destination finale. Le compilateur contrôle les cartes, outils, fichiers, scénarios, objets, cibles d’effets, dépendances et chemins successifs. Le serveur refuse une mission invalide avec un message explicite. Le runtime ne retombe jamais sur un lecteur plat.

La sauvegarde garde les brouillons existants et ajoute `worldProgress[world].explorations[missionId]` : position, étapes et signature. Les effets sont reconstruits de manière idempotente ; un état d’une autre mission/version est ignoré, une position dans un mur revient au départ. Une modification en cours invalide un résultat asynchrone. Le code élève ne reçoit ni le monde ni le canal de communication hôte.

Les essais JavaScript disposent d’un délai de démarrage distinct, puis de **1,5 seconde d’exécution**, avec **100 lignes / 64 000 caractères** de logs au maximum. Une boucle infinie est interrompue. Les simulations de commandes et la réponse HTTP suivent les exercices existants. La vérification des scénarios ouvre les portes ; seule l’interaction finale émet la fin de mission. L’état reste `completed_unverified` côté métier : aucune note, maîtrise, récompense ou validation professeur n’est inventée.

## Captures

Toutes les captures utilisent des comptes synthétiques. Les références originales restent intactes.

| Parcours | Avant / monde | Poste ouvert | Effet / conclusion |
| --- | --- | --- | --- |
| Référence Code Station | [Deck historique](EXPLORATION_CAPTURES/reference-deck.png) | [Ancien poste physique](EXPLORATION_CAPTURES/reference-terminal.png) | [Deck raccordé](EXPLORATION_CAPTURES/code-station-world.png) |
| Assault | [Ancien lecteur](EXPLORATION_CAPTURES/assault-before.png), [monde](EXPLORATION_CAPTURES/assault-world.png) | [Contrôleur](EXPLORATION_CAPTURES/assault-terminal.png) | [Drones actifs et accès ouverts](EXPLORATION_CAPTURES/assault-restored.png) |
| Jeu du jour | [Ancien lecteur](EXPLORATION_CAPTURES/daily-before.png), [monde](EXPLORATION_CAPTURES/daily-world.png) | [Inventaire](EXPLORATION_CAPTURES/daily-terminal.png) | [Transformation](EXPLORATION_CAPTURES/daily-restored.png), [victoire](EXPLORATION_CAPTURES/daily-victory.png), [mobile](EXPLORATION_CAPTURES/daily-mobile.png) |

## Contrôles et limites

| Contrôle | Résultat |
| --- | --- |
| 20 variantes parcourues au clavier jusqu’à la victoire | PASS — Chrome 154, [preuve](EXPLORATION_PREUVES/missions.json) |
| Jeu réellement affecté au 08/10, Jouer → victoire → reprise arcade | PASS — [preuve](EXPLORATION_PREUVES/daily.json) |
| Collision, blur, code isolé, validation annulée, fermeture avec dernière édition | PASS — [preuve](EXPLORATION_PREUVES/inputs.json) |
| Graphes, cartes fermées/ouvertes, version de sauvegarde, refus API | PASS — 6 tests, [log](EXPLORATION_PREUVES/exploration-tests.log) |
| Arcade, lancement, erreur réseau, reprise, droits, formats d’écran | PASS — 11 parcours, [preuve](EXPLORATION_PREUVES/arcade.json) |
| Compte, badge approuvé par professeur, mot de passe, logout, reprise | PASS — 10 parcours, [preuve](EXPLORATION_PREUVES/account.json) |
| Élève : connexion, séance, arcade, retour avec réponse conservée, mobile | PASS — [preuve](EXPLORATION_PREUVES/student.json) |
| `npm test` | 285/290 au premier passage ; trois échecs et deux annulations dans les tests de processus/ports sous charge. Les deux fichiers concernés repassent seuls : 6/6 PASS. Tous les cas passent sur l’ensemble des deux exécutions. [Suite](EXPLORATION_PREUVES/unit-tests.log), [reprise ciblée](EXPLORATION_PREUVES/retest-timing.log) |
| `npm run build` | PASS — syntaxe, schémas et invariants existants, [log](EXPLORATION_PREUVES/build.log) |
| Pont du pack `launcher-bridge.test.mjs` | PASS — 23 tests |
| Ancien `scripts/browser-check.mjs` | FAIL avant le jeu : génération bloquée dans sa fixture sans modèle IA configuré ; flux professeur complet non validé par ce script. [Log](EXPLORATION_PREUVES/host-regression.log) |
| Intégrité du pack | 103 PASS, 2 FAIL de hash sur le même `FRONT_REFERENCE/WORLD_ARCADE_AUTONOME.html`, 1 NOT RUN (`jsonschema` absent). Ce fichier est identique à HEAD, SHA-256 `c40a21dd3f9131d467eb1866272d16ff8f1b98157361b02662c05157458ce263`. Référence et inventaire non retouchés. [Preuve](EXPLORATION_PREUVES/pack.json) |
| Production, appareils physiques et autres moteurs de navigateur | NOT RUN |

Les walkthroughs ont fait corriger des angles de navigation trop serrés, un obstacle du pas de tir, le contournement d’une porte d’Infiltration, le délai initial des Workers et une fermeture tardive qui pouvait remplacer une navigation déjà engagée. Les tests finaux de leur périmètre passent.

Les activités shell de Bunker restent une **simulation locale annoncée**, sans accès à un shell système ou à des services distants. Les variantes d’un même monde partagent sa carte, mais conservent leurs fichiers, scénarios, compétence et effet nommé ; une mission affectée est un relais, un challenge puis une conclusion physique, pas la réintroduction des quatre decks de l’ancienne campagne. Les contenus pédagogiques préexistants, y compris certains starters déjà corrects, sont conservés.

Aucune migration de base, suppression de compte, publication de séance ou modification des données réelles n’a été effectuée. Le contrôle pédagogique serveur et le drapeau `EDEN_WORLD_ARCADE` existants restent applicables. Le build local ne constitue pas un déploiement.

Pour reproduire les contrôles principaux :

```sh
npm run test:exploration
npm run test:exploration:browser
node --import tsx scripts/exploration-daily-check.mjs --source .data/chatgpt-personal/courses.sqlite --date 2026-10-08
node --import tsx scripts/exploration-input-check.mjs
ARCADE_REPORT_DIRECTORY=test-results/exploration/arcade-regression node --import tsx scripts/arcade-browser-check.mjs
ARCADE_REPORT_DIRECTORY=test-results/exploration/account-regression node --import tsx scripts/arcade-account-browser-check.mjs
node --import tsx scripts/student-access-browser-check.mjs --source .data/chatgpt-personal/courses.sqlite --date 2026-10-08
npm run build
```

Les nouveaux scripts navigateur utilisent `PLAYWRIGHT_CHROMIUM_EXECUTABLE` ou Chrome installé sur ce poste. Les rapports temporaires complets restent dans `test-results/exploration/` ; les preuves sélectionnées ci-jointes permettent la revue depuis le dépôt.
