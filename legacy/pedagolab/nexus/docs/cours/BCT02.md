# BCT02 — Tests, débogage et résolution de problèmes (compétence transverse)

## Objectif du socle

Garantir le bon fonctionnement d'une application par une démarche de résolution de problèmes et de test systématique.

Source : `content/source/referentiel-original.md`. Les textes source sont distingués des propositions pédagogiques. Guide professeur, cours introductifs et dossiers de TP ; ce n’est pas une validation de compétence.

---

## BCT02-C1-1 — Structurer sa démarche de stratégie de débogage

### DEBUG METHOD // Une hypothèse à la fois

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

La console tombe en panne et l’équipe veut modifier trois fichiers ensemble. Organise l’enquête pour savoir quelle correction agit.

### Cours d’introduction proposé

Déboguer suit une démarche explicite : observer, formuler une hypothèse, isoler, vérifier puis corriger. Décris attendu et obtenu avec des étapes reproductibles. Réduis le problème sans perdre le symptôme et collecte la trace qui départage les hypothèses.

Modifier plusieurs choses à la fois rend la cause difficile à identifier. Une hypothèse fausse peut être utile si le test l’écarte clairement. Après correction, relance le scénario original et des cas voisins. La méthode s’applique au code, à la configuration et à l’environnement ; elle ne se résume pas à cliquer sur un bouton de débogage.

### Exemple

```text
Observation : zéro devient 10. Hypothèse : || utilise une valeur par défaut pour zéro. Test : comparer 0, 1 et absence. Correction : traiter explicitement le cas absent.
```

### Production

Résous le bug du TP en remplissant le journal de cinq étapes, y compris un test qui pourrait contredire ton hypothèse.

Mode : Production et observation humaine

### Critères proposés

- Reproduction
- hypothèse
- isolation
- observation du test
- correction et régression

### Transfert individuel

Le bug disparaît dès que tu ajoutes un affichage. Comment éviter de conclure trop vite ?

### Jeu d’amorce — questions et correction professeur

Modifier trois causes possibles en même temps rend…

Attendu : L’interprétation du résultat plus difficile

On cherche à relier un changement à une observation.

Une hypothèse infirmée est…

Attendu : Une information utile si le test est clair

L’enquête progresse aussi par élimination argumentée.

### Notions du socle (texte source, ligne 272)

Démarche : 
1. observer le bug
2. formuler une hypothèse 
3. isoler la cause
4. vérifier
5. corriger 

Méthode appliquée au code, à la configuration et à l'environnement

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C1-2 — Identifier un problème technique rencontré

### ERROR DECODER // Le message est un indice

**Typologie et niveau source :** Savoir-faire méthodologique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Trois erreurs arrivent : commande introuvable, accès refusé et propriété absente. Ne leur applique pas la même recette.

### Cours d’introduction proposé

Identifier un problème demande de lire le message exact, le contexte et le moment où il apparaît. Une commande introuvable concerne disponibilité ou chemin d’exécution ; un accès refusé suggère des permissions ou une authentification selon le contexte ; une propriété absente peut venir des données ou du code.

Le message indique une piste, pas toujours la cause finale. Cherche sa documentation, reproduis et utilise un outil d’observation adapté. Note les versions, commandes ou actions nécessaires sans enregistrer de secrets. Demander de l’aide avec un cas minimal et les essais déjà faits permet une réponse plus utile.

### Exemple

```text
Rapport minimal : environnement ; action ; attendu ; message exact ; observation ; hypothèse ; essai effectué.
```

### Production

Classe les erreurs fictives puis reproduis un problème de TP et fournis un rapport exploitable.

Mode : Production et observation humaine

### Critères proposés

- Message exact
- contexte
- outil choisi
- origine justifiée et non devinée

### Transfert individuel

Deux erreurs différentes apparaissent après la même modification. Comment cherches-tu une cause commune ?

### Jeu d’amorce — questions et correction professeur

