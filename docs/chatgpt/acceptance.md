# Recette SIWC — 6 octobre 2026

## État de livraison

| Domaine | Résultat |
| --- | --- |
| Implémentation locale | Terminée pour le protocole documenté : authentification, coffre, catalogue, choix explicite, transport SSE, pipeline et worker intégrés. |
| Tests automatisés | 190 tests de la suite complète, dont 35 tests SIWC, et build/syntaxe/schémas réussis après les correctifs du 7 octobre. Les recettes Chrome SIWC et historique ont réussi lors de la recette initiale. |
| Authentification réelle | **Vérifiée localement le 7 octobre 2026** : connexion réalisée par le professeur, identité/scopes validés par l’application, puis catalogue réel de quatre modèles obtenu avec cette connexion. Les tests automatisés continuent d’utiliser une autorité OIDC synthétique. |
| Génération réelle | **Petit appel de connexion et quatre schémas pédagogiques vérifiés le 7 octobre 2026**, sur le modèle sélectionné, jusqu’à `response.completed`. Les schémas ont été réunis dans un appel avec données fictives ; le résultat respecte le contrat local. Le diagnostic et les vérifications ont utilisé le forfait ChatGPT. La génération d’une séance complète reste non vérifiée. |
| Mode hébergé | **Accès requis ; contrat partenaire à compléter.** Bloqué côté serveur, pas de consommateur hébergé livré ou prétendu fonctionnel. |
| Production | **Non déployée.** Neon et données de production inchangés. |

La qualification « implémentation terminée » décrit le code et les vérifications contrôlées. Elle ne certifie pas l’éligibilité d’un compte, la disponibilité d’un modèle, les scopes réellement accordés, ni la qualité d’un cours généré en conditions réelles. Les niveaux de raisonnement SIWC non confirmés restent indisponibles. Le laboratoire shell/DOM nécessite sa configuration existante.

Correction du 7 octobre : la route réelle a renvoyé HTTP 200 et des événements SSE sans en-tête `Content-Type`, ce qui déclenchait « Le fournisseur n’a pas ouvert le flux attendu ». Le lecteur accepte désormais cet en-tête absent, mais exige toujours `response.completed` avec un statut `completed`. La requête annonce `Accept: text/event-stream`. Les tests couvrent l’absence d’en-tête, les fragments UTF-8, les interruptions, les erreurs de quota, le rejet des corps JSON/HTML et le parcours HTTP de vérification de connexion.

Second correctif du 7 octobre : le refus HTTP 400 `invalid_json_schema` venait du `type` absent sur `duration.includesReadingAttemptsHelpAndCorrection`. Les constantes et énumérations de tous les schémas pédagogiques déclarent désormais leur type, en conservant leurs contraintes. Les schémas exportés ont été régénérés. Une préparation existante refusée pour ce code propose une reprise explicite, sans duplication du brouillon ni retry automatique ; les contrôles de source et les budgets restent applicables. Le test réel avec données fictives a validé les schémas de conception, revue du plan, rédaction et revue finale avec `gpt-6-astra`. La préparation de l’utilisateur n’a pas été reprise : l’approbation automatique a demandé son autorisation explicite avant de renvoyer les documents à ChatGPT.

Troisième correctif du 7 octobre : un appel de conception avait été interrompu à 180 069 ms avec 20 851 caractères partiels conservés, pour un délai local configuré à 180 000 ms. Le délai ChatGPT par défaut passe à 600 s (maximum configurable 1 200 s), borné par le temps global restant. Une reprise explicite met à jour ce seul délai pour les anciens jobs, en conservant les budgets, la connexion, le modèle, les étapes validées et les fragments. Les traces distinguent maintenant expiration locale, annulation et coupure réseau. Les tests simulent une réussite après l’ancienne limite, une lecture bloquée interrompue par le délai, et la reprise d’un job enregistré avec 180 s. Aucun nouvel appel réel de génération n’a été effectué pour ce correctif.

## Commandes et preuves

