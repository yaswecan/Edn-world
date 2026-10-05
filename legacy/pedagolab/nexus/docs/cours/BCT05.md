# BCT05 — IA comme assistant de développement (compétence transverse)

## Objectif du socle

Utiliser les outils d'IA comme assistants professionnels de manière critique et tracée. 

Comprendre
↓
Questionner
↓
Vérifier
↓
Corriger
↓
Décider

Source : `content/source/referentiel-original.md`. Les textes source sont distingués des propositions pédagogiques. Guide professeur, cours introductifs et dossiers de TP ; ce n’est pas une validation de compétence.

---

## BCT05-C1-1 — C'est quoi l'IA et les types d'IA

### ORACLE LIMITS // Une réponse plausible

**Typologie et niveau source :** Savoir · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

L’oracle du laboratoire invente une méthode JavaScript et cite une page inexistante. Distingue production plausible et connaissance vérifiée.

### Cours d’introduction proposé

L’IA regroupe différentes approches et usages. Un système de classification peut attribuer une catégorie ; un système génératif produit du contenu. Un modèle de langage apprend des régularités à partir de données d’entraînement et génère une suite de tokens selon son contexte. Cette capacité ne garantit pas la vérité d’une réponse.

Une hallucination est une production incorrecte ou inventée présentée de manière plausible. Le modèle peut manquer de contexte, confondre des versions ou reproduire des biais. Des outils de recherche peuvent apporter des sources, mais celles-ci doivent être contrôlées. Distingue le modèle, l’application qui l’utilise et les outils auxquels elle a accès. Une simulation pédagogique à réponses préparées n’est pas un modèle génératif.

### Exemple

```text
Affirmation à vérifier : « Array.secureSort() fait partie du JavaScript standard ». Chercher la méthode dans la documentation avant de l’utiliser.
```

### Production

Classe des usages d’IA puis vérifie deux affirmations préparées par le professeur. Identifie ce que l’outil sait réellement consulter.

Mode : Production et observation humaine

### Critères proposés

- Types d’usage
- modèle/application/outils distingués
- affirmations vérifiées
- limites expliquées

### Transfert individuel

Une réponse est très détaillée et confiante mais sans source vérifiable. Que conclus-tu ?

### Jeu d’amorce — questions et correction professeur

Une réponse fluide constitue…

Attendu : Une sortie à vérifier, pas une preuve

La plausibilité n’établit pas l’exactitude.

Un quiz à réponses préparées est-il un LLM ?

Attendu : Non, c’est une simulation déterministe

Le mécanisme réel doit être annoncé.

### Notions du socle (texte source, ligne 329)

IA générative
modèle de langage
prédiction statistique
données d'entraînement
limites des modèles
hallucinations

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT05-C2-1 — Formuler une demande efficace

### PROMPT FORGE // Définir le contrat

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Outils IA générative

### Situation d’entrée

La demande « fais un site sécurisé » produit une réponse inutilisable. Écris un contrat de tâche contrôlable plutôt qu’une formule magique.

### Cours d’introduction proposé

Une demande utile précise le but, le contexte nécessaire, les contraintes, les données disponibles et la forme attendue. Indique ce qui est déjà connu, ce qui manque et comment tu vérifieras le résultat. Un exemple d’entrée/sortie aide à lever une ambiguïté, sans remplacer les règles métier.

Évite d’envoyer des secrets ou des données personnelles non autorisées. Après la réponse, compare au contrat, relève les écarts et reformule un point précis. L’itération doit réduire une ambiguïté ou corriger un défaut ; allonger le prompt n’améliore pas automatiquement le résultat. Conserve la demande et les vérifications. Ici, le jeu utilise des réponses préparées ; l’usage réel d’un outil se fait seulement dans le cadre autorisé par le professeur.

### Exemple

```text
Tâche : expliquer une fonction JS à un débutant. Contraintes : aucun framework, distinguer paramètres/retour, fournir un exemple testé, signaler les incertitudes.
```

### Production

Rédige un prompt pour une tâche de TP, applique la grille de précision, puis améliore-le après une réponse de simulation. Pour l’usage réel, utilise un outil approuvé.

Mode : Production et observation humaine

### Critères proposés

- Prompt initial
- contexte utile
- contraintes
- données retirées
- retour critiqué
- itération motivée

### Transfert individuel

L’IA respecte le format mais ignore un cas limite. Quelle précision ajoutes-tu ?

