# Livraison COMPTE_JOUEUR — 5 octobre 2026

Le lot est intégré dans l’application existante. Comptes scolaires, AKA/avatar, Mon espace, Premier signal, choix des badges mis en avant et changement de mot de passe sont raccordés à la persistance et aux permissions hôtes. Les dépendances publiques manquantes restent fermées. **Aucun déploiement, ouverture d’inscriptions, migration ou accès à une base réelle.**

## Fonctions prêtes et vérifiées

- Profil créé une fois par compte existant, privé par défaut, sans nom administratif prérempli. AKA unique dans la classe (élèves/enseignants), NFKC et casse ignorée ; format Unicode existant conservé. Identifiant scolaire et sauvegardes inchangés.
- Personnalisation : aperçu de carte à gauche au bureau, compact sur mobile, quinze avatars autorisés, clavier, annulation, erreur explicite et succès après persistance. Asset indisponible signalé. Aucun téléversement ou URL d’avatar arbitraire.
- Mon espace : carte sans adresse/identité civile/classe, action de reprise d’une sauvegarde accessible, état des deux jeux, collection et progression indisponible sans faux zéro. Menu Mon espace / Personnaliser / Mon compte / Se déconnecter.
- Badge **Premier signal** : attribué une seule fois à partir d’une preuve Code Station approuvée par le professeur autorisé, avec contrôle de mission/run/propriétaire. Le navigateur ne peut ni attribuer ni dater le badge. Le professeur valide une preuve selon son parcours existant ; pas d’attribution sur simple déclaration de fin. Aucun crédit XP.
- Mise en avant : endpoint dédié, zéro à trois IDs acquis uniques, ordre conservé, retrait et remplacement. Une seule attribution métier disponible aujourd’hui ; le scénario complet de trois/quatre badges réels reste bloqué, les mécanismes correspondants sont testés avec des entrées unitaires synthétiques.
- Mon compte : informations privées du compte courant, capacité locale réelle, confirmation du nouveau secret, vérification de l’actuel, hachage scrypt hôte et déconnexion de toutes les sessions. L’assistance professeur existante conserve ses permissions et révoque également les sessions.
- Changement de compte : requêtes annulées et réponses tardives rejetées, état privé effacé, coordination des onglets arcade, relecture de session à chaque route privée et au retour navigateur. Aucun compte/profil/récompense/secret dans le stockage navigateur.

## Fichiers applicatifs

| Fichier | Changement |
| --- | --- |
| `server/arcade-profile.mjs` (nouveau) | Catalogue d’avatars et badge vérifiable, profil idempotent, AKA unique, projections, contrôle des badges équipés. |
| `server/arcade.mjs` | Réutilisation du service profil, APIs espace/collection/compte, reprise autorisée et dernière ouverture, protections et limites de mutation. |
| `server/auth.mjs` | Version d’authentification compatible avec les sessions historiques, changement et révocation transactionnels, capacités privées, limitation d’abus. |
| `server/app.mjs` | Connexion transactionnelle ; assistance mot de passe et modification d’agrégat élève transactionnelles pour éviter d’écraser une rotation concurrente. Aucun changement des permissions professeur. |
| `public/world-arcade/account-views.js` (nouveau) | Écrans compte/espace/personnalisation/collection, carte, badges et formulaires accessibles. |
| `public/world-arcade/app.js` | Branchement des vues, onboarding, erreurs, gestion des sessions/requêtes/focus, mot de passe et badges. |
| `public/world-arcade/style.css`, `index.html` | Styles confinés, responsive et navigation Mon espace. Bornes et thème conservés. |
| `tests/arcade-account.test.mjs` (nouveau) | 16 tests du lot, API réelle et logique de présentation à trois emplacements. |
| `tests/arcade.test.mjs` | Projection publique attendue étendue aux badges, autres assertions conservées. |
| `scripts/arcade-account-browser-check.mjs` (nouveau) | Parcours de bout en bout et captures exclusivement synthétiques. |
| `scripts/arcade-browser-check.mjs` | Adaptation à l’onboarding/Mon espace ; destination de rapports configurable pour préserver les anciens rapports. |
| `README.md` | Fonctionnalités, limites et commandes de recette. |

Le prompt 07 et `DEMARRER_COMPTE_JOUEUR.txt` ont été extraits de l’archive fournie sans écraser les références existantes. Le dossier n’a pas de Git : empreintes dans `COMPTE_JOUEUR_AVANT.json` et inventaire final dans `COMPTE_JOUEUR_FICHIERS.json`. Aucun changement du prototype, du corpus, des assets de référence ou des anciens rapports SUIVI.

## Commandes réellement exécutées

