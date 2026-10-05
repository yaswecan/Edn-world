# Publier / mettre à jour sur Vercel

## 1. Racine et build

La racine contient `package.json`, `package-lock.json`, `vercel.json`, `docs/`, `api/`, `server/`. Framework **Other** ; **Root Directory : racine, pas docs**. Node **22.x**. Installation `npm ci`, build `npm run build`, Output Directory `docs`. Le warning 24.x vs 22.x disparaît si les paramètres du projet sont aussi sur 22.x.

Le build ne lit aucun secret et ne lance pas la migration. Acorn est copié depuis la dépendance verrouillée vers `docs/vendor/` avec sa licence. Le serveur embarque `server/templates/` grâce à `includeFiles`.

## 2. Variables serveur

- `DATABASE_URL` : **la même chaîne Neon du projet précédent** (avec mot de passe et `sslmode=require`).
- `TEACHER_PASSWORD` : 20–256 caractères, jamais côté élève.
- `CLASS_CODE` : 8–128 caractères, communiqué aux élèves, distinct du mot de passe professeur.
- `CRON_SECRET` : au moins 32 caractères pour la purge quotidienne.
- `CLASS_ID` : garder `a1-logique-261001` ou la valeur déjà utilisée pour cette séance ; ce n’est pas l’identifiant BIOS.
- `RETENTION_DAYS` : 30 par défaut, 1–365. Exporter avant la purge.
- `PUBLIC_ORIGIN` : normalement vide. Si défini, origine HTTPS exacte du déploiement, sans chemin ni slash final.

Ne modifie pas les mots de passe existants sans intention : une rotation invalide les sessions correspondantes. Il n’y a pas de liaison automatique aux comptes du précédent hub BIOS.

## 3. Migration non destructive

La première requête d’API applique `server/schema.mjs` dans une transaction sous verrou consultatif. Elle crée uniquement les objets absents du schéma `eden_logic_261001`, dont trois nouvelles tables pour les évaluations. Le SQL synchronisé est aussi dans `database/schema.sql`.

Le compte Neon doit pouvoir créer ce schéma/tables/index. Il n’y a aucun `DROP SCHEMA`, `DROP TABLE` ou `TRUNCATE` dans la migration. Les dossiers déjà présents restent conservés. Ne lance pas une réinitialisation de base pour mettre à jour cette application.

La réutilisation de la même base ne doit pas faire mélanger deux cours : les tables et la portée `production:CLASS_ID` sont stables. Les previews sont dans `preview:CLASS_ID`, donc ne présentent pas les dossiers de production.

## 4. Recette de publication — obligatoire sur tes comptes

1. `/api/health` retourne `ok:true`, `schema:2`. Une configuration incomplète retourne un message, pas un faux suivi activé.
2. Connecte-toi à `/prof.html`. Ouvre le site élève dans un autre profil de navigateur ; saisis un code fictif et `CLASS_CODE`.
3. Écris les quatre programmes du diagnostic. Fais un premier essai volontairement faux, observe la console, puis corrige et teste. Clique sur **Remettre mes quatre programmes** et attends le reçu.
4. Dans `/prof.html`, ouvre ce dossier : vérifier le premier et le dernier code, les tests, les indices, l’original et les 20 indicateurs et le statut « Pré-corrigé · à relire ».
5. Modifie un point avec un commentaire, enregistre, recharge le dossier. La nouvelle note doit être conservée.
6. Télécharge le dossier puis ouvre `feuille_correction.xlsx` et `evaluation/rendu_original.json`. Vérifie la nouvelle note et l’ancienne copie figée.
7. Teste une sauvegarde du cours, ferme/réouvre, puis une reprise sur un autre appareil avec la clé privée élève. Aucun accès par simple prénom.
8. Coupe le réseau : « envoi non confirmé » doit rester visible. Rétablis le réseau, réessaie la remise ; un même reçu ne crée pas deux évaluations.
9. Exporte la classe. Une erreur d’un dossier interrompt l’archive groupée et est signalée, sans ZIP prétendument complet.
10. Supprime le profil fictif une fois la recette terminée.

## 5. Limites opérationnelles

La synthèse de classe ne renvoie pas tous les codes ni tous les items : seuls les détails d’un élève les chargent. L’export groupé récupère un dossier à la fois et assemble le ZIP dans le navigateur professeur afin de ne pas renvoyer un gros ZIP de classe depuis une fonction Vercel. Pour une très grande classe, utiliser les exports individuels. 500 profils maximum affichés ; historique récent des 200 copies par élève dans l’interface. Les copies de cours se créent sur clic, pas à chaque frappe.

Les sauvegardes et évaluations sont limitées à 300 Ko par requête. Codes de 10 000 caractères maximum par exercice. Les fonctions Vercel utilisent des requêtes Neon HTTP, pas un serveur qui écoute ni SQLite.

## 6. En cas d’échec

`401` : reconnecter le profil concerné ; exporter le travail local avant un changement de compte. `409` : une copie/relecture plus récente existe ; recharger sans écraser aveuglément. `429` : patienter puis réessayer. `503` : vérifier variables Vercel et permissions Neon. Ne jamais copier `DATABASE_URL` dans une capture publique ou le code frontend.

## Documentation officielle consultée

- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/functions/limitations
- https://github.com/neondatabase/serverless
- https://github.com/acornjs/acorn