### Jeu d’amorce — questions et correction professeur

Une demande précise doit inclure…

Attendu : Un objectif et des critères de vérification

Les critères rendent la sortie contrôlable.

Une bonne itération…

Attendu : Cible un écart constaté

Elle répond à une observation concrète.

### Notions du socle (texte source, ligne 330)

prompt
contexte
précision
reformulation
itération

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT05-C2-2 — Utiliser une IA pour assister une tâche technique

### ASSIST, NOT REPLACE // Garder la main

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Copilot / ChatGPT / Claude

### Situation d’entrée

L’assistant propose un composant que personne dans l’équipe ne sait expliquer. Décide quelle aide demander et quelle part conserver sous contrôle.

### Cours d’introduction proposé

Une IA peut assister la compréhension d’un code, la rédaction de documentation ou la proposition d’un correctif. Commence par définir la tâche que tu gardes sous ta responsabilité et les critères que tu peux vérifier. Fournis seulement les informations autorisées et nécessaires.

Lis les modifications, exécute les tests et compare à la documentation. Ne présente pas une sortie non vérifiée comme un travail maîtrisé. Pour apprendre, demande un indice, une explication ou un contre-exemple avant une solution complète ; reconstruis ensuite une petite partie sans aide. Conserve une trace de l’outil, de la date, du prompt, de la sortie utilisée et de tes corrections. Le professeur décide du périmètre d’autorisation de l’IA.

### Exemple

```text
Journal : outil/version affichée, tâche, prompt expurgé, extrait utilisé, tests, corrections personnelles, décision finale.
```

### Production

Avec un outil autorisé, demande une aide limitée sur ton TP puis teste, corrige et explique le résultat. Sans accès autorisé, utilise la sortie fournie comme entraînement, sans revendiquer l’usage réel.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Outil réellement utilisé ou simulation déclarée
- prompt
- sortie
- tests
- corrections
- explication autonome

### Transfert individuel

L’outil est indisponible pendant l’évaluation. Quelle partie sais-tu refaire et expliquer sans lui ?

### Jeu d’amorce — questions et correction professeur

Avant d’intégrer une sortie, tu…

Attendu : La lis et vérifies son comportement

Tu conserves la décision et la responsabilité techniques.

Une simulation hors ligne démontre-t-elle l’usage réel de Copilot ?

Attendu : Non, elle prépare cet usage

La nature de la preuve doit rester exacte.

### Notions du socle (texte source, ligne 331)

génération de code
aide à la documentation
aide à la recherche d'information
aide à la compréhension d'un code existant

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT05-C3-1 — Vérifier les informations produites

### SOURCE CHECK // La citation fantôme

**Typologie et niveau source :** Savoir-faire méthologique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Une réponse affirme qu’une bibliothèque accepte un paramètre absent de sa documentation. Deux blogs se recopient. Trouve une preuve indépendante.

### Cours d’introduction proposé

Vérifier une information consiste à revenir à une source identifiable et pertinente pour l’affirmation. Pour une API, privilégie la documentation correspondant à la version utilisée et un essai minimal reproductible. Une citation doit réellement soutenir ce qui est affirmé ; un lien existant peut être hors sujet.

Distingue source primaire, analyse, opinion et promotion. Compare les dates, versions et conditions. Deux pages reprenant la même annonce ne sont pas deux confirmations indépendantes. Si la preuve manque, marque l’affirmation comme non vérifiée et limite son usage. Conserve une trace brève : affirmation, source, passage utile, test, conclusion et incertitude.

### Exemple

```text
Affirmation → documentation de version → exemple minimal → résultat observé → confirmé / infirmé / non vérifié.
```

### Production

Vérifie trois affirmations de l’oracle : une exacte, une fausse, une invérifiable avec les sources fournies. Documente ta conclusion sans forcer un verdict.

Mode : Production et observation humaine

### Critères proposés

- Affirmations isolées
- sources identifiées
- pertinence
- essais
- conclusions et incertitudes

### Transfert individuel

La documentation actuelle confirme la réponse, mais le projet utilise une ancienne version. Quelle vérification manque ?

### Jeu d’amorce — questions et correction professeur

Une source utile doit…

Attendu : Soutenir précisément l’affirmation et la version

La pertinence est aussi importante que l’existence du lien.

Sans preuve suffisante, tu marques…

Attendu : Non vérifié

L’incertitude n’est ni une confirmation ni une réfutation.

