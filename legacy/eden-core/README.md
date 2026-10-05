# EDEN Hub — version Vercel + Neon

**Projet complet : Hub élève, six missions, simulateur PC facultatif, API et suivi professeur.**

La séance reste **mardi 13h20–16h15**, avec **pause de 14h30 à 14h45**. Le simulateur reste la dernière étape, après le ticket et le bilan. L’élève utilise une seule adresse, sans télécharger ni extraire de ZIP.

## Déployer

Le guide pas à pas est dans **[DEPLOIEMENT_VERCEL.md](DEPLOIEMENT_VERCEL.md)**.

1. Crée une base **Neon PostgreSQL** et copie sa chaîne de connexion.
2. Envoie **le contenu de ce dossier** dans ton dépôt GitHub : `package.json`, `vercel.json`, `api/`, `server/`, `docs/`, etc.
3. Importe le dépôt dans Vercel. **Root Directory = racine du projet, PAS `docs/`**. Framework : **Other**. Les commandes et le dossier de sortie sont déjà dans `vercel.json`.
4. Ajoute les variables serveur : `DATABASE_URL`, `TEACHER_PASSWORD`, `CLASS_CODE`, `CRON_SECRET`. Le guide détaille leur rôle et leur génération.
5. Déploie puis vérifie `/api/health`. Ouvre le site élève à `/` et le tableau professeur à `/prof.html`.

Ne publie jamais les secrets dans GitHub ou `docs/config.js`. Les valeurs vides de `.env.example` ne sont pas des identifiants utilisables.

## Ce qui change par rapport au ZIP précédent

Le serveur permanent et SQLite sont remplacés par **dix fonctions Vercel Node** et **Neon PostgreSQL via HTTPS**. Aucune donnée de suivi n’est enregistrée dans un fichier local Vercel. Le schéma `eden_bios_hub` est créé automatiquement à la première requête correctement configurée ; le SQL équivalent est fourni dans `database/schema.sql`.

Les anciens comptes ou suivis SQLite ne sont **pas** importés automatiquement. Garde tes exports précédents. La nouvelle base ne prétend pas retrouver les comptes Eden Hub existants.

## Ce qui est conservé

Les 36 écrans, les six missions, les schémas au feutre, les jeux RAM/CPU, le mini-labo JavaScript, le ticket, les exports et le simulateur sont conservés. Le bonus se déroule ainsi : assembler, câbler, démarrer, observer le BIOS simulé, diagnostiquer quatre pannes, réparer, redémarrer, expliquer. Aucun réglage du vrai PC n’est modifié.

Le dossier `enseignant/` contient les notes de préparation et les critères pédagogiques. Il n’est pas servi comme site public.

## Comprendre la sauvegarde

| Contenu | Où il est conservé | Ce que reçoit le professeur |
|---|---|---|
| Réponses aux six missions, code de l’exercice, ticket | Stockage local du navigateur ; exports HTML/JSON | Bilan remis manuellement dans ton dépôt Eden Hub |
| État du simulateur | Navigateur ; reprise sur le même profil local | Synthèse et événements du bonus, après activation explicite du partage |
| Essais du bonus, erreurs, indices, explication | Neon après accusé de réception serveur | Liste authentifiée, chronologie, commentaire et validation humaine |
| Nombre d’écrans parcourus | Joint aux envois du bonus | Compteur de progression, **pas les réponses détaillées du cours** |

Il n’y a pas de synchronisation automatique de tout le cours entre appareils. Un code élève est un pseudonyme, **pas une identité officielle vérifiée**. Deux inscriptions avec le même code créent deux sessions distinctes.

Sur le bonus, l’élève clique **« Partager / synchroniser »**, saisit `CLASS_CODE`, puis attend le message de réception. Sans cette action, le professeur ne reçoit pas ses essais. Un échec réseau n’efface pas le travail local. Le code ne présente jamais un simple enregistrement local comme une réception serveur.

## Usage professeur

