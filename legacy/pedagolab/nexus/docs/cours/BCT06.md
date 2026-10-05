# BCT06 — Hygiène numérique et cyber sécurité (compétence transverse)

## Objectif du socle

Comprendre les risques liés au numérique et adopter une posture défensive en tant que développeur.

Source : `content/source/referentiel-original.md`. Les textes source sont distingués des propositions pédagogiques. Guide professeur, cours introductifs et dossiers de TP ; ce n’est pas une validation de compétence.

---

## BCT06-C1-1 — Hygiène numérique

### IDENTITY SHIELD // Réduire l’exposition

**Typologie et niveau source :** Savoir · Non précisé

**Outils source :** Atelier

### Situation d’entrée

Un dossier de fuite entièrement fictif révèle qu’un même mot de passe a été réutilisé. Organise la défense sans rechercher des informations sur des personnes réelles.

### Cours d’introduction proposé

L’hygiène numérique repose sur plusieurs mesures complémentaires : mots de passe uniques, gestionnaire adapté, second facteur, mises à jour, sauvegardes et vigilance face aux sollicitations. Un gestionnaire permet d’éviter la réutilisation ; il doit lui-même être protégé. Le second facteur réduit certains risques, sans rendre tout hameçonnage impossible.

En cas de fuite, suis la procédure de l’établissement : signaler, modifier les accès concernés depuis le service légitime, révoquer les sessions si nécessaire et vérifier les usages suspects. L’OSINT de cet atelier porte exclusivement sur des identités et documents fictifs fournis. Il ne s’agit pas de constituer un dossier sur un camarade ni d’exposer publiquement des données personnelles.

### Exemple

```text
Identité fictive : agent-test. Services fictifs A/B. Incident : réutilisation. Plan : signaler → sécuriser l’accès légitime → vérifier sessions → prévenir la récidive.
```

### Production

Sur un compte de démonstration approuvé, explique un gestionnaire et le second facteur ; traite le dossier fictif et propose un plan de réduction d’exposition.

Mode : Production et observation humaine

### Critères proposés

- Scénario fictif
- mesures complémentaires
- procédure d’incident
- limites du second facteur
- absence de données réelles

### Transfert individuel

Un message te presse de communiquer un code de second facteur. Quel canal utilises-tu pour vérifier la demande ?

### Jeu d’amorce — questions et correction professeur

Réutiliser un mot de passe…

Attendu : Étend le risque si un service est compromis

L’unicité limite les conséquences d’une fuite.

L’OSINT de ce laboratoire porte sur…

Attendu : Des documents et identités fictifs fournis

La défense s’apprend sans constituer un dossier personnel.

### Notions du socle (texte source, ligne 352)

OSINT (Dox) — réception d'infos personnelles suite à fuite de données
Authentification à double facteur
Gestionnaire de mot de passe

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT06-C1-2 — Phishing — atelier pratique

### PHISHING MIRROR // Reconnaître le piège

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** HTML/CSS, API

### Situation d’entrée

Une page de sensibilisation fictive imite un portail de la ville. Repère les signaux trompeurs et transforme-la en démonstration explicite, sans collecter de mot de passe.

### Cours d’introduction proposé

L’hameçonnage cherche à pousser une personne vers une action risquée en utilisant une identité, une urgence ou une demande trompeuse. Une apparence soignée ou HTTPS ne suffisent pas à établir la légitimité d’un service. Vérifie le contexte, l’adresse et la demande par un canal connu.

Adaptation pédagogique explicite du socle : la page reste marquée SIMULATION, utilise une marque fictive et ne contient aucun formulaire de collecte de secret. Les mesures portent sur des événements factices agrégés dans le laboratoire, jamais sur une liste de « personnes hackées ». Ne diffuse pas cette page à des tiers. L’objectif est de comprendre le mécanisme, signaler et corriger les signes trompeurs, pas de piéger les élèves.

### Exemple

```text
<aside>SIMULATION PÉDAGOGIQUE — ne saisir aucune donnée réelle</aside>
<button type="button">Signaler cette demande fictive</button>
```

### Production

Crée une page HTML/CSS de sensibilisation fictive et annotée. Ajoute des signaux de vérification et, dans un TP local encadré, un compteur d’événements synthétiques sans identifiant.

Mode : Atelier navigateur + vérifications manuelles

### Critères proposés

- Bannière simulation
- marque fictive
- aucune collecte de secret
- signaux expliqués
- événements synthétiques
- périmètre fermé

### Transfert individuel

Un site possède un cadenas HTTPS mais demande un code de sécurité inattendu. Pourquoi le cadenas ne suffit-il pas ?

### Jeu d’amorce — questions et correction professeur

Le TP doit collecter…

Attendu : Aucun identifiant ni mot de passe réel

La démonstration porte sur un mécanisme avec données synthétiques.