« Ça ne marche pas » doit être complété par…

Attendu : Étapes, message et résultat attendu

Le contexte rend le problème reproductible.

Un message d’erreur prouve-t-il toujours la cause racine ?

Attendu : Non, il fournit une observation à interpréter

Une chaîne de dépendances peut produire un symptôme éloigné de la cause.

### Notions du socle (texte source, ligne 273)

> Rechercher et comprendre l'origine des messages d'erreurs les plus courants
> Manipuler un outils de débogage

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C2-1 — Connaître les différents types de recette et tests

### TEST SCOPE // Choisir la bonne vérification

**Typologie et niveau source :** Savoir · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Un test de fonction passe, mais le parcours de signalement échoue. Identifie ce que chaque type de test peut réellement démontrer.

### Cours d’introduction proposé

Un test unitaire cible un comportement limité ; un test d’intégration vérifie plusieurs composants ; un test de charge observe une sollicitation définie. La recette fonctionnelle confronte le produit aux besoins et critères. Aucun type ne remplace tous les autres.

Un plan précise cas, données, étapes, résultat attendu et criticité. Le ticket trace un défaut ; le procès-verbal de validation synthétise le périmètre vérifié et les réserves. Une criticité dépend de l’impact et du contexte, pas seulement de la facilité de correction. Ne présente pas un échantillon de tests comme une garantie universelle.

### Exemple

```text
Calcul d’énergie → unitaire. Route + stockage → intégration. Parcours habitant → recette fonctionnelle. Requêtes simultanées contrôlées → charge sur labo autorisé.
```

### Production

Associe les risques à des tests et rédige un petit plan avec un cas critique et une réserve.

Mode : Production et observation humaine

### Critères proposés

- Types distingués
- plan
- criticité argumentée
- limites et réserves

### Transfert individuel

Un test de charge réussit mais le bouton ne fonctionne pas au clavier. Quel périmètre n’a pas été vérifié ?

### Jeu d’amorce — questions et correction professeur

Tester seulement une fonction couvre-t-il son câblage au frontend ?

Attendu : Non

La portée de chaque test doit être explicitée.

La criticité d’un défaut dépend surtout…

Attendu : De son impact dans le contexte d’usage

Un défaut court à décrire peut avoir un impact important.

### Notions du socle (texte source, ligne 274)

> Connaître les différents types de recette 
> Recette fonctionnelle 
> Tests techniques 
> types (intégration, montée de charge, unitaire), criticité, PV de validation, tickets

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C2-2 — Contrôle de l'aspect fonctionnel du produit en suivant le plan de recette

### ACCEPTANCE RUN // Suivre le plan

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Le plan prévoit vide, erreur et succès, mais l’équipe coche tout après un seul essai. Rejoue les étapes et conserve les résultats réels.

### Cours d’introduction proposé

Une recette fonctionnelle suit les critères et scénarios convenus. Pour chaque cas, prépare l’état initial et les données, réalise les étapes puis compare attendu et obtenu. Note réussite, échec ou impossibilité de test, sans transformer un cas non exécuté en succès.

Les écarts deviennent des tickets avec preuve utile. Une correction doit être retestée et les cas voisins peuvent nécessiter une régression. La validation finale précise la version et les réserves. L’objectif est un contrôle reproductible du besoin, pas une série de coches sans observation.

### Exemple

```text
R1 formulaire vide → erreur associée. R2 envoi interrompu → texte conservé. R3 succès → référence affichée. Chaque ligne reçoit date, version et constat.
```

### Production

Exécute le plan du TP, ouvre un ticket pour un écart et reteste après correction.

Mode : Production et observation humaine

### Critères proposés

- Plan renseigné
- résultats exacts
- version
- ticket
- retest

### Transfert individuel

Un service externe empêche d’exécuter un cas. Quel statut utilises-tu plutôt que « réussi » ?

### Jeu d’amorce — questions et correction professeur

Un cas non exécuté doit être noté…