Ouvre `/prof.html`, puis saisis `TEACHER_PASSWORD` dans la partie **Suivi du simulateur**. Le mot de passe de classe ne donne aucun accès professeur. Le tableau affiche le PC monté, les pannes réparées, les essais, les erreurs, les indices et la dernière explication. Tu peux commenter, valider, exporter ou supprimer une session.

Le tableau utilise un cookie HttpOnly / SameSite Strict, Secure en HTTPS. La connexion dure huit heures. Une nouvelle preuve remet la validation pédagogique en attente. Si un élève envoie une nouvelle version pendant que tu la relis, le serveur refuse d’appliquer une validation obsolète : actualise puis relis.

La page de préparation/projection est publique ; **les données reçues des élèves sont protégées par l’API**, pas par un bouton caché. Le mode projection ne commande pas les autres postes et ne partage aucun essai.

## Configuration locale

Node **22.x** et npm. Une dépendance : `@neondatabase/serverless`, version verrouillée dans `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
npm run secrets
# Copier les secrets affichés et la chaîne Neon dans .env.local.
npm run dev
```

Site : `http://127.0.0.1:4173/`. Ce serveur local utilise **les mêmes handlers** que Vercel. La base reste Neon, pas une imitation SQLite. Pour découvrir seulement le site sans base : `npm run start:static` ; aucun suivi distant n’est alors annoncé comme actif.

Ne copie pas un `.env.local` de développement dans ton dépôt. Dans Vercel, renseigne les variables dans l’interface du projet et redéploie après chaque changement.

## Dossiers

```text
api/                     Fonctions Vercel : configuration, envoi, professeur, purge
server/                  Validation, sessions, repository PostgreSQL, migration
scripts/                 Développement, build, migration, secrets, recette de publication
database/schema.sql      Schéma SQL lisible, idempotent
docs/                    Site public, cours et simulateur ; aucun secret serveur
enseignant/              Préparation, contrôles et limites (hors site)
integration/API.md       Contrat réellement implémenté
tests/                   Tests Node, navigateur et Neon optionnel
vercel.json              Build, publication docs/, fonctions et purge quotidienne
```

## Tests et recette

```sh
npm run build
npm test
npm run smoke -- https://ton-site.vercel.app
```

`npm test` teste la logique, le contrat HTTP et l’adaptateur de base avec des doubles de test. **Cela ne remplace pas un test Neon réel.** Voir [enseignant/CONTROLES.md](enseignant/CONTROLES.md) pour les résultats effectivement obtenus et les vérifications restantes.

Sur une **branche Neon de test distincte**, définir `TEST_DATABASE_URL` et `TEST_ALLOW_DB_WRITES=1`, puis `npm run test:neon`. Sans ces deux valeurs, le test est explicitement ignoré, jamais déclaré réussi. Le test ne lit pas automatiquement `DATABASE_URL`.

Les scripts Playwright rejouent le cours, le bonus et le suivi dans un navigateur autorisé. Ne désactive aucune politique de sécurité pour les faire fonctionner.

## Conservation et limites

Conservation par défaut : 30 jours depuis le dernier envoi ; `RETENTION_DAYS` peut être modifié. La purge tourne à la consultation du tableau, sur demande authentifiée et une fois par jour via le cron Vercel si `CRON_SECRET` est configuré. Au maximum 2 000 événements par session sont conservés, et les 1 000 derniers sont affichés.

Effacer la progression locale ne supprime pas les données déjà reçues. Pour les supprimer : action **Supprimer cette session** côté professeur. La suppression applicative n’efface pas les éventuelles sauvegardes ou journaux gérés séparément par tes hébergeurs.

Ce projet est un outil pédagogique autonome : pas de SSO Eden Hub, pas de carnet de notes officiel, pas d’anti-triche, pas d’audit professionnel de sécurité revendiqué. Vérifie avec l’établissement les accès, l’hébergement, les durées de conservation et les informations à fournir aux élèves.

Yacine
