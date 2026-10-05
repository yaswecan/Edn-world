# EDEN Teacher Twin — Spécification produit, fonctionnelle et technique v1.1

**Statut :** spécification cible de référence  
**Périmètre :** A1 puis extensible à d’autres classes / référentiels  
**Références de rendu :** EDEN Hub du 1er octobre 2026 + EDEN Hub Vercel/Neon + planification A1 2026–2027 + PédagoLab Worlds V7.1 pour le runtime jeu + Drive Distributor V6 pour la publication Google Drive  
**Principe produit :** une intention enseignant minimale doit pouvoir produire une séance complète, exécutable dans EDEN, accompagnée de son corpus, de son diagnostic de la séance précédente, de sa correction, de sa note, de son niveau, de ses groupes de remédiation et de sa mission CodeStation.

---

## 1. Vision produit

EDEN Teacher Twin n’est pas un générateur de cours isolé. C’est un **double pédagogique persistant** qui maintient un état fidèle de la progression réelle d’une classe et qui transforme une intention courte en expérience pédagogique complète.

Le système doit connaître en permanence :

- le référentiel à couvrir ;
- les compétences N2 / N3 ;
- les sous-compétences ;
- les notions, outils et exemples associés ;
- les critères observables ;
- les prérequis ;
- les règles de maîtrise ;
- le niveau d’étayage attendu ;
- la planification annuelle ;
- les séquences S01 à S14 ;
- le planning détaillé ;
- les évaluations prévues ;
- le cahier de texte réel ;
- les ressources existantes ;
- les productions et preuves élèves ;
- les corrections ;
- les niveaux NA / EC / A1 / A2 ;
- les groupes de remédiation ;
- les décisions et modifications du professeur ;
- les missions et événements CodeStation.

Le produit doit pouvoir répondre à une intention telle que :

> « Prépare ma séance de jeudi. »

et produire une séance prête à être relue puis publiée, sans que le professeur ait à reformuler manuellement tout le contexte pédagogique.

---

## 2. Invariants non négociables

### 2.1 La planification EDEN est la source de vérité opérationnelle

Le fichier Excel sert d’import initial, d’export et éventuellement de support d’échange. Après ingestion, la version canonique est la planification versionnée stockée dans EDEN.

### 2.2 Prévu, préparé, réalisé et maîtrisé sont quatre états différents

EDEN doit distinguer :

1. **Prévu** : présent dans la planification ;
2. **Préparé** : une séance a été générée ;
3. **Réalisé** : la séance a réellement eu lieu ;
4. **Maîtrisé** : les preuves satisfont la règle de maîtrise.

Une séance reportée ne compte jamais comme compétence abordée.

### 2.3 Le diagnostic porte toujours sur la dernière séance réellement réalisée

Le diagnostic d’une nouvelle séance est généré à partir de la dernière séance pédagogique clôturée dans le cahier de texte, jamais à partir d’une séance simplement planifiée.

Si la séance précédente a été :

- annulée ;
- reportée ;
- remplacée ;
- marquée « non réalisée » ;
- ou correspond à un événement non évaluable ;

EDEN remonte jusqu’à la dernière séance réalisée éligible au diagnostic.

### 2.4 Le diagnostic ne contient aucune nouvelle notion

Il mesure exclusivement des critères travaillés lors de la séance source et éventuellement leurs prérequis explicitement réactivés.

### 2.5 Une note n’est pas une maîtrise

Le diagnostic produit une preuve. La maîtrise durable d’un critère reste calculée selon la politique pédagogique, notamment la règle actuelle : **deux preuves autonomes espacées, dont une en transfert**.

### 2.6 L’interface du jour est générée par composition, pas par génération de code front arbitraire

Le modèle génère un `DailyLessonSpec`. Le renderer EDEN transforme ce spec en interface. Le LLM ne réécrit pas l’application HTML/CSS/JS chaque jour.

### 2.7 Toute modification structurante du plan est versionnée

Aucune réécriture silencieuse du calendrier, du référentiel, d’une grille ou d’une séance publiée.

### 2.8 CodeStation est une activité native EDEN

CodeStation ne doit pas être un jeu externe déconnecté. Une mission est liée à une séance, à des compétences, à des preuves et au profil de progression élève.

---

## 3. Modèle conceptuel global

```text
RÉFÉRENTIEL
    │
    ├── Compétences N2
    │      └── Critères / N3
    │             ├── notions
    │             ├── outils
    │             ├── exemples
    │             ├── prérequis
    │             ├── traces attendues
    │             ├── règle de maîtrise
    │             └── étayage
    │
    ▼
PLANIFICATION VERSIONNÉE
    │
    ▼
INTENTION PROFESSEUR
    │
    ▼
TEACHER TWIN
    │
    ├── diagnostic séance précédente
    ├── séance du jour
    ├── activités
    ├── ressources
    ├── CodeStation
    └── corpus
    │
    ▼
INTERFACE ÉLÈVE
    │
    ▼
ÉVÉNEMENTS / RENDUS / PREUVES
    │
    ├── correction
    ├── note /20
    ├── niveau NA / EC / A1 / A2
    ├── feedback
    └── groupe de remédiation
    │
    ▼
CAHIER DE TEXTE RÉEL
    │
    ▼
MISE À JOUR DU TWIN
    ↺
```

---

## 4. Ingestion complète du classeur de planification

L’importeur doit ingérer l’ensemble du modèle pédagogique et non seulement les dates.

### 4.1 Correspondances principales

| Feuille actuelle | Objet EDEN cible |
|---|---|
| `00 Sommaire` | métadonnées / navigation / source import |
| `01 Planification A1` | vue annuelle + slots |
| `02 Référentiel A1` | curriculum, compétences, critères, règles |
| `03 Planning détaillé` | entrées de planification atomiques |
| `S01` à `S14` | blueprints de séquences |
| `04 Architecture péda` | politique pédagogique du Teacher Twin |
| `05 Évaluations` | specs d’évaluation planifiées |
| `06 Suivi compétences` | vue calculée de maîtrise |
| `07 Cartographie critères` | vue calculée par critère |
| `08 Groupes remédiation` | recommandations / groupes calculés |
| `09 DATA évaluations` | historique de preuves réelles |
| `10 Paramètres` | échelles, élèves, labels, paramètres |
| `11 Cahier de texte` | exécution réelle des séances |
| `12 Ressources` | registre de packs et ressources |
| `13 Interventions pro` | événements pédagogiques externes |

### 4.2 Champs du référentiel à persister

Pour chaque critère N3 :

- `n2_code` ;
- `n2_label` ;
- `n3_code` ;
- `n3_label` ;
- `typology` ;
- `notions_tools` ;
- `examples` ;
- `sequence_id` ;
- `planned_dates` ;
- `expected_trace` ;
- `status` ;
- `observable_criterion` ;
- `prerequisites` ;
- `mastery_rule` ;
- `scaffolding_rule`.

Les blocs textuels du référentiel ne doivent pas être perdus : ils constituent le contexte de génération.

### 4.3 Import idempotent et versionné

Chaque import doit créer :

- une empreinte SHA-256 du fichier source ;
- un `curriculum_version` ;
- un `plan_version` ;
- un rapport de mapping ;
- les warnings ;
- les conflits éventuels.

Réimport d’un Excel modifié : EDEN présente un diff et ne remplace pas silencieusement les changements réalisés dans l’application.

### 4.4 Clés stables

Utiliser les identifiants déjà structurants :

- compétence : code N3 ;
- séquence : `S01...S14` ;
- évaluation : `PM-xx`, `BP-xx`, `EO-xx` ;
- pack : `R-AAMMJJ` ;
- mission CodeStation : identifiant propre versionné.

---

## 5. Modèle de données persistant

### 5.1 Domaine organisationnel

