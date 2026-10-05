# BCT04 — Accessibilité numérique (compétence transverse)

## Objectif du socle

Concevoir des services numériques utilisables par le plus grand nombre.

Source : `content/source/referentiel-original.md`. Les textes source sont distingués des propositions pédagogiques. Guide professeur, cours introductifs et dossiers de TP ; ce n’est pas une validation de compétence.

---

## BCT04-C1-1 — Sensibilisation aux enjeux du handicap numérique

### NO ONE LEFT // Le portail qui exclut

**Typologie et niveau source :** Atelier 
Savoir · Non précisé

**Outils source :** Atelier, RGAA

### Situation d’entrée

L’alerte ne se comprend qu’avec la couleur rouge, la vidéo n’a pas de sous-titres et le formulaire exige une souris.

### Cours d’introduction proposé

L’accessibilité vise à rendre un service utilisable par des personnes ayant des besoins variés, notamment liés à des handicaps visuels, auditifs, moteurs ou cognitifs. Une même personne peut rencontrer plusieurs obstacles ; on n’attribue pas un profil unique à un diagnostic. Le contexte, les outils et les préférences comptent.

Observe les barrières concrètes : information portée uniquement par une couleur, élément sans nom, ordre de lecture incohérent, action impossible au clavier. Le RGAA fournit un cadre de vérification ; il ne se réduit pas à un score automatique. Un atelier de sensibilisation ne reproduit pas l’expérience vécue d’un handicap. Utilise des scénarios documentés, écoute les besoins et associe chaque obstacle à un levier concret.

### Exemple

```text
Obstacle : « les cases rouges sont obligatoires ». Correction : indication textuelle + association au champ, sans dépendre uniquement de la couleur.
```

### Production

Analyse quatre obstacles du portail fictif et propose des corrections. Explique le rôle du RGAA sans prétendre réaliser un audit complet.

Mode : Production et observation humaine

### Critères proposés

- Obstacles décrits
- usages concernés sans stéréotype
- leviers adaptés
- distinction sensibilisation/audit

### Transfert individuel

Le portail fonctionne avec ton clavier mais une personne reste bloquée. Quelle démarche adoptes-tu ?

### Jeu d’amorce — questions et correction professeur

Une information importante doit…

Attendu : Rester compréhensible sans dépendre uniquement de la couleur

Des indices complémentaires rendent l’information accessible.

Un atelier avec contrainte simulée…

Attendu : Illustre une barrière sans reproduire un handicap

On évite de réduire une expérience vécue à une simulation.

### Notions du socle (texte source, ligne 312)

> Atelier sensibilisation aux handicaps
> Leviers principaux par type de handicap
> Existence et rôle du RGAA

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT04-C2-1 — Appliquer les règles RGAA de base

### KEYBOARD RESCUE // Rouvrir le sas

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** HTML/ARIA, RGAA

### Situation d’entrée

Le bouton du sas est une div cliquable sans nom accessible. Répare la structure avant d’ajouter de nouveaux attributs.

### Cours d’introduction proposé

Privilégie les éléments HTML natifs : un bouton fournit déjà une sémantique et des interactions clavier. Donne un nom compréhensible aux champs et actions, conserve un indicateur de focus visible et un ordre de navigation logique. Les alternatives textuelles dépendent du rôle de l’image ; une décoration peut avoir une alternative vide.

Les critères de contraste dépendent notamment du texte et de sa taille. Pour le texte courant, la référence WCAG AA demande généralement un rapport de 4,5:1 ; le grand texte a un seuil différent. ARIA complète la sémantique lorsque nécessaire, mais n’ajoute pas à elle seule les comportements clavier. Vérifie avec des outils et des essais manuels plutôt que de seulement compter les attributs.

### Exemple

```text
<label for="code">Code du sas</label>
<input id="code" name="code">
<button type="button">Ouvrir le sas</button>
```

### Production

Répare le fragment HTML, puis vérifie au clavier le nom, le focus et l’ordre. Mesure le contraste dans un outil adapté.

Mode : Atelier navigateur + vérifications manuelles

### Critères proposés

- HTML modifié
- essai clavier
- nom des actions
- mesure de contraste
- justification des alternatives

### Transfert individuel

Tu dois créer un composant personnalisé. Pourquoi role="button" ne suffit-il pas ?

### Jeu d’amorce — questions et correction professeur

Pour une action, tu privilégies…

Attendu : Un bouton HTML natif correctement nommé

Le natif évite de réimplémenter plusieurs comportements.

Ajouter ARIA…

Attendu : Ne remplace pas le comportement clavier

Sémantique et comportement doivent être cohérents.

### Notions du socle (texte source, ligne 313)

> Contraste WCAG AA, alternatives textuelles, navigation clavier
> Attributs ARIA sur composants interactifs

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT04-C2-2 — Réinvestir l'accessibilité sur tous les projets interface

### FOCUS RETURN // Ne pas perdre l’utilisateur

**Typologie et niveau source :** Savoir-faire méthodologique · Non précisé

**Outils source :** HTML/ARIA

### Situation d’entrée

La modale de confirmation s’ouvre, mais le focus reste derrière. Après une erreur serveur, aucun champ n’indique comment corriger.

### Cours d’introduction proposé

L’accessibilité doit être réinvestie lorsque l’interface change. Une modale doit avoir un nom, un comportement clavier cohérent et une gestion du focus à l’ouverture, pendant l’interaction et à la fermeture. Le pattern WAI-ARIA documente ces attentes ; un élément dialog natif peut fournir une partie du comportement.

