# Intégration World Arcade — 5 octobre 2026

Le module est intégré à l’application Express existante à **`/arcade`**, derrière **`EDEN_WORLD_ARCADE=1`** (désactivé par défaut). La tranche disponible fonctionne avec les comptes, missions, permissions et sauvegardes de Tween Teach. Aucun déploiement, accès à la base réelle, import de joueurs de démonstration ou migration réelle n’a été exécuté.

## Environnement et audit

- Node 22.14, Express 5, JavaScript ESM, HTML/CSS, npm et `package-lock.json` existant. Aucun framework ni dépendance ajouté.
- Aucun `AGENTS.md` hôte ou parent trouvé. Le `AGENTS.md` du pack et les documents 00/01/02/03/04/06, le corpus, les sources visuelles et les captures ont été examinés.
- Ce workspace ne contient pas de `.git` : pas de commit, branche ou diff Git disponible. `avant.sha256.json` et `CHANGEMENTS.json` documentent les fichiers examinés et l’état livré. Les fichiers de configuration secrets n’ont pas été lus ou modifiés.
- Tests de persistance dans **SQLite `:memory:` avec `url:''` explicite**. Les tests n’utilisent pas `.env.local`. Le schéma SQL existant reste identique.

## Fonctionnalités et statuts

| Fonction | Statut | Résultat |
| --- | --- | --- |
| Entrée, Commencer/Entrée, salle, navigation et liens profonds | Intégré et testé | Deux bornes HTML/CSS, ville, assets locaux, navigation clavier et retour du jeu. |
| Code Station | Intégré et testé | Adaptateur vers le runtime PédagoLab déjà utilisé par `spec.codeStation`. Choix des missions publiées de la classe ; IDs persistés conservés. |
| Autorisation et reprise | Intégré et testé | `authorizeGame`, `worldAccess`, activité autonome, affectation et publication contrôlés. Reprise par compte/monde/mission ; ancienne partie recontrôlée après fermeture ou changement de séance. |
| Sauvegarde | Intégré et testé | Même `player_progression` et même structure ; enregistrement transactionnel ; confirmation après réponse ; erreur et nouvelle tentative ; pas de récompense vérifiée issue du client. |
| Session et connexion scolaire | Intégré et testé | Cookie `eden_session` conservé. Formulaire utilise `/api/login`, règles et limitation hôtes. Retour au jeu demandé après connexion autorisée. Déconnexion réelle. |
| Profil et avatars | Intégré et testé | Champ JSON facultatif `arcadeProfile` sur l’identité existante ; pseudo, avatar et visibilité. Aucun identifiant/mot de passe dupliqué. |
| Galerie et fiche | Intégré et testé | Profils élèves configurés, pagination/recherche après filtrage serveur. Le professeur voit les profils de sa classe. L’élève voit son profil et les profils partagés avec sa classe. Privé par défaut ; aucun nom réel de remplacement. |
| Réglages | Intégré et testé | Son désactivé à chaque chargement, activable explicitement ; son bref, sans musique automatique. Réduction système prioritaire, CRT désactivable. Seules les préférences décoratives sont locales. |
| Cyber Funk | En attente de service | Aucun moteur trouvé dans `server/`, `public/`, `data/` ou `legacy/`. Borne indisponible, aucune mini-démo substituée. |
| Top 5, périodes et points | En attente de décision et de validateur | Aucun barème arcade serveur approuvé. Réponse `unavailable`, zéro entrée, aucun faux filtre ni score. Le client borne aussi à cinq lignes. Aucun classement réel prétendu. |
| Grades | En attente de décision | Aucun catalogue métier trouvé. Aucun grade personnel attribué ; les neuf grades proposés restent dans les références privées. |
| Inscription, vérification et récupération externes | En attente de service et de décision | L’hôte ne gère que les identifiants scolaires ; aucun fournisseur e-mail ou parcours externe. Écran fermé et opérations refusées côté serveur, pas de création simulée. Il faudra un fournisseur intégré à l’identité hôte et la politique publique/mineurs validée. |
| Communauté et classement publics | En attente de décision | Toujours fermés ; le drapeau UI ne les active pas. |
| PostgreSQL distant, e-mails réels, appareils physiques, publication | Hors périmètre exécuté | Non exécutés. Aucun résultat de production revendiqué. |

