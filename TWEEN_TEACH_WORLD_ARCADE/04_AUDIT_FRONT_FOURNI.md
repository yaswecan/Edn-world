# Audit concret du front fourni

## Source inspectée

Archive fournie dans la conversation : `WORLD_ARCADE_FRONT_HTML_CSS_JS.zip`.
Copie de référence conservée dans `FRONT_REFERENCE/World_Arcade_Frontend/`, avec le HTML autonome
adjacent. L’inventaire SHA-256 permet de vérifier cette copie ; il ne certifie pas sa sécurité.
L’audit porte sur ces fichiers, **pas sur le dépôt Tween Teach**, qui n’est pas accessible ici.

## Cartographie des raccordements

| Fichier / élément observé | Présent dans le prototype | Action d’intégration |
|---|---|---|
| `index.html` : `#splash`, `#start-button`, `#app` | Entrée puis salle | Porter dans le routeur/layout hôte ; conserver le focus |
| `css/styles.css` | 59 Ko environ, styles autonomes globaux | Reprendre la DA et isoler sélecteurs, tokens, animations |
| `js/data.js` : `ArcadeData.games` | IDs `code-station` et `cyber-funk` | Résoudre les moteurs et autorisations réels |
| `js/data.js` : `ArcadeData.players` | 18 pseudos, scores, classes et présences fictifs | Remplacer par une projection serveur autorisée ; jamais de seed métier |
| `js/data.js` : `ArcadeData.ranks` | 9 grades, sans seuils XP | Lire la configuration hôte ; conserver comme référence graphique |
| `js/app.js` : `renderRanking`, `ranking` | Classement de démonstration avec calculs locaux | Remplacer par agrégation et filtrage serveur |
| `js/app.js` : `renderRanks` | Attribue visuellement Rookie au profil local | Lire le grade réel, ne pas inventer une attribution |
| `js/app.js` : formulaire `auth-form` | Validation HTML puis profil local | Remplacer entièrement la soumission par l’authentification réelle |
| `js/app.js` : clé `eden.world-arcade.front.v1` | Profil, préférences, réussites locales | Ne pas importer cette clé dans les données de production |
| `js/app.js` : `startGame` | Émet `worldarcade:launch`, puis lance la démo si non annulé | Annuler synchroniquement avant le branchement asynchrone |
| `js/app.js` : `completeGame` | Première réussite locale : +200 XP de démonstration | Exclure du système réel de points |
| `js/app.js` : `worldarcade:demo-complete` | Signal navigateur | Ne jamais le traiter comme validation serveur |
| `js/games.js` | Deux mini-jeux Canvas autonomes | Conserver seulement en référence ; ne pas remplacer les moteurs existants |
| `integration/launcher-example.js` | Exemple gardant le fallback si une route manque | Ne pas déployer tel quel ; utiliser un flux sans repli vers la démo |
| `index.html` : Google Fonts | Requête externe facultative, aucune police embarquée | Retirer ou adapter à la politique hôte ; aucun binaire de police ajouté |
| `previews/` et `tests/results.json` | Captures et rapport du front autonome | Preuves de référence uniquement, pas preuve de raccordement |

## Piège prioritaire : annulation tardive du lancement

Le code source appelle `window.dispatchEvent(event)` puis continue immédiatement vers la mini-démo
si l’événement n’a pas été annulé. Une fonction listener `async` qui fait un `await` avant
`event.preventDefault()` laisse la démo démarrer. Le pont `CONTRATS/launcher-bridge.mjs` annule d’abord,
puis résout l’autorisation. Il refuse par défaut une absence de moteur ou de mapping et ne reprend
jamais la démo sur une erreur. Ce correctif de parcours ne remplace pas les contrôles serveur.

## Ce que les formulaires font vraiment

Le prototype n’a pas de fournisseur d’authentification. Ses saisies valides donnent accès à un profil
local de démonstration. La conservation du pseudo et de l’avatar ne prouve ni inscription ni connexion.
Masquer « Démo » sans remplacer le handler produirait une fausse authentification. L’e-mail et le mot
de passe ne sont pas destinés à être stockés par ce front. Utiliser des valeurs fictives lors d’un aperçu.

## Rendre les classements réels

Les chiffres, statuts en ligne et scopes dans `data.js` ne proviennent pas des élèves. Les filtres
locaux servent à illustrer l’UI ; les réponses de production doivent venir du service hôte. Ne pas
publier le fichier de fixtures comme JSON accessible, ne pas transformer ses données en migration et
ne pas alimenter le classement d’un jeu avec des valeurs extrapolées depuis un autre jeu.

Le grade affiché dans une illustration n’est pas une source de vérité sur les grades historiques.
Les noms Rookie et Explorer sont conservés ; le reste du catalogue livré est une proposition à
confronter au dépôt. Les identifiants et règles persistés ne sont pas à réécrire pour obtenir le visuel.

## Nettoyer les textes sans dégrader le contenu

Le prototype comporte des slogans, des mentions « Démo », du texte explicatif sur son stockage et
une action de réinitialisation locale. La cible de production utilise le corpus textuel plus sobre.
On supprime les mentions de démo seulement quand la fonction correspondante est remplacée et vérifiée.
On ne supprime pas l’information essentielle d’une erreur, d’une indisponibilité ou d’une sauvegarde.

Les textes pédagogiques des vrais jeux, leurs explications, leurs consoles et leurs éditeurs restent
intacts. Ce dossier ne justifie pas de raccourcir le contenu des cours ou de supprimer leurs diagnostics.

## Risques de styles et de cycle de vie

La feuille utilise `:root`, `body`, des classes communes (`.button`, `.panel`, `.modal`), des sélecteurs
généraux et des états globaux. L’import global peut modifier tout Tween Teach. Même dans une route
dédiée, une SPA peut conserver les styles après navigation : tester l’aller-retour vers un cours.

Les handlers clavier/hashchange, le canvas, les boucles audio et les événements de focus doivent
être démontés au départ du module. Une navigation répétée ne doit pas multiplier les listeners ou
continuer à jouer un son dans l’espace de cours. Le code autonome est une référence à porter, pas
un script à injecter plusieurs fois dans une page partagée.

## Provenance des images

Les assets WebP du front sont des illustrations extraites de la maquette générée de la conversation,
selon le README source. La maquette est incluse pour comparaison ; les photos de stock filigranées
et les captures de marques/e-sport du corpus d’inspiration **ne sont pas embarquées comme assets de
production** dans ce dossier. Aucun droit sur des marques externes n’est présumé. Aucun fichier de
police n’est inclus. Voir l’inventaire `CORPUS/assets.manifest.json` et le document de provenance.