Pour un formulaire, associe les messages aux champs, donne une explication exploitable et n’efface pas inutilement les valeurs. Les erreurs validées par PHP restent à restituer dans un HTML accessible. Les changements dynamiques importants peuvent nécessiter une annonce adaptée ; évite les annonces permanentes qui perturbent. Teste le parcours complet, pas seulement la présence d’un attribut.

### Exemple

```text
Parcours : bouton déclencheur → ouverture → focus dans la modale → action ou annulation → retour au déclencheur.
```

### Production

Sur le TP DOM, réalise et teste une modale ; sur le TP PHP, restitue une erreur de formulaire accessible. Consigne les deux parcours.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Code et essai modale
- parcours focus
- erreur PHP liée au champ
- correction sans perte inutile
- observations

### Transfert individuel

Le bouton ayant ouvert la modale disparaît après validation. Où replacer le focus pour poursuivre la tâche ?

### Jeu d’amorce — questions et correction professeur

Après fermeture d’une modale, le focus…

Attendu : Revient à un point logique du parcours

La continuité de la tâche guide le retour du focus.

Une erreur de formulaire doit…

Attendu : Indiquer le champ et la correction attendue

Le retour doit permettre de comprendre et agir.

### Notions du socle (texte source, ligne 314)

BC06 : composants JS dynamiques, focus sur les modales
BC07 : formulaires PHP accessibles, messages d'erreur

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT04-C3-1 — Auditer l'accessibilité avec Google Lighthouse

### AUDIT GAP // Le score ne voit pas tout

**Typologie et niveau source :** Savoir-faire méthodologique · Non précisé

**Outils source :** Google Lighthouse

### Situation d’entrée

Lighthouse affiche un excellent score alors que l’ordre de lecture et la consigne du formulaire restent incompréhensibles.

### Cours d’introduction proposé

Les audits automatiques peuvent détecter certains défauts et orienter une correction. Ils ne peuvent pas évaluer tous les critères ni juger entièrement la pertinence d’une alternative textuelle ou d’un parcours. Le score d’accessibilité Lighthouse porte sur les contrôles automatisés qu’il exécute.

Ouvre chaque audit, repère les éléments concernés et reproduis le problème. Complète par des essais manuels : clavier, ordre de lecture, zoom, messages et focus. Note les vérifications non réalisées plutôt que de les déclarer conformes. Un audit RGAA possède un périmètre et une méthode ; un rapport Lighthouse seul ne vaut pas déclaration de conformité. Conserve les preuves des corrections et leurs limites.

### Exemple

```text
Rapport : automatique = audit détecté/corrigé ; manuel = scénario/attendu/observé ; non testé = motif et suite prévue.
```

### Production

Exécute Lighthouse sur le TP, corrige deux alertes et ajoute un défaut important qu’un essai manuel révèle.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Rapport réel
- éléments inspectés
- corrections
- essai manuel
- limites clairement indiquées

### Transfert individuel

Un collègue veut afficher « 100 % accessible » après un score de 100. Comment reformules-tu le résultat ?

### Jeu d’amorce — questions et correction professeur

Le score Lighthouse garantit-il tout le RGAA ?

Attendu : Non, son périmètre est limité

Les contrôles automatisés ne couvrent pas tous les critères.

Un contrôle non réalisé doit être marqué…

Attendu : Non testé, avec sa limite

La traçabilité doit distinguer absence de défaut et absence de test.

### Notions du socle (texte source, ligne 315)

> Interpréter le score accessibilité Lighthouse
> Lien avec BCT03 (Lighthouse couvre aussi performance et SEO)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT04-C3-2 — Corriger et justifier les choix d'accessibilité

### ACCESS DEFENSE // Justifier la réparation

**Typologie et niveau source :** Savoir-faire méthodologique · Non précisé

**Outils source :** Lighthouse, cahier de recette

### Situation d’entrée

L’équipe propose de fermer le ticket d’accessibilité parce que « ça a l’air mieux ». Prépare une démonstration vérifiable.

### Cours d’introduction proposé

Corriger un défaut d’accessibilité consiste à supprimer une barrière identifiée et à vérifier que le parcours fonctionne. Décris l’état initial, l’usage bloqué, le choix de correction et le résultat observé. Une justification technique doit rester compréhensible pour les personnes qui ne lisent pas le code.

Associe la correction à un critère de recette concret : atteindre l’action au clavier, percevoir le focus, comprendre un message d’erreur. Rejoue les parcours voisins pour repérer une régression. En soutenance, montre le comportement plutôt que d’énumérer des attributs. Distingue ce qui est vérifié de ce qui reste à auditer ; une correction locale n’établit pas la conformité du service entier.

### Exemple

```text
Avant : Tab ignore l’action. Après : button reçoit le focus, Entrée l’active, le message est compréhensible. Régression : le parcours de retour reste possible.
```

### Production

Présente en binôme deux corrections, fais rejouer les étapes par ton partenaire et joins le compte rendu au cahier de recette.

Mode : Production et observation humaine

### Critères proposés

- Défauts initiaux
- corrections
- critères et essais
- résultat du partenaire
- justification
- points non testés

### Transfert individuel

Une correction améliore le clavier mais masque un texte à fort zoom. Comment traites-tu cette régression ?

### Jeu d’amorce — questions et correction professeur

Une bonne justification relie…

Attendu : Obstacle, correction et vérification

Elle montre l’effet sur un usage concret.

Après correction, tu vérifies…

Attendu : Le parcours ciblé et les parcours voisins

Une amélioration peut introduire une régression ailleurs.

### Notions du socle (texte source, ligne 316)

> Corriger les défauts d'accessibilité identifiés
> Justifier les choix lors de la soutenance
> Critère de recette fonctionnelle (BCT02)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.