La galerie peut donc être vide au premier accès : les élèves existants n’ont pas été transformés en faux profils. Ils peuvent choisir un pseudo/avatar dans Mon profil. Les données scolaires restent accessibles uniquement via leurs outils hôtes et permissions habituelles.

## Raccordements et limites techniques

- `code-station` désigne l’entrée de lancement PédagoLab ; `lesson_versions.spec.codeStation.missionId` résout la vraie mission et son monde. Aucune renumérotation de sauvegarde. Les cinq mondes et leurs missions existants restent sous contrôle du professeur.
- `POST /api/arcade/launch` vérifie l’affectation puis retrouve/crée une partie dans une transaction hôte. Des ouvertures concurrentes de la même affectation retrouvent le même run, sans dépendre d’une clé client renouvelable.
- Les contextes, événements et sauvegardes des anciennes routes `/api/game/runs/:id/...` recontrôlent également les permissions. Une partie devenue interdite n’est pas réouverte par son URL directe.
- L’iframe du moteur existant garde `sandbox="allow-scripts"`, une origine opaque, la CSP sans réseau et les Workers limités. Dans World Arcade, seul le message de connexion non sensible utilise `*` ; contexte privé et événements utilisent un `MessagePort` dédié après contrôle de la fenêtre source et de l’origine opaque. Fermer le jeu détruit l’iframe et le port. L’ancien lanceur de séance reste compatible et testé.
- Les XP historiques internes au runtime restent déclaratifs. Ils ne deviennent ni points vérifiés, ni grades, ni preuves pédagogiques approuvées. Les résultats restent `review_required` jusqu’à validation professeur ; aucun service d’attribution arcade n’a été inventé.
- La liste de classe est filtrée serveur avant recherche, total et pagination (24 maximum). Le store hôte charge les agrégats de la classe en mémoire ; ce n’est pas une pagination SQL optimisée pour des milliers de membres.
- Le CSS n’est chargé que sur la page arcade, sous `.world-arcade`, avec tokens préfixés. Les polices sont système, aucun CDN. Les styles et renderers de cours n’ont pas été modifiés.
- Le générateur du runtime ne conservait pas certaines adaptations de microcopie déjà documentées dans `docs/student-wording.md`. Les adaptations de sauvegarde et de ressources sont maintenant conservées dans `scripts/game-runtime.mjs` ; les tests visuels et de jeu existants passent après régénération.

## Fichiers livrés

- Nouveaux : `server/arcade.mjs`, `public/world-arcade/{index.html,app.js,style.css,identity.js}`, les 18 images locales, `tests/arcade.test.mjs`, `tests/fixtures/arcade.mjs`, `scripts/arcade-browser-check.mjs`.
- Raccordement : `server/app.mjs`, `server/game.mjs`, `public/app.js`, `scripts/game-runtime.mjs`, `public/game/runtime.js`. Le runtime HTML/CSS a été régénéré depuis les sources hôtes.
- Configuration/documentation : `.env.example`, `.vercelignore`, `README.md`, ce dossier `SUIVI/`.
- Le pack de référence reste hors `public/` et est exclu des uploads Vercel. Aucun `ArcadeData`, `ArcadeGames`, fichier de démonstration, fixture ou corpus complet importé par le module connecté.

## Commandes et résultats