```sh
npm run test:chatgpt
npm test
npm run test:chatgpt:browser
npm run build
```

Les tests n’utilisent pas `.env.local`, Neon ou une clé de production. Le sandbox local refusait initialement les sockets de test (`listen EPERM`), puis les tests HTTP ont été exécutés dans l’environnement autorisé. Les problèmes découverts dans ce lot ont été corrigés avant les résultats ci-dessus. Le dépôt n’a pas de commande lint/typecheck globale distincte : `build` appelle `check`, qui vérifie la syntaxe, les exports de schémas, le DDL commun et la préservation des primitives Drive.

La commande livrée `npm run dev:chatgpt` a également été lancée : accueil d’initialisation et `/api/health` répondent HTTP 200, stockage SQLite séparé, serveur et worker distincts. Aucun compte n’a été créé pendant cette vérification ; le runtime de vérification a été arrêté proprement.

La recette historique `scripts/browser-check.mjs` passe dans Chrome : publication, parcours élève, corrections, arcade et mobile. Son Chromium Playwright n’est pas installé sur ce poste ; le binaire Chrome a été indiqué via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Elle attend l’ancien parcours immédiat et nécessite `EDEN_QUALITY_PIPELINE=0` (le défaut approfondi existait déjà avant ce lot). Un lanceur temporaire a borné les attentes navigateur à 20 s, sans modifier ses scénarios. Relance équivalente sur ce Mac :

```sh
env -u OPENAI_API_KEY EDEN_QUALITY_PIPELINE=0 \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm run test:browser
```

| Fichier de tests | Frontières exercées |
| --- | --- |
| `tests/chatgpt-auth.test.mjs` | Configuration hébergée refusée ; hôte/client persistants ; callback valide/refus/rejeu/state/navigateur/session ; signature, nonce, issuer, audience, expiration et identité ; absence de scopes ; comptes de même email ; rotation concurrente ; révocation et permissions du coffre. |
| `tests/chatgpt-api.test.mjs` | Isolation élève/professeur/autre professeur de même classe ; secrets absents des réponses ; origines et Host/proxy interdits ; callback sans cookie Strict ; session professeur révoquée ; petit appel explicite simulé. |
| `tests/chatgpt-provider.test.mjs` | API choisie et sérialisation conservée ; allowlist SIWC ; prompts et schémas communs ; SSE fragmenté/UTF-8, terminal requis, erreurs après texte, JSON incomplet ; codes de récupération ; délais ; aucune bascule API. |
| `tests/chatgpt-jobs.test.mjs` | Choix figé, idempotence, changements de compte/réglages ; tous les rôles du pipeline sur SIWC simulé ; fixtures frontend/programmation/shell ; protection des appels API annexes ; concurrence/bail ; retries bornés ; fragments/reprise/annulation ; révision tardive. |
| `tests/chatgpt-process.test.mjs` | Deux vrais processus partageant le coffre : un renouvellement ; worker séparé tué par SIGKILL : job durable incertain et zéro relance automatique. |
| Tests existants | Contrats pédagogiques, 429 historiques/actuels, corpus, publication, droits, arcade, migrations SQLite/PostgreSQL de test, restauration, ateliers, corrections et contenu élève. |

La recette navigateur vérifie le lien depuis les réglages existants, le bouton officiel, le retour loopback simulé, la confirmation initiale, la sélection du modèle et du fournisseur, le mobile sans débordement, le double lancement idempotent, la fermeture d’onglet, la récupération/annulation du job et la déconnexion. Le simulateur remplace la redirection du serveur vers OpenAI ; les destinations externes du navigateur sont bloquées. La signature et le token endpoint sont exercés séparément avec l’autorité de test. Ce n’est pas une authentification réelle.

Preuves locales régénérables dans `test-results/chatgpt/` : `report.json`, `settings-desktop.png`, `settings-mobile.png`, `job-cancelled.png`. Les captures desktop/mobile ont été inspectées. Ce répertoire est ignoré par Git.