Attendu : Non testé ou bloqué avec sa raison

La trace doit représenter les actions réellement réalisées.

Après un correctif, il faut…

Attendu : Retester le cas et les comportements voisins utiles

La correction supposée doit être observée.

### Notions du socle (texte source, ligne 275)

> Suivre les étapes du plan de recette 
> Valider les fonctionnalités exprimées dans la tâche confiée et détaillées dans les spécifications

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C2-3 — Gérer le flux d'un ticket en tant que développeur

### TICKET FLOW // Du signalement à la vérification

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Le ticket est fermé dès que le code est poussé. Le bug demeure : reconstruis le flux et son critère de sortie.

### Cours d’introduction proposé

Un ticket décrit un travail ou un défaut avec contexte, étapes, attendu, obtenu et impact. La criticité aide à prioriser selon le besoin. Les états dépendent du processus d’équipe, mais doivent distinguer prise en charge, travail, vérification et clôture.

Un développeur clarifie les informations, signale un blocage et relie le changement à la demande. « Code écrit » n’est pas forcément « défaut vérifié ». La clôture doit suivre la règle convenue, avec version corrigée et preuve de retest. Évite les données sensibles dans les captures ou journaux joints.

### Exemple

```text
À qualifier → prêt → en cours → à vérifier → fermé. Variante : bloqué avec cause et responsable du déblocage.
```

### Production

Rédige un ticket à partir du bug fourni puis fais-le traverser le processus avec un binôme vérificateur.

Mode : Production et observation humaine

### Critères proposés

- Ticket reproductible
- criticité
- lien à la correction
- retest avant clôture

### Transfert individuel

Le défaut n’est pas reproductible sur le poste du relecteur. Quelles informations ajoutes-tu ?

### Jeu d’amorce — questions et correction professeur

Pousser du code suffit-il toujours à fermer le ticket ?

Attendu : Non, respecter le critère de vérification

La clôture doit refléter un résultat confirmé.

Un ticket bloqué doit porter…

Attendu : La cause et la prochaine action utile

Le blocage doit pouvoir être traité par l’équipe.

### Notions du socle (texte source, ligne 276)

> Comprendre les notions de criticité 
> Comprendre et gérer le flux d'un ticket en tant que développeur

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C3-1 — Exécuter des tests déjà fournis

### RED GREEN // Exécuter avant de conclure

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Tests fournis

### Situation d’entrée

Les tests sont fournis et l’un échoue. Ta mission n’est pas d’inventer une suite : exécute, lis l’échec puis vérifie ton correctif.

### Cours d’introduction proposé

Une suite fournie décrit des comportements attendus et compare les résultats. L’élève apprend d’abord à la lancer dans le bon environnement, lire un échec et retrouver le code concerné. Un test qui ne s’exécute pas n’est pas un test réussi.

Observe les données, le résultat attendu et obtenu. Corrige le programme sans changer arbitrairement le contrat, puis relance tous les tests. Distingue erreur d’installation de l’outil et échec d’une assertion. La réussite porte uniquement sur les cas exécutés ; elle ne prouve pas la compréhension individuelle, qui se vérifie aussi par une explication et un transfert.

### Exemple

```text
Cas fournis : coût inférieur, coût égal et coût supérieur à l’énergie. Attendu : jamais de résultat négatif.
```

### Production

Lance les tests de la fonction proposée, corrige le défaut puis explique un résultat ligne par ligne.

Mode : Atelier navigateur + vérifications manuelles

### Critères proposés

- Tests exécutés
- échec interprété
- correction
- suite relancée sans suppression de cas

### Transfert individuel

La commande ne trouve pas l’outil de test. Pourquoi ce message n’est-il pas une erreur de logique métier ?

### Jeu d’amorce — questions et correction professeur

Une suite qui ne démarre pas est…

Attendu : Un problème d’exécution à résoudre

Il faut distinguer outil indisponible et assertion en échec.

Pour rendre les tests verts, supprimer un cas gênant…

