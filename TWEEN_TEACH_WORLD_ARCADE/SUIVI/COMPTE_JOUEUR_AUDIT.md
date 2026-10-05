# Audit COMPTE_JOUEUR — 5 octobre 2026

État initial examiné avant modification. Un seul AGENTS.md trouvé, celui du dossier d’intégration, lu avec les prompts 00, 01, 07, la spécification, le corpus, les contrats et les rapports antérieurs. Le dossier de travail ne contient pas de dépôt Git. Les empreintes initiales sont conservées dans `COMPTE_JOUEUR_AVANT.json`. Aucun accès à `.env.local`, aucune ouverture de base réelle.

| Fonction | État initial et réutilisation |
| --- | --- |
| Application | Express 5, modules JS, front HTML/CSS/JS. `server/app.mjs`, `public/world-arcade/`. Aucun framework ajouté. |
| Identité | `teachers` / `learners`, identifiants stables, mot de passe scrypt, cookie HttpOnly SameSite Strict, sessions hôtes (`server/auth.mjs`). |
| Persistance | Agrégats JSON SQLite/PostgreSQL. Transactions SQLite IMMEDIATE / verrou transactionnel PostgreSQL partagé (`server/store.mjs`). |
| Arcade | `/arcade`, drapeau `EDEN_WORLD_ARCADE`, bootstrap, galerie de classe, profil incorporé au compte. Inscription déjà réellement fermée, aucun faux handler actif. |
| AKA | Règle existante : 2–24 lettres/chiffres Unicode, espaces, tirets, underscores. Pas d’unicité ni de noms réservés. Cette règle de format est conservée. Unicité ajoutée dans la classe, entre enseignants et élèves, normalisation NFKC + minuscules. Pas de fusion d’établissements ni de renommage en masse des anciens profils. |
| Avatars | Quinze portraits locaux déjà intégrés. Provenance : maquette générée fournie, inventaire du corpus et audit 04. Aucun nouvel asset externe, photo ou upload. Les droits d’une éventuelle publication publique restent à confirmer. |
| Permissions | Profils privés par défaut, consultation professeur de sa classe, partage classe facultatif existant. Aucun annuaire scolaire pour visiteur/externe. |
| Jeux | Code Station utilise `authorizeGame`, `authorizeRun`, `game_runs`, `player_progression`. Cyber Funk absent. Aucun remplacement de moteur. |
| Récompenses | Aucun catalogue de badges/grades/XP approuvé. Mais `game_evidence` et `/api/teacher/game-evidence/:id/approve` fournissent une validation réelle par le professeur. Le badge proposé « Premier signal » peut être raccordé à cette preuve, avec mission, run, propriétaire et validateur du bon périmètre. Les autres propositions restent inactives faute de chapitre/moteur identifié. |
| Sécurité du compte | Connexion/déconnexion fonctionnelles, assistance professeur existante `/api/teacher/learners/:id/access`. Changement personnel absent. Réinitialisation professeur initialement sans révocation des sessions. |
| E-mail / public | Pas de fournisseur d’identité externe, d’envoi, de vérification ni de récupération. Pas de politique publique validée. Les écrans expliquent cette fermeture et utilisent l’assistance scolaire existante ; aucun faux e-mail ou jeton. |

## Raccordements retenus

Un profil facultatif par compte, créé sans AKA administratif, dans la transaction hôte. Les champs `handleKey`, `featuredBadgeIds`, `arcadeAwards`, `authVersion` restent dans les agrégats existants ; aucune migration DDL. Les cartes visibles sont des projections explicites, distinctes de Mon compte.

Mon espace agrège les missions accessibles et les sauvegardes hôtes. Aucun score ou palier calculé à partir des XP déclaratifs du navigateur. Le badge Premier signal est enregistré une seule fois sous une clé métier stable du compte ; zéro modification de XP. La collection autorise zéro à trois badges acquis, sans créer artificiellement quatre récompenses pour remplir la carte.

Le changement de mot de passe exige le secret actuel, confirme le nouveau, conserve le hachage hôte et révoque toutes les sessions du compte. La connexion et la rotation partagent la transaction. `authVersion` traite les anciens cookies et la compatibilité des sessions existantes (version implicite zéro). L’assistance professeur conserve son périmètre et son interface, avec la même révocation.

## Capacités bloquantes

Inscription/vérification/récupération e-mail, comptes fédérés : fournisseur hôte absent. Communauté publique : politique et validation explicite absentes. Grades/classement : catalogue et métrique absents. Cyber Funk : moteur absent. Attribution « Signal rétabli » : chapitre admissible non identifié. PostgreSQL distant : non testé, aucune connexion autorisée. Toutes ces capacités restent fermées/indisponibles ; elles ne bloquent pas le compte scolaire, la personnalisation, Mon espace ou Premier signal.
