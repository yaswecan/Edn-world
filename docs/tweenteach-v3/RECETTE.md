# Recette V3 — 16 octobre 2026

## Environnement et portée

Recette locale avec Node 22.14, bases SQLite temporaires/en mémoire, comptes fictifs, serveurs HTTP sur boucle locale et Chromium. Les tests d’adaptateurs existants utilisent aussi leur moteur PostgreSQL isolé. Les laboratoires DOM et shell ont été exécutés avec les images Docker locales existantes. Aucun compte réel, base scolaire, déploiement ou migration de production n’a été utilisé.

Les verdicts ci-dessous portent sur les assertions et parcours indiqués. Un test API est un appel réel au serveur et à sa persistance, mais n’est pas présenté comme un clic navigateur. Les contrôles V1/V2 réutilisés sont identifiés. Les critères composites peuvent s’appuyer sur plusieurs tests indépendants. La matrice ne certifie ni conformité juridique ni capacité en production.

## Commandes et preuves

| Référence | Commande / fichier | Résultat |
|---|---|---|
| Suite | `node --import tsx --test --test-concurrency=4 tests/*.test.mjs` | 403/403 PASS, 98,26 s ; derniers ajustements couverts par V3 ci-dessous |
| V3 | `npm run test:tracking:v3` ; [tests V3](../../tests/tracking-v3.test.mjs), [fixture CSS](../../tests/fixtures/tracking-v3.mjs) | 16/16 PASS au dernier passage, 4,80 s |
| V2 | `npm run test:tracking:v2` ; [tests de compétences V2](../../tests/competency-v2.test.mjs) | 29 tests au contrôle initial ; repris dans la suite complète |
| V1 | `npm run test:tracking` ; [suivi](../../tests/student-tracking.test.mjs), [stockage documentaire](../../tests/documentary-storage.test.mjs) | 48 tests au contrôle initial ; repris dans la suite complète |
| BV3 | `npm run test:tracking:v3:browser` ; [script](../../scripts/tracking-v3-browser-check.mjs) | PASS, huit groupes de contrôles ; rapport et captures dans `test-results/tracking-v3/` |
| BV2 | `npm run test:tracking:v2:browser` | PASS : référentiel, grille, publication, consolidation, reprise réellement sauvegardée |
| BV1 | `npm run test:tracking:browser` | PASS : sauvegarde, panne réseau, publication, reprise ciblée et changement de compte avec réponses retardées |
| LAB | `npm run test:editor:labs` | PASS : DOM/shell réels, fichiers exacts, remise, confidentialité, reset, export/import |
| ID | [identité des séances](../../tests/session-identity.test.mjs) | Inclus dans Suite |
| TRANS | [transferts](../../tests/lesson-transfer.test.mjs), [révisions](../../tests/lesson-revision.test.mjs) | Inclus dans Suite |
| CHECK | `npm run check` et `git diff --check` | Syntaxe, schéma SQL, invariants de stockage et espaces vérifiés |

Les rapports générés et captures sont ignorés par Git ; les scripts et fixtures permettent de les reproduire. Les journaux de cette exécution locale sont dans `/private/tmp/tweenteach-v3-*.log` ; ils ne constituent pas des artefacts de déploiement.

Une première suite complète a passé 397 tests. Deux passages ultérieurs à concurrence non bornée ont chacun échoué sur le lanceur local : réception du second message stdout puis délai de démarrage sous charge. Le test attend désormais le message LAN réellement nécessaire ; les contrôles finaux bornent la concurrence à quatre fichiers. Aucun test fonctionnel n’a été supprimé. Le pilote LAB a été corrigé pour transmettre `draftVersion` et vérifier les erreurs HTTP. Un sélecteur BV3 a été ajusté après inspection de la véritable fiche professeur : cette fiche n’utilise pas le composant élève `.lesson-stage`.

## Matrice AC3-01 à AC3-72

Préconditions communes : chaque test initialise ses données fictives, dispose d’un professeur A1, d’un professeur A2 non habilité et d’élèves distincts. Les variantes utilisent une version précise de référentiel/grille et des remises figées. « Conforme » signifie que les assertions citées ont effectivement passé ; les réserves restent explicites.