- `organizations`
- `classes`
- `teachers`
- `learners`
- `enrollments`

### 5.2 Curriculum

- `curricula`
- `curriculum_versions`
- `competency_n2`
- `competency_n3`
- `competency_relations`
- `competency_examples`
- `competency_prerequisites`
- `mastery_policies`
- `scaffolding_policies`

### 5.3 Séquences

- `sequence_blueprints`
- `sequence_versions`
- `sequence_objectives`
- `sequence_activity_patterns`
- `sequence_resources`

### 5.4 Planification

- `plans`
- `plan_versions`
- `plan_entries`
- `plan_entry_competencies`
- `plan_changes`
- `plan_change_reasons`

Un `plan_entry` doit contenir au minimum : date, jour, catégorie, séquence, module, compétences, objectif, activité/trace attendue, évaluation associée, durée, pack ressources, état et notes.

### 5.5 Séances

- `lessons`
- `lesson_versions`
- `lesson_runs`
- `lesson_blocks`
- `lesson_activities`
- `lesson_resources`
- `lesson_publications`

### 5.6 Cahier de texte réel

Un `lesson_run` constitue la vérité de ce qui s’est réellement passé.

Champs minimum :

- prévu ;
- commencé ;
- terminé ;
- partiellement terminé ;
- reporté ;
- annulé ;
- contenu réellement couvert ;
- contenu non couvert ;
- difficultés ;
- ajustements ;
- commentaire professeur ;
- traces collectées ;
- prochaine action recommandée.

### 5.7 Évaluations et preuves

- `assessment_specs`
- `assessment_versions`
- `assessment_attempts`
- `submissions`
- `rubrics`
- `rubric_versions`
- `rubric_items`
- `corrections`
- `correction_revisions`
- `evidence`
- `criterion_mastery`
- `competency_mastery`

### 5.8 Remédiation

- `remediation_snapshots`
- `remediation_groups`
- `remediation_members`
- `remediation_recommendations`

### 5.9 Ressources et corpus

- `resources`
- `resource_versions`
- `resource_files`
- `resource_links`
- `corpus_packages`
- `corpus_manifests`

### 5.10 CodeStation

- `game_worlds`
- `game_missions`
- `game_mission_versions`
- `game_runs`
- `game_events`
- `game_evidence`
- `player_progression`

**La progression de jeu ne doit jamais être confondue avec la maîtrise pédagogique.**

### 5.11 Teacher Twin

- `teacher_policies`
- `teacher_preferences`
- `agent_runs`
- `agent_decisions`
- `agent_artifacts`
- `teacher_approvals`

---

## 6. Mémoire du Teacher Twin

Le Teacher Twin ne doit pas dépendre d’une mémoire implicite du modèle.

### Couche 1 — mémoire métier

PostgreSQL / Neon : vérité persistante et structurée.

### Couche 2 — mémoire documentaire

Index de recherche pour : corpus, anciens cours, documents, exemples, fiches, supports, corrections et ressources longues.

### Couche 3 — mémoire de run

Contexte temporaire de la génération en cours : intention, outils appelés, décisions, artefacts intermédiaires.

Le contexte transmis au modèle doit être assemblé à la demande. Il ne faut pas envoyer tout le classeur à chaque appel.

---

## 7. Politique pédagogique persistante

L’onglet `04 Architecture péda` doit devenir une configuration explicite du Teacher Twin.

### Rythme de référence

- lundi : savoir-faire technique / construire ;
- mardi : savoir / comprendre ;
- jeudi : programmation / algorithmique / raisonner ;
- vendredi : remédiation / transfert.

### Progression d’étayage

`très guidé → guidage partiel → semi-autonome → autonomie accompagnée`.

### Preuves

- diagnostic quotidien formatif ;
- point de maîtrise ;
- bilan de progression ;
- évaluation officielle.

Les évaluations officielles restent distinctes des diagnostics quotidiens et ne sont jamais recalculées silencieusement.

---

## 8. Entrée principale : une intention professeur

Le professeur ne doit pas avoir à écrire un prompt détaillé.

Exemples valides :

- « Prépare jeudi. »
- « Prépare ma prochaine séance. »
- « Je veux faire Git avant le Web. »
- « Je n’ai pas fait S02 mardi. »
- « Garde la séance mais rends-la plus pratique. »
- « Fais une séance de remédiation à partir du diagnostic d’aujourd’hui. »

### `TeacherIntent`

```json
{
  "classId": "A1",
  "intent": "Prépare ma séance de jeudi",
  "targetDate": null,
  "constraints": [],
  "requestedChanges": [],
  "mode": "prepare"
}
```

Le système résout automatiquement :

- la date ;
- le slot ;
- l’entrée de planification ;
- la séquence ;
- les compétences ;
- le diagnostic source ;
- les ressources existantes ;
- l’état de la classe.

---

## 9. Architecture agentique

### 9.1 Principe

Un **orchestrateur principal Teacher Twin** conserve la responsabilité du workflow. Les spécialistes sont utilisés comme outils ou sous-agents bornés. Ne pas créer une swarm d’agents autonomes concurrents.

### 9.2 Rôles

#### A. Teacher Twin / Orchestrator

- interprète l’intention ;
- assemble le contexte ;
- décide quelles étapes sont nécessaires ;
- contrôle les versions ;
- demande validation avant écriture structurante ;
- produit le `DailyBundle` final.

#### B. Curriculum Analyst

- lit le référentiel ;
- vérifie prérequis ;
- détecte incohérences ;
- sélectionne critères et exemples utiles ;
- challenge le plan.

#### C. Lesson Architect

- construit la chronologie ;
- choisit les patterns pédagogiques ;
- dose étayage / autonomie ;
- construit le `DailyLessonSpec`.

#### D. Assessment & Correction Specialist

- construit le diagnostic de la séance précédente ;
- crée la grille ;
- choisit les moteurs de correction ;
- calcule note et niveau ;
- produit les feedbacks et preuves.

#### E. Corpus Compiler

- transforme les specs validés en PDF/PPTX/XLSX/JSON/assets ;
- crée le ZIP Drive-ready ;
- génère le manifeste.

#### F. CodeStation Mission Designer

- choisit ou adapte une mission existante ;
- ne génère une mission nouvelle que si aucune ressource adaptée n’existe ;
- relie objectifs, tests, narration et preuves.

#### G. Quality Reviewer

Peut être implémenté comme une passe de validation plutôt qu’un agent autonome permanent.

- cohérence pédagogique ;
- durée ;
- prérequis ;
- correction ;
- absence de nouvelle notion dans le diagnostic ;
- qualité rédactionnelle ;
- complétude du corpus ;
- conformité du `LessonSpec`.

---

## 10. Outils du Teacher Twin

### Lecture

- `get_plan_context`
- `get_plan_entry`
- `get_previous_completed_lesson`
- `get_curriculum_nodes`
- `get_sequence_blueprint`
- `get_class_mastery_summary`
- `get_student_evidence`
- `search_resources`
- `get_previous_corpora`
- `get_codestation_catalog`

### Génération

- `create_lesson_draft`
- `create_diagnostic_spec`
- `create_activity_spec`
- `create_rubric`
- `create_codestation_mission`
- `compile_corpus`
- `render_lesson_preview`

### Écriture contrôlée

- `propose_plan_change`
- `apply_plan_change`
- `publish_lesson`
- `close_lesson_run`
- `record_teacher_observation`
- `approve_correction`

### Permissions

- lecture : autonome ;
- génération de brouillon : autonome ;
- modification de plan : proposition puis validation ;
- publication élève : validation professeur ;
- suppression / replanification majeure : validation explicite.

---

## 11. Pipeline de génération quotidienne

### Étape 1 — Résoudre l’intention