### Notions du socle (texte source, ligne 332)

vérification des sources
validation des informations
détection d'erreurs
esprit critique

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT05-C3-2 — Auditer et corriger un code généré

### AI PATCH AUDIT // Le tri trompeur

**Typologie et niveau source :** Savoir-faire méthologique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Une sortie présentée comme « optimisée » trie les niveaux 2, 10, 3 dans le mauvais ordre. Lis la proposition, teste un contre-exemple et corrige.

### Cours d’introduction proposé

Un code généré se relit comme toute contribution : contrat d’entrée/sortie, hypothèses, erreurs, effets de bord, sécurité et lisibilité. Un exemple favorable ne suffit pas. Cherche des cas limites qui distinguent le comportement voulu d’une solution seulement plausible.

En JavaScript, sort() sans comparateur trie selon des représentations textuelles et modifie le tableau. Pour un tri numérique croissant sans modifier l’entrée, copie le tableau et donne un comparateur numérique. La correction doit être comprise, pas simplement redemandée à une autre IA. Exécute les tests fournis, explique le bug et consigne les modifications. D’autres types de données demandent un contrat explicite.

### Exemple

```text
const copie = [...input.niveaux];
return copie.sort((a, b) => a - b);
```

### Production

Corrige main(input) pour renvoyer les niveaux numériques triés par ordre croissant. Vérifie les doublons, les nombres négatifs et la liste vide.

Mode : Atelier navigateur + vérifications manuelles

### Critères proposés

- Code avant/après
- contre-exemple
- tests
- explication du comparateur
- entrée non modifiée

### Transfert individuel

L’entrée contient maintenant des nombres sous forme de texte et des valeurs invalides. Quel contrat faut-il clarifier avant de corriger ?

### Jeu d’amorce — questions et correction professeur

Sans comparateur numérique, sort()…

Attendu : Peut produire un ordre textuel inadapté

Le comportement par défaut n’est pas un tri numérique général.

Pour auditer une sortie IA, tu privilégies…

Attendu : Des contre-exemples et tests liés au contrat

Le comportement observé doit soutenir la décision.

### Notions du socle (texte source, ligne 333)

lecture de code
compréhension d'un code non écrit par soi-même
détection de bugs
correction
amélioration

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT05-C3-3 — Identifier les limites d'une solution proposée par une IA

### ALTERNATIVE ROUTE // Une solution n’est pas la solution

**Typologie et niveau source :** Savoir-faire méthologique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

L’oracle conseille un framework complet pour afficher trois cartes statiques. Compare sa proposition à une solution plus simple.

### Cours d’introduction proposé

Une proposition technique dépend d’hypothèses : volume, équipe, maintenance, sécurité, budget et usages. Énonce ces hypothèses avant de comparer des solutions. Une technologie populaire peut être inutile pour un petit besoin, tandis qu’une solution simple peut devenir insuffisante dans un autre contexte.

Cherche les limites de la réponse : règle métier oubliée, environnement incompatible, coût non évalué, dépendance inutile, résultat non accessible. Construis au moins une alternative et compare avec les mêmes critères. La décision ne consiste pas à refuser systématiquement l’IA, mais à accepter, modifier ou rejeter une proposition avec des raisons vérifiables. Note les points restant incertains.

### Exemple

```text
Comparaison : HTML/CSS statique vs framework. Critères : besoin, interaction, compétences, maintenance, dépendances, performances et accessibilité.
```

### Production

Écris une courte décision d’architecture avec deux alternatives et un prototype minimal vérifiant le point le plus incertain.

Mode : Production et observation humaine

### Critères proposés

- Hypothèses
- critères communs
- alternatives
- essai ciblé
- décision et limites

### Transfert individuel

Le besoin devient collaboratif et nécessite des mises à jour fréquentes. Quel élément de ta décision réexamines-tu ?

### Jeu d’amorce — questions et correction professeur

Comparer deux solutions exige…

Attendu : Les mêmes critères et hypothèses

Les compromis ne se lisent qu’à besoin comparable.

Une bonne décision peut…

Attendu : Changer si les hypothèses changent

La décision est contextualisée et révisable.

### Notions du socle (texte source, ligne 334)

> erreurs de raisonnement
> solutions alternatives
> remise en question

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT05-C4-1 — Utiliser l'IA dans le respect du cadre pédagogique et professionnel

### AI RULES // Le laboratoire responsable