| Commande | Résultat / preuve |
| --- | --- |
| `node --import tsx --test tests/arcade-account.test.mjs tests/arcade.test.mjs` | 31/31 ; `COMPTE_JOUEUR_TESTS_API.log`. Premier essai bloqué par le sandbox, puis réussi en local autorisé. |
| `npm test` | 115/115 lors de la passe complète ; `COMPTE_JOUEUR_TESTS_COMPLETS.log`. Les deux tests ultérieurs supplémentaires passent dans la commande ciblée ci-dessus. |
| `npm run test:legacy` | 128/128 ; `COMPTE_JOUEUR_LEGACY.log`. |
| `npm run build` | Réussi (exécute `check`, syntaxe, schémas et primitives Drive) ; `COMPTE_JOUEUR_BUILD.log`. Pas de script lint/typecheck séparé. |
| `node --import tsx scripts/arcade-account-browser-check.mjs` | Parcours, captures 1440/1024/390, zéro erreur JS non interceptée ; `COMPTE_JOUEUR_NAVIGATEUR.json` et `.log`. |
| `ARCADE_REPORT_DIRECTORY=TWEEN_TEACH_WORLD_ARCADE/SUIVI/COMPTE_JOUEUR_REGRESSION node --import tsx scripts/arcade-browser-check.mjs` | 11/11 groupes, zéro erreur JS ; sauvegarde/réseau/permissions/rendu et cours/professeur. |
| `npm run test:visual` | Reprise complète : 27/28 ; un timeout de chargement du diagnostic mobile. `COMPTE_JOUEUR_VISUELS.log`. |
| `npm run test:visual -- --project=mobile -g 'save, send failure'` | Reprise ciblée du seul échec : 1/1, sans modification des cours ni des baselines ; `COMPTE_JOUEUR_VISUEL_REPRISE.log`. |
| `python3 TWEEN_TEACH_WORLD_ARCADE/OUTILS/verifier_pack.py` | 105 contrôles réussis, zéro échec ; validation Python JSON Schema non exécutée (`jsonschema` absent). `COMPTE_JOUEUR_PACK.log`. |

Les captures du lot sont dans `COMPTE_JOUEUR_CAPTURES/`. Les captures de non-régression sont séparées dans `COMPTE_JOUEUR_REGRESSION/captures/`. Comparaison visuelle effectuée avec le profil initial et les références : palette, portraits, typographie, panneaux et bornes conservés ; nouveaux formulaires lisibles. La surface équivalente à un zoom de 200 % est testée, pas un lecteur d’écran ni un appareil physique.

## Dépendances bloquantes et conditions d’activation

| Dépendance | État livré et travail restant |
| --- | --- |
| Identité externe / e-mail | Inscription, vérification, renvoi et récupération fermés (503 uniforme). Écran inscription dans le bon ordre e-mail/mot de passe/confirmation ; assistance scolaire affichée. Choisir/configurer un vrai service hôte, vérifier son cycle complet, sa délivrabilité et ses protections avant activation. Aucun token ni faux envoi implémenté. |
| Comptes fédérés | Aucun fournisseur présent ; aucune création de secret local pour un compte sans mot de passe. Parcours de réauthentification à brancher au fournisseur réel. |
| Politique publique/mineurs et protections distribuées | Validation produit/établissement et autorisation explicite requises. Limitation de fréquence locale réutilisant les conventions du dépôt ; stockage partagé des limites à prévoir avant exposition publique multi-instance. Aucune affiliation scolaire publiée. |
| Grades / Top 5 | Règles, seuils et métriques métier absents. États indisponibles maintenus, aucun Rookie/XP/classement inventé. |
| Cyber Funk / Signal rétabli / Premier néon | Moteur Cyber Funk absent et chapitre Code Station admissible non identifié. Aucun branchement au mini-jeu du prototype. Aucun badge correspondant actif. |
| PostgreSQL distant et droits de publication des portraits | Non vérifiés ici. Transaction PostgreSQL existante conservée ; recette de concurrence exécutée en SQLite uniquement. Assets déjà utilisés en interne, provenance documentée ; droits publics à confirmer avant ouverture. |

## Compatibilité et retour arrière

Aucune nouvelle table ni migration. Ajouts facultatifs aux agrégats JSON : `arcadeProfile.handleKey`, `featuredBadgeIds`, `arcadeAwards` et `authVersion` ; `sessions.authVersion` ; `game_runs.lastPlayedAt` à une reprise. Les profils/sessions anciens restent lisibles (version d’authentification implicite zéro). Pas de modification des XP, notes, identifiants, missions ou formats de sauvegarde. La date du badge est celle de sa première attribution persistée à la lecture du service, sans inventer une date d’approbation historique.

L’ouverture reste contrôlée par `EDEN_WORLD_ARCADE`, dont la valeur n’a pas été modifiée. Le mettre à zéro sur une instance autorisée masque le module sans supprimer les profils. Pour un retour de code, préserver la révocation/version de sessions et les hachages courants : ne jamais restaurer d’anciens mots de passe ou d’anciennes sessions. Aucun rollback de données n’a été exécuté.

## Revue finale

**RECETTE RÉUSSIE POUR LE PÉRIMÈTRE TESTÉ ; BLOQUÉ SUR DÉPENDANCE pour le cycle public, les grades/classements et Cyber Funk.** Relecture réalisée par le même agent, pas une revue indépendante.

Défauts corrigés : unicité AKA et création concurrente absentes ; sessions encore valides après assistance mot de passe ; possibilité d’écrasement d’un agrégat compte par une mutation parallèle ; réponse privée tardive après sortie ; bootstrap visiteur conservé après une connexion hôte ; bouton afficher/masquer au nom accessible incohérent. Tests API et navigateur associés réussis. Les projections publiques ne contiennent aucune adresse/affiliation/source de preuve, les mutations sont explicitement limitées et les récompenses ne font pas confiance au runtime.

Les choix de changement/récupération ont été confrontés aux recommandations [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) et [W3C Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html). Cette recette locale ne constitue ni une homologation de production ni une validation juridique.
