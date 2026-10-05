# Déployer EDEN Hub sur Vercel + Neon

## 1. Préparer le dépôt GitHub

Extrais le ZIP **sur ton poste professeur**. Envoie le contenu du dossier `EDEN_HUB_VERCEL_NEON` dans ton dépôt : les fichiers `package.json` et `vercel.json` doivent être à la racine, à côté des dossiers `api`, `server` et `docs`.

Les élèves n’extraient rien : ils utiliseront l’adresse du site une fois publié. Garde aussi les fichiers commençant par un point (`.gitignore`, `.vercelignore`, `.nvmrc`, `.env.example`). N’envoie pas `.env.local`, de mot de passe, de sauvegarde de base ni `node_modules`.

## 2. Créer une base Neon

Dans Neon, crée un projet PostgreSQL dédié à ce Hub, puis ouvre **Connect**. Copie la chaîne de connexion complète, de forme `postgresql://…neon.tech/…?sslmode=require`. Le projet accepte une URL Neon directe ou avec `-pooler` ; la communication du driver se fait en HTTPS. Utilise de préférence le réglage de connexion proposé par Neon.

Ce n’est ni l’adresse du tableau de bord Neon, ni une clé API, ni le seul mot de passe. La chaîne contient un nom d’utilisateur **et** un mot de passe : elle reste secrète.

Le code attend exactement la variable **`DATABASE_URL`**. Si une intégration Vercel/Neon a créé une variable avec un préfixe différent, copie sa valeur dans `DATABASE_URL` ou fais correspondre le nom dans ton projet. Ne remplace pas une base utilisée par une autre application sans vérifier sa destination.

### Tables

Pas besoin de créer les tables à la main : la première requête à `/api/config` ou `/api/health` les crée dans le schéma isolé **`eden_bios_hub`**. La migration est transactionnelle, idempotente et protégée par un verrou PostgreSQL entre démarrages concurrents.

Si le rôle Neon choisi n’a pas le droit de créer un schéma, fais exécuter `database/schema.sql` par le responsable de la base, puis adapte les droits. Pour lancer la même migration depuis ton poste : `npm run db:migrate`, avec `.env.local` renseigné. Ne lance pas les tests sur une base de classe en production.

## 3. Générer les trois secrets

Sur ton poste équipé de Node 22 :

```sh
npm run secrets
```

Le script affiche trois valeurs aléatoires, sans écrire de fichier. Copie-les dans un endroit privé et dans les variables Vercel correspondantes. N’envoie aux élèves **que le code de classe**, jamais le mot de passe professeur ou le secret cron.

| Variable | Valeur à saisir dans Vercel | Rôle |
|---|---|---|
| `DATABASE_URL` | Chaîne de connexion Neon complète | Base PostgreSQL distante |
| `TEACHER_PASSWORD` | Secret généré ; 20 caractères minimum | Accès aux données du tableau professeur |
| `CLASS_CODE` | Autre secret ; 8 caractères minimum | Activation du partage élève |
| `CRON_SECRET` | Secret distinct ; 32 caractères minimum | Autorisation de la purge quotidienne |

Variables facultatives : `CLASS_ID` (défaut `a1-bios-os`), `CLASS_LABEL`, `RETENTION_DAYS` (défaut 30), `PUBLIC_ORIGIN`.

**Laisse `PUBLIC_ORIGIN` vide au premier déploiement.** Le projet utilise alors le domaine de la requête. Si tu le fixes, indique l’origine exacte (`https://…`), sans chemin ni slash final. Une valeur incorrecte peut bloquer les actions par contrôle d’origine.

`CRON_SECRET` absent n’empêche pas les envois, mais **la purge planifiée ne sera pas autorisée**. Ne présente pas la purge quotidienne comme active tant que son exécution n’a pas été vérifiée.

## 4. Importer dans Vercel

Dans Vercel, crée un projet à partir du dépôt GitHub.

| Réglage | Valeur |
|---|---|
| Framework Preset | **Other** |
| Root Directory | **Racine du dépôt** — ne pas choisir `docs` |
| Node.js | **22.x**, également indiqué dans `package.json` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `docs` |

`vercel.json` fournit déjà ces commandes et le dossier de sortie. Supprime les anciens Overrides incompatibles si tu réutilises le projet Vercel de la version statique.

Ajoute les quatre variables dans **Settings → Environment Variables**, au moins pour **Production**, puis déploie. N’ajoute aucun préfixe `NEXT_PUBLIC_` : ce projet n’est pas une application Next.js et ses secrets ne sont jamais destinés au navigateur.

Le build ne se connecte pas à Neon et ne dépend pas de données élèves. Un build réussi ne prouve donc pas que le mot de passe Neon est correct : la vérification suivante est nécessaire.

### Preview et développement