Déterminer date, classe, slot et demande réelle.

### Étape 2 — Charger le plan

Récupérer l’entrée de planning et sa version.

### Étape 3 — Charger la dernière séance réellement terminée

Cette séance devient la source du diagnostic.

### Étape 4 — Charger le référentiel pertinent

Inclure : critères, exemples, prérequis, règle de maîtrise, niveau d’étayage et traces attendues.

### Étape 5 — Charger l’état réel de la classe

- dernières preuves ;
- élèves NA / EC / A1 / A2 ;
- groupes récents ;
- difficultés signalées ;
- activités déjà vues.

### Étape 6 — Générer le diagnostic

Le diagnostic est indépendant du nouveau contenu de la journée.

### Étape 7 — Générer la séance du jour

Construire la progression pédagogique en fonction du plan et de l’état réel.

### Étape 8 — Sélectionner / générer CodeStation

Choisir la mission la plus utile, pas simplement la plus proche lexicalement.

### Étape 9 — Compiler le corpus

Générer tous les artefacts enseignant/élève.

### Étape 10 — Contrôles qualité

Le bundle n’est pas publiable tant qu’un check bloquant échoue.

### Étape 11 — Prévisualisation professeur

Afficher : interface élève, diagnostic, grille, réponses attendues, corpus, mission, compétences, durée et changements proposés.

### Étape 12 — Publication

La même application EDEN affiche alors la nouvelle séance via son spec publié.

---

## 12. Diagnostic quotidien — spécification complète

### 12.1 Source

`sourceLessonRunId = dernière séance réalisée et clôturée éligible`.

### 12.2 Durée

Cible : 10 à 20 minutes selon le contenu précédent. Le moteur peut conserver 20 minutes lorsque la compétence justifie une production pratique importante.

### 12.3 Contenu

- 2 à 4 critères prioritaires ;
- aucune nouvelle notion ;
- priorité aux tâches pratiques ;
- questions fermées uniquement si elles apportent une vraie preuve ;
- une production incomplète doit pouvoir être remise.

### 12.4 Structure recommandée

1. rappel minimal de la consigne ;
2. 2 à 4 mini-tâches ;
3. remise obligatoire ;
4. correction flash après remise ;
5. pas de solution détaillée avant remise.

### 12.5 Copie figée

`submit` crée une copie immuable.

Les entraînements réalisés plus tard ne remplacent jamais le diagnostic remis.

### 12.6 Essais

Conserver séparément :

- premier essai ;
- dernier essai ;
- nombre d’exécutions ;
- tests ;
- indices consultés ;
- abandon / passage ;
- chronologie.

Ces données contextualisent l’autonomie mais ne doivent pas retirer automatiquement des points.

### 12.7 Barème global

Score final : `/20`.

- `NA` : 0–4 ;
- `EC` : 5–9 ;
- `A1` : 10–14 ;
- `A2` : 15–20 ;
- `NE` : non remis ou résultat non déterminable tant que des éléments obligatoires doivent être relus.

### 12.8 Niveau par critère

Chaque critère dispose de seuils explicites A1/A2 dans sa rubrique.

Compatibilité interne :

- 0 → NA / à construire ;
- 1 → EC / fragile ;
- 2 → A1 / en consolidation ;
- 3 → A2 / maîtrisé sur cette preuve.

**A2 sur une preuve ne signifie pas encore maîtrise durable du critère.**

### 12.9 Résultat attendu

```json
{
  "score": 13,
  "scoreMax": 20,
  "level": "A1",
  "status": "auto_corrected_to_review",
  "confidence": 0.94,
  "criteria": [
    {
      "criterion": "BC05-C1-3",
      "level": "A1",
      "points": 6,
      "max": 8,
      "evidence": []
    }
  ],
  "feedback": "...",
  "remediationPriorities": []
}
```

---

## 13. Correction automatique

### 13.1 Moteur de correction par type

| Activité | Correction principale |
|---|---|
| QCM | déterministe |
| Vrai/faux | déterministe |
| Texte à trous fermé | déterministe |
| Matching / ordre | déterministe |
| Drag & drop | déterministe |
| JavaScript | AST + tests bornés |
| HTML | structure DOM + tests |
| CSS | règles / DOM + tests + éventuellement comparaison visuelle |
| Terminal simulé | état final + commandes attendues |
| SQL simulé / sandboxé | tests de résultat |
| réponse courte | rubrique + LLM |
| explication longue | rubrique + LLM + seuil de confiance |
| CodeStation | tests + événements + preuve finale |
| production ambiguë | relecture humaine |

### 13.2 Interdiction

Ne jamais exécuter du code élève arbitraire directement dans le backend applicatif.

Utiliser : interpréteur borné, Worker, iframe sandboxée ou environnement isolé approprié selon le type d’activité.

### 13.3 Confiance

- `>= 0.90` : pré-correction automatisée forte ;
- `0.70–0.89` : pré-correction + drapeau de vérification ;
- `< 0.70` : relecture obligatoire ;
- syntaxe / construction non prise en charge : `review_required`, jamais zéro automatique par défaut.

### 13.4 Relecture professeur

Le professeur peut modifier :

- chaque item ;
- le commentaire ;
- la note ;
- le niveau ;
- le statut.

Toute modification conserve : auteur, date, ancienne valeur, nouvelle valeur, justification et version.

### 13.5 Réouverture

Une réouverture crée une nouvelle tentative. L’ancienne copie reste intacte.

---

## 14. Calcul de maîtrise

Le moteur de maîtrise exploite les preuves, pas la moyenne brute des notes.

Politique par défaut issue de la planification :

- poids récent : 60 % ;
- preuves 2–4 semaines : 25 % ;
- preuves plus anciennes : 15 %.

Mais la pondération ne peut pas à elle seule marquer un critère « maîtrisé » si la règle de maîtrise explicite exige plusieurs preuves.

Exemple :

```text
preuve 1 : A1 · autonome
preuve 2 : A1 · autonome
preuve 3 : A2 · transfert
→ critère maîtrisé
```

Une réussite unique A2 reste une preuve forte, pas une validation durable automatique.

---

## 15. Groupes de remédiation

### 15.1 Génération immédiate

Après correction du diagnostic, EDEN génère immédiatement une proposition de groupes.

### 15.2 Entrées

- résultat du diagnostic actuel ;
- critères faibles ;
- prérequis manquants ;
- historique récent ;
- maîtrise durable ;
- observations professeur.

### 15.3 Typologie par défaut

- **G0 — reprise fondamentale** : NA / prérequis manquant ;
- **G1 — guidé** : EC ;
- **G2 — consolidation** : A1 ;
- **G3 — transfert / challenge** : A2 ou maîtrise forte.

Les groupes peuvent être organisés par critère plutôt que par note globale.

### 15.4 Vendredi

Le vendredi récupère l’ensemble des preuves de la semaine et propose des groupes stabilisés. Le professeur peut conserver, fusionner, scinder ou déplacer un élève.

### 15.5 Adaptation de la séance en cours

Option activable : après le diagnostic, EDEN peut proposer d’adapter le reste de la séance du jour.

Exemple :

> 9 élèves échouent sur l’incrémentation. Proposition : insérer 12 min de réactivation avant l’activité principale.

Le professeur accepte ou refuse.

---

## 16. `DailyLessonSpec`

Le `lesson.json` actuel devient un format universel et versionné.

```json
{
  "schemaVersion": "1.0",
  "lessonId": "R-261008",
  "lessonVersion": 1,
  "classId": "A1",
  "date": "2026-10-08",
  "planEntryId": "...",
  "planVersion": 17,
  "sequence": "S04",
  "title": "Boucles : consolider puis introduire les tableaux",
  "skills": [],
  "objectives": [],
  "prerequisites": [],
  "reactivation": [],
  "diagnostic": {},
  "timeline": [],
  "blocks": [],
  "activities": [],
  "slides": [],
  "resources": [],
  "codeStation": {},
  "teacherGuide": {},
  "studentFlow": {},
  "quality": {},
  "sourceVersions": {}
}
```