Vérification du **7 octobre 2026** : correction de l’accès aux réglages après connexion professeur, entrée directe **ChatGPT & API** dans le menu et bouton de connexion placé en haut sur mobile. La recette Chrome passe ses 13 contrôles, dont le retour après authentification applicative et le refus d’une destination de retour externe ; `npm run check` réussit. `connect-mobile.png` montre le bouton avant connexion ChatGPT. L’authentification OpenAI de cette recette reste simulée. Les fichiers corrigés sont servis par l’instance locale sur le port 4181 sans redémarrage.

Deuxième vérification du **7 octobre 2026** : le professeur avait réussi la connexion mais n’avait pas choisi le fournisseur et le modèle. La préparation permet désormais cette activation sur place ; elle explique le mode encore sélectionné et empêche les lancements tant qu’il n’est pas prêt. Le choix reste explicite et ne démarre aucun appel d’inférence. Les anciennes demandes API bloquées sont conservées ; le prochain lancement après activation crée une nouvelle action. La recette Chrome passe ses **16 contrôles**, notamment ce parcours et la conservation de l’intention saisie ; `npm run check` réussit. Une lecture du catalogue officiel avec la connexion réelle a réussi sans génération réelle.

## Recette réelle restant à exécuter par le professeur

1. Suivre le [démarrage personnel](README.md), choisir un compte éligible et autoriser le forfait dans la fenêtre OpenAI.
2. Confirmer que la connexion seule ne suffit pas : vérifier les modèles, choisir un slug accessible puis enregistrer le mode ChatGPT.
3. Cliquer **Tester la connexion · un appel au forfait**. Vérifier la confirmation terminale. En cas d’erreur, conserver uniquement le code, statut et request ID expurgés ; ne copier aucun token ou URL OAuth.
4. Importer une courte source technique et choisir une séance HTML/CSS ou programmation avec durée confirmée. Lancer la préparation ; fermer puis rouvrir l’onglet depuis la liste.
5. Vérifier les étapes et les paramètres dans la zone technique, le statut final, la couverture des sources et les contrôles de schéma. Ouvrir le brouillon, tester les exercices et comparer avec la référence pédagogique actuelle. Ne publier qu’après relecture professeur.
6. Pour shell/Git ou DOM, configurer le laboratoire existant avant le lancement et vérifier les preuves d’exécution. Un contrôle absent doit rester bloquant.
7. Tester le changement de connexion pendant un job, sa déconnexion et la reprise explicite. Vérifier que le fournisseur figé ne change pas et qu’aucun appel API n’est apparu.
8. Vérifier la déconnexion dans Tween Teach et dans la gestion d’usage ChatGPT. Si la révocation distante n’est pas confirmée, supprimer l’accès depuis ChatGPT.

Ne pas relancer automatiquement un appel au résultat inconnu pour « finir le test ». Ne pas certifier les étapes 1–8 à partir des fixtures.

## Fichiers livrés

- Fournisseur/authentification : `server/ai/{chatgpt,vault,settings,routes,plan-provider,errors}.mjs`.
- Intégration : `server/pedagogy/{provider,jobs,routes,dom}.mjs`, `server/{app,index,generator,assessment,openai-errors}.mjs`.
- Interface professeur : `public/ai-settings.{html,js}`, `public/ai-access.js`, `public/app.js`, `public/preparation.js` ; composants et CSS existants réutilisés.
- Runtime/tests : `scripts/{chatgpt-local,ai-worker,chatgpt-browser-check}.mjs`, `tests/chatgpt*.test.mjs`, `tests/fixtures/chatgpt*.mjs`.
- Dépendances et documentation : `package.json`, `package-lock.json`, `.env.example`, `README.md`, `docs/chatgpt/*.md`.

Aucune modification de `vercel.json`, des prompts pédagogiques, de l’arcade, des jeux, des schémas de leçon ou du renderer élève. Aucun service souscrit ; aucun déploiement, commit ou push effectué.
