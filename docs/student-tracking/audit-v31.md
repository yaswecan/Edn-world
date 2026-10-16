# Audit et livraison Diagnostics V3.1 — 16 octobre 2026

Périmètre : diagnostics de début de séance, correction par réponse, publication, fiche individuelle et propositions de besoins. Travail local de développement ; comptes DEMO, SQLite en mémoire et fichiers temporaires. Aucune donnée élève réelle utilisée, aucune migration de production, aucun déploiement ni appel à un modèle payant.

Documents lus : `AUDIT_SPEC_DIAGNOSTICS_TWEENTEACH_V3_1.md`, `PROMPT_CODEX_DIAGNOSTICS_TWEENTEACH_V3_1 (1).txt` et sections pertinentes EVI/MAS/PUB/PRO/ELE/ACT/AIA de `SPECIFICATIONS_TWEENTEACH_COMPETENCES_SUIVI_PLANIFICATION_V3.md`, présents dans le dossier Downloads fourni. La capture visuelle mentionnée n'était pas jointe : la structure décrite a été utilisée, sans prétendre avoir inspecté une image.

Le dépôt contenait déjà des modifications V3 non commitées : elles ont été conservées. Aucun `AGENTS.md` applicable au périmètre modifié ; le fichier du sous-projet arcade ne concerne pas ces chemins. Versions installées inspectées : Node 22.14.0, Express 5.1.0, Ajv 8.20.0, Playwright 1.56.0, pg 8.16.3, tsx 4.20.6. Aucune dépendance ajoutée. Le serveur conserve ses agrégats JSON SQLite/PostgreSQL, son authentification, ses transactions, instantanés, grilles et runners.

## Constats avant modification

Les états ci-dessous décrivent l'audit initial, pas des défauts constatés en production. Les preuves après modification figurent dans [la recette](acceptance-v31.md).

| Exigence | Chemin / symbole inspecté | État constaté | Risque ou conséquence | Changement intégré | Vérification |
| --- | --- | --- | --- | --- | --- |
| DIA source réellement réalisée | `server/domain.mjs`, `generator.mjs`, `occurrence-planning.mjs` | partiel | Deux journaux coexistent ; ancienne sélection par séance close insuffisante pour les réalisations partielles V3 | Résolveur sur dates réelles, activités confirmées, parcours explicite, sélection manuelle justifiée et source figée | AD01–05 |
| DIA N+1 et budget complet | `server/diagnostic.mjs:buildDiagnostic`, `diagnostic-practice.mjs` | partiel | Durées des seules tâches ; anciens exercices très chargés ; ajout répété possible sans marqueur | Aperçu, N d'origine, rôle unique de transfert, tâches resserrées, temps de lecture/remise, grille obligatoire | AD06–09 |
| DIA démarrage et échéance | `student-tracking.mjs:startAttempt/saveDraft`, `public/app.js` | absent après inspection | Aucune échéance serveur individuelle V3.1 | Préparation puis démarrage explicite, échéance persistante, pause/extension tracées et contrôles d'écriture | AD10–12 |
| DIA copie et conflits | `assessment.mjs:submitAttempt`, `content-snapshots.mjs` | présent et vérifié | Fondations à préserver | Instantané existant enrichi des états de réponse ; après échéance, seules les réponses reçues sont évaluées ; récupération séparée | AD11–12 |
| DIA laboratoires pendant la passation | `pedagogy/dom.mjs`, `pedagogy/labs.mjs` | partiel | Les moteurs existaient mais leurs routes élèves exigeaient la remise préalable du diagnostic | Contexte de tentative explicite, mêmes moteurs, échéance recontrôlée après exécution, captures ordonnées des fichiers avant remise | AD08, AD11–14, AD23, AD40 |
| COR commentaire par réponse | `assessment.mjs`, `student-tracking-routes.mjs`, `public/student-tracking.js` | partiel | Retours par item de barème et appréciation existaient, sans ancrage fin aux sous-réponses/fichiers | Identifiant stable tentative/version/item/partie ; révisions, suppression, autosauvegarde, notes privées distinctes | AD13–17 |
| COR correction par question | `public/student-tracking.js` | absent après inspection | Navigation uniquement par copie | Vue transversale avec production, points/provenance, commentaire et lien vers finalisation | AD14–16, AD34 |
| COR note, niveau, publication | `competency-service.mjs`, `competency-calculations.mjs`, `student-tracking.mjs` | présent et vérifié pour les fondations V3 ; partiel pour le contrat V3.1 | Une nouvelle correction pouvait manquer d'appréciation ou confondre niveau observable et score | Finalisation V3.1 stricte ; dénominateur conservé ; plafond observable ; publication d'une révision cohérente | AD18–24 |
| GRO proposition et reprise | `adaptive-paths.mjs`, `remediation.mjs` | partiel | Fondations d'attribution/vérification présentes, familles V3.1 et exposition absentes | Politique déterministe par critère, inconnus/contradictions, priorité et preuves explicites ; validation professorale | AD25–33 |
| UI profil | `public/student-tracking.js`, `competency-ui.js`, `style.css` | partiel | Résultats et suivi présents, sans structure diagnostic/source/critères demandée | Résumé latéral, critères centraux, preuves cliquables, réponses/commentaires adjacents, mobile empilé | AD34–36, AD40 |
| TEC permissions, postes partagés, code inerte | Authentification, projections élèves, `private-session.js`, runners | présent et vérifié pour les protections existantes | Nouvelles routes à soumettre aux mêmes règles | Contrôles de rôle, classe, acteur courant et révision ; aucune exécution lors de la lecture des copies | AD17, AD29–31, AD37–39 |
| TEC éditions et imports concurrents | `lesson-editor.mjs`, `lesson-package.mjs`, `lesson-transfer*.mjs` | partiel | Édition/export pouvait emporter une confirmation locale ou contourner la nouvelle validation | Source/contrat protégés ; export sans confirmation locale ; réimport à confirmer ; validation avant publication | AD06, AD09, AD40 |
| QUA calibration en classe | Aucun chronométrage d'élèves fourni | non vérifié | Budget logiciel ≠ temps réel d'apprentissage | Relecture obligatoire, estimation explicite et vue « Charge et incidents » | AD07 ; calibration réelle à effectuer |