Chaque contenu doit être rattaché à :

- un objectif ;
- éventuellement une compétence ;
- une preuve attendue ;
- une durée ;
- un mode de correction si applicable.

---

## 17. Structure de la séance élève

La structure exacte peut varier, mais le renderer doit disposer des blocs suivants :

1. **Aujourd’hui** : objectif, durée, progression ;
2. **Diagnostic de la séance précédente** ;
3. **Correction flash / débrief** ;
4. **Réactivation éventuelle** ;
5. **Découverte / observation** ;
6. **explication / apport** ;
7. **live code / démonstration** ;
8. **activité guidée** ;
9. **pause** ;
10. **activité autonome** ;
11. **CodeStation** ;
12. **point de maîtrise / ticket de sortie** ;
13. **bilan / remise**.

La séance de référence du 1er octobre compte 175 minutes, 12 blocs, 31 étapes et 26 slides : EDEN doit être capable de reproduire cette densité sans générer une nouvelle application dédiée.

---

## 18. Principes UX de l’interface élève

### 18.1 Une seule URL

L’élève arrive sur EDEN, s’identifie et obtient la séance du jour. Aucun ZIP à décompresser.

### 18.2 Un geste central par écran

Référence pédagogique :

`observe → reconstruis → teste → explique → transfère`.

Ne pas afficher simultanément objectif, bonus, aide, grille, correction et consigne longue si cela surcharge l’action.

### 18.3 Progression guidée

- barre d’avancement ;
- prochaines étapes visibles sans spoiler les solutions ;
- reprise sur même appareil ;
- synchronisation serveur avec reçu ;
- mode hors-ligne limité si nécessaire ;
- séparation claire entre « sauvegardé localement » et « reçu par le serveur ».

### 18.4 Progression ≠ maîtrise

100 % des écrans parcourus ne signifie jamais 100 % de maîtrise.

---

## 19. Design system EDEN

Le système de rendu doit conserver une identité stable, tout en composant une interface différente chaque jour.

### Composants minimum

- `LessonHero`
- `Timeline`
- `ObjectiveCard`
- `ConceptCard`
- `Diagram`
- `BlackboardDiagram`
- `Quiz`
- `TruthTable`
- `CircuitExercise`
- `FillBlank`
- `Matching`
- `DragDrop`
- `CodeEditor`
- `Console`
- `Preview`
- `TestRunner`
- `Terminal`
- `FileExplorer`
- `LiveCode`
- `WriteResponse`
- `Reflection`
- `Submission`
- `MasteryCheck`
- `Simulator`
- `CodeStationLauncher`

### Règles visuelles

- fond clair ;
- signature indigo / violet / navy ;
- typographie noire à fort contraste ;
- cartes arrondies ;
- code / terminal sombres ;
- schémas pédagogiques simples ;
- espaces généreux ;
- hiérarchie forte ;
- responsive laptop en priorité ;
- accessibilité clavier et contrastes contrôlés.

Le modèle choisit des composants et leur contenu ; il ne choisit pas librement toute la CSS.

---

## 20. Corpus Compiler

Chaque séance publiée produit un pack `R-AAMMJJ` prêt à déposer sur Drive.

### Structure cible

```text
R-261008/
  00_MANIFEST/
    manifest.json
    README.txt
    sources.json

  01_ELEVE/
    carnet-eleve.pdf
    fiche-recap.pdf
    exercices.pdf
    fichiers-depart/

  02_DIAGNOSTIC/
    diagnostic-eleve.pdf
    diagnostic-spec.json
    grille.json
    correction-reference.pdf
    fichiers-reference/

  03_PROFESSEUR/
    trame-professeur.pdf
    memo-professeur.pdf
    guide-animation.pdf
    groupes-remediation.xlsx

  04_PRESENTATION/
    presentation.pptx
    presentation.pdf

  05_CORRECTION/
    modele-feuille-correction.xlsx
    bareme.pdf
    reperes.pdf

  06_CODESTATION/
    mission.json
    assets/
    correction-mission.json

  07_SOURCES_EDEN/
    lesson.json
    teacher-guide.json
    activity-specs.json
    rubric.json

  R-261008_CORPUS_COMPLET.zip
```

### Manifeste

Le manifeste contient :

- identifiants et versions ;
- date de génération ;
- planVersion ;
- curriculumVersion ;
- liste des fichiers ;
- SHA-256 ;
- compétences ;
- durée ;
- statut `draft / approved / published / archived`.

Le corpus est un export. EDEN reste la source de vérité.

---

## 21. Dossier individuel après diagnostic

Pour chaque élève :

```text
PRENOM_id/
  rendu/
    ensemble_des_reponses.json
    bilan.html
    code/

  evaluation/
    rendu_original.json
    premiers_essais/
    essais_et_tests.json
    progression.html
    correction.json
    correction.html
    exemple_corrige/

  feuille_correction.xlsx
  manifest.json
  LIRE.txt
```

Le classeur individuel conserve au minimum :

- `Correction` ;
- `Barème` ;
- `Repères` ;
- `Essais`.

Le système doit produire automatiquement la note, le niveau, les critères, les preuves et le feedback avant relecture.

---

## 22. CodeStation — intégration complète

### 22.1 Position

CodeStation est un runtime pédagogique interne accessible comme une étape de séance.

### 22.2 `GameMissionSpec`

```json
{
  "missionId": "CS-LOOPS-DEBUG-02",
  "version": 3,
  "world": "station-alpha",
  "title": "Réparer le moteur",
  "narrative": "...",
  "competencies": ["BC05-C1-3"],
  "prerequisites": [],
  "duration": 25,
  "rooms": [],
  "interactables": [],
  "terminals": [],
  "tasks": [],
  "tests": [],
  "hints": [],
  "completionRule": {},
  "evidenceRule": {},
  "teacherValidation": false
}
```

### 22.3 Types de missions

- JavaScript ;
- HTML/CSS ;
- DOM ;
- shell / terminal ;
- Git simulé / workflow ;
- debug ;
- recherche dans des logs ;
- hardware / BIOS / OS ;
- réseau ;
- API ;
- logique / maths ;
- reproduction d’interface.

### 22.4 Événements

- `mission_started`
- `room_entered`
- `terminal_opened`
- `code_attempted`
- `test_failed`
- `test_passed`
- `hint_used`
- `task_completed`
- `mission_completed`
- `teacher_validated`

### 22.5 Preuves

La mission peut produire des preuves, mais le niveau de joueur / badge / grade de jeu reste séparé des grades pédagogiques.

### 22.6 Sélection de mission

Ordre :

1. réutiliser une mission validée existante ;
2. adapter une mission template ;
3. générer une nouvelle mission uniquement si nécessaire.

---

## 23. Interface professeur

### 23.1 Dashboard

Afficher :

- séance du jour ;
- planifié vs réalisé ;
- alertes ;
- compétences non couvertes ;
- derniers diagnostics ;
- groupes proposés ;
- prochaines séances.

### 23.2 Planification

Deux modes synchronisés :

- calendrier / table éditable ;
- conversation avec le Teacher Twin.

Drag & drop d’une séance → analyse immédiate des dépendances.

### 23.3 Aujourd’hui

Actions :

- générer / régénérer ;
- visualiser le diagnostic source ;
- prévisualiser élève ;
- modifier un bloc ;
- modifier une activité ;
- remplacer CodeStation ;
- voir corpus ;
- lancer la publication.

### 23.4 Correction