Privilégie une branche Neon distincte et des secrets différents pour les déploiements Preview. Le code sépare aussi les sessions par `VERCEL_ENV:CLASS_ID` (`production:…`, `preview:…`, `development:…`). Ce n’est pas une gestion multi-établissements ni un remplacement des droits sur la base.

Après ajout ou modification d’une variable, **redéploie**. Changer `TEACHER_PASSWORD` invalide les sessions professeur ; changer `CLASS_CODE` invalide les anciennes connexions de partage. Changer `CLASS_ID` ouvre un autre espace de classe : les anciennes lignes ne sont pas fusionnées.

## 5. Vérifier avant la classe

Ouvre l’adresse du site, puis :

1. **`/api/health`** doit renvoyer `{"ok":true,"backend":"neon","schema":1}`. Cela vérifie la connexion et la création du schéma, sans afficher de secret.
2. **`/prof.html`** : connecte-toi avec le mot de passe professeur dans la partie Suivi du simulateur. La page de préparation reste publique, les suivis élèves passent par l’API authentifiée.
3. Sur un navigateur élève : effectue le parcours, ouvre le bonus, active **Partager / synchroniser** avec le code de classe et réalise une manipulation. Attends l’accusé de réception.
4. Dans l’autre navigateur professeur : actualise, ouvre le suivi, lis l’explication, ajoute un commentaire et exporte. Supprime la session de test.
5. Recharge la page élève, teste le mini-labo JavaScript et un export HTML. Les réponses du cours restent locales : configure le dépôt de bilan dans `docs/config.js`.

Tu peux aussi exécuter :

```sh
npm run smoke -- https://ton-site.vercel.app
```

Le contrôle est en lecture seule par défaut. Avec les variables locales `SMOKE_TEACHER_PASSWORD` et `SMOKE_CLASS_CODE`, il crée un suivi **TEST-…**, envoie un essai synthétique, le lit et le supprime. Ne place pas ces valeurs dans les arguments de l’URL ni dans un dépôt public.

### Ce que tu envoies aux élèves

Uniquement **l’adresse principale publiée**, à placer dans Eden Hub. Pas l’URL GitHub du code et pas le ZIP. Les liens `edenHubUrl` et `submissionUrl` dans `docs/config.js` sont facultatifs ; colle les vrais liens de ton établissement ou laisse-les vides.

## 6. Purge et maintien en service

Le cron déclaré dans `vercel.json` appelle `/api/cron` une fois par jour à `0 2 * * *` (horaire UTC). Vercel ajoute l’autorisation liée à `CRON_SECRET`. Vérifie une exécution dans les outils de ton projet : un calendrier déclaré seul ne prouve pas son exécution. Les possibilités exactes et délais dépendent de ton offre Vercel.

Le tableau déclenche aussi une purge des données devenues trop anciennes à chaque consultation. La suppression depuis une fiche efface la session et ses événements. Définis les sauvegardes Neon, les accès des administrateurs et les journaux de déploiement selon la politique de l’école ; le script applicatif ne les gère pas.

## Dépannage rapide

| Symptôme | Vérification |
|---|---|
| Site visible, `/api/health` introuvable | Root Directory probablement réglé sur `docs` au lieu de la racine ; API non déployée |
| « Suivi à configurer » | Variables absentes, trop courtes, ou non ajoutées à l’environnement Production ; redéployer |
| HTTP 503 | Chaîne Neon, droits SQL, disponibilité de la branche, ou durée de première connexion ; lire les logs privés |
| Le tableau est vide | L’élève doit activer le partage du bonus et envoyer un essai ; les six missions ne se synchronisent pas automatiquement |
| « Origine refusée » | `PUBLIC_ORIGIN` incorrect, domaine différent ou intégration par iframe intersite ; ouvrir le lien directement |
| HTTP 409 en validant | Une nouvelle preuve est arrivée ; actualiser la fiche et relire avant de valider |
| HTTP 429 | Trop de requêtes rapprochées ; attendre le délai indiqué |
| Connexion perdue après rotation de secret | Se reconnecter côté professeur ou réactiver le partage avec le nouveau code de classe |
| Migration SQL refusée | Rôle sans autorisation de créer le schéma ; faire vérifier les droits Neon |

Ne publie jamais une capture contenant `DATABASE_URL`, les cookies, les tokens ou les mots de passe. Aucun déploiement réel sur ton compte n’a été fait dans l’environnement de création du ZIP.

## Références de l’adaptation

Documentation officielle consultée pour cette version :
- Vercel — Node.js runtime : https://vercel.com/docs/functions/runtimes/node-js
- Vercel — configuration : https://vercel.com/docs/project-configuration/vercel-json
- Vercel — versions Node : https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- Vercel — cron et sécurité : https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Neon — driver serverless et transactions HTTP : https://github.com/neondatabase/serverless
- Neon — options du driver : https://github.com/neondatabase/serverless/blob/main/CONFIG.md

Yacine