## Gabarits inspectés et comparaison

`buildDiagnostic(previous, ...)` sélectionne jusqu'à trois activités corrigibles confirmées, puis ajoute l'ancien `diag-verification`. Selon la source, **N = 2, 3 ou 4** : le nouveau contrat donne respectivement **3, 4 ou 5 exercices obligatoires**. Ce nombre ne doit pas être supposé constant à deux. Les activités pratiques sélectionnées gardent leur éditeur, leur production et leur mécanisme de test.

L'ancien `diag-verification` demandait deux tests, un cas limite, une adaptation et une justification. Dans le nouveau contrat, il est resserré sur un contrôle précis : entrée, résultat attendu, défaut détectable. Le nouvel exercice a sa propre consigne et production : modification d'une contrainte connue, réponse adaptée et vérification justifiée. Il est commun à tous et accessible indépendamment des autres tâches.

| Gabarit | Avant | Après aperçu V3.1 | Budget estimé |
| --- | --- | --- | --- |
| Source à 1 activité retenue + vérification | N=2 ; tâches à 5 min | 3 tâches ; existantes 6+5 min, ajout 5 min | Lecture 2 + tâches 11+5 + vérification/remise 2 = 20 min |
| Source à 2 activités retenues + vérification | N=3 ; tâches à 5 min | 4 tâches ; existantes 4+4+3 min, ajout 5 min | Même budget complet 20 min |
| Source à 3 activités retenues + vérification | N=4 ; tâches à 5 min | 5 tâches ; existantes 3+3+3+2 min, ajout 5 min | Même budget complet 20 min ; restructuration et relecture indispensables |
| Fixture DEMO ciblée | N=2, deux critères enseignés | N+1=3, même couverture, troisième notion exclue | 2+6+5+5+2 = 20 min ; aucune mesure d'élève |

Les répartitions sont des propositions éditables. Une durée n'est pas une preuve que l'ancienne tâche a été suffisamment raccourcie. L'auteur doit relire consigne, production, référence, alternative correcte et erreur prévue ; le serveur refuse un budget total incohérent. Le barème ne devient pas automatiquement `/20` : la note utilise le dénominateur configuré. La fixture a explicitement 8+8+4 points et une grille DEMO.

Gabarits concurrents inspectés : `practicalBaseline` (quatre tâches), anciens `startingTasks`, fixtures et pages historiques, ancienne action de renforcement du diagnostic, import/export et éditeur. Les anciennes copies et baselines restent historiques. La génération courante passe par le contrat V3.1 ; sans source réelle, son brouillon reste à compléter et la publication est refusée, y compris via une dérogation pédagogique générique. Une importation conserve le marqueur N+1 mais retire la confirmation de source de l'autre installation. Les tests historiques utilisent une fixture explicitement ancienne, sans ajouter de contournement au serveur livré.