- file des copies ;
- score provisoire ;
- niveau ;
- confiance ;
- items à relire ;
- premier vs dernier essai ;
- modification avec justification ;
- export individuel / classe.

### 23.5 Remédiation

Vue par critère et par élève. Groupes modifiables manuellement.

### 23.6 Cahier de texte

À la fin de séance, le professeur clôture :

- réellement fait ;
- non fait ;
- difficulté ;
- changement ;
- commentaire ;
- suite.

Le Teacher Twin utilise immédiatement cette clôture pour préparer le diagnostic suivant.

---

## 24. API applicative cible

### Plan / référentiel

- `POST /api/imports/planning`
- `GET /api/curricula/:id`
- `GET /api/plans/:id`
- `GET /api/plans/:id/versions`
- `PATCH /api/plans/:id/entries/:entryId`
- `POST /api/plans/:id/changes/propose`
- `POST /api/plans/:id/changes/:changeId/apply`

### Teacher Twin

- `POST /api/twin/intent`
- `GET /api/twin/runs/:runId`
- `POST /api/twin/runs/:runId/approve`

### Séances

- `POST /api/lessons/generate`
- `GET /api/lessons/:id`
- `POST /api/lessons/:id/preview`
- `POST /api/lessons/:id/publish`
- `POST /api/lessons/:id/close`
- `GET /api/today`

### Évaluation

- `POST /api/assessments/:id/start`
- `POST /api/assessments/:id/save`
- `POST /api/assessments/:id/submit`
- `GET /api/assessments/:id/result`
- `GET /api/teacher/assessments/:id/submissions`
- `POST /api/teacher/submissions/:id/correction`
- `POST /api/teacher/submissions/:id/reopen`

### Remédiation

- `POST /api/remediation/compute`
- `GET /api/remediation/latest`
- `PATCH /api/remediation/groups/:id`

### Corpus

- `POST /api/corpus/:lessonId/compile`
- `GET /api/corpus/:lessonId/manifest`
- `GET /api/corpus/:lessonId/download`

### CodeStation

- `GET /api/game/missions/:id`
- `POST /api/game/runs`
- `POST /api/game/runs/:id/events`
- `POST /api/game/runs/:id/complete`

---

## 25. Événements pédagogiques

Toutes les interactions importantes doivent produire un événement normalisé.

Exemples :

- `lesson_opened`
- `step_started`
- `step_completed`
- `answer_saved`
- `code_run`
- `test_run`
- `hint_opened`
- `diagnostic_submitted`
- `resource_opened`
- `game_started`
- `game_completed`
- `lesson_submitted`

Chaque événement contient :

- `eventId` ;
- `learnerId` ;
- `lessonRunId` ;
- `activityId` ;
- `timestamp` ;
- `payloadVersion` ;
- `payload`.

Les événements bruts ne sont pas eux-mêmes des preuves de maîtrise. Le moteur d’évidence transforme certains événements en preuves qualifiées.

---

## 26. Qualité de génération

### 26.1 Checks bloquants

Une séance ne peut pas être publiée si :

- la durée dépasse le créneau sans justification ;
- le diagnostic ne pointe pas la dernière séance réellement réalisée ;
- le diagnostic introduit une nouvelle notion ;
- une activité obligatoire n’a pas de consigne ;
- une activité évaluée n’a pas de correction ;
- une grille ne somme pas à 20 lorsqu’elle prétend être /20 ;
- une compétence référencée n’existe pas ;
- la pause obligatoire manque sur un créneau concerné ;
- le corpus est incomplet ;
- le JSON ne valide pas son schéma ;
- une mission CodeStation obligatoire ne possède pas de règle de réussite.

### 26.2 Checks pédagogiques

Score qualité sur :

- cohérence avec le plan ;
- progressivité ;
- niveau d’étayage ;
- authenticité des situations ;
- temps d’activité élève ;
- charge cognitive ;
- réactivation ;
- transfert ;
- qualité du feedback ;
- différenciation.

### 26.3 Evals

Conserver un jeu de séances de référence et vérifier à chaque changement :

- respect du schéma ;
- qualité des diagnostics ;
- correction ;
- absence de fuite de solution ;
- stabilité du design ;
- exactitude des compétences ;
- qualité des groupes.

---

## 27. Versioning

Tout objet important est versionné :

- curriculum ;
- plan ;
- séquence ;
- séance ;
- diagnostic ;
- grille ;
- correction ;
- ressource ;
- mission CodeStation.

Une séance réalisée garde toujours les versions utilisées le jour J.

Une modification du référentiel trois mois plus tard ne réécrit pas l’historique.

---

## 28. Gestion des modifications du plan

Le Teacher Twin peut proposer :

- déplacer ;
- insérer ;
- scinder ;
- fusionner ;
- reporter ;
- changer un objectif ;
- changer une compétence ;
- changer une séquence.

Avant application :

- détecter les dépendances ;
- identifier les compétences impactées ;
- vérifier les évaluations futures ;
- proposer un nouveau placement ;
- expliquer l’impact.

Toute modification reçoit un `reason` et un auteur.

---

## 29. Sécurité et intégrité

### 29.1 Comptes

- authentification professeur distincte ;
- sessions élèves opaques ;
- secrets uniquement serveur ;
- cookies HttpOnly pour professeur ;
- périmètre strict par classe.

### 29.2 Code élève

- aucun `eval` serveur non borné ;
- aucune commande shell réelle depuis une réponse élève sans sandbox dédiée ;
- limites de taille / temps ;
- réseau interdit par défaut dans les runtimes d’exercice.

### 29.3 Mineurs

Minimiser les données personnelles. L’analyse pédagogique doit pouvoir fonctionner avec identifiants scolaires internes sans envoyer plus de données nominatives que nécessaire aux modèles.

### 29.4 Audit

Journaliser :

- génération ;
- publication ;
- modification de note ;
- modification de plan ;
- validation ;
- suppression.

---

## 30. OpenAI / orchestration

Architecture recommandée : application-controlled agent runtime.

- un orchestrateur Teacher Twin ;
- tools fortement typés ;
- sorties structurées JSON ;
- spécialistes bornés ;
- traces de runs ;
- validations humaines avant actions structurantes.

Les objets tels que `TeacherIntent`, `DailyLessonSpec`, `DiagnosticSpec`, `CorrectionResult`, `RemediationSnapshot` et `GameMissionSpec` doivent être produits via des schémas JSON stricts.

### MCP

MCP est optionnel pour le cœur EDEN.

Recommandation :

- fonctions internes directes pour Neon / EDEN ;
- MCP pour exposer EDEN à d’autres agents ou brancher certains outils externes ;
- connecteur Drive ultérieurement pour publier automatiquement le corpus ;
- ne pas mettre toute la logique métier derrière MCP sans nécessité.

---

## 31. `DailyBundle` — sortie canonique

Une génération terminée retourne :

```json
{
  "lesson": {},
  "diagnostic": {},
  "rubric": {},
  "correctionReference": {},
  "remediationPolicy": {},
  "codeStationMission": {},
  "teacherGuide": {},
  "studentInterface": {},
  "corpusManifest": {},
  "journalDraft": {},
  "qualityReport": {},
  "planImpact": null
}
```

C’est l’unité atomique de préparation d’une journée.

---

## 32. Cycle de vie d’une journée

```text
1. INTENTION
   "Prépare jeudi"

2. CONTEXTE
   plan + référentiel + dernière séance réelle + état classe

3. GÉNÉRATION
   diagnostic précédent + séance courante + CodeStation

4. QA
   vérifications automatiques + reviewer

5. VALIDATION PROF
   aperçu interface + corpus + barème

6. PUBLICATION
   /today devient la nouvelle interface élève

7. DIAGNOSTIC
   remise figée

8. CORRECTION
   auto-précorrection + note + grade + feedback

9. REMÉDIATION
   groupes immédiats + proposition d’adaptation

10. APPRENTISSAGE
    cours / exercices / CodeStation

11. CLÔTURE
    cahier de texte réel

12. MISE À JOUR TWIN
    nouvelles preuves + prochaine séance source
```

