# Contrôles de livraison — Vercel + Neon, version 3.0.0

## Exécuté sur cette version

**Build local : réussi.** Vérification de la syntaxe, des imports, des liens locaux, de la cohérence SQL/JavaScript, du lockfile et des dix handlers. Aucun appel Neon n’est nécessaire au build. Les 36 écrans, six missions et 175 minutes dont 15 minutes de pause sont conservés.

**141 tests Node : réussis, 0 échec.**
- 41 tests du cours ; 46 tests du moteur PC ; 12 tests de la file de synchronisation.
- 36 tests du contrat HTTP/API avec un **repository mémoire injecté seulement pour les tests**.
- 6 tests du contrat de l’adaptateur Neon/SQL avec un **driver simulé**.

Les tests HTTP utilisent réellement Node et un port local. Ils vérifient inscription, accès professeur, cookie, contrôle d’origine, sessions expirées, corps déjà analysés par Vercel, enveloppes invalides, déduplication, ordre des paquets, validation versionnée, suppression, limites partagées, purge et erreurs sans fuite de secrets. **Le double mémoire ne prouve pas l’exécution du SQL par PostgreSQL.**

### Chromium — simulateur en document mémoire

`tests/simulator_component.py` a été exécuté : mauvaise zone, glisser-déposer de carte mère, placement des pièces, sept câbles, POWER, choix BIOS USB/SSD, premier démarrage, quatre diagnostics, réparation avec nouveau démarrage, explication finale, reprise par remontage du composant, écran 390 px sans débordement horizontal. **Zéro erreur JavaScript de page.**

### Chromium — tableau professeur en document mémoire

`tests/teacher_component.py` a été exécuté avec des réponses `fetch` explicitement simulées. Test du mot de passe refusé puis accepté dans l’interface, compteur 36/36, affichage 4/4 pannes, détail, validation avec révision attendue, commentaire, suppression, déconnexion et écran 390 px. **Zéro erreur JavaScript de page.** Le rendu a été relu. Ce test vérifie l’interface, pas un cookie réel dans Vercel ni l’accès réel à Neon.

## Non exécuté / à vérifier

- **Pas de déploiement sur un compte Vercel.** Le fichier de configuration est préparé ; une recette réelle reste nécessaire.
- **Pas de test de connexion, de migration ni de transaction sur une base Neon réelle.** Aucun identifiant n’a été fourni. `npm run test:neon` a été lancé et s’est explicitement déclaré ignoré : 0 réussite, 1 test ignoré, faute de branche de test configurée.
- **`npm ci` avec téléchargement n’a pas été exécuté** : l’environnement ne résout pas le registre npm. Le package verrouillé `@neondatabase/serverless@1.1.0`, son URL et son intégrité ont été vérifiés dans les métadonnées officielles ; le lockfile a été contrôlé localement. Il doit être installé lors du déploiement ou sur ton poste.
- **Le parcours navigateur HTTP complet n’a pas abouti dans cet environnement.** Chromium bloque la navigation locale par `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Aucune politique n’a été modifiée ni contournée. Les tests API HTTP et les tests DOM mémoire sont donc deux vérifications distinctes.
- Pas de mesure en salle de la durée du bonus, de compatibilité avec les comptes Eden Hub, d’audit professionnel de sécurité, de test de charge ou de validation juridique de l’hébergement.

Le rapport machine de cette livraison est dans `tests/rapport-vercel-neon.json`. Les anciens nombres de tests du projet SQLite ne sont pas les résultats de cette version.

## Rejouer

```sh
npm ci
npm run build
npm test
```

Pour un PostgreSQL réel : crée une **branche Neon dédiée aux tests**, copie sa connexion dans `TEST_DATABASE_URL`, définis `TEST_ALLOW_DB_WRITES=1`, puis exécute `npm run test:neon`. Les fixtures ont un namespace aléatoire et sont supprimées à la fin ; ce test ne doit pas viser une base de classe.

Tests navigateur dans un environnement autorisé :

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
# Avec le site local lancé :
npm run test:e2e
npm run test:e2e:sim
```

Pour le contrat de l’interface de suivi **avec un double local** : arrêter le serveur local précédent, lancer `node tests/mock-server.mjs`, puis `npm run test:e2e:api`. Ce mock n’est importé par aucune fonction de production et n’est pas déployé. Il ne peut pas servir de stockage durable.

Pour les composants sans serveur : `python tests/simulator_component.py` et `python tests/teacher_component.py`. `EDEN_CHROMIUM` permet d’indiquer un binaire de navigateur autorisé, `EDEN_TEST_OUTPUT` un dossier de résultats.

## Recette minimale sur ton hébergement

1. Déployer avec les quatre variables ; vérifier `/api/health`, puis connexion professeur dans `/prof.html`.
2. Élève : terminer le parcours, ouvrir le bonus, activer le partage, faire une manipulation et attendre le message de réception.
3. Professeur : lire la session dans un autre navigateur, commenter, valider, exporter. Si une nouvelle preuve arrive, relire avant de valider à nouveau.
4. Recharger le site élève, tester le code dans le Worker, vérifier la reprise et l’export réel. Faire un essai avec deux élèves distincts.
5. Couper puis rétablir le réseau sur le poste autorisé ; vérifier l’envoi différé sans doublons et l’absence de faux message de réception.
6. Supprimer la session de test ; vérifier le cron, la conservation, les accès Neon, les liens de dépôt et la politique de l’établissement.

Yacine