| Critère | Précondition et action | Attendu | Observé et preuve | Verdict |
|---|---|---|---|---|
| AC3-01 | Créer bloc/compétence/sous-compétence/critères ; fermer puis rouvrir SQLite | Hiérarchie persistante | Identités, parents et codes relus ; V3 `AC3-01/02/03`, création/rechargement BV3 | PASS |
| AC3-02 | Importer une source avec code absent et niveaux variables | Aucun niveau/code officiel fabriqué | Codes `null` conservés, hiérarchie source et import V2 exacts ; V3, V2 AC21 | PASS |
| AC3-03 | Réutiliser un code dans une autre branche puis dans la même branche | Distinction des identités, ambiguïté refusée | Branche distincte acceptée, même branche refusée ; V3 `AC3-03/08/09/10`, V2 AC21 | PASS |
| AC3-04 | Créer un cycle parent et un cycle de prérequis obligatoires | Refus avant activation | HTTP 400 sur les deux cycles ; V3 `AC3-04/05/06/07` | PASS |
| AC3-05 | Modifier une version publiée et conserver une copie ancienne | Nouvelle révision, usages consultables | Snapshot original inchangé, `basedOnId` distinct ; V3, V1 AC14, BV3 usages | PASS |
| AC3-06 | Supprimer brouillon inutilisé puis version publiée | Suppression limitée et archivage proposé | Suppression brouillon 200, publié 400 ; V3 et interface d’archivage | PASS |
| AC3-07 | Publier un référentiel partagé sans puis avec permission dédiée | Contrôle serveur | 403 sans capacité ; publication après capacité explicite dans la fixture ; V3 | PASS |
| AC3-08 | Appliquer deux fois le même aperçu d’import | Pas de doublon ni code changé | Même identité retournée, origine conservée ; V3 import, ID transfert | PASS |
| AC3-09 | Réimporter une origine avec contenu divergent | Conflit sans écrasement | Aperçu `conflict`, application 409, ancienne ligne intacte ; V3 | PASS |
| AC3-10 | Importer hiérarchie ambiguë et paquet malformé | Refus, données intactes, aucune exécution | Refus V3 et contrôles archives TRANS : chemins, décompression, transaction | PASS |
| AC3-11 | Filtrer un élément ; ouvrir sa séance puis sa séquence datée ; revenir | Navigation et filtre conservés | Liens issus des usages et retour navigateur avec recherche conservée ; V3 usages et BV3 | PASS |
| AC3-12 | Planifier un objectif parent sans preuve enfant | Aucun grade descendant | Couverture par critère direct, aucune observation créée ; V3 occurrence, V2 AC26 | PASS |
| AC3-13 | Réutiliser un contenu à plusieurs dates, changer de classe/acteur | Attributions et historiques séparés | Brouillons/remises distincts par occurrence ; périmètre classe refusé à l’autre professeur ; V1 AC02/AC05, TRANS | PASS |
| AC3-14 | Reporter puis annuler une occurrence | Date initiale conservée, aucun réalisé fictif | `initialDate` conservée et réalisation vide ; V3, report réel BV3 | PASS |
| AC3-15 | Réaliser une activité sur deux et replanifier le reste | Identités stables, pas de duplication | Une seule activité dans le reste, lien parent conservé, replanification unique ; V3 | PASS |
| AC3-16 | Déclarer le réalisé collectif et l’absence de Bob | Aucun résultat individuel inventé | Constat séparé, zéro observation et zéro élève évalué ; V3 | PASS |
| AC3-17 | Ajouter objectif futur et laisser un critère non planifié | États neutres distincts | Couverture `unplanned` distincte ; élève « Pas encore évalué » ; V3/BV3 | PASS |
| AC3-18 | Modifier avec ancienne révision ou autre classe | Conflit/refus sans écrasement | 409 ancien onglet, 404 professeur A2 ; V3 | PASS |
| AC3-19 | Sauver des fichiers, recharger et provoquer une erreur réseau | Octets retrouvés, erreur distincte du succès | BV1 panne/reprise ; LAB DOM/shell ; tests de stockage documentaire | PASS |
| AC3-20 | Doubler remise et autosauvegarde tardive | Remise logique unique et copie figée | Identité/empreinte stables, écriture tardive refusée ; V1 AC05/06/08 | PASS |
| AC3-21 | Créer reprise et entraînement | Diagnostic et résultat initiaux conservés | Tentatives distinctes ; original EC conservé jusqu’à la fin du parcours V3 ; V1 AC13, V3 AC72 | PASS |
| AC3-22 | Attribuer reprise après clôture | Seul l’élève ciblé peut travailler | Attribution spécifique, passation de classe fermée ; V1 AC13/17, BV1/BV2 | PASS |
| AC3-23 | Envoyer score/grade/validation fabriqués à la remise | Aucun résultat officiel fondé sur le client | Correction à relire, score `null`, zéro observation ; V3 `AC3-23/61` | PASS |
| AC3-24 | Runner réellement indisponible pendant le parcours, puis correction manuelle | Incident distinct de NA ; correction possible | Incident manuel et agrégat testés ; LAB réel réussi. Aucune panne effective Docker/runner n’a été injectée dans le parcours de correction | NON VÉRIFIÉ |
| AC3-25 | Ouvrir une copie contenant du code | Lecture sans exécution, aperçu isolé | Copie échappée ; protections interpréteur/DOM dans Suite ; BV1 consultation et exécution retardée | PASS |
| AC3-26 | Documenter une production de groupe hors plateforme | Provenance collective, appréciation individuelle | Constat par attribution/critère, date et description, publication séparée ; V3/BV3 | PASS |
| AC3-27 | Remplacer contenu/réordonner sections après remise | Ancienne consigne et copie intactes | Version originale retrouvée ; V1 AC14, TRANS et LAB roundtrip | PASS |
| AC3-28 | Fixture 8 + 1 + 5 sur 20 avec essentiel incomplet | 14/20 global EC, observations différentes | Grade EC et observations A1/EC ; V2 AC22/23/24 et BV2 | PASS |
| AC3-29 | Tester seuil exact, arrondi, item exempt et points manquants | Seuils explicites, dénominateur expliqué | V2 AC25 ; V3 exemption : 13/16, item 4 points exclu ; correction partielle sans total final | PASS |
| AC3-30 | Aucun rendu, correction absente, mapping absent, règle absente | Causes distinctes sans zéro fictif | V3 fixture six élèves, V2 AC25/34/35/36, V1 AC09/10 | PASS |
| AC3-31 | Trois critères sources sur sept, doublon et précision locale | Couverture partielle 3/7 | Comptage dédupliqué, aucun niveau parent implicite ; V2 AC26 | PASS |
| AC3-32 | Deux situations recevables, règle explicite | Proposition sur le seul critère démontré | Proposition A1, validation/publication séparées ; V2 AC27 et V3 constats | PASS |
| AC3-33 | Dix réexécutions/clones puis situation indépendante | Une situation pour les clones | Une famille retenue, seconde situation nécessaire ; V2 AC27 | PASS |
| AC3-34 | Aide autorisée, autonomie inconnue, tâche plafonnée | Aucun A2 inventé ou pénalité arbitraire | Règles d’autonomie/plafond vérifiées ; V2 AC28 | PASS |
| AC3-35 | Dates inconnues, égales et correction tardive | Sélection stable sur date réelle | V2 AC29/30 ; constat V3 `workedAt:null` exclu avec explication | PASS |
| AC3-36 | Nouvelle contradiction après niveau publié | Niveau publié maintenu, vérification proposée | V2 AC29/30 ; ancienne preuve publiée maintenue après révision privée V3 | PASS |
| AC3-37 | Même code, nouvelle version de sens | Pas de consolidation implicite | Correspondance validée par critère requise ; V2 AC32 | PASS |
| AC3-38 | Valider manuellement une proposition | Motif, auteur, périmètre et preuves conservés | Validation explicite, preuve obligatoire, décision historisée ; V2 AC31/33, BV2 | PASS |
| AC3-39 | Consulter avant publication avec comptes élève/autre classe | Aucune correction privée exposée | Projections JSON et routes privées refusées ; V1 AC16, V2 AC31, BV1/BV2 | PASS |
| AC3-40 | Réviser une correction publiée sans republier | Ancienne publication seulement | BV1/BV2 et V2 AC31/37 ; constats hors plateforme V3 idem | PASS |
| AC3-41 | Corriger pendant validation/publication de synthèse | Proposition obsolète refusée | HTTP conflit et obligation de recalcul ; V2 AC33 | PASS |
| AC3-42 | Publier un lot comprenant une copie non corrigée | Résultat exact par copie | Une publiée/une refusée avec cause ; V1 AC19 | PASS |
| AC3-43 | Retirer publication puis rétablir explicitement ; révoquer accès | Dérivés masqués et historique conservé | V3 AC43 : questions, synthèse, bilan et retour formatif protégés ; BV3 retrait/republication ; V1 révocations | PASS |
| AC3-44 | Recalculer à entrées/version identiques | Pas de nouvelle décision publiée ni doublon | Même identifiant de proposition V3 constats ; calculs déterministes V2 | PASS |
| AC3-45 | Parcourir hub, fiches et matrices | Navigation intégrée, titres/codes exacts | ID et BV1/BV2/BV3 ; aucune route V3 indépendante du shell de suivi | PASS |
| AC3-46 | Ouvrir dossier après diagnostic et reprise | Anciennes tentatives retrouvables | V1 AC05/13, BV1 liens depuis historique et dossier | PASS |
| AC3-47 | Consulter compétence et activité future en élève | Preuves publiées et prochaine activité, aucun pair | V2 AC31/37, V3 neutralité et constats, BV2/BV3 | PASS |
| AC3-48 | Question Alice, lecture Bob/A2, réponse, révocation | Échange privé lié à version exacte | Bob ne voit rien, A2 refusé, ancienne révision de réponse refusée ; V3/BV3 | PASS |
| AC3-49 | Navigation intégralement clavier et focus de chaque formulaire aux trois largeurs | Tous parcours utilisables, erreurs/vides distincts | Tabulation/focus et absence de débordement vérifiés à 360/768/1440 ; erreurs réseau BV1. Parcours complet sans souris et audit lecteur d’écran non exécutés | NON VÉRIFIÉ |
| AC3-50 | Six élèves attribués, cinq remises, trois C2 exploitables | Deux EC sur trois, exclusions ventilées | Population 6, remis 5, dénominateur 3, EC 2, absence/incident/mapping chacun 1 ; V3 CSS | PASS |
| AC3-51 | Population vide, observations répétées et échelles incompatibles | Pas de faux 0 %, doublon ou tendance | V3 : dénominateur 0 sans niveaux ; échelles différentes désactivées ; volume 20 observations/élève dédupliqué | PASS |
| AC3-52 | Examiner alerte, preuve et action avec contexte | Alerte stable et action réelle | V3 alerte dédupliquée, BV3 preuve/préremplissage élève+critère, BV2 attribution utilisable, V3 AC72 | PASS |
| AC3-53 | Preuve insuffisante ou notion nouvelle | Enseignement/vérification sans échec automatique | V2 AC34/35/36, aucune attribution implicite | PASS |
| AC3-54 | Attribuer puis terminer une reprise | Droits de travail ; pas de maîtrise automatique | BV2 sauvegarde élève réelle ; V1 AC17 et V3 AC72 sans décision de maîtrise | PASS |
| AC3-55 | Vérification réussie, persistante ou ressource absente | Sortie explicite, diagnostic conservé | V2 AC39 : poursuite/intervention professeur/activité manquante ; V3 AC72 | PASS |
| AC3-56 | Réviser preuve ou révoquer droit pendant activation | Revalidation atomique | V2 AC37/38 transactions ; alerte V3 devenue obsolète refusée | PASS |
| AC3-57 | Alice/Bob/professeur A2 sur URL/API/fichiers/exports | Refus sans fuite | V1 AC02/16, TRANS permissions, V3 questions/export | PASS |
| AC3-58 | Transférer/révoquer/archiver rattachement | Historique préservé sans accès transversal | V1 AC02/03/04 et révocations ; V2 sources/cibles révoquées | PASS |
| AC3-59 | Deux comptes même navigateur, réseau et exécution retardés | Aucun contenu du premier dans le second | BV1 : purge, réponse invalidée et résultat réel de runner retenu puis rejeté | PASS |
| AC3-60 | Exporter séance puis réimporter ailleurs | Aucun élève/résultat/activation locale | TRANS et V2 AC16/32/38 ; corrigés et export refusés aux élèves | PASS |
| AC3-61 | Exporter suivi/bilan, textes à préfixe formule | Périmètre/mode/publication respectés | V3 CSV neutralisé, mode requis, élève 403 sur export prof ; bilan personnel sans correction privée | PASS |
| AC3-62 | Changer de rôle/classe et lire révision privée | Aucun cache hors périmètre | V3 sessions/permissions et no-store ; BV1 changement de compte, V2 historique publié | PASS |
| AC3-63 | Simuler puis relancer migration additive | Sources intactes, aucun doublon | Simulation identique octet à octet ; trois tables ajoutées et seconde application sûre ; V3 + V1 AC18 ambiguïtés | PASS |
| AC3-64 | Sauvegarder puis restaurer base isolée | Sources restaurables, limites documentées | V3 sauvegarde/restauration SQLite ; [procédure](MIGRATION.md). Restauration cloud de production non exécutée | PASS |
| AC3-65 | Ajouter 200 élèves et 4 000 observations historiques | Pagination, lectures bornées et mesure réelle | V3 : une ligne demandée, 14 lectures d’agrégats, fichiers de copie non chargés ; mesure ci-dessous | PASS |
| AC3-66 | Import avec instructions de privilégier/publier, cœur sans appel IA | Aucun droit donné ni sortie publiée | V3 import en brouillon A1, compte inchangé, publication partagée 403, zéro job IA ; BV3 réseau externe bloqué | PASS |
| AC3-67 | Activer automatisme existant puis révoquer ; cloner/importer | Contrôles et autorisation locale conservés | V2 AC38 : bornes, idempotence, transaction concurrente et autorisation absente des clones | PASS |
| AC3-68 | Utiliser éditeurs programmation/console, DOM et shell | Parcours existants fonctionnels | Suite workshops/interpréteur ; BV1 runner réel ; LAB DOM/shell réels | PASS |
| AC3-69 | Importer homonymes et gérer compte partagé | Pas de fusion au prénom/suspension abusive | V1 AC01/04 : identifiants stables, comptes distincts, garde multiclasse | PASS |
| AC3-70 | Planifier version future et tenter attribution par ancienne route | Pas d’accès implicite aux brouillons/anciens travaux | V3 : aucune attribution à création ; brouillon refusé à release ; assign refusé avant release même après fermeture | PASS |
| AC3-71 | Changer les preuves avant décision d’alerte/synthèse | Sources conservées, résultat à actualiser | V3 alerte 409 et V2 proposition périmée refusée ; aucune réécriture des preuves | PASS |
| AC3-72 | Création/rattachement → planning → remise → publication → consultation → reprise → vérification | Parcours cohérent jusqu’à clôture | V3 AC72 : API réelle sur une fixture, état final closed, diagnostic EC inchangé, zéro maîtrise automatique ; étapes UI BV1/BV2/BV3 | PASS |