---

## 33. Cas de secours

### Pas de séance précédente

Créer un diagnostic baseline explicitement marqué `baseline`, sans prétendre mesurer une séance inexistante.

### Séance précédente non clôturée

Bloquer la génération finale du diagnostic et demander au professeur de valider le contenu réellement fait, ou utiliser explicitement le dernier run clôturé.

### Pas de plan pour la date

Créer un brouillon à partir de l’intention, sans modifier la planification avant validation.

### Correction ambiguë

Conserver `NE / review_required` pour les éléments nécessaires ; ne jamais transformer l’incertitude du moteur en zéro.

### Corpus partiellement généré

Ne pas marquer le bundle « ready ».

### CodeStation indisponible

Prévoir une activité fallback portant sur les mêmes critères.

---

## 34. Définition de Done d’une séance générée

Une séance est `READY_FOR_REVIEW` si :

- entrée de plan résolue ;
- compétences valides ;
- diagnostic de la séance précédente généré ;
- correction et grille générées ;
- note / niveau calculables ;
- déroulé complet ;
- toutes les activités possèdent consigne et attendu ;
- CodeStation sélectionné ou fallback prévu ;
- corpus compilé ;
- interface rendue sans erreur ;
- contrôles qualité réussis.

Elle est `PUBLISHED` uniquement après validation professeur.

---

## 35. Critères d’acceptation V1

### Ingestion

- importer le classeur A1 complet ;
- retrouver toutes les compétences N3 ;
- retrouver toutes les séances du planning ;
- retrouver les reports du cahier de texte ;
- préserver ressources et IDs R-xxxxxx ;
- produire un diff après modification.

### Teacher Twin

Commande : « Prépare ma séance de jeudi ».

Attendu :

- détermine le bon jeudi ;
- récupère le bon plan ;
- récupère la dernière séance réellement réalisée ;
- génère un diagnostic uniquement sur cette séance ;
- génère la nouvelle séance ;
- ne modifie pas le plan sans validation.

### Diagnostic

- /20 ;
- NA/EC/A1/A2/NE ;
- copie figée ;
- premier essai séparé ;
- pré-correction ;
- fichier Excel individuel ;
- feedback ;
- relecture possible ;
- historique de correction.

### Remédiation

- groupe proposé pour chaque élève ayant une preuve ;
- raison visible ;
- regroupement par critère ;
- édition manuelle ;
- snapshot conservé.

### Interface

- une seule URL ;
- navigation guidée ;
- rendu à la qualité du Hub du 1er octobre ;
- composants interactifs ;
- sauvegarde fiable ;
- nouvelle séance sans redéploiement de front.

### Corpus

- ZIP complet `R-AAMMJJ` ;
- PDF élève ;
- PDF professeur ;
- diagnostic ;
- correction ;
- XLSX ;
- PPTX/PDF présentation ;
- JSON source ;
- CodeStation ;
- manifeste.

### CodeStation

- lancement depuis la séance ;
- mission liée aux compétences ;
- événements synchronisés ;
- preuve finale récupérée ;
- progression jeu séparée de la maîtrise.

---

## 36. Roadmap de construction recommandée

### Phase 1 — `eden_core`

- schéma de données universel ;
- import Excel ;
- plan versionné ;
- référentiel ;
- cahier de texte ;
- éditeur planification.

### Phase 2 — Teacher Twin

- intent resolver ;
- context builder ;
- outils de lecture ;
- proposition de changements ;
- `DailyLessonSpec`.

### Phase 3 — diagnostic universel

- moteur de grille ;
- moteurs de correction ;
- copies figées ;
- exports ;
- grades ;
- preuves ;
- remédiation.

### Phase 4 — renderer + corpus

- design system ;
- composants ;
- `/today` ;
- prévisualisation professeur ;
- compilateur PDF/PPTX/XLSX/ZIP.

### Phase 5 — CodeStation natif

- contrat mission ;
- catalogue ;
- events ;
- evidence ;
- missions adaptatives.

### Phase 6 — boucle adaptative

- modification de la suite de séance après diagnostic ;
- vendredi auto-préparé ;
- alertes de progression ;
- challenge automatique de la planification.

---

## 37. Décisions d’architecture à conserver

1. **Pas de nouvelle app par séance.** Une app, des specs de séance.
2. **Pas de vérité pédagogique dans le prompt.** La vérité est en base.
3. **Pas de diagnostic basé sur le planning théorique.** Toujours le dernier réel.
4. **Pas de note = maîtrise.** Note et maîtrise sont deux objets distincts.
5. **Pas de correction IA opaque.** Toujours une rubrique et des preuves.
6. **Pas de zéro automatique quand le moteur ne comprend pas une copie.** Relecture.
7. **Pas de CodeStation parallèle.** CodeStation est un composant EDEN.
8. **Pas de corpus comme source de vérité.** Le corpus est une compilation exportable.
9. **Pas de modification silencieuse.** Tout est versionné.
10. **Pas de publication automatique sans aperçu professeur en V1.**

---

## 38. Résultat produit attendu

À terme, le professeur doit pouvoir écrire :

> **« Prépare ma séance de jeudi. »**

EDEN doit alors :

1. comprendre la date et le créneau ;
2. lire la planification ;
3. lire le référentiel complet ;
4. lire la dernière séance réellement réalisée ;
5. générer le diagnostic de cette séance ;
6. générer sa grille /20 ;
7. préparer sa correction automatique ;
8. préparer les niveaux NA / EC / A1 / A2 ;
9. préparer la logique de remédiation ;
10. générer la séance du jour ;
11. générer ou sélectionner les ressources ;
12. intégrer CodeStation ;
13. construire l’interface élève ;
14. générer le corpus complet Drive-ready ;
15. afficher un aperçu professeur ;
16. publier après validation ;
17. corriger les diagnostics remis ;
18. générer les groupes ;
19. adapter éventuellement la suite ;
20. enregistrer le réel dans le cahier de texte ;
21. mettre à jour les preuves et la maîtrise ;
22. utiliser ce nouvel état pour la séance suivante.

**C’est cette boucle fermée — planifier → faire → observer → corriger → remédier → replanifier — qui définit EDEN Teacher Twin.**

---

## 39. Réutilisation normative des projets existants

Cette section fixe ce qui doit être **réutilisé**, **migré**, **encapsulé** ou **abandonné** dans les projets existants.  
Le principe est de ne pas réécrire ce qui fonctionne déjà, tout en évitant de conserver plusieurs sources de vérité.

---

### 39.1 Principe général

EDEN devient l’application centrale.

```text
                         EDEN
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
        ▼                 ▼                  ▼
   Teacher Twin      Lesson Runtime      EDEN Core
        │                 │                  │
        │                 │                  │
        │          ┌──────┴──────┐           │
        │          │             │           │
        ▼          ▼             ▼           ▼
   génération   cours        GAME RUNTIME   Neon
                            (PédagoLab)
        │
        ▼
 CORPUS COMPILER
        │
        ▼
 DRIVE PUBLISHER
 (Drive Distributor)
```

PédagoLab et Drive Distributor ne restent donc pas des applications métiers indépendantes.

Ils deviennent des **capacités internes d’EDEN**.

---

## 40. PédagoLab → EDEN Game Runtime

### 40.1 Ce qui est conservé

Le projet `PEDAGOLAB_WORLDS_V7_1_CURRICULUM` contient cinq univers à conserver :

