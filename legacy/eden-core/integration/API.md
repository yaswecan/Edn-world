# API du suivi PC — version Vercel + Neon

Contrat de ce projet autonome, **pas une API officielle Eden Hub**. Une classe par configuration ; les identités Eden Hub, le SSO et le carnet de notes ne sont pas raccordés. Le serveur dérive la classe de son environnement et l’élève de son jeton opaque, jamais d’un identifiant élève libre dans le JSON.

## Transport et routes

Même origine, JSON, pas de CORS permissif. Corps maximal 300 Ko. Les réponses privées sont `Cache-Control: no-store`. Les fonctions acceptent le flux HTTP local ou le corps `req.body` déjà analysé par Vercel.

| Route | Accès | Résultat |
|---|---|---|
| `GET /api/config` | Public | `enabled`, backend, libellé de classe, conservation et nombre d’écrans ; pas de secret |
| `GET /api/health` | Public | Connexion Neon et schéma version 1 ; 503 si indisponible |
| `POST /api/enroll` | Code de classe | `{alias,classCode}` → `studentId`, `token`, `expiresAt` |
| `POST /api/events` | Bearer élève | Événements du bonus et synthèse, dédupliqués |
| `POST /api/teacher/login` | Mot de passe serveur | Cookie opaque professeur |
| `POST /api/teacher/logout` | Cookie professeur | Révocation du cookie et de la session distante |
| `GET /api/teacher/learners` | Cookie professeur | Liste (500 maximum), conservation, nombre d’écrans |
| `GET /api/teacher/learner/:id` | Cookie professeur | Synthèse et 1 000 derniers événements |
| `POST /api/teacher/learner/:id` | Cookie professeur | Validation versionnée et commentaire |
| `DELETE /api/teacher/learner/:id` | Cookie professeur | Suppression de la session et de ses essais |
| `POST /api/teacher/maintenance` | Cookie professeur | Purge des données périmées |
| `GET /api/cron` | Bearer `CRON_SECRET` | Même purge, requête quotidienne de Vercel |

Secrets configurés uniquement côté serveur. Mot de passe professeur : 20–256 caractères, code classe : 8–128. Sessions professeur : 8 heures ; élève : 7 jours. Pseudonymes : 2–48 lettres/chiffres/espaces/tirets/points/underscores. Un pseudonyme identique ne fusionne pas les sessions.

## État transmis

```json
{
  "packetId": "identifiant-du-paquet",
  "order": 12,
  "coreCompleted": 36,
  "simulator": {
    "version": 1,
    "runId": "identifiant-de-partie",
    "seq": 28,
    "events": []
  }
}
```

Cet exemple ne contient que les clés de transport : ce **n’est pas un état complet valide**. Le schéma réel et le constructeur sont dans `docs/app/pcsim/model.js`. Le serveur reconstruit une synthèse bornée avec `sanitizeSimulator` et `simulatorSummary`.

Les réponses détaillées au diagnostic, aux six missions et au ticket ne sont pas envoyées. `coreCompleted` est le nombre d’écrans parcourus joint aux événements du bonus, pas un compte de compétences validées.

Chaque événement possède un identifiant, un `runId`, une séquence et un type connu. Le corps client peut contenir au plus 500 événements. Le serveur rejette les identifiants répétés dans un même lot et déduplique ensuite les renvois par `(learner_id,event_id)`.

Une transaction prend un verrou sur la session, insère les événements, actualise le résumé uniquement si `order` est plus récent, puis borne l’historique à 2 000 événements. Des fonctions Vercel différentes partagent le même état PostgreSQL. La réponse `receivedAt`, `acceptedEvents`, `duplicateOrOlder` n’arrive qu’après l’écriture réussie. Le navigateur attend cette réponse avant d’afficher « reçu ».

## Validation pédagogique

```json
{
  "validation": "valide",
  "note": "Bonne démarche de diagnostic.",
  "expectedRevision": 42,
  "expectedRunId": "identifiant-de-partie"
}
```

Valeurs acceptées : `a-valider`, `valide`, `a-revoir`. La révision et le runId attendus viennent de la fiche lue par le professeur ; s’il n’y a pas encore de synthèse, ils valent `null`. Une nouvelle preuve depuis la lecture produit un **409**, pas une validation silencieuse d’une autre version. Nouvelle synthèse = retour à « à valider ». La note professeur est conservée séparément.

Les preuves sont fournies par le navigateur et ne constituent pas un examen infalsifiable. La compréhension et l’explication restent à apprécier humainement.

## Sécurité et cycle de vie

Le mot de passe professeur et le code classe ne sont pas stockés en clair dans la base. Les tokens sont aléatoires et hachés ; les empreintes de configuration invalident les anciennes sessions lors d’une rotation de secret. Cookie HttpOnly / SameSite Strict / Secure en HTTPS. Contrôle d’origine pour les appels et refus des requêtes marquées intersites.

Limites partagées dans PostgreSQL : 12 tentatives professeur par tranche de 15 minutes et IP, 120 inscriptions par 15 minutes et IP, 120 envois par minute et session élève. Le seuil d’inscription tient compte des postes d’une classe derrière une même IP. Les clés de limitation sont hachées avec une clé serveur ; pas d’IP brute dans les tables applicatives. Ces mesures ne remplacent pas les protections de l’hébergement.

Conservation : 30 jours par défaut après le dernier envoi. Purge à la consultation professeur, via l’endpoint de maintenance et via le cron authentifié. Le projet ne configure pas les sauvegardes ni les journaux de tes hébergeurs.

Statuts : 400 données invalides, 401 session absente/expirée, 403 secret ou origine refusés, 404 ressource absente, 405 méthode refusée, 409 preuve obsolète, 413 taille, 415 format, 429 limite, 503 configuration/connexion Neon. Pas de fuite de chaîne de connexion dans les réponses.

## Intégration native éventuelle

Pour rattacher ce service aux vrais comptes Eden Hub, remplace l’inscription par une session issue de la plateforme et ajoute sa gestion des rôles/établissements. Ne publie jamais de clé serveur dans le client. Le moteur pédagogique et le transport sont séparés afin de permettre cette adaptation ; elle n’est pas incluse dans cette version autonome.