Attendu : Ne corrige pas le comportement

Le contrat de test ne doit pas être changé sans raison explicitement validée.

### Notions du socle (texte source, ligne 277)

Exécution de tests unitaires déjà fournis pour vérifier son code (A1 — l'élève n'écrit pas encore les tests)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C3-2 — Tester une API avec Postman

### API ASSERT // Vérifier la réponse entière

**Typologie et niveau source :** Savoir-faire technique · A2

**Outils source :** Postman

### Situation d’entrée

Le service renvoie le bon statut avec un mauvais type de données. Ajoute une lecture du corps au protocole de test Postman.

### Cours d’introduction proposé

Tester une API exige méthode, route, contexte d’authentification, données et attentes. Postman permet de conserver les requêtes et d’inspecter la réponse ; la collection rend les cas reproductibles. Vérifie statut, en-têtes utiles, structure et valeurs, pas seulement le fait d’avoir reçu quelque chose.

Utilise des variables de laboratoire et des jetons fictifs. Les cas négatifs vérifient absence, invalidité et droits selon le contrat. Une latence observée ne constitue pas un test de charge. Relie l’écart au ticket et garde l’export expurgé pour le retest.

### Exemple

```text
Attendu : 200 avec tableau d’alertes ; obtenu : 200 avec {error: ...}. Le statut seul masquerait la non-conformité.
```

### Production

Exécute la collection locale et rédige une observation pour un statut correct mais un corps erroné.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Collection
- résultats réels
- vérification de structure
- ticket et retest

### Transfert individuel

Le service renvoie une erreur HTML à la place du JSON attendu. Quels indices permettent de la détecter ?

### Jeu d’amorce — questions et correction professeur

Un 200 avec le mauvais corps est…

Attendu : Un écart au contrat

L’ensemble de la réponse doit être vérifié.

Un export Postman partagé doit exclure…

Attendu : Les secrets réels

La reproductibilité ne justifie pas l’exposition d’identifiants.

### Notions du socle (texte source, ligne 278)

Tests de routes, requêtes, réponses (lien BC07)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C4-1 — Déboguer du code

### BREAKPOINT // Regarder l’état exact

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** DevTools

### Situation d’entrée

Le total change à une ligne précise. Place un point d’arrêt plutôt que de lire cent messages ajoutés au hasard.

### Cours d’introduction proposé

Le débogueur suspend l’exécution pour inspecter variables et pile d’appels. Un breakpoint arrête à un endroit choisi ; les commandes pas à pas permettent d’observer l’évolution. La console aide à explorer des valeurs, mais une modification effectuée pendant le débogage ne corrige pas forcément le fichier source.

Prédis une valeur avant d’avancer, puis compare. Si la divergence apparaît plus tôt, déplace le point d’arrêt ou réduis le cas. Reprends l’exécution, corrige le fichier et relance normalement. La preuve attendue montre l’état fautif et l’état corrigé, pas seulement l’icône d’un breakpoint.

### Exemple

```text
Entrée energie="10" ; après +5 : "105". Le breakpoint permet de constater le type avant l’opération.
```

### Production

Dans DevTools du TP, inspecte le type fautif, corrige le fichier et reproduis sans intervention dans le débogueur.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Breakpoint réel
- valeurs et types
- cause
- code corrigé
- retest normal

### Transfert individuel

Le programme semble marcher seulement quand tu modifies une variable dans la console. Qu’est-ce qui n’est pas encore corrigé ?

### Jeu d’amorce — questions et correction professeur

Changer une variable dans la console corrige-t-il toujours le fichier ?

Attendu : Non

L’état temporaire du débogueur et le code enregistré sont distincts.

Avant un pas à pas utile, il faut…

Attendu : Une hypothèse et une valeur attendue

L’observation doit répondre à une question.

### Notions du socle (texte source, ligne 279)

Console, breakpoints — première correction de bug avec méthode

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT02-C4-2 — Utiliser un debugger et lire des logs

