# Vérifications exécutées — 4 novembre 2026

Les preuves ci-dessous proviennent des tests exécutés dans ce dépôt et d’un vrai navigateur Chrome. Les rapports inclus dans le ZIP source n’ont pas été utilisés comme preuve de conformité.

| Commande | Résultat |
| --- | --- |
| `node --import tsx --test --test-concurrency=4 tests/*.test.mjs` | 456 tests réussis, 0 échec, 0 ignoré |
| `npm run check` | Syntaxe, schémas exportés, DDL et primitives Drive : réussite |
| `node --import tsx scripts/programming-package.mjs docs/programming/examples/bibliotheque.lesson.json /tmp/bibliotheque.tweenteach.zip` | Paquet construit et validé par le lecteur natif |
| `npm run test:programming:browser` | Recette Chrome : 29 contrôles réussis |
| `node --import tsx scripts/session-types-browser-check.mjs` | Planification et deux écrans de création : 5 contrôles réussis |

La fidélité au ZIP est vérifiée contre ses données réelles : explications, départs, exemples visibles, prédictions, indices, cas de test, QCM, textes à trous, mémo, introductions et tableaux comparatifs. Les démonstrations des ateliers autonomes restent absentes comme dans le cours élève original. Les tests de présentation couvrent les dix ateliers et les changements de noms de variables.

La recette navigateur couvre l’import du ZIP original depuis le sélecteur professeur, sa création en brouillon, les six familles de schémas, les modifications effectives du code et des arguments, la séparation console/retour, les résultats de tests, l’invalidation de trace, la préservation du brouillon en mode exemple, les QCM et leurs feedbacks, les bilans segmentés avec variantes, le transfert facultatif, le comparatif déclaratif, l’interruption effective du Worker et son redémarrage, l’indice zéro, les largeurs 768 et 390 pixels, la sauvegarde/reprise authentifiée, le refus direct du corpus professeur, le mémo autorisé, l’import/exécution du second corpus et le mode sans mouvement. Elle contrôle aussi la disposition schéma/code, la palette du ZIP, les cinq repères, le mémo, le sélecteur de séance, l’export/reprise du travail complet et la largeur réelle du lecteur élève sur ordinateur, tablette et mobile. Tester plusieurs cas conserve la trace de l’appel affiché : des arguments de test différents ne sont pas présentés comme ceux de l’éditeur.

Le rapport détaillé est généré dans `test-results/programming/report.json` et les captures dans le même dossier : import, array, for, while, function, foreach, decompose, largeur tablette/mobile, travail élève sauvegardé et second corpus. Ces fichiers de recette restent dans le répertoire ignoré habituel du dépôt.

La recette des types de séance vérifie le choix et la persistance dans le plan, la création depuis la fenêtre principale et depuis la page de préparation, ainsi que la durée du modèle choisi. La création utilise le parcours complet de 360 minutes ou une de ses séances de 180 minutes ; elle ne prétend pas adapter automatiquement ce contenu à un autre sujet.

Les tests de programmation vérifient aussi :

- Les 54 tests des solutions de référence dans le moteur applicatif et dans les threads de test serveur.
- Les départs intentionnellement erronés, le budget du while, la portée du return de callback, les tableaux vides et les valeurs nulles/zéro.
- Le refus d’accès au navigateur, au réseau, au stockage, aux prototypes et aux structures internes du moteur.
- La racine enveloppante ou directe, l’intégrité, les collisions Unicode, chemins dangereux, liens symboliques et bombes de décompression.
- Les types, versions et capacités inconnus, les références et durées incohérentes, l’absence d’activité silencieusement perdue.
- Le réimport idempotent, l’absence de cours partiel sur échec, le transport canonique sans perte et la conservation des 63 ressources après modification puis export.
- La séparation des comptes, la reprise serveur, le conflit de version, la remise avec reçu, l’absence de note inventée et le refus d’une tentative diagnostique notée pour ce corpus formatif.
- Les validations d’édition riche, les résultats périmés et le refus de résultats importés présentés comme certifiés.

La suite complète couvre également les anciens lecteurs web/programmation, les transferts historiques, les règles de publication, les accès, les diagnostics, les révisions et le suivi existant. Les tests utilisent des fixtures isolées ; aucune donnée de la base de travail de l’utilisateur n’est importée ou publiée par ces recettes.

Limites : aucune validation de déploiement en production, aucun appel réel au fournisseur IA, aucun audit lecteur d’écran ou multi-navigateurs complet. Le sous-ensemble JavaScript et les budgets sont décrits dans [engine.md](engine.md).
