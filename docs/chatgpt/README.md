# ChatGPT dans Tween Teach — parcours personnel

Intégration revue le **6 octobre 2026**. Elle ajoute un accès au forfait ChatGPT au pipeline pédagogique existant. Le compte professeur Tween Teach reste la source des droits. Les autorisations OpenAI et les données applicatives sont indépendantes.

## Démarrer

Prérequis : Node 22.14–22.x, dépendances npm installées, navigateur pour OAuth ; Chrome/Chromium pour les contrôles de rendu existants. Compte ChatGPT éligible et permission d’utiliser le forfait nécessaires pour les appels réels.

```sh
npm ci
npm run dev:chatgpt
```

Ouvrir **http://127.0.0.1:4181/**. Le lanceur n’importe ni `.env.local`, ni les clés, la base Neon ou les services cloud hérités du shell. Il crée `.data/chatgpt-personal/courses.sqlite` et lance deux processus : Express et le consommateur des jobs. Fermer l’onglet ne les arrête pas. Garder cette commande ouverte pendant la préparation ; après arrêt du runtime, relancer la même commande pour reprendre les jobs persistants. Les processus interrompus sont redémarrés jusqu’à cinq fois ; un appel dont l’issue est inconnue reste suspendu.

1. Créer son mot de passe professeur à l’accueil (12 caractères minimum). Aucun compte de démonstration n’est créé par ce lanceur.
2. Dans **Ma classe & réglages**, importer le classeur de planification avec le parcours existant et confirmer les durées.
3. Dans le menu professeur, ouvrir **ChatGPT & API**, puis **Continue with ChatGPT** en haut de la page. L’accès **Ma classe & réglages → Réglages IA · API ou ChatGPT** reste disponible. Un lien direct vers `/ai-settings.html` ramène à cette page après la connexion professeur. Le libellé officiel est conservé en anglais ; aucun logo non autorisé n’est recréé.
4. Dans la fenêtre OpenAI, choisir le compte/espace et autoriser les permissions. Le callback est exactement `http://127.0.0.1:4181/auth/callback` par défaut. Ne pas remplacer l’hôte par `localhost`.
5. Après connexion, ouvrir **Préparer une séance** : si le mode API n’est pas configuré, le bloc **Utiliser mon abonnement ChatGPT** permet de choisir un modèle puis **Utiliser ChatGPT pour les préparations**. Les modèles sont chargés depuis la connexion ; ce choix n’effectue aucune génération. On peut aussi choisir **Abonnement ChatGPT**, la connexion et le modèle dans les réglages IA puis enregistrer. Une identité seule n’active pas l’inférence.
6. **Tester la connexion · un appel au forfait** effectue un petit appel Responses réel, sur action explicite. Une réussite ne prouve pas encore la qualité d’une séance entière.
7. **Préparer une séance** : sélectionner créneau, sources et intention. La page conserve le job dans son URL et dans la liste des préparations. Les étapes affichées viennent du worker, sans pourcentage artificiel.
8. Revenir après rechargement, relire l’aperçu et les contrôles, puis publier avec le parcours existant. Aucun job ne publie automatiquement.

**Nouvelle version** crée une nouvelle action au prochain lancement. Un clic répété ou une répétition réseau sur la même action retrouve le même job. Annuler tente d’interrompre le transport et empêche les étapes suivantes ; cela ne restitue pas le quota déjà consommé. **Vérifier l’avancement** consulte la tentative enregistrée ; **Nouvelle tentative de cette étape** est l’action explicite qui autorise un nouvel appel et conserve les étapes déjà validées. Le budget global de temps et d’appels reste applicable.

Les profils frontend interactif et shell/Git nécessitent le laboratoire existant (`labs/README.md`). Sans sa configuration, ces séances s’arrêtent avant les appels IA, avec un brouillon identifiable. Le HTML/CSS sans scripts et le sous-ensemble de programmation existant restent utilisables localement. Aucun Docker, laboratoire, service payant ou infrastructure de queue n’est créé par SIWC.

