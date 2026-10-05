# BCT01 — Qualité, documentation et autonomie technique (compétence transverse)

## Objectif du socle

Exploiter la documentation existante.
Produire un code lisible, maintenable et documenté.

Source : `content/source/referentiel-original.md`. Les textes source sont distingués des propositions pédagogiques. Guide professeur, cours introductifs et dossiers de TP ; ce n’est pas une validation de compétence.

---

## BCT01-C1-1 — Rédiger une documentation de projet

### README RESCUE // Un inconnu doit démarrer

**Typologie et niveau source :** Savoir-faire technique · A2

**Outils source :** Markdown

### Situation d’entrée

Le dépôt marche uniquement sur le poste de son auteur. Écris un README permettant à un autre agent de lancer la mission.

### Cours d’introduction proposé

Une documentation de projet explique objectif, prérequis, installation, configuration, lancement, tests et limites. Les commandes doivent être exécutables dans un ordre compréhensible et préciser le dossier attendu. Markdown structure titres, listes, liens et blocs de code.

Les secrets ne sont pas des exemples à publier : donne des noms de variables et des valeurs fictives. Indique versions et erreurs connues, puis fais tester le README par une personne qui n’a pas assisté au développement. Une documentation est un livrable maintenu avec le code, pas une décoration écrite après coup.

### Exemple

```text
# NEXUS
## Prérequis
## Installation
## Configuration sans secrets
## Lancement
## Tests
## Limites et dépannage
```

### Production

Rédige le README du TP et fais réaliser un démarrage à froid par ton binôme sans explication orale supplémentaire.

Mode : Production et observation humaine

### Critères proposés

- README versionné
- commandes testées
- prérequis
- retour du lecteur et correction

### Transfert individuel

Une dépendance change de version et modifie une commande. Quelles parties du README et des tests revois-tu ?

### Jeu d’amorce — questions et correction professeur

Le meilleur contrôle d’un guide de démarrage est…

Attendu : Un essai par un lecteur indépendant

Le guide doit fonctionner sans contexte caché.

Un mot de passe réel appartient-il au README ?

Attendu : Non

La documentation explique la configuration sans exposer les accès.

### Notions du socle (texte source, ligne 253)

README, documentation de projet (lien BC10)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT01-C1-2 — Documenter une API et commenter son code

### API MANUAL // Un contrat lisible

**Typologie et niveau source :** Savoir-faire technique · A2

**Outils source :** Markdown, PHP, JS

### Situation d’entrée

L’équipe frontend connaît l’URL mais ignore les champs et erreurs. Documente l’API et explique les décisions non évidentes du code.

### Cours d’introduction proposé

Documenter une API demande méthode, route, paramètres, corps, authentification, réponses et cas d’erreur. Les exemples utilisent des données fictives et correspondent au comportement testé. Indique champs requis, types et règles utiles à un consommateur.

Un commentaire de code explique surtout une intention, une contrainte ou un choix non évident ; il ne doit pas répéter chaque instruction. Les commentaires PHP et JavaScript respectent la langue attendue dans le projet. Une documentation incorrecte peut tromper davantage qu’une absence : relie-la aux tests et actualise-la avec les changements.

### Exemple

```text
POST /alertes ; corps {secteur, message} ; succès 201 + id ; invalidité 422 selon ce contrat de TP ; exemples et limites. Commentaire : pourquoi une valeur est bornée.
```

### Production

Documente deux routes du TP et ajoute deux commentaires utiles, puis fais reproduire un appel depuis cette seule documentation.

Mode : Production et observation humaine

### Critères proposés

- Contrat complet
- exemples exécutés
- erreurs
- commentaires sur intention
- langue cohérente

### Transfert individuel

Le backend change un champ requis sans mettre à jour le guide. Quel type de test peut signaler la divergence ?

### Jeu d’amorce — questions et correction professeur

Un commentaire utile explique souvent…

Attendu : Pourquoi une contrainte existe

Il donne un contexte que le code seul ne rend pas évident.

La documentation d’API doit inclure…

Attendu : Les erreurs et les types, pas seulement le succès

Le client doit savoir interpréter les différents résultats.

### Notions du socle (texte source, ligne 254)

Documentation d'API (lien BC07)
Commentaires PHP + JS rédigés dans la langue attendue

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT01-C1-3 — Rechercher une information dans une documentation technique

### DOC NAVIGATOR // Lire la bonne page

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Une réponse de forum utilise une option inexistante dans ta version. Retrouve la documentation et interprète son exemple.

### Cours d’introduction proposé

Chercher dans une documentation commence par identifier le produit, la version et la question précise. Utilise sommaire, recherche, références et liens connexes. Une page d’introduction explique l’usage général ; une référence précise les paramètres, valeurs et erreurs.

Lis les prérequis et le contexte de l’exemple : ce qui est fourni n’est pas toujours un programme complet. Teste une adaptation minimale, note attendu et obtenu, puis conserve la référence utilisée. Une absence de résultat peut signaler un mauvais terme de recherche ou une fonction différente selon la version.

### Exemple