**Typologie et niveau source :** Savoir-être · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Un prompt contient les noms et difficultés des élèves ainsi qu’une clé API. Prépare une version sûre et un registre d’usage avant toute demande.

### Cours d’introduction proposé

L’usage professionnel de l’IA exige de connaître le cadre applicable et les règles de l’établissement. L’AI Act encadre des usages et acteurs ; ses obligations dépendent du contexte et de dispositions susceptibles d’évoluer. Consulte les sources officielles datées et ne transforme pas ce cours en avis juridique ou certificat de conformité.

Ne transmets pas de secrets ni de données personnelles sans cadre autorisé. Remplace les exemples par des données fictives, respecte les droits sur les contenus et déclare l’assistance reçue. Documente ce que tu as vérifié et corrigé. Le professeur conserve les décisions pédagogiques ; l’outil ne doit pas profiler les élèves à partir de caractéristiques sensibles. Compare aussi l’aide immédiate à ce que tu peux expliquer et refaire seul.

### Exemple

```text
Prompt expurgé : « Voici un exemple fictif sans nom ni secret. Explique l’erreur de cette fonction. » Journal : usage autorisé, sources, tests, décision humaine.
```

### Production

Classe les informations d’un prompt fictif, retire les éléments sensibles et produis une charte de travail courte avec sources officielles et date de consultation.

Mode : Production et observation humaine

### Critères proposés

- Prompt expurgé
- cadre pédagogique
- sources officielles datées
- transparence
- droits et confidentialité
- limites

### Transfert individuel

Un outil annonce une nouvelle politique de conservation. Que vérifies-tu avant de réutiliser les données du projet ?

### Jeu d’amorce — questions et correction professeur

Une clé API doit être…

Attendu : Retirée du prompt et traitée comme un secret

La confidentialité s’applique aussi à l’assistance IA.

Une fiche pédagogique sur l’AI Act…

Attendu : Ne prouve pas à elle seule la conformité d’un usage

L’application du cadre dépend du contexte et des sources à jour.

### Notions du socle (texte source, ligne 335)

> Connaître l'IA Act
> transparence d'usage
> confidentialité / protection des données
> propriété intellectuelle
> impact de l'IA sur l'apprentissage

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BTC05-C4-2 — Prendre en compte les biais et les effets discriminatoire de l'IA

### BIAS RADAR // Le critère caché

**Typologie et niveau source :** Savoir-être · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Deux profils fictifs ont les mêmes compétences, mais le système change sa recommandation quand seul un indice d’origine sociale est modifié.

### Cours d’introduction proposé

Un biais peut venir des données, des étiquettes, des objectifs, des choix de mesure ou du contexte d’utilisation. Une sortie peut reproduire ou amplifier des inégalités. L’absence d’un attribut sensible explicite n’exclut pas des variables qui lui sont liées.

Pour enquêter, utilise des exemples fictifs comparables, définis le résultat attendu et documente ce qui change. Un écart isolé ne suffit pas à établir toutes les causes : formule une hypothèse et élargis la vérification avec un protocole pertinent. N’utilise pas les élèves réels comme profils à classer et ne reproduis pas de stéréotypes. Propose une réduction du risque, une supervision humaine et les limites de ta conclusion. Code source conservé : BTC05-C4-2, alias BCT05-C4-2 proposé.

### Exemple

```text
Paire fictive A/B : mêmes compétences, expériences et tâche ; un indice non pertinent varie. Comparer la recommandation et demander une justification contrôlable.
```

### Production

Analyse un jeu fictif de décisions fourni par le professeur, relève une différence injustifiée et propose un test complémentaire et une mesure de prévention.

Mode : Production et observation humaine

### Critères proposés

- Données fictives
- comparaison contrôlée
- hypothèse
- limites
- prévention
- décision humaine

### Transfert individuel

Supprimer la colonne sensible suffit-il si une autre variable sert de proxy ? Explique ce que tu testes.

### Jeu d’amorce — questions et correction professeur

Ne pas inclure un attribut sensible…

Attendu : Ne garantit pas l’absence de biais

Des variables liées et le contexte peuvent maintenir le risque.

Pour ce TP, les profils doivent être…

Attendu : Fictifs et construits pour une comparaison contrôlée

Le but est d’étudier un mécanisme sans exposer de personnes.

### Notions du socle (texte source, ligne 336)

> type de biais 
> effet discriminatoire (exemple les castes)
> esprit critique

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.