## Intégration et données

Nouveaux modules : `server/diagnostic-v31.mjs` (source, budget, ancrages, durée), `diagnostic-v31-routes.mjs` (aperçu, confirmation, commentaires, durée, récupération, questions, indicateurs), `diagnostic-needs.mjs` (besoins déterministes), `public/diagnostic-ui.js` (préparation et vues).

`server/pedagogy/lab-context.mjs` raccorde les moteurs DOM/shell existants à la tentative diagnostique. Les fichiers conservés par le serveur avant échéance rejoignent l'instantané remis et sont commentables individuellement ; les commandes et résultats tardifs ne modifient pas cette copie. Les fichiers internes Git sont exclus. Aucun nouveau moteur ni debugger n'est ajouté.

Les modèles existants portent les ajouts : `lesson_versions.spec.diagnostic.contract`, versions d'items, `assessment_attempts.timing/exposure`, `submissions.answerStates/closure`, `corrections.responseComments/privateNotes/finalized`, versions de règles et preuves dans les propositions existantes. Aucune table ni base parallèle. Les instantanés de récupération restent distincts des remises originales. Aucun ancien commentaire général n'est recopié sous toutes les réponses.

À l'échéance, chaque écriture est refusée par le serveur ; le reçu immuable est matérialisé lors de la prochaine requête d'expiration/remise. Il n'y a pas de nouveau worker censé fabriquer un reçu pendant une coupure réseau. L'interface ne certifie la remise qu'après réponse serveur et conserve la saisie locale non synchronisée dans le périmètre du compte.

Le calcul des besoins n'utilise ni note globale, ni rapidité, ni sentiment d'un commentaire. Il distingue manque de preuve, non-exposition, contradiction, déficit observé, application partielle et attendu démontré. Une nouvelle correction privée invalide une proposition ancienne ; l'attribution exige la publication exacte des preuves et une activité disponible. Les nouvelles affectations automatiques sont désactivées pour ce contrat. La vérification crée une situation distincte sans modifier le diagnostic ni établir à elle seule une maîtrise durable.

## Migration et retour sûr

La migration est additive dans les objets JSON : **aucun DDL ni backfill**. Le script `scripts/migrate-diagnostics-v31.mjs` est un inventaire SQLite en lecture seule, relançable. Sur une copie isolée :

```sh
node scripts/migrate-diagnostics-v31.mjs --db /chemin/vers/copie-isolee.sqlite
```

Il compte versions historiques/V3.1, brouillons admissibles et versions portant des tentatives. Il refuse `--apply`. Chaque brouillon est converti via l'aperçu, avec motif, nouvelle version immuable et grille à configurer. Les publications et copies déjà commencées ne sont jamais converties en place. Le test de migration vérifie aussi l'identité binaire du fichier SQLite après deux inventaires.

Avant une activation sur une autre installation : sauvegarder selon la procédure de stockage existante, vérifier la restauration sur une base séparée, inventorier, puis convertir un brouillon de test et refaire le parcours de recette. Aucun de ces gestes sur une base réelle n'a été exécuté ici. Le script d'inventaire ne traite pas une URL PostgreSQL ; les champs JSON utilisent le store commun, mais une installation PostgreSQL distante nécessite sa propre recette.

Retour applicatif : arrêter les nouvelles préparations V3.1 et conserver l'historique. Ne pas remettre en service une ancienne version serveur ignorant les échéances tant qu'une passation V3.1 est ouverte : terminer/fermer ces passations avec la version courante. Un éventuel retour de sauvegarde s'effectue sur une copie isolée, avec conservation préalable des écritures survenues depuis la sauvegarde ; ne pas écraser les nouvelles copies. Aucun script de suppression ou de rétroconversion des réponses n'est fourni.

## Limites de validation

La recette couvre le logiciel local, les runners existants et les données synthétiques. Restent non vérifiés : calibration auprès d'élèves, estimation réelle du temps de correction, arbitrage des groupes avec un professeur, infrastructure PostgreSQL distante, charge de production et audit exhaustif d'accessibilité. Aucun résultat psychométrique ou effet pédagogique n'est revendiqué. Les durées, incidents et tâches non traitées sont des indicateurs de conception, jamais des notes.
