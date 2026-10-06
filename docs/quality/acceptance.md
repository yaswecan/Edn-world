# Recette de la préparation approfondie — 5 octobre 2026

Le parcours est intégré et accessible en développement. La validation pédagogique réelle demeure **NOT RUN** : aucune clé API n’est configurée et le moteur Docker est arrêté. Aucun cours réel, compte élève ou déploiement de production n’a été modifié. Les trois séances sont des fixtures originales, exécutées dans le véritable orchestrateur avec des réponses IA simulées.

## Résultats vérifiables

| Vérification | État | Preuve et portée |
| --- | --- | --- |
| Syntaxe JavaScript, schémas stricts, DDL additif, primitives Drive conservées | PASS | `npm run check` |
| Suite automatisée complète | PASS | `npm test` : 135 tests, aucun échec ni test ignoré |
| Import Markdown/DOCX/PDF, code/tableaux, scan sans OCR, versions et accès privés | PASS | `tests/pedagogy.test.mjs`, `tests/pedagogy-api.test.mjs` ; fixtures synthétiques |
| Import HTTPS réel, résolution épinglée et extraction MDN | PASS | [url-import.json](evidence/url-import.json) |
| Paramètres Responses, rejet des sorties incomplètes et schémas invalides | PASS | Tests avec transport fournisseur simulé ; aucun appel OpenAI réel |
| Ordre des dépendances appliqué, acquis sans preuve refusés | PASS | Tests de conception et de réordonnancement des unités/blocs |
| Persistance des étapes, réponse réussie réutilisée, annulation et interruption incertaine | PASS | Tests de l’orchestrateur et de l’API ; aucun retry aveugle |
| Quatre candidats maximum, budget et arrêt pour stagnation | PASS | Tests : arrêt au quatrième candidat ou au deuxième rapport identique |
| Hash exact, preuves obligatoires, source modifiée, fixture non publiable | PASS | Tests du contrôle de qualité et de la publication |
| Parcours professeur puis élève : import, brouillon, code, diagnostic enregistré/remis, synthèse et permissions | PASS | `npm run test:quality:browser`, [acceptance.json](evidence/acceptance.json) |
| Rendu des trois séances à 1280 et 390 px | PASS | Captures par pilote ci-dessous ; aucune image manquante ni débordement détecté |
| DOM réel : clics, état, console, erreurs, autre solution, mauvais code, réseau bloqué, boucle bornée, sauvegarde et reset | PASS | `npm run test:quality:dom`, [rapport DOM](evidence/dom/acceptance.json). Chromium réel via adaptateur HTTP de test local, pas Docker |
| Laboratoires Docker : PTY, Git, restauration, deux élèves, quotas, réseau, charge de 18 élèves | NOT RUN | Daemon Docker arrêté. Code et syntaxe Python vérifiés ; aucune capacité d’isolation ou de charge revendiquée |
| Génération et revue OpenAI réelles ; calibration du juge sur le corpus réservé | NOT RUN | Clé absente. [Corpus réservé](../../tests/fixtures/pedagogy-heldout.json), jamais injecté dans les prompts |
| Comparaison modèle/effort A–D, deux répétitions | NOT RUN | [model-comparison.json](evidence/model-comparison.json) ; coût réel non mesuré, aucun modèle déclaré meilleur |
| OCR et compréhension sémantique des figures importées | NOT RUN | Non implémentés ; limites signalées dans le dossier de sources |
| Apprentissage auprès de vrais élèves | NOT RUN | Aucune expérimentation de classe effectuée |

Les fichiers de traces locaux sont `/tmp/tween-quality-tests.log`, `/tmp/tween-quality-check.log`, `/tmp/tween-quality-browser.log` et `/tmp/tween-quality-dom.log`. Les JSON et captures versionnables du dépôt constituent les preuves durables. Les chemins `test-results/quality-render/<hash>` dans les rapports désignent les captures détaillées de la machine de recette ; les vues représentatives sont recopiées dans `docs/quality/evidence`.

## Trois séances complètes

Toutes sont en version 3 : squelette initial, premier candidat puis candidat corrigé. Elles comprennent huit minutes de diagnostic, un mécanisme développé, exemple travaillé, schéma, prédiction, pratique guidée, production autonome justifiée, transfert, vérification finale et remédiation. Les 110 minutes sont une estimation de conception, pas un temps d’apprentissage observé.