HTTPS prouve-t-il l’intention légitime du site ?

Attendu : Non, il sécurise un transport dans un contexte de certificat

La légitimité exige d’autres vérifications.

### Notions du socle (texte source, ligne 353)

Création d'une page de phishing HTML/CSS
Utilisation d'une API pour stocker les statistiques des personnes hackées
Sensibilisation aux dangers du phishing

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT06-C2-1 — Connaître les attaques de base et se défendre

### DEFENSE RANGE // Attaquer le scénario, pas les personnes

**Typologie et niveau source :** Savoir · A2

**Outils source :** OWASP Top 10

### Situation d’entrée

Le laboratoire local expose un formulaire vulnérable fictif. Associe chaque faiblesse à une défense et vérifie que la fonction utile reste disponible.

### Cours d’introduction proposé

Une initiation offensive/défensive commence par un périmètre explicite : machines autorisées, données fictives, durée et actions prévues. Une vulnérabilité peut concerner l’interprétation de données, le contrôle d’accès ou les états de session. OWASP sert de repère pour structurer les risques ; ce n’est pas une liste suffisante à elle seule pour sécuriser une application.

Pour le TP, observe des traces préparées de XSS, d’injection SQL et de requêtes non autorisées. Relie-les respectivement à un encodage de sortie adapté au contexte, des requêtes paramétrées et des vérifications d’autorisation/état côté serveur. La validation des entrées complète ces défenses sans les remplacer. Vérifie aussi qu’une entrée légitime continue de fonctionner. Aucune cible publique ou compte tiers n’est utilisé.

### Exemple

```text
Faiblesse → trace fictive → impact → défense → test de non-régression → limites du contrôle.
```

### Production

Dans le laboratoire fourni ou une VM dédiée approuvée, étudie deux faiblesses, applique les protections et joins les observations avant/après.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Autorisation et périmètre
- données fictives
- traces
- défense adaptée
- tests légitimes et cas limites
- limites

### Transfert individuel

Une validation client bloque l’entrée, mais le serveur reçoit directement une requête différente. Quelle défense manque ?

### Jeu d’amorce — questions et correction professeur

Avant un essai de sécurité, il faut…

Attendu : Un périmètre autorisé et explicite

L’autorisation et le périmètre sont des prérequis du laboratoire.

Une requête préparée vise notamment à…

Attendu : Séparer la structure SQL des valeurs

Chaque défense traite un mécanisme précis.

### Notions du socle (texte source, ligne 354)

Connaître les attaques de base
Attaquer son propre système et adopter une position défensive

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT06-C2-2 — Protéger son système avec des outils Linux

### BASTION DRILL // Durcir sans se verrouiller

**Typologie et niveau source :** Savoir-faire technique · A2

**Outils source :** fail2ban, pare-feu

### Situation d’entrée

Une règle pare-feu proposée couperait l’accès de l’administrateur. Prépare une modification testable et un retour arrière sur une VM dédiée.

### Cours d’introduction proposé

Le durcissement système combine mises à jour, services nécessaires seulement, droits limités, authentification SSH appropriée et règles réseau cohérentes. Avant de changer un accès distant, garde une voie de récupération et teste la nouvelle configuration depuis une seconde connexion.

Un changement de port SSH peut réduire du bruit, mais ne remplace pas l’authentification ni les mises à jour. Un outil comme fail2ban réagit à des événements de journaux selon des règles ; il faut comprendre ses critères et vérifier qu’il ne bloque pas un usage légitime. Un honeypot est un dispositif d’observation à isoler, pas une protection universelle : ici, on étudie des journaux synthétiques, sans en exposer un sur Internet. Documente les règles et leur retour arrière.

### Exemple

```text
Plan : accès console disponible → vérifier configuration → autoriser le nouvel accès → tester deuxième session → conserver retour arrière → consigner.
```

### Production

Sur une VM de TP uniquement, propose et vérifie une règle pare-feu, une politique SSH et une lecture de logs fail2ban. Le professeur valide avant application.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- VM dédiée
- accès de secours
- configuration vérifiée
- essais autorisé/refusé
- logs
- retour arrière
- limites

### Transfert individuel

Le mécanisme de bannissement bloque un élève légitime sur un réseau partagé. Quelles hypothèses examines-tu ?

### Jeu d’amorce — questions et correction professeur

Changer le port SSH…

Attendu : Ne suffit pas à sécuriser le serveur

C’est au mieux une mesure complémentaire.

Avant une règle pouvant couper SSH, tu prévois…

Attendu : Une récupération et un test de seconde connexion

La continuité d’administration doit être vérifiée.

### Notions du socle (texte source, ligne 355)

Protéger son système avec un pare-feu
Modifier son port de connexion SSH
Honeypot, utiliser fail2ban

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.