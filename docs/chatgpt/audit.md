# Audit et décision d’architecture

Date : **6 octobre 2026**. État Git initial propre. Seules les instructions `AGENTS.md` du sous-projet World Arcade ont été trouvées ; ce sous-projet n’est pas modifié. Aucun `.env.local` ni secret existant n’a été lu. Aucune migration, requête métier ou écriture sur Neon/production.

## Cartographie de l’existant

| Zone | Fichiers réels et contrat conservé |
| --- | --- |
| Runtime | `server/index.mjs` : Express ESM Node 22, stockage SQLite/PostgreSQL, consommateur local. `api/index.mjs` : Vercel, initialise l’app mais n’exécute pas les préparations. `vercel.json` : durée 300 s. |
| Droits | `server/auth.mjs` : session applicative, rôles, classe, version du mot de passe, cookies HttpOnly ; `server/app.mjs` : routes professeur/élève. |
| Préparation | `server/pedagogy/jobs.mjs` : assemblage, conception, revue du plan, rédaction par unités, contrôles, revue indépendante, corrections. |
| Qualité | `server/pedagogy/prompts.mjs`, `contracts.mjs`, `quality.mjs`, `scaffold.mjs`, `catalog.mjs` : diagnostic, progression, productions de code, sources, mécanismes pédagogiques et barrières de publication. |
| Appels IA | `server/pedagogy/provider.mjs` : Responses API, prompts communs, schéma JSON, rôles et budgets. `server/generator.mjs` : ancien enrichissement ; `server/rubric-grading.mjs` / `assessment.mjs` : pré-correction séparée. |
| Ingestion | `server/pedagogy/documents.mjs` et `pdf-worker.mjs` : extraction locale/serveur et ingestion d’URL contrôlée. `server/retrieval.mjs` : recherche lexicale, sans embeddings facturés. Aucune extraction IA ou recherche OpenAI cachée. |
| Données et jobs | `server/store.mjs` et `database/schema.sql` : agrégats JSON, transactions SQLite `BEGIN IMMEDIATE`, verrou consultatif PostgreSQL. Tables existantes `generation_jobs`, `generation_calls`, `generation_candidates`. Jobs Drive distincts dans `server/jobs.mjs`. |
| Cours et exports | `server/domain.mjs`, `corpus.mjs`, `artifacts.mjs`, `database-snapshot.mjs` : versions, publication, corpus et transfert de base ; formats conservés. |
| Interface | `public/app.js`, `preparation.html`, `preparation.js`, `brand.css`, `style.css`, `preparation.css` : espace et composants professeur réutilisés. Renderer et pages élèves inchangés. |
| Laboratoires | `server/pedagogy/labs.mjs`, `dom.mjs`, `labs/README.md` : exécuteurs isolés déjà requis pour shell/Git et DOM. Pas de nouveau moteur. |
| Erreurs 429 | `failOpenAI` dans `server/openai-errors.mjs` → appel de `provider.mjs` → trace `generation_calls` → état du job → `public/preparation.js`. Ancien enrichissement → middleware d’erreur → `public/app.js`. |

Le dépôt distinguait déjà les codes de crédits, dépenses, quota et débit dans `openai-errors.mjs`. Ce lot ajoute les conditions de retry exploitées par les jobs, les délais de reprise persistants et les erreurs SIWC. **La cause de la 429 historique reste inconnue** : son corps original et ses en-têtes ne sont pas fournis. Aucun diagnostic « crédits épuisés » n’est déduit du seul statut.

## Décision

L’interface commune est `callStructured({role,input,schema,config,signal,images})`. Elle reçoit les mêmes prompts/schémas, puis sélectionne une sérialisation selon le fournisseur **figé dans le job**. `server/ai/settings.mjs` capture propriétaire, connexion et slug avant l’exécution. `server/ai/plan-provider.mjs` gère SSE et résultat validé ; `server/ai/errors.mjs` classe les récupérations. Les outils distants SIWC ne sont pas utilisés. Le petit test de connexion est une action explicite au forfait.

Les préférences non secrètes sont ajoutées à l’agrégat `teachers`; les jobs ajoutent des champs optionnels. Pas de migration DDL ni de changement du format de sauvegarde. Un professeur d’une même classe ne peut pas consulter/reprendre/annuler le job ou la connexion d’un autre. Les sources pédagogiques restent des ressources de classe conformément à l’existant.

`server/ai/chatgpt.mjs` associe session professeur, navigateur, tentative unique, identité signée et client délivré. Le cookie transitoire SameSite=Lax sert au callback ; le cookie applicatif Strict reste inchangé. Une déconnexion applicative ou un changement de mot de passe invalide le callback en attente. L’ajout d’un compte ne remplace pas les credentials actifs avant validation.

`server/ai/vault.mjs` garde les secrets hors des tables et exports, vérifie propriétaire/permissions et utilise un verrou interprocessus avec écritures atomiques. Les URLs d’autorisation ne sont pas journalisées et aucun ID token n’y est ajouté comme hint facultatif. La connexion sait renouveler, découvrir le catalogue et révoquer. Déconnexion et envoi d’une nouvelle requête sont sérialisés ; un token précédemment lu ne peut pas lancer une requête après suppression locale.

## Corrections de l’exécuteur

- Le lanceur personnel et `scripts/ai-worker.mjs` consomment réellement la queue persistante, dans un processus distinct de l’interface HTTP.
- Une génération à la fois par connexion ; concurrence volontairement fixée à 1 pour cette version. Il n’existe pas de réglage prétendant valider des capacités de concurrence non mesurées.
- Idempotence par propriétaire/action ; conflit si la même clé change de contenu. Choisir une autre connexion ne réécrit jamais un job existant.
- Acquisition atomique, heartbeat 30 s, bail 5 min et vérification du bail à chaque checkpoint/installation. Surveillance de l’annulation chaque seconde et AbortSignal jusqu’au transport.
- Réponses validées réutilisées après interruption. Flux interrompu : fragments conservés séparément, état `blocked` + récupération `uncertain` ou `incomplete`, reprise explicite.
- Erreurs temporaires : maximum trois tentatives par opération, `Retry-After` respecté, sinon délai exponentiel borné avec jitter. Aucun SDK ne réessaie sous cette politique.
- Quota/permissions/configuration : aucune boucle automatique. Limite du forfait : connexion suspendue jusqu’à vérification explicite. Aucun horaire de reset inventé.
- Révision de départ attachée au candidat ; une publication, une modification professeur ou la perte du bail empêche l’installation tardive. La préparation produit son propre brouillon.

Ces mécanismes ne garantissent pas une consommation exactement unique côté fournisseur. Un crash peut arriver après consommation et avant persistance. L’état d’incertitude représente précisément ce cas.

## Dépendances facturées et capacités

La préparation, ses revues et corrections utilisent toutes le même fournisseur. L’assemblage appelle `generateLesson` avec `localOnly:true`. L’ancien enrichissement et la pré-correction par rubrique sont bloqués lorsque le professeur a choisi ChatGPT ; leur emploi exige un choix API explicite. Le laboratoire existant constitue une dépendance distincte, annoncée avant l’appel IA et jamais remplacée par une simulation.

Les schémas, évaluateurs, références NX Academy/Codewars/TryHackMe/OverTheWire/Codecademy, renderer, arcade et formats de corpus sont conservés. Les bibliothèques d’authentification sont ajoutées au manifeste et au lockfile ; le DevKit n’est pas repris. Les limites de modèle non établies restent non configurables, notamment les niveaux de raisonnement SIWC.
