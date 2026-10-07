# Recette V2 — 7 octobre 2026

Le moteur et les ateliers sont intégrés au dépôt. Les contrôles logiciels, navigateur, shell/Git et DOM Docker réels passent. **La livraison reste partielle : aucun des trois pilotes réels n’a produit de corpus complet validé dans les limites autorisées.** Les appels sont arrêtés. Une fixture complète, un plan accepté ou une réponse partielle ne constituent pas une séance prête.

La préparation personnelle fournie est accessible sur [l’instance corrigée](http://127.0.0.1:4181/preparation.html?job=prep_56c0948e-9e0b-40d4-8318-112b10a95661). Son contexte du 14 septembre, ses sources et ses versions sont conservés. Sa révision 2 applique la nouvelle politique, mais son budget initial était épuisé : aucun nouvel appel de ce travail, aucun relèvement des plafonds, aucune publication élève. [Audit et cause établie](audit-v2.md) · [Décision d’architecture](architecture-v2.md).

| Contrôle | État | Preuve et limite |
| --- | --- | --- |
| Syntaxe, schémas exportés, DDL additif, primitives Drive | PASS | `npm run check` |
| Suite automatisée | PASS | `npm test` : 212 tests, aucun échec, annulation ou test ignoré ; 44 tests ciblés repassés sur les dernières corrections, puis suite complète finale |
| Tentative persistée avant transport, identifiant distant, résultat enregistré réutilisé | PASS | `tests/preparation-v2.test.mjs` |
| Perte du suivi sans nouvelle consommation, double reprise, résultats tardifs et révisions | PASS | Tests transactionnels et [navigateur](evidence-v2/browser/acceptance.json) |
| Provision incertaine conservée, plafond partagé, une seule version suivie de sa revue | PASS | Tests du moteur ; récupération distante testée avec transport simulé |
| Annulation locale avant annulation fournisseur background | PASS | Test dédié ; intégration HTTP de cancellation implémentée, appel API réel non exécuté |
| Analyse séparée, dépendances, pratique/preuve, outils autorisés et durée du contrat | PASS | Contrôles de conception et tests négatifs ; ne prouve pas la qualité absolue du cours |
| Identifiants de compétences et activités contraints avant génération | PASS | Schéma contextualisé et tests de rejet |
| Fiche de séance ambiguë | PASS | Analyse indépendante conservée puis choix explicite requis avant conception |
| Débogueur réel, variables, pas à pas, modification du code | PASS | Worker et interpréteur réels dans Chrome ; [preuve](evidence-v2/browser/acceptance.json) |
| Design : fichiers raccordés et référence PNG agrandissable | PASS | Rendu réel du corrigé, accès authentifié, code privé absent de l’aperçu |
| Exemples JS publics et validations privées | PASS | Résultat réel affiché, tests privés et variantes jamais exposés par l’API élève |
| Terminal professeur, éditeur commun, version exacte, aucune progression élève | PASS | [Recette navigateur et Docker](evidence-v2/lab-preview/acceptance.json) |
| Shell/Git : état erroné, autre méthode correcte, commit, reprise et interruption | PASS | [9 contrôles réels](evidence-v2/labs.json), image figée par digest |
| Isolation et admission de dix-huit shells | PASS | Réseau désactivé, utilisateur 1000, limites mémoire/processus, aucun montage hôte ; 18 réponses et refus du 19e. Ce n’est pas une mesure de charge de classe représentative |
| DOM : clics, console, erreur plausible, autre solution, réseau et boucle bornée | PASS | [10 contrôles Chromium](evidence-v2/dom/acceptance.json), adaptateur local authentifié |
| Isolation Docker du DOM | PASS | [5 contrôles réels](evidence-v2/dom/docker.json) : navigateur sandboxé, erreur plausible, autre solution, réseau refusé, boucle interrompue et conteneur supprimé ; charge de classe non mesurée |
| Export exact, partiel explicite, fichier absent ou corrompu, refus interclasse | PASS | Tests du téléchargement, manifeste du ZIP compris ; [vrai pilote bloqué](evidence-v2/real-ui.json) : aperçu partiel et export non compilé explicitement indisponible |
| Sauvegarde de la préparation personnelle et restauration | PASS | [Restauration privée jetable](evidence-v2/backup-restore.json), intégrité SQLite, liens historiques et migrations additives ; stockage objet distant non restauré |
| Trois parcours de référence et rendu mobile | PASS | [Fixtures](evidence-v2/fixtures/acceptance.json), réponses IA simulées et non publiables |
| Analyse/conception ChatGPT réelle | Voir les pilotes | [Traces par tentative](evidence-v2/real-pilots.json), étapes et durées effectives |
| Livraison des trois corpus réels complets | FAIL | 21 appels réels au total ; aucun candidat complet. Résultats détaillés ci-dessous |
| Exécution des corrigés et revue finale de ces trois corpus réels | NOT RUN | La rédaction n’a pas produit de version complète ; les preuves des fixtures restent distinctes |
| Comparaison contrôlée A–D et calibration du juge sur corpus réservé | NOT RUN | Pas de conclusion « modèle supérieur » tirée de briefs ou versions de code différents |
| OCR, interprétation sémantique des figures importées, SSH | NOT RUN | Capacités non fournies ; signalées et jamais déclarées disponibles |
| Expérimentation avec de vrais élèves, déploiement de production | NOT RUN | Aucune publication ni expérimentation de classe effectuée |

Les trois fixtures illustrent les contenus, exercices et corrections attendus. Leurs revues 75 puis 100 sont simulées pour exercer l’orchestrateur. Elles ne mesurent pas la qualité d’un modèle. Les preuves de référence du 5 octobre restent consultables dans [le rapport historique](acceptance.md) ; les preuves V2 ajoutent le débogueur et le shell réel.

[Vérification finale des services et des budgets](evidence-v2/final-verification.json).

La recette manuelle du logiciel est accessible ; la recette pédagogique des trois cours reste bloquée. Aucun déploiement en production ni publication élève n’a eu lieu.

| Pilote réel | Résultat obtenu | Blocage final | Appels | Temps depuis la demande / temps fournisseur cumulé |
| --- | --- | --- | ---: | --- |
| [CSS — cascade et boîte](http://127.0.0.1:4182/preparation.html?job=prep_849ef194-6fd9-49e3-bd2c-bac98accb324) | Analyse et contrat conservés ; revue de plan acceptée | Rédaction interrompue à l’échéance, fragment conservé ; aucun candidat complet | 9 | 60 min / 32,8 min |
| [JavaScript — conditions](http://127.0.0.1:4182/preparation.html?job=prep_67f319e8-762f-4248-baf5-1d5404a0f767) | Analyse et plan conservés ; réemploi local du plan démontré sans appel de conception supplémentaire | Revue refusée : parcours des seize essais insuffisamment attesté, charge débutant trop forte, solution accessible dans des supports censés être masqués pendant l’autonomie | 8 | 60 min / 36,6 min |
| [Shell/Git](http://127.0.0.1:4182/preparation.html?job=prep_5d75b10e-f624-4715-9dc3-57604af00a6b) | Analyse et deux propositions de conception complètes conservées | Contrainte non résolue liée aux exercices d’administration de la référence ; une autre tentative a reçu une surcharge fournisseur après du texte partiel | 4 | 59 min 55 s / 25,4 min |

La dernière proposition shell a été contrôlée par le worker qui terminait son appel avec l’ancienne vérification des prérequis ; ses traces gardent ces objections historiques. La contrainte d’administration non disponible demeure bloquante avec les règles corrigées. Aucun contournement de cette contrainte ni aucune autorisation d’administrer le laboratoire n’a été ajouté.

Les 30 minutes supplémentaires autorisées ont été enregistrées avec sauvegarde et événement d’audit dans la base des pilotes. La préparation personnelle n’a pas bénéficié de cette extension. Les enveloppes de durée sont arrivées à échéance ; les 3 appels non consommés du plafond commun ne suffisent pas à réouvrir une enveloppe de temps expirée.

[Mesures finales](evidence-v2/real-metrics.json) : 21 soumissions, deux issues de flux inconnues et une surcharge explicite. Les usages connus couvrent 18 appels : 269 764 tokens d’entrée et 145 759 de sortie. Ce n’est pas une estimation des usages manquants. Les temps fournisseur s’additionnent entre travaux parallèles et ne représentent pas le temps d’attente du professeur. L’ensemble de la recette réelle s’étend de 14 h 16 à 15 h 29, heure de Paris, avec des démarrages de pilotes échelonnés.

La comparaison avant/après de cours réels complets reste **NOT RUN**. L’audit démontre des corrections applicatives et un plan CSS enrichi ; il ne revendique pas un gain pédagogique final mesuré sur les trois corpus. La comparaison A–D et la calibration du juge restent à faire dans une enveloppe autorisée distincte.

Les tentatives réelles emploient `gpt-6-astra`, sans modèle de secours. Les anciens profils du pilote CSS omettent l’effort ; le niveau effectif ne peut pas être déduit de leur durée. Les nouvelles préparations ont envoyé `reasoning.effort: high` après vérification du catalogue du compte. L’analyse JavaScript a effectivement réussi avec ce réglage en 209 698 ms. Le coût en monnaie et le quota restant du forfait ne sont pas fournis ; ils restent inconnus. Les tokens renvoyés et les durées figurent dans les traces, sans raisonnement interne brut.

Les pilotes ont reçu une extension de 30 minutes explicitement autorisée par le professeur, portant leur limite à 60 minutes depuis la demande. Les plafonds de 24 appels par pilote, trois réécritures et surtout 24 appels pour toute la recette restent inchangés. Le compteur commun est réservé dans la même transaction que chaque tentative ; trois travaux distincts peuvent avancer en parallèle sans dépasser ce plafond. La préparation personnelle reste à son budget initial. L’attente dans la file compte dans cette durée existante. Aucun redémarrage du worker ou changement de code ne remet le compteur à zéro. Les appels de test unitaires, les consultations de modèle et les exécutions locales de laboratoires sont distincts des appels réels d’inférence.

La recette isolée est ouverte sur [http://127.0.0.1:4182/preparation.html](http://127.0.0.1:4182/preparation.html), compte synthétique `professeur`, mot de passe `quality-preview-only`. Elle utilise `.data/quality-v2/courses.sqlite`. Le serveur de consultation n’exécute aucun worker IA. Pour le rouvrir :

```sh
npm run preview:quality:v2
```

Pour l’instance personnelle et son worker durable :

```sh
npm run dev:chatgpt
```

Le laboratoire local de recette écoute sur 4193, avec une configuration privée dans `.data/quality-v2/lab.json`. Pour le recréer, construire `docker build -t tweenteach-shell:quality-v2 labs`, construire aussi `docker build -f labs/Dockerfile.dom -t tweenteach-dom:quality-v2 labs` pour le DOM, puis lancer `npm run preview:labs`. La recette V2 lit cette configuration. Le déploiement du laboratoire dédié reste décrit dans [labs/README.md](../../labs/README.md) ; ce Docker Desktop local ne constitue pas une installation de production.

Pour rejouer les vérifications ciblées : `npm run test:quality:v2`, `npm run test:quality:v2:browser`, `node --import tsx scripts/lab-preview-browser.mjs`, `python3 scripts/lab-acceptance.py`, `python3 scripts/dom-docker-acceptance.py`. Une reprise réelle du harness utilise `node --import tsx scripts/quality-real.mjs --run --no-serve --workers=3` ; elle respecte les budgets déjà enregistrés et ne recrée pas une enveloppe de consommation.

Les anciennes séances restent lisibles. Les modifications humaines concurrentes ne sont pas écrasées : le remplacement du brouillon échoue si sa version active a changé. Leur fusion automatique avec une nouvelle conception n’est pas implémentée. La recherche documentaire des grands corpus reste bornée ; un dossier trop volumineux est refusé avec demande de sélection/scission. Le débogueur couvre le sous-ensemble JavaScript EDEN, pas le DOM ou l’ensemble du langage. Les vérifications CSS restent structurelles et les limites sont soumises à la revue.
