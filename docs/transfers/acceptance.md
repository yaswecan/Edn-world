# Recette du transfert — 9 octobre 2026

Les comptes, cours et travaux de ces essais sont synthétiques. Aucun catalogue actif, aucune base déployée et aucun compte réel n’ont été modifiés. Les deux serveurs navigateur ont des bases indépendantes ; le serveur source est arrêté avant l’import sur la destination.

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Préparer, modifier, enregistrer, fermer puis rouvrir SQLite | PASS | Test de redémarrage sur fichier temporaire ; titre et version conservés, export possible. |
| Séance riche transférée et réexportée | PASS | Même révision pédagogique et mêmes fichiers ; illustrations, source citée, segments, corrigés, ateliers et données intégrées conservés. |
| Serveur source arrêté | PASS | Chrome affiche les illustrations et le rendu CSS, modifie l’éditeur et vérifie le corrigé depuis le serveur cible uniquement. |
| Export individuel et multiple | PASS | Boutons réels, sélection, deux téléchargements `.tweenteach.zip` contrôlés par empreinte. |
| Import complet, sous-ensemble et lot mixte | PASS | Tests d’un lot ajout/remplacement/ignoré, reprise de l’autre sous-ensemble, ajout seul dans Chrome. |
| Remplacement publié | PASS | Même ID public, date, classe et rattachement ; nouveaux blocs/activités, ancienne version conservée, nouveau run. |
| Réimport identique, clic concurrent et perte de réponse | PASS | Pas de doublon ni révision supplémentaire ; reçu identique ; les autres séances du paquet restent importables. |
| Copie indépendante et correspondance manuelle | PASS | Nouvelle identité pour la copie ; les imports suivants ciblent toujours la correspondance choisie. |
| Deux séances avec mêmes titre/date | PASS | Ajout par défaut tant qu’aucune identité portable ou correspondance explicite n’est connue. |
| Ressource absente, bloc inconnu, format incompatible | PASS | Refus avant activation. Possibilité d’ignorer une entrée dont la ressource est invalide. |
| ZIP hostile | PASS | Traversée de chemin, chemin absolu, lien symbolique, fichier inattendu, taille annoncée mensongère et décompression excessive refusés. |
| Cible modifiée ou génération active | PASS | Récapitulatif périmé refusé ; génération active signalée ; les écritures de génération possèdent des gardes de version. |
| Interruption du transfert | PASS | Archive incompressible de plus de 2 Mio répartie sur au moins trois fragments : reprise, fragment répété identique et vérification finale. |
| Échec au milieu de l’application | PASS | Exception injectée lors du second ajout : aucune séance ni ressource du lot activée, reprise réussie. |
| PostgreSQL indépendant | PASS | PGlite exécute le schéma PostgreSQL, les verrous et transactions ; contrainte injectée, rollback vérifié, reprise et ressources inline. Ce test n’est pas une connexion Neon/production. |
| Import dans une autre classe | PASS | Propriétaire, classe, documents et illustrations attribués à la destination ; aucune création de classe ou de planning, objectifs conservés. |
| Mission affectée | PASS | Fichiers, scénarios, validateur et signature du moteur conservés/remappés ; aucune partie élève copiée. |
| Permissions | PASS | Élève et anonyme refusés ; accès aux transferts limité au professeur propriétaire et à sa classe ; origine étrangère refusée. |
| Données élèves | PASS | Anciennes tentatives et réponses conservées ; nouvelle version sans ancien crédit ; corrigés privés absents de la réponse élève. |
| Élève déjà connecté | PASS | Notification sans remplacement de l’éditeur ; saisie conservée ; actualisation volontaire vers la nouvelle version. |
| Shell/Git importé | PASS | Broker Docker réel, terminal PTY, déplacement de fichier, contenu et validation vérifiés dans l’aperçu professeur sans ancien job de génération. |
| DOM importé | PASS | Broker Docker réel, éditeur, rendu Chromium isolé, console et test de deux clics réussis après transfert. |
| Disponibilité des moteurs | PASS | Probe fixe de l’application avant import, version d’image vérifiée, aucun code du paquet exécuté pendant l’analyse ; moteur non configuré refusé par les tests d’intégration. |
| Mobile | PASS | Récapitulatif et résultat à 390 px sans débordement horizontal. |
| Ancienne sauvegarde complète v1 | PASS | Intégrité vérifiée avant ajout des nouvelles tables vides ; altération toujours refusée. |
| Publication/remplacement sur l’instance en ligne | NOT RUN | Code non déployé et aucune séance réelle sélectionnée sur l’URL de production. |
| Stockage S3 réel | NOT RUN | Lecture via le service d’artefacts existant ; aucun bucket réel utilisé par la recette isolée. |
| Charge de classe / VM de laboratoire distante | NOT RUN | La recette Docker Desktop ne mesure pas la capacité d’un hôte de production. |

Commandes exécutées :

- `npm run check` : PASS (syntaxe JavaScript, schémas, DDL et primitives Drive) ; syntaxe Python du broker vérifiée par `ast.parse`.
- `node --import tsx --test tests/*.test.mjs` : PASS, 305 tests lors du contrôle complet final. Un contrôle ciblé supplémentaire couvre l’import entre deux classes différentes.
- `node --import tsx --test tests/lesson-transfer.test.mjs tests/database-upload.test.mjs` : PASS, 33 tests lors de la recette ciblée, avant l’ajout du contrôle entre classes.
- `node --import tsx --test tests/lesson-transfer.test.mjs` : PASS, 14 tests dans la dernière exécution, dont le transfert entre classes.
- `node --import tsx scripts/lesson-transfer-browser-check.mjs` : PASS, 14 contrôles navigateur.
- `node --import tsx scripts/lesson-transfer-labs-check.mjs` : PASS, 6 contrôles avec Docker réel ; aucun progrès élève créé par l’aperçu professeur.

Un premier essai du moteur DOM a dépassé sa limite existante de lancement Chromium de 5 secondes. La limite et le sandbox ont été conservés. Le contrôle de disponibilité a été renforcé pour vérifier le démarrage réel avec un document fixe, avant activation du paquet ; la nouvelle exécution des ateliers shell et DOM a ensuite réussi. Une panne future de ce moteur bloque la séance concernée, sans faux succès d’import.

Preuves locales reproductibles, exclues de Git : `test-results/lesson-transfer/report.json`, `labs-report.json`, `review.png`, `preview.png`, `student.png`, `mobile-review.png`, `shell-imported.png`, `dom-imported.png`, ainsi que les archives de recette. Les journaux bruts de tests ont été conservés dans `/private/tmp/tweenteach-transfer-final-tests.log` et `/private/tmp/tweenteach-transfer-final-targeted.log` pendant la session.

Le code et le schéma sont prêts à être déployés avec la stack actuelle. La recette distante restante nécessite l’URL de l’instance exécutant cette version, sa base PostgreSQL autorisée et, pour DOM/shell, le broker mis à jour avec ses images. Aucun transfert local n’est présenté ici comme une opération effectuée en production.