| Commande réellement exécutée | Résultat et preuve |
| --- | --- |
| `npm test` | 100 tests réussis à la passe complète : 86 existants + 14 arcade. `tests-unitaires.log`. |
| `node --import tsx --test tests/arcade.test.mjs` | 15/15 à la passe finale, dont le test supplémentaire de conservation des données. `tests-arcade.log`. |
| `npm run test:legacy` | 128/128. `tests-historiques.log`. |
| `npm run build` (exécute `npm run check`) | Syntaxe, exports de schémas et préservation des primitives Drive réussis. `build.log`. Aucun script lint/typecheck séparé défini. |
| `npm run test:visual` | 28/28, sans mise à jour des baselines. `tests-visuels.log`. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser` | Parcours hôte complet réussi, y compris Worker en boucle infinie interrompu. `parcours-hote.log`. |
| `node --import tsx scripts/arcade-browser-check.mjs` | 11 scénarios groupés réussis, aucun `pageerror`. `navigateur.log` et `navigateur.json`. |
| `python3 TWEEN_TEACH_WORLD_ARCADE/OUTILS/verifier_pack.py` | 105 contrôles réussis, 0 échec ; Python `jsonschema` absent, contrôle complémentaire ci-dessous. `verification-pack.log`. |
| `node --test TWEEN_TEACH_WORLD_ARCADE/OUTILS/launcher-bridge.test.mjs` | 23/23 contrôles du pont de référence. Il n’est pas utilisé par le module, qui appelle directement son adaptateur. `pont-reference.log`. |
| Validation du corpus avec `Ajv2020` déjà installé | Schéma draft 2020 validé, aucune installation. `schema-corpus.log`. |

L’essai initial sous sandbox avait annulé les tests API car les sockets locales renvoyaient EPERM. Ils ont ensuite réussi avec permission d’exécution élargie. Deux défauts du script navigateur (interception levée avant sa réponse, navigation vers la même URL sans rechargement) ont été corrigés, puis la recette complète relancée. Aucun échec n’a été assimilé à une réussite.

## Captures et comparaison

`navigateur.json` associe chaque capture à sa route, son rôle synthétique, son viewport et son environnement. `captures/` contient l’entrée, la salle visiteur, l’inscription fermée, le profil, la galerie, les états sans classement/grades, le vrai jeu et sa panne de sauvegarde, les cinq tailles (1440×1050, 1280×720, 768×1024, 390×844, 360×800), les réglages, le cours et la page professeur bureau/mobile.

Comparaison visuelle effectuée avec `REFERENCES/02_RENDU_FRONT.png`, l’accueil et le mobile fournis : silhouettes, frontons, écrans, console, ville et couleurs conservés. Écarts voulus : corps plus lisibles, polices système, pas de badge Démo, de joueurs ou scores inventés ; bornes empilées sur mobile conformément à la spécification (le prototype les juxtapose). Les panneaux reflètent les données réellement disponibles.

Focus et dialogues testés au clavier. La vérification de confort à 200 % utilise un viewport de 720×525 équivalent à la surface disponible d’un écran 1440×1050 à ce zoom ; le zoom natif et les appareils tactiles physiques restent non vérifiés. Le moteur affiche « Clavier recommandé » ; aucune fausse manette tactile ajoutée.

## Activation, données et retour arrière

Le module reste fermé par défaut. Pour une instance de recette déjà autorisée, définir **`EDEN_WORLD_ARCADE=1`** dans son environnement puis ouvrir **`/arcade`**. Les liens apparaissent dans l’espace professeur et la séance élève. Le drapeau ne crée aucune identité et n’ouvre ni inscription ni annuaire public. `.env.local` et l’instance réelle n’ont pas été modifiés ou démarrés pour cette tâche.

La commande de recette autonome `node --import tsx scripts/arcade-browser-check.mjs` ouvre uniquement un serveur temporaire sur loopback et une base en mémoire, puis les ferme. Les comptes synthétiques vivent uniquement dans ce processus. Ne pas utiliser `npm run dev` comme test isolé : le démarrage hôte charge `.env.local` et initialise son store configuré.

**Migration : aucune.** `arcadeProfile` est un champ facultatif dans les agrégats JSON existants. Aucune table/colonne/contrainte ou clé persistée ne change. Pas de réécriture des sauvegardes existantes au démarrage.

**Retour arrière :** retirer `EDEN_WORLD_ARCADE=1` ou le fixer à `0`, puis redémarrer l’instance concernée. Les anciennes routes restent disponibles ; la page, les assets et APIs arcade deviennent inaccessibles. Conserver les profils et sauvegardes déjà enregistrés, sans suppression ni restauration destructive.

## Revue finale

Voir `REVIEW.md` et `RECETTE.json`. Verdict global : **BLOQUÉ SUR DÉPENDANCE** pour Cyber Funk, les métriques/grades et les comptes publics ; **recette réussie pour le périmètre intégré testé**. Ces résultats ne constituent pas une homologation de production ou une validation juridique de l’ouverture publique.