## Accès des élèves sur le même Wi-Fi

Après arrêt du lanceur personnel (**Ctrl+C**), `npm run dev:lan` ouvre aussi l’application sur l’adresse privée de l’ordinateur. Partager le lien `/today` affiché dans le terminal. Les élèves utilisent leurs comptes habituels et les séances publiées ; leurs réponses restent dans la même base `courses.sqlite`. Le professeur garde `http://127.0.0.1:4181/`, notamment pour les connexions personnelles IA. Le callback et ses contrôles d’accès local sont conservés.

Le serveur et le worker restent uniques ; les deux adresses partagent la même application. Le mode réseau est explicite, limité à une adresse IPv4 privée attachée à cet ordinateur et doit être relancé après un changement de réseau. En cas de plusieurs interfaces, utiliser `npm run dev:lan -- --lan-host=ADRESSE_IP`. Arrêter le lanceur coupe les deux accès ; relancer `npm run dev:chatgpt` revient à l’accès sur le Mac uniquement. Voir [le partage réseau et le dépannage](../../README.md#partager-avec-les-élèves-sur-le-même-wi-fi).

## Configuration personnelle facultative

Créer **`.env.chatgpt.local`** uniquement pour les options voulues. Ce fichier est ignoré par Git et Vercel. La liste des variables acceptées est contrôlée par le lanceur.

| Variables | Portée et rôle |
| --- | --- |
| `EDEN_CHATGPT_PORT` | Port local, défaut 4181 ; seul le port du callback varie. |
| `EDEN_AI_MAX_CALLS` | Appels par préparation, défaut 24, maximum 40. |
| `EDEN_AI_MAX_SESSION_MINUTES` | Durée totale depuis le lancement, défaut 30, maximum 90. |
| `EDEN_AI_CALL_TIMEOUT_SECONDS` | Forfait ChatGPT : défaut 600 s (10 min), maximum 1 200 s. API : défaut 180 s, maximum 240 s. Chaque appel est aussi borné par le temps total restant de la préparation. Une expiration conserve le texte partiel, sans valider le résultat. |
| `EDEN_AI_MAX_REWRITES` | Corrections pédagogiques, défaut/max 3. |
| `EDEN_DIAGNOSTIC_MINUTES` | Réglage existant du diagnostic, défaut 8. |
| `EDEN_SOURCE_HOSTS` | Domaines HTTPS exacts autorisés pour l’ingestion existante. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | Binaire du navigateur de vérification. |
| `EDEN_LAB_URL`, `EDEN_LAB_TOKEN`, `EDEN_LAB_SHELL_IMAGE`, `EDEN_LAB_DOM_IMAGE` | Laboratoire existant, explicitement configuré ; jeton du laboratoire séparé des credentials OpenAI. |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_GRADING_MODEL`, `EDEN_AI_*_MODEL`, `EDEN_AI_*_EFFORT`, budgets USD et `EDEN_AI_MAX_OUTPUT_TOKENS` | Option API seulement. Présence d’une clé ≠ autorisation de l’utiliser pour un job ChatGPT. |

Variables internes fixées par le lanceur : `EDEN_CHATGPT_MODE=local`, `EDEN_PERSONAL_LOCAL=1`, `EDEN_AI_WORKER_EXTERNAL=1`, `HOST=127.0.0.1`, `PORT`, `EDEN_DB_PATH`, `EDEN_ARTIFACT_PATH`, `EDEN_QUALITY_EVIDENCE_PATH`, `EDEN_CHATGPT_VAULT`. Ne pas les recopier dans Vercel. `DATABASE_URL` et les variables cloud ne sont pas acceptées dans ce fichier personnel.

Après une interruption, **Vérifier l’avancement** réconcilie la tentative enregistrée sans nouvel appel. **Nouvelle tentative de cette étape** autorise une nouvelle consommation si la récupération est impossible et applique le délai par appel actuellement configuré. Connexion, modèle, résultats valides et plafonds globaux d’origine sont conservés. Un budget de durée épuisé reste bloquant, y compris après une révision de conception.

SIWC envoie `model`, `instructions`, `input`, `store`, `stream`, `text` et, pour une capacité confirmée par le catalogue du compte, `reasoning`. Les nouvelles préparations choisissent `high` lorsqu’il est disponible ; sinon elles gardent le défaut fournisseur explicitement non vérifié. Les profils déjà figés ne changent pas. Les images de revue restent des entrées inline ; aucun outil distant, mode pro inventé ou paramètre API incompatible n’est ajouté. Voir [l’audit V2](../quality/audit-v2.md).

## Données et credentials

Le coffre `.data/chatgpt-personal/credentials/connections.json` a des permissions **0600**, dans un répertoire **0700**. Il contient l’identifiant d’hôte stable, les tentatives courtes et les enregistrements distincts. Ce fichier n’appartient pas aux tables métier, aux corpus, aux réponses du frontend ou aux exports. Il est protégé par les permissions du compte système, pas chiffré contre un utilisateur ayant déjà accès à ce compte. Utiliser un poste et un disque protégés.

Les renouvellements sont verrouillés entre processus (`proper-lockfile`), puis enregistrés par remplacement atomique et synchronisation disque. Un marqueur persistant précède toute rotation : après une interruption ambiguë, les tokens sont conservés mais inutilisables jusqu’à reconnexion. Une erreur temporaire du catalogue ne supprime pas les credentials. La déconnexion conserve le couple identité/client pour une future connexion, révoque la session renouvelable et efface les tokens locaux. Une révocation non confirmée est signalée.

## Vercel : accès requis

L’application est Express ESM, avec `api/index.mjs`, Neon/PostgreSQL et une fonction configurée à 300 secondes dans `vercel.json`. Il n’y a pas de consommateur hébergé de `generation_jobs`. Augmenter la durée d’une fonction ne crée pas ce consommateur. La documentation Vercel consultée décrit 300 s sur Hobby, 800 s sur Pro/Enterprise, et 1 800 s en bêta sous conditions ; ces possibilités ne prouvent ni l’abonnement du projet ni une autorisation SIWC.

| Environnement | État et callback |
| --- | --- |
| Développement personnel | Loopback ci-dessus, enregistrement dynamique sans secret client. |
| Preview Vercel | SIWC indisponible. Aucun callback loopback ni credential personnel à copier. |
| Production Vercel | SIWC indisponible, aucune modification ni déploiement effectué. |

Après accès partenaire confirmé : obtenir les callbacks HTTPS exacts pour chaque environnement, issuer/endpoints, méthode d’authentification du client, éventuel secret du client confidentiel, scopes et contrat d’inférence réellement autorisés. Prévoir le stockage serveur chiffré par propriétaire, la rotation/revocation et un consommateur durable validé pour ces durées/transports. Le code local n’est pas un adaptateur hébergé et aucun drapeau ne l’y transforme. Les routes de préférences, le pipeline commun et les jobs constituent les points d’intégration ; les pièces dépendant du contrat restent fermées. Aucun tunnel ou relais local pour Vercel.

## Désactivation et contenus

Dans les réglages, déconnecter chaque connexion puis choisir API si souhaité. Arrêter le lanceur désactive le parcours personnel ; `npm run dev` conserve le fonctionnement existant. Conserver `courses.sqlite`, les artefacts et les versions publiées. Ne jamais supprimer une base pour revenir en arrière. Les changements métier sont additifs dans les agrégats JSON existants, sans nouvelle table SQL.

Le corpus ZIP existant permet de récupérer les contenus terminés. Le transfert de base existant cible une installation **neuve**, pas la fusion d’un cours dans une production déjà peuplée. Il refuse les jobs non terminés et n’emporte jamais le coffre. Ce lot n’invente pas une fonction d’import de cours absente. Ne transférer aucune connexion personnelle vers l’hébergement.

Voir [l’audit et les décisions](audit.md), [la recette](acceptance.md) et [les sources officielles consultées](sources.md).