```text
Question : que renvoie Array.find sans correspondance ? Chercher la référence, lire le retour, tester un tableau vide puis gérer undefined.
```

### Production

Trouve une réponse dans une documentation primaire, cite la section et adapte un exemple au TP.

Mode : Production et observation humaine

### Critères proposés

- Question précise
- version
- section retrouvée
- exemple compris et testé

### Transfert individuel

L’exemple dépend d’une variable définie plus haut dans la page. Comment retrouves-tu le contexte manquant ?

### Jeu d’amorce — questions et correction professeur

Avant d’adapter un exemple, lire…

Attendu : Son contexte, ses paramètres et le résultat attendu

Un extrait n’est pas nécessairement autonome.

Une option manque dans ta version. Que faire ?

Attendu : Consulter la documentation correspondante

La version fait partie de la question technique.

### Notions du socle (texte source, ligne 255)

> Navigation dans une documentation
> Recherche d'information
> Interprétation d'exemple

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT01-C1-4 — Exploiter une documentation pour installer ou utiliser un outil

### INSTALL GUIDE // Exécuter sans deviner

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Le guide suppose un runtime absent et un dossier déjà créé. Reconstruis les prérequis avant de lancer la commande suivante.

### Cours d’introduction proposé

Exploiter une documentation d’installation demande de repérer système, version, dépendances, droits et commandes. Distingue une commande à lancer d’un exemple de sortie. Vérifie chaque étape avant de poursuivre ; un échec initial peut expliquer les erreurs suivantes.

Lis le message d’erreur et cherche la section pertinente plutôt que de modifier des paramètres au hasard. Ne copie pas une commande demandant des privilèges élevés sans comprendre son effet et son origine. Conserve un journal des adaptations au poste utilisé et vérifie le résultat réel avec une commande de version ou un petit lancement.

### Exemple

```text
Guide : prérequis Node → vérifier node -v → ouvrir le dossier projet → lire package.json → lancer le script prévu → vérifier le service.
```

### Production

Fais fonctionner un petit dépôt inconnu à partir de son guide et corrige une erreur de prérequis préparée.

Mode : Production et observation humaine

### Critères proposés

- Guide suivi
- prérequis identifiés
- erreur diagnostiquée
- résultat réel
- adaptations documentées

### Transfert individuel

Le guide utilise apt mais ton poste utilise dnf. Comment trouves-tu l’équivalent sans supposer les mêmes noms de paquets ?

### Jeu d’amorce — questions et correction professeur

Une étape d’installation échoue. Faut-il enchaîner toutes les suivantes ?

Attendu : Non, comprendre l’échec et son effet

Les étapes suivantes peuvent dépendre du résultat manquant.

Un guide vise un autre OS. Il faut…

Attendu : Vérifier les instructions adaptées à son environnement

Le contexte technique doit correspondre aux commandes.

### Notions du socle (texte source, ligne 256)

> Suivre un guide d'installation
> identifier les prérequis
> Résoudre un problème simple à partir de la documentation

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT01-C2-1 — Refactoriser et améliorer la qualité du code

### CLEAN PATCH // Améliorer sans changer le contrat

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** IDE

### Situation d’entrée

La fonction marche pour les cas attendus, mais elle est dupliquée et illisible. Refactorise en conservant le comportement.

### Cours d’introduction proposé

Refactoriser améliore la structure interne sans changer le comportement attendu. Nommage, petites responsabilités, suppression de duplication et conventions cohérentes facilitent lecture et maintenance. Corriger un bug et ajouter une fonctionnalité changent le comportement ; il faut distinguer ces opérations dans la trace.

Commence par exécuter les tests existants. Modifie progressivement, relance puis lis le diff. Un code plus court n’est pas automatiquement meilleur : la lisibilité et la clarté du contrat priment. Documente les choix utiles et les cas que les tests ne couvrent pas encore.

### Exemple

```text
Avant : function f(x){return x.a-x.b<0?0:x.a-x.b;}
Après : function energieRestante({energie, cout}) { return Math.max(0, energie - cout); }
Attention : adapter les noms suppose un contrat d’entrée explicitement décidé.
```

### Production

Refactorise la fonction du laboratoire sans modifier son contrat d’entrée et de sortie ; sépare tout correctif fonctionnel.

Mode : Atelier navigateur + vérifications manuelles

### Critères proposés

- Tests avant/après
- diff
- nommage
- duplication réduite
- comportement conservé

### Transfert individuel

Une simplification change le traitement du zéro. Comment détectes-tu et qualifies-tu cette modification ?

### Jeu d’amorce — questions et correction professeur

Refactoriser signifie principalement…

Attendu : Changer la structure en préservant le comportement attendu

Les modifications de contrat doivent être distinctes et testées.

Avant le changement, lancer les tests sert à…

Attendu : Connaître l’état de départ

La référence initiale permet de repérer une régression.

### Notions du socle (texte source, ligne 257)

Maintenabilité, lisibilité, conventions de code
Reprendre un développement existant avec bugs à corriger et fonctionnalités à intégrer

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.