### TRACE CORRELATION // Relier les étages

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** IDE, Serveur

### Situation d’entrée

L’IDE s’arrête dans le contrôleur tandis qu’un log indique une erreur de stockage. Relie les deux traces d’une même requête.

### Cours d’introduction proposé

Le pas à pas inspecte l’état pendant l’exécution ; les logs conservent des événements après coup. Ces outils sont complémentaires, notamment pour les problèmes difficiles à reproduire. Un identifiant de requête et des horodatages aident à relier les traces.

Observe sans modifier plusieurs variables au hasard. Distingue un message de symptôme et la cause racine. Les journaux doivent rester proportionnés et ne pas contenir de secrets. Après correction, vérifie le parcours et la trace attendue, puis retire les affichages temporaires qui ne doivent pas rester dans le produit.

### Exemple

```text
request_id=lab-12 : entrée contrôleur → validation OK → stockage refusé → réponse d’erreur. L’IDE confirme la donnée transmise au repository.
```

### Production

Utilise le debugger du TP et un journal serveur expurgé pour expliquer la même erreur.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Pas à pas
- logs corrélés
- cause localisée
- correctif et vérification

### Transfert individuel

Deux requêtes s’entremêlent dans les logs. Quelle information permet de ne pas mélanger leurs événements ?

### Jeu d’amorce — questions et correction professeur

Pour relier les logs d’une même requête, utiliser…

Attendu : Un identifiant de corrélation

Les traces doivent être liées sans collecter des données personnelles inutiles.

Logs et debugger sont…

Attendu : Complémentaires

Ils observent l’exécution à des moments et niveaux différents.

### Notions du socle (texte source, ligne 280)

Inspection pas à pas (IDE)
Diagnostic via logs serveur (lien BC09 — logs production)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BC02-C5-1 — Utiliser l'inspecteur de code type DevTools

### DEVTOOLS LENS // Observer le navigateur

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** DevTools

### Situation d’entrée

Le code source semble correct, mais le DOM contient autre chose et une requête échoue. Ouvre les bons panneaux de DevTools.

### Cours d’introduction proposé

Cette sous-compétence porte le code source BC02-C5-1 dans le bloc BCT02 ; l’application conserve ce code et signale l’alias proposé BCT02-C5-1. L’inspecteur montre le DOM actuel, qui peut différer du HTML initial après JavaScript. Les styles calculés expliquent le rendu ; Réseau montre requêtes et réponses ; Console affiche des messages et erreurs.

Choisis le panneau selon ta question. Une modification dans l’inspecteur peut aider à tester une hypothèse mais disparaître au rechargement. Pour corriger durablement, retrouve le fichier ou le traitement responsable. Inspecter n’est pas contourner une autorisation serveur.

### Exemple

```text
Question DOM : quel élément existe ? Question Réseau : quelle route et quel statut ? Question Console : quelle erreur et quelle ligne ?
```

### Production

Sur le TP, retrouve un nœud, une règle CSS gagnante, une requête et une erreur console ; relie chaque observation à une hypothèse.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Quatre observations réelles
- différence DOM/source
- correction enregistrée
- alias source compris

### Transfert individuel

Tu modifies une valeur dans l’inspecteur et la page paraît réparée. Pourquoi faut-il encore corriger le projet ?

### Jeu d’amorce — questions et correction professeur

Le panneau Elements décrit surtout…

Attendu : Le DOM actuel

Le document peut avoir été transformé depuis son chargement.

Une modification dans DevTools est-elle toujours persistante ?

Attendu : Non

L’expérimentation temporaire doit être reportée au bon fichier.

### Notions du socle (texte source, ligne 281)

> Inspecter le DOM, les requêtes réseau, les erreurs console
> Utiliser un outils d'inspection pour comprendre un comportement inconnu
> Premier principe de résolution de problème : observation / hypothèse / investigation (en lien avec bloc Tst et débogage)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.