| Pilote | Contrôles réels | État final |
| --- | --- | --- |
| [HTML/CSS : modèle de boîte](evidence/box/lesson.student.json) | Références CSS et diagnostic : PASS. Largeur mesurée à 300 px dans un véritable iframe. Rendu 1280/390 : PASS. | Fixture, non publiable |
| [Algorithmique : conditions combinées](evidence/logic/lesson.student.json) | 16 cas pour la règle d’accès, 16 pour la livraison et 4 pour le transfert. Rendu 1280/390 : PASS. | Fixture, non publiable |
| [Shell/Git : classement et première trace](evidence/shell/lesson.student.json) | Rendu : PASS. Déplacement, copie et commit : NOT RUN. Git est préparé comme prolongement facultatif, sans SSH. | Brouillon bloqué par les trois contrôles de laboratoire |

Chaque répertoire contient `lesson.teacher.json` (corrigés et tests privés), `lesson.student.json`, `sources.json`, `preparation.json` (carte de couverture, alternatives et rapports), `comparison.json`, `concept-1280.png`, `concept-390.png` et `teacher-preview-mobile.png`. Les scores de revue 75 puis 100 sont **simulés** pour exercer la correction et la revalidation ; ils ne constituent pas des notes pédagogiques fiables.

Comparaison concrète : le [pilote CSS](evidence/box/comparison.json) remplace une explication générique de styles par le calcul `300 + 20 + 20 + 2 + 2 = 344`, puis explique pourquoi `border-box` ramène l’extérieur à 300 px et le contenu à 256 px. L’exercice conserve le padding et la bordure ; le transfert impose un contenant de 240 px, un texte long et une largeur adaptée. La correction est exécutée et son rendu mesuré. [Capture mobile](evidence/box/concept-390.png).

Le [pilote algorithmique](evidence/logic/comparison.json) expose précisément le contre-exemple `true,true,false,true` : une expression mal regroupée laisse passer malgré l’alarme. La réparation est testée sur les seize combinaisons, puis la production autonome déplace la règle vers la livraison. Le [pilote shell](evidence/shell/comparison.json) développe le lien entre position, chemin et effet réel des commandes, avec copie avant déplacement puis index/commit. Son résultat de laboratoire reste non vérifié.

L’avant provient de l’assemblage local existant ; l’après est une fixture rédigée pour cette recette. Aucun avant/après ne prétend mesurer un gain dû à un modèle ni constituer une référence validée par le professeur.

## Cause, modèle et limites

Les trois runs historiques examinés provenaient de la bibliothèque locale (32, 90 et 65 ms), sans appel IA. Le chemin historique n’enrichissait ni les exemples LiveCode ni les ateliers, et son appel unique ne fixait pas d’effort de raisonnement ou de plafond de sortie. Voir [l’audit causal](audit.md).

Modèle réellement appelé dans cette mission : **aucun**. Les fixtures déclarent `effectiveModel: fixture`. Les tests de transport vérifient l’envoi de `gpt-6.1-sol`, `reasoning.effort: high` et `max_output_tokens: 24000` ; ces tests ne prouvent pas l’accès API. Les capacités sont configurées à partir de la documentation, et les rôles peuvent être paramétrés. Aucun abonnement ChatGPT Pro n’est assimilé à une capacité API.

Restent à valider avant ouverture réelle : qualité et coût des sorties IA, calibration indépendante des juges, sandbox Chromium dans l’image Docker, PTY/Git et isolation entre élèves, sauvegarde/restauration sous incident, contention et charge de classe. Le moteur DOM rejoue les interactions via images ; il ne fournit pas de vidéo continue. OCR, reconstruction de figures et SSH ne sont pas disponibles.

## Ouvrir la recette

```sh
npm run preview:quality
```

Ouvrir [l’accueil isolé](http://quality.localhost:4180/), utiliser `professeur` / `quality-preview-only`, puis [la préparation](http://quality.localhost:4180/preparation.html). La base `.data/quality-preview.sqlite` est dédiée aux fixtures et persistante ; `.env.local` n’est pas chargé. Au premier démarrage, les contrôles Chrome préparent les trois brouillons avant l’ouverture du serveur. Les préparations enregistrées donnent accès aux aperçus et aux preuves.

L’instance a été démarrée et la connexion ainsi que les trois aperçus ont été ouverts dans Chromium : **PASS**. Les liens exacts des préparations de cette base sont dans [preview.json](evidence/preview.json). Les empreintes finales des candidats ont été recalculées et correspondent aux sources et au runtime livrés : [verification.json](evidence/verification.json).

Activation par défaut en développement ; production désactivée par défaut. Retour arrière : `EDEN_QUALITY_PIPELINE=0`, en conservant les nouvelles tables et les contrôles sur les brouillons `qualityRequired`. Aucun déploiement effectué. [Configuration complète](README.md) · [Installation du laboratoire séparé](../../labs/README.md).