1. `CODE//STATION`
2. `BUNKER//OPS`
3. `ROCKET//LAUNCH`
4. `INFILTRATION//TRACE`
5. `ASSAULT//SIM`

La philosophie existante est conservée :

> une même compétence peut être réutilisée dans plusieurs mondes afin de travailler le transfert.

Sont également conservés :

- les univers graphiques ;
- les mécaniques de missions ;
- les scénarios de test ;
- les validateurs ;
- les productions finales ;
- les missions à plusieurs cas de test ;
- les déblocages progressifs ;
- les overrides professeur ;
- les brouillons de mission ;
- les événements de progression ;
- la notion de preuve produite par une mission ;
- le gameplay et l’expérience joueur de l’ancien `CODE//STATION` complet lorsqu’ils sont supérieurs au renderer générique EDEN.

### 40.2 Catalogue de départ

Le catalogue PédagoLab existant est importé dans EDEN avec ses liaisons pédagogiques.

Exemples existants à préserver :

```text
CODE//STATION
├── Énergie critique
├── Relancer les moteurs
├── Badge d’accès
└── Évaluation · Réparer la station

BUNKER//OPS
├── SHELL MAZE
├── Service vital
├── Liaison interne
└── Évaluation · Healthcheck

ROCKET//LAUNCH
├── La diagonale oubliée
├── Séquence de lancement
├── Compte à rebours
└── Évaluation · Contrôleur de lancement

INFILTRATION//TRACE
├── Trace HTTP
├── Journal d’événements
├── Anomalie de session
└── Évaluation · Rapport incident

ASSAULT//SIM
├── Inventaire drones
├── Décision énergie
├── Formation
└── Évaluation · Contrôleur d’escouade
```

Ces missions deviennent les premières entrées de `game_missions`.

---

### 40.3 Ce qui ne doit pas rester propriétaire de PédagoLab

Les fonctions suivantes migrent vers EDEN Core :

- comptes professeur ;
- comptes élèves ;
- authentification ;
- référentiel ;
- planification ;
- cartographie de compétences ;
- maîtrise ;
- remédiation ;
- bibliothèque générale ;
- historique pédagogique ;
- source de vérité de progression.

Le schéma actuel de type :

```text
students
student_progress.payload
worldOverrides
```

ne doit plus constituer le modèle canonique.

Le runtime de jeu demande ces informations à EDEN.

---

### 40.4 Extraction du catalogue

Dans PédagoLab V7.1, les mondes et missions sont actuellement fortement définis dans le frontend.

EDEN doit les sortir du code d’interface.

Cible :

```text
game_worlds
game_missions
game_mission_versions
game_runs
game_events
game_evidence
game_unlocks
game_teacher_overrides
```

Une mission devient une donnée versionnée.

Exemple :

```json
{
  "id": "code-station/motors",
  "version": 1,
  "world": "code-station",
  "title": "Relancer les moteurs",
  "competencies": [
    "BC05-C1-3",
    "BCT02-C1-1"
  ],
  "brief": "Un même programme doit activer tous les modules.",
  "starterFiles": {},
  "scenarios": [],
  "validator": "motors",
  "final": false
}
```

Le jeu ne dépend donc plus d’un tableau JavaScript hardcodé.

---

### 40.5 `GameBridge`

EDEN et les jeux communiquent à travers un contrat stable nommé `GameBridge`.

#### Contexte fourni au lancement

```json
{
  "studentId": "...",
  "lessonRunId": "...",
  "missionId": "...",
  "missionVersion": 3,
  "attemptId": "...",
  "locale": "fr",
  "permissions": {
    "hints": true,
    "teacherValidation": false
  }
}
```

#### Événements retournés

```text
game_started
mission_started
room_entered
terminal_opened
file_opened
code_run
test_run
test_failed
test_passed
hint_used
task_completed
mission_completed
game_closed
```

Chaque événement contient au minimum :

```json
{
  "eventId": "...",
  "studentId": "...",
  "lessonRunId": "...",
  "missionRunId": "...",
  "type": "test_passed",
  "timestamp": "...",
  "payload": {}
}
```

---

### 40.6 Les jeux ne calculent pas la maîtrise finale

Le runtime peut dire :

```text
3/4 tests réussis
mission terminée
2 indices utilisés
production finale correcte
```

mais il ne décide pas seul :

```text
BC05-C1-3 = maîtrisé
```

Il produit une `Evidence`.

Le moteur de maîtrise EDEN applique ensuite les règles globales :

- répétition ;
- autonomie ;
- transfert ;
- récence ;
- diversité des preuves.

---

### 40.7 Déblocage

Les règles existantes PédagoLab sont conservées comme **règles de jeu** :

```text
monde précédent terminé
OU
override professeur
```

Mais EDEN peut ajouter une règle pédagogique :

```text
mission autorisée
SI
prérequis pédagogiques compatibles
OU
override professeur explicite
```

Un override :

- ouvre l’accès ;
- ne marque aucune mission comme réussie ;
- ne crée aucune preuve artificielle ;
- ne modifie pas la maîtrise.

---

### 40.8 Intégration dans `DailyLessonSpec`

Une activité jeu est référencée ainsi :

```json
{
  "type": "game",
  "runtime": "pedagolab",
  "worldId": "code-station",
  "missionId": "motors",
  "duration": 25,
  "competencies": ["BC05-C1-3"],
  "required": true,
  "unlockAfter": "exercise-loops-03"
}
```

Le même renderer élève peut donc afficher :

```text
Cours
→ Exercice
→ CODE//STATION
→ Bilan
```

sans changement d’application.

---

### 40.9 Stratégie technique de migration

#### V1

Le moteur de jeu peut rester isolé sous une route EDEN :

```text
/play/:worldId/:missionId
```

Le frontend jeu existant est encapsulé et authentifié par EDEN.

#### V1.5

Extraction :

- des définitions de mondes ;
- des missions ;
- des validateurs ;
- du stockage de progression.

#### V2

Le runtime devient un package dédié :

```text
packages/
  game-runtime/
  game-catalog/
  game-validators/
  game-bridge/
```

Cela permet de conserver le gameplay tout en supprimant les dépendances historiques à PédagoLab.

---

## 41. Drive Distributor → EDEN Drive Publisher

### 41.1 Périmètre conservé

De `drive-distributor-v6-rendus`, EDEN conserve principalement la **partie publication / upload**.

À conserver :

- authentification Google Drive par compte de service ;
- impersonation Google Workspace ;
- support des Shared Drives ;
- `supportsAllDrives` ;
- découverte du dossier racine élèves ;
- découverte des dossiers élèves ;
- navigation matière → sous-dossiers ;
- support des raccourcis Drive vers des dossiers ;
- création de dossiers manquants ;
- création d’arborescences ;
- sélection d’un ou plusieurs élèves ;
- distribution à tous les élèves ;
- upload multi-fichiers ;
- conservation d’une arborescence ;
- prévention des doublons ;
- rapport détaillé par élève ;
- gestion individuelle des erreurs.

Les fonctions existantes telles que :

```text
listStudents
listChildFolders
findChildFolder
resolvePath
createFolder
uploadBuffer
fileExists
discoverPathsInsideSubject
```

constituent la base du futur `DrivePublisher`.

---

### 41.2 Ce qui n’est pas prioritaire pour EDEN V1

La fonction `Récupérer les rendus` de Drive Distributor peut rester hors du noyau initial.

Elle pourra être reconnectée ensuite si EDEN doit récupérer des travaux externes stockés exclusivement dans Drive.

La priorité V1 est :

```text
EDEN
→ compile le corpus
→ prépare la destination
→ publie les fichiers
→ retourne le rapport
```

---

### 41.3 Le Drive Publisher n’est pas la source de vérité

Drive reçoit des copies distribuées.

Il ne remplace jamais :

