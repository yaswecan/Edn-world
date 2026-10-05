# Rejouer les contrôles · v6.0.0

## Installation et Node
`npm ci`, puis `npm run build`, `npm test` et `npm run check:deployment`.
Les 186 tests Node réussis lors de la fabrication ne nécessitent pas Neon. Les tests de stockage utilisent des doubles mémoire. Leurs résultats sont conservés dans `RESULTATS_NODE.txt`.

## Navigateur réel sur une machine autorisée
Installer Python, Playwright et un navigateur autorisé (`pip install -r tests/requirements.txt`, puis installation du navigateur Playwright si nécessaire). Lancer `npm run test:e2e`.
Ce smoke test V6 démarre si nécessaire `tests/mock-server.mjs` sur `127.0.0.1:4181` : véritables fichiers HTTP/modules/cookies, API mémoire, soumission, correction et ZIP Excel. `CHROMIUM_PATH` peut sélectionner un navigateur déjà installé. La navigation native a été tentée et arrêtée par la politique du navigateur (ERR_BLOCKED_BY_ADMINISTRATOR) ; aucune navigation réelle ni cookie natif n’a pu être validé dans cet environnement. Ne pas contourner une politique administrateur.

Le serveur de test utilise des secrets **fictifs** et un stockage mémoire. Il n’est jamais un serveur de production ; `tests/` est exclu par `.vercelignore`.

## Fixture DOM / API de fabrication
Dans un terminal `node tests/mock-server.mjs`, dans l’autre `npm run test:dom`.
Le script utilise Chromium, les modules locaux injectés, des SVG intégrés, un stockage simulé et un pont Python vers l’API mémoire. Il traverse les 31 écrans et teste l’interface professeur et les exports (92 contrôles lors de la fabrication). Il ne valide pas la navigation native, les cookies de production ou une base Neon.
Les résultats temporaires vont dans `tests/results-dom/` ; ceux de la fabrication sont résumés dans `RESULTATS_DOM.json`. Les exports sont des démonstrations fictives.

## Neon réel : opt-in explicite
Sur une branche Neon de **TEST indépendante**, définir `TEST_DATABASE_URL` et `TEST_ALLOW_DB_WRITES=1`, puis `npm run test:neon`.
Le test exerce migration v2, copie, idempotence, isolation, correction atomique, conflit et réouverture. Il crée un élève dans un périmètre de test unique et le supprime en fin de test. Le schéma créé reste sur la branche de test. Sans les variables, le test est ignoré. Aucun test réel Neon n’a été exécuté lors de la fabrication.

## Fichiers de rapports
`RESULTATS_BUILD.txt` : sortie du build et de l’audit strict.
`RESULTATS_NODE.txt` : tests unitaires/API mémoire.
`RESULTATS_DOM.json` : contrôles d’interface dans la fixture.
Le rapport de portée et les limites se trouvent à la racine dans `RAPPORT_TESTS.md`.