## Mesure et limites

La fixture de volume ajoute 200 élèves et 4 000 observations historiques ; le test exige exactement 14 lectures d’agrégats et une réponse paginée. Le temps dépend de la charge locale ; la valeur du dernier passage est consignée avec le décompte final. Le stockage lit encore les agrégats de la classe en mémoire. Ce test ne mesure pas la capacité Neon/Vercel ni un temps de réponse garanti.

Les deux critères NON VÉRIFIÉ ne sont pas convertis en PASS sur la seule lecture du code. Il reste à injecter une indisponibilité effective du runner pendant la correction et à effectuer le parcours complet sans souris/avec lecteur d’écran. Les sauvegardes distantes, ressources/signatures S3, quotas, rôles de production et restauration cloud restent hors de l’environnement testé.

## Résultat final

Décompte de recette : **70 PASS, 0 FAIL, 2 NON VÉRIFIÉ, 0 NON APPLICABLE**.

Dernière suite complète : **403/403 tests**, 98,26 s. Après ajout du cas d’exemption et ajustement de la cause « incident technique sans remise », la suite ciblée V3 a passé **16/16 tests**, 4,80 s. Les trois recettes navigateur, la recette LAB et `npm run check` sont PASS ; `git diff --check` ne signale aucun défaut.

Dernière mesure V3 : **152,17 ms**, SQLite en mémoire, 200 élèves et 4 000 observations supplémentaires, **14 lectures d’agrégats**. Cette mesure inclut le calcul et ne représente pas un engagement de performance en production.