- la ressource EDEN ;
- la séance ;
- le résultat ;
- la preuve ;
- le corpus canonique.

EDEN conserve :

```text
artifactId
artifactVersion
sha256
driveFileId
driveFolderId
publishedAt
publicationStatus
```

---

### 41.4 Modes de publication

Le Teacher Twin doit pouvoir publier selon plusieurs stratégies.

#### Corpus professeur

```text
DRIVE/
└── Corpus enseignant/
    └── R-261008/
        ├── professeur/
        ├── diagnostic/
        ├── correction/
        ├── presentation/
        └── sources/
```

#### Ressources élèves

```text
ELEVES/
├── Alice/
│   └── 01 - Tech/
│       └── 01 - Cours/
│           └── R-261008/
├── Bilal/
│   └── ...
└── ...
```

#### Fichiers individualisés

EDEN peut générer un fichier différent pour chaque élève puis le distribuer dans son dossier.

Exemple :

```text
Alice/
  feuille_remediation_Alice.pdf

Bilal/
  challenge_Bilal.pdf
```

Le `DrivePublisher` reçoit alors un manifeste destinataire → fichiers.

---

### 41.5 `DrivePublicationSpec`

```json
{
  "publicationId": "...",
  "lessonId": "R-261008",
  "target": "students",
  "students": ["all"],
  "subject": "01 - Tech",
  "path": [
    "01 - Cours",
    "R-261008"
  ],
  "createMissingFolders": true,
  "skipExisting": true,
  "artifacts": [
    {
      "artifactId": "student-handbook",
      "filename": "carnet-eleve.pdf"
    }
  ]
}
```

---

### 41.6 Résultat de publication

```json
{
  "publicationId": "...",
  "status": "partial_success",
  "total": 18,
  "success": 17,
  "failed": 1,
  "students": [
    {
      "studentId": "...",
      "status": "success",
      "filesCreated": 4,
      "filesSkipped": 1
    }
  ]
}
```

Le professeur voit :

```text
17 / 18 élèves servis

1 erreur
→ Martin : dossier 01 - Tech inaccessible

[ Réessayer uniquement les erreurs ]
```

---

### 41.7 Suppression de la limite architecturale de 4 Mo

Drive Distributor V6 fait actuellement passer les fichiers navigateur → Function Vercel avant upload Drive et limite volontairement la requête à environ 4 Mo.

Cette contrainte ne doit **pas** être reprise dans EDEN.

Les corpus EDEN peuvent contenir :

- PDF ;
- PPTX ;
- XLSX ;
- images ;
- assets CodeStation ;
- ZIP.

Le `DrivePublisher` doit donc supporter :

1. upload backend direct depuis les artefacts générés ;
2. upload en flux ;
3. upload Drive résumable pour les gros fichiers ;
4. éventuellement publication par lots.

Ainsi :

```text
Corpus Compiler
      │
      ├── Artifact Storage
      │
      └── DrivePublisher
               │
               ▼
          Google Drive
```

Le navigateur du professeur ne transporte pas le corpus complet.

---

### 41.8 API cible Drive

```text
GET  /api/integrations/drive/status
GET  /api/integrations/drive/students
GET  /api/integrations/drive/tree
POST /api/integrations/drive/publications
GET  /api/integrations/drive/publications/:id
POST /api/integrations/drive/publications/:id/retry
```

Pour une séance :

```text
POST /api/corpus/:lessonId/publish-drive
```

---

## 42. Nouveau flux cible avec modules réutilisés

```text
INTENTION PROFESSEUR
        │
        ▼
   TEACHER TWIN
        │
        ├── planification
        ├── référentiel
        ├── cahier de texte
        ├── preuves
        └── ressources
        │
        ▼
 DAILY LESSON SPEC
        │
        ├───────────────┐
        │               │
        ▼               ▼
 LESSON RUNTIME     GAME RUNTIME
                     PédagoLab
        │               │
        └───────┬───────┘
                ▼
             PREUVES
                │
                ▼
        ASSESSMENT ENGINE
                │
                ├── note /20
                ├── NA / EC / A1 / A2
                ├── correction
                └── groupes
                │
                ▼
          CORPUS COMPILER
                │
                ├── stockage EDEN
                │
                └── DRIVE PUBLISHER
                    Drive Distributor
                        │
                        ▼
                   Google Drive
```

---

## 43. Décision de réutilisation par projet

### PédagoLab

| Élément | Décision |
|---|---|
| Univers / gameplay | **GARDER** |
| CODE//STATION complet | **GARDER / ENCAPSULER** |
| BUNKER / ROCKET / INFILTRATION / ASSAULT | **GARDER** |
| Missions et scénarios | **MIGRER vers catalogue EDEN** |
| Validateurs | **GARDER puis isoler** |
| Déblocages | **GARDER comme règles de jeu** |
| Override professeur | **GARDER** |
| Événements / preuves jeu | **GARDER et normaliser** |
| Comptes | **REMPLACER par EDEN** |
| Référentiel interne | **REMPLACER par EDEN Core** |
| Cartographie / remédiation | **REMPLACER par EDEN Core** |
| `student_progress` blob | **MIGRER vers tables normalisées** |
| Dashboard professeur PédagoLab | **NE PAS conserver comme source principale** |

### Drive Distributor

| Élément | Décision |
|---|---|
| Connexion Google Drive | **GARDER** |
| Shared Drives | **GARDER** |
| Workspace impersonation | **GARDER** |
| Découverte élèves | **GARDER** |
| Navigation dossiers | **GARDER** |
| Raccourcis Drive | **GARDER** |
| Création dossiers manquants | **GARDER** |
| Upload multi-fichiers | **GARDER** |
| Distribution sélective / tous | **GARDER** |
| Skip doublons | **GARDER** |
| Rapport par élève | **GARDER** |
| Collecte des rendus | **OPTIONNEL / PHASE SUIVANTE** |
| UI indépendante Drive Distributor | **REMPLACER par écran EDEN** |
| mot de passe `APP_PASSWORD` | **REMPLACER par auth EDEN** |
| transit 4 Mo via Function | **REMPLACER par upload backend/résumable** |

---

## 44. Nouvelle roadmap de migration

### Étape A — figer les briques réutilisables

- inventorier tous les mondes PédagoLab ;
- inventorier missions et validateurs ;
- figer les tests de non-régression jeu ;
- isoler les helpers Google Drive ;
- figer les tests Drive existants.

### Étape B — EDEN Core

- importer référentiel et planification ;
- créer utilisateurs / classes ;
- créer séances / preuves / ressources ;
- mettre en place le versioning.

### Étape C — brancher PédagoLab

- EDEN gère l’auth ;
- route `/play/...` ;
- `GameBridge` ;
- persistance EDEN ;
- missions existantes inchangées fonctionnellement.

### Étape D — brancher Drive Publisher

- réutiliser les helpers Google Drive ;
- intégrer les écrans dans l’espace professeur ;
- brancher les artefacts du Corpus Compiler ;
- supprimer la limite 4 Mo.

### Étape E — connecter la boucle complète

```text
Teacher Twin
→ DailyLessonSpec
→ Lesson Runtime
→ PédagoLab
→ Evidence Engine
→ Correction
→ Remédiation
→ Corpus
→ Drive
```

---

## 45. Invariant supplémentaire

Deux règles sont ajoutées aux décisions d’architecture :

11. **Ne pas réécrire les jeux PédagoLab fonctionnels pour la V1.** Les encapsuler, les tester, puis les extraire progressivement.

12. **Ne pas réécrire la couche Google Drive fonctionnelle.** Réutiliser ses primitives d’accès, de découverte, de création et d’upload, mais remplacer son UI, son auth et la limite de transit Vercel par l’infrastructure EDEN.


