# Spécification — World Arcade dans Tween Teach

**Statut : cible d’intégration v1.0.0, 5 octobre 2026.** Le dépôt hôte n’a pas été inspecté dans cette
livraison. Les noms d’opérations ci-dessous sont des contrats logiques, pas des routes déjà existantes.
Les décisions visuelles sont définies ici ; les règles métier réellement installées doivent être
inventoriées avant toute modification. Les seuils de grade et les barèmes non connus restent non définis.

## 1. Intention produit et limites

World Arcade est l’entrée ludique de Tween Teach, pas un deuxième LMS. L’utilisateur doit comprendre
immédiatement où commencer, quels mondes il peut ouvrir et comment retrouver sa progression.
Le module couvre l’entrée, la salle, le lanceur, le panneau joueurs, le Top 5, les profils, les grades,
les réglages, l’authentification publique et leurs états. Les moteurs de jeu sont des systèmes
raccordés, pas réécrits dans cette livraison d’intégration.

Le thème arcade reste confiné à ce module et aux cadres de jeu pertinents. Le style des séances,
diagnostics, éditeurs, rendus et interfaces professeur reste celui du produit existant. Un diagnostic
pédagogique ne devient pas un écran obligatoire avant chaque clic Jouer. Ses conditions d’accès,
s’il y en a déjà, restent gérées par la séance et le serveur.

Aucune boutique, monnaie achetable, récompense monétaire, loterie, messagerie publique, multijoueur,
chat vocal ou classement de notes n’est ajouté. Le temps connecté et les tentatives ne deviennent
pas des récompenses automatiques. Les paramètres de présence ne sont pas un objectif v1.

## 2. Direction artistique

### Identité

Fond noir bleuté `#0B0B13`, panneaux `#11111D` et `#171722`, texte clair `#F7F3FA`, texte secondaire
`#9692A9`, contours `#2B293B`. Code Station utilise le cyan `#60DCF5`, Cyber Funk le rose `#FF5078`.
Le violet `#A292FB` et l’or pâle `#EDD08A` restent des accents. Ces valeurs proviennent du CSS fourni,
pas d’une réinterprétation libre de la maquette.

Les deux bornes ont une silhouette de meuble : fronton, écran, façade de contrôle et bouton Jouer
large. Elles restent du HTML/CSS. Les images remplissent les écrans et décors, jamais les textes ou
les contrôles. La fenêtre sur la ville, les portraits pixel art et les reflets néon portent l’identité.
Le contraste ne doit pas dépendre d’un halo. Les trames ne passent pas devant les textes de formulaire.

Les titres sont massifs et condensés ; les corps et formulaires restent en sans-serif lisible. La
police pixel est réservée à l’identité et à de courts accents. Reprendre les familles déjà autorisées
dans Tween Teach ; les noms de polices du prototype sont des références, sans fichiers de police
livrés. Les chargements Google Fonts externes du prototype sont à retirer ou à réautoriser selon
la politique du produit. Aucun nouveau CDN n’est nécessaire.

### Composition et adaptation

Au bureau : navigation latérale fine, ville et deux bornes au centre, Top 5 puis aperçu joueurs à
droite. Le Top 5 est secondaire par rapport aux jeux. Un écran de hauteur réduite peut défiler ;
ne pas écraser les bornes et les contrôles pour tout faire tenir au-dessus de la ligne de flottaison.
Sur tablette : réduire les colonnes, pas la taille de lecture. Sur mobile : bornes empilées, navigation
compacte, Top 5 et joueurs sous les jeux. Aucun défilement horizontal de page à 360 px de largeur.

Cibles de confort du projet : commandes principales d’au moins 44 × 44 px, corps lisible, focus visible,
zoom à 200 %, panneaux de formulaire utilisables avec clavier mobile. Cette taille de 44 px est notre
choix de confort, pas l’affirmation d’un minimum WCAG universel. Voir S5 pour le critère de référence.

### Mouvement et son

Son désactivé au premier accès, activé seulement par une action explicite. Animation décorative
modérée, aucun clignotement rapide. La préférence système de réduction du mouvement est respectée
et ne peut pas être annulée silencieusement par la valeur par défaut de l’application. Interrupteurs
pour les mouvements décoratifs et la trame rétro ; conserver les informations nécessaires au jeu.
Un fondu bref accompagne Commencer sans retarder le choix de jeu. Voir S6.

## 3. Navigation et écrans

Les identifiants ci-dessous sont logiques. Les chemins seront choisis selon le routeur hôte. Le
retour navigateur, les liens profonds, les rafraîchissements et le retour depuis un jeu doivent fonctionner.

| ID | Écran | Contenu et action principale |
|---|---|---|
| WA-01 | Entrée | Logo/World Arcade, Commencer, connexion discrète et son |
| WA-02 | Salle | Deux bornes, Top 5 du périmètre permis, aperçu joueurs |
| WA-03 | Joueurs | Galerie paginée, recherche par pseudo, filtre autorisé, fiche |
| WA-04 | Classement | Maximum cinq joueurs, jeu/période/périmètre disponibles |
| WA-05 | Mon profil | Pseudo, avatar, grade et progression réels ; réglages de visibilité |
| WA-06 | Grades | Catalogue réel ; aucun seuil ou grade personnel fictif |
| WA-07 | Réglages | Son, mouvements, effet rétro, déconnexion réelle |
| WA-08 | Connexion/inscription | Authentification du produit, e-mail/mot de passe pour l’externe |
| WA-09 | Lancement/reprise | Autorisation, reprise ou lancement, erreur et retour à la salle |
| WA-10 | Fiche joueur | Pseudo, avatar, grade et accomplissements rendus visibles dans ce périmètre |

### WA-01 — Entrée

Commencer ouvre immédiatement le catalogue. Il ne conditionne pas sa consultation à la création
d’un compte. Entrée a le même effet uniquement si l’écran est actif et aucun champ, dialogue ou jeu
ne consomme la touche. Si la session est déjà valide, montrer son accès profil plutôt qu’une invitation
à se reconnecter. L’inscription n’est pas une deuxième action primaire concurrente.

Lors d’un retour depuis un jeu, retrouver la salle et la sélection ; ne pas rejouer l’onboarding.
Un lien profond autorisé vers un jeu ou un profil n’est pas forcé à repasser par l’entrée décorative.

### WA-02 — Salle et états des bornes

Code Station : `code-station`, cyan. Cyber Funk 3026 : `cyber-funk`, rose. Leur disponibilité ne se
déduit pas de la présence d’une image. Le serveur/adaptateur associe chaque entrée au moteur réellement
présent et à l’accès de l’utilisateur. Les IDs du corpus peuvent être mappés, pas imposés à la base.

| État résolu | Libellé principal | Comportement |
|---|---|---|
| Disponible, sans sauvegarde | Jouer | Autoriser puis lancer le moteur réel |
| Disponible, sauvegarde réelle | Reprendre | Restaurer le point de progression valide |
| Session nécessaire | Se connecter | Ouvrir le parcours hôte ; conserver le jeu demandé |
| E-mail à vérifier | Vérifier mon e-mail | Ouvrir la gestion de vérification, sans faux envoi |
| Verrouillé | Verrouillé | Action de lancement désactivée, condition connue si disponible |
| Moteur absent ou maintenance | Indisponible | Ne pas ouvrir la mini-démo en remplacement |
| Demande en cours | Ouverture… | Une seule demande, boutons de lancement temporairement bloqués |
| Erreur réseau | Réessayer | Aucun gain de points ; aucune sauvegarde annoncée à tort |

La salle comporte un aperçu de la galerie et un accès « Voir les joueurs ». Un compteur n’apparaît
que s’il vient du service autorisé ; ne pas afficher 18, 49 ou un nombre de personnes en ligne issu
des illustrations. Chaque état non disponible est vrai, pas un prétexte marketing « bientôt » sans date.

### WA-03 / WA-10 — Joueurs et fiche

La galerie montre tous les profils que le serveur autorise pour le périmètre choisi, en pages si
nécessaire. Taille initiale suggérée : 24 cartes, à adapter aux conventions hôtes. Recherche par
pseudo et tri stables. Pas de requête renvoyant toute la base puis filtrée dans le navigateur.
Le titre public est « Joueurs », pas « Students ». Dans le périmètre scolaire autorisé : « Ma classe ».

Une carte affiche portrait, pseudo et grade réel disponible. La fiche peut montrer des accomplissements
ludiques validés et autorisés, jamais les notes scolaires ou les informations de connexion. Le grade
absent reste absent, avec un état explicite si cela aide l’utilisateur ; ne pas distribuer Rookie
à tous par défaut pour combler un champ manquant. Les avatars fournis sont des choix illustrés, pas
une photo d’élève. Un upload de photo personnelle n’est pas ajouté en v1.

Un externe ne voit ni la liste des classes, ni les affiliations, ni les noms réels par recherche,
autocomplétion, compteur, erreur, URL directe, export ou fiche. La liste autorisée doit être calculée
avant pagination et total. Un professeur ne reçoit pas automatiquement tous les établissements.
Les règles s’appliquent aussi aux requêtes et aux caches ; voir S3.

### WA-04 — Top 5

Chaque classement porte un périmètre autorisé, une métrique approuvée, une période et un jeu — ou
un ensemble de jeux seulement si une métrique commune est définie. L’interface n’affiche que les
filtres que le serveur sait traiter. Pas de faux changement visuel de scores pour simuler un filtre.

Le serveur renvoie **0 à 5 lignes**, sans curseur pour lire la sixième place. Le client vérifie aussi
cette limite à l’affichage. S’il y a moins de cinq joueurs éligibles, ne pas ajouter de personnes fictives.
Un état sans participation est différent d’un calcul indisponible. Une réponse issue du cache signale
un éventuel retard sans prétendre être une présence temps réel.

Règle proposée en l’absence de règle de présentation existante : ordre score décroissant, puis clé
opaque stable pour un ordre déterministe à score égal. Le rang affiché peut rester ex æquo (1, 1, 3…).
La limite de cinq lignes reste absolue même à la frontière des ex æquo. Documenter le départage ; ne
pas ajouter de sixième ligne. Ne pas récompenser la vitesse comme effet secondaire de ce départage.

Une fiche distincte « Ta place » peut montrer au joueur sa propre position hors Top 5, si cette donnée
est autorisée et disponible. Elle ne publie aucun voisin hors Top 5. Pas d’option « voir tout le classement ».
Les enseignants peuvent avoir leur suivi pédagogique existant, mais ce module ne l’expose pas à tous.

Les périodes semaine/mois/depuis le début sont présentées seulement si le backend peut les calculer.
Réutiliser son fuseau et ses bornes. À défaut, proposer Europe/Paris et des intervalles semi-ouverts
[début, fin), puis faire valider ce choix. Ne pas remettre à zéro les XP cumulés à chaque semaine.
Un filtre de période n’efface aucune progression persistée.

### WA-05 / WA-06 — Profil, grade et classement

Les trois notions restent séparées : **grade durable**, **position ponctuelle** et **évaluation scolaire**.
Ni une mauvaise semaine, ni un diagnostic non acquis, ni une absence ne rétrograde automatiquement un
joueur. La mise en forme ne convertit jamais une absence de donnée en score nul ou en compétence non acquise.

Le prototype contient neuf grades à trois divisions : Rookie, Explorer, Operator, Specialist,
Vanguard, Elite, Phantom, Legend, Prestige. Ce catalogue est une référence graphique. Le contexte
retrouve les demandes « Rookie » et « Explorer plutôt que Scout », mais pas un barème historique
approuvé pour les neuf grades. Le catalogue serveur a donc priorité. Les seuils JSON sont volontairement
`null`. Une clé métier ancienne peut conserver son identifiant et changer uniquement son libellé.

Si aucun catalogue métier n’existe, le panneau Grades public n’annonce pas de promotions inventées.
Conserver la proposition dans la prévisualisation privée ; ouvrir sa version publique après validation.
Prestige n’implique aucune remise à zéro automatique : rien ne doit effacer les accomplissements.

## 4. Identité, inscription et permissions

### Un compte, des affiliations

Une identité existante peut posséder un profil arcade et des affiliations scolaires autorisées.
Le profil arcade référence le compte hôte ; il ne crée pas un second mot de passe. Un externe peut
rejoindre plus tard une classe via un parcours contrôlé sans fusion automatique fondée seulement sur
un e-mail saisi. Un rôle de professeur n’est jamais accordé par auto-déclaration.

| Public | Catalogue | Profil propre | Galerie scolaire | Communauté visible | Administration |
|---|---|---|---|---|---|
| Visiteur | Oui, sans données privées | Non | Non | Non par défaut v1 | Non |
| Externe non vérifié | Oui ; accès jeu selon politique | Parcours de vérification limité | Non | Non par défaut | Non |
| Externe vérifié | Jeux publics autorisés | Oui | Non | Profils explicitement visibles si fonction ouverte | Non |
| Élève connecté | Jeux autorisés/débloqués | Oui | Classe(s) autorisée(s) selon politique hôte | Seulement si participation publique autorisée | Non |
| Professeur connecté | Périmètre autorisé | Selon produit | Ses classes autorisées | Selon permissions ordinaires | Outils existants uniquement |
| Administrateur | Selon capacités réelles | Selon produit | Selon permissions réelles | Selon permissions réelles | Rôle vérifié côté serveur |

Cette matrice est une cible à faire correspondre aux capacités réelles, pas une nouvelle enum de rôles
à injecter dans la base. Une capacité masquée dans l’UI reste interdite côté serveur et sur route directe.
Le filtrage inclut l’établissement et les affiliations si le produit est multi-tenant.

### Parcours d’inscription externe

Consulter la salle → Créer un compte → saisir pseudo, e-mail et mot de passe → validation par le
service hôte → vérification e-mail → choix d’avatar → profil privé par défaut → accès aux jeux publics
éligibles. Retour automatique vers le jeu demandé après connexion si toujours autorisé. Ne pas afficher
« e-mail envoyé » avant que le fournisseur ait au moins accepté sa prise en charge ; ne jamais garantir
la livraison dans la boîte de réception.

Le formulaire utilise les règles de mot de passe configurées par l’authentification, et non le
`minlength=12` du prototype comme standard implicite. Réutiliser la protection contre les tentatives
abusives et les erreurs évitant l’énumération des comptes ; aucun mot de passe en stockage navigateur,
logs, télémétrie, capture ou URL. Voir S2. Les mécanismes de session et de protection des mutations
restent cohérents avec le framework et le fournisseur hôtes ; pas d’authentification maison parallèle.

Si le service d’e-mail ou la politique d’ouverture n’est pas prêt, ne pas feindre de créer un compte
réel. L’inscription nouvelle reste désactivée en production, mais peut être testée avec le fournisseur
simulé de l’environnement de test. La connexion scolaire existante continue de fonctionner.

### Mineurs et confidentialité

La base légale, la notice, la durée de conservation, les procédures de suppression et les conditions
d’inscription des mineurs doivent être établies avec le responsable du produit/établissement avant
l’ouverture publique. Une case « J’ai 15 ans » n’est pas une validation universelle de conformité ; le
parcours scolaire et le service de loisir public peuvent avoir des conditions différentes. Ne pas
collecter une date de naissance complète, un document d’identité ou l’identité d’un parent sans
nécessité et politique validées. Voir S4 pour une approche proportionnée de vérification d’âge.

La participation au classement public et la visibilité du profil ne sont pas activées d’office pour
les élèves. Réutiliser les choix et autorisations existants ; en l’absence de politique validée, garder
le public désactivé. Le retrait de visibilité fait disparaître le profil des vues publiques et de
leurs caches, sans effacer arbitrairement des archives scolaires soumises à une autre règle.

## 5. Données et frontières de confiance

### Ce que l’UI peut conserver localement

Son, réduction d’animations, effet rétro, éventuellement filtre de navigation non sensible.
Une préférence locale n’accorde aucun droit. Pseudo et avatar en production sont persistés selon le
profil hôte ; on ne recopie pas le profil de démonstration dans une identité réelle sans action maîtrisée.
Déconnexion, changement de classe ou de compte invalident les données privées mises en cache.

### Ce qui appartient au serveur

Identité et affiliations ; autorisations ; catalogue publié ; disponibilité des moteurs ; sauvegardes
validées ; XP ; grades ; éligibilité au classement ; agrégations par période ; choix de visibilité
contrôlés. Le navigateur n’envoie pas une liste arbitraire de joueurs, un rôle ou un montant de récompense
à appliquer. Les DTO publics sont construits par sélection de champs, pas par suppression fragile de
quelques clés sensibles dans l’objet utilisateur complet.

### Validation de missions et points

Préférer le validateur déjà utilisé par les vrais jeux. Un événement JavaScript, même nommé « validé »,
ne constitue pas une preuve. Le serveur lie la tentative à l’utilisateur courant, au jeu, à la mission,
à sa version et aux règles d’accès ; il vérifie le résultat à partir d’éléments contrôlables. Les points
sont déterminés par le barème serveur. Une signature sur un simple « terminé=true » client ne suffit pas.

Pour une première réussite récompensée, la déduplication doit être fondée sur une clé métier stable
correspondant à la règle d’attribution (compte, jeu, mission/version et règle d’award), avec transaction
ou garantie équivalente. Deux requêtes simultanées, deux onglets et un nouveau jeton client ne doivent
pas doubler une même récompense. Les répétitions récompensables éventuelles doivent être explicitement
définies côté métier, pas déduites de la répétition d’un événement.

Si un jeu ne possède pas de validation suffisamment fiable pour le classement, il peut rester jouable
selon la politique hôte mais ne crée pas de score « vérifié ». Ne pas installer un nouveau service
d’exécution de code arbitraire pour résoudre ce point. L’exécution pédagogique existante conserve
son isolation et ses limites ; aucune exécution shell sur le serveur web de Tween Teach.

### Sauvegarde et erreurs

Le clic Reprendre utilise une sauvegarde accessible à ce compte et ce jeu ; aucun `playerId` arbitraire
ne doit permettre de reprendre la partie d’un autre. Versionner et migrer les sauvegardes seulement
si le moteur l’exige. Préserver les sauvegardes existantes ; pas de remplacement par les structures
simplifiées du front fourni. Afficher un succès d’enregistrement seulement après confirmation.

Pour un réseau indisponible : différencier résultat local non confirmé et résultat persisté ; ne pas
mettre à jour le Top 5 en optimiste comme si le serveur avait validé. La réémission éventuelle respecte
l’idempotence et l’expiration de la session. Ne pas traiter une 403 comme une panne transitoire à répéter.

## 6. Contrats d’intégration

`CONTRATS/arcade-host-contract.ts` décrit les attentes de l’UI indépendamment du transport : session,
capacités, jeux, galerie, Top 5, profil, grades et lancement. Ces noms ne sont ni des noms de tables ni
des endpoints à créer d’office. Un service existant peut remplir plusieurs opérations.

La production a un adaptateur hôte réel. Le mode démonstration reste isolé et n’est jamais activé comme
secours à une erreur d’API. Les données fictives restent uniquement dans les références, tests et aperçus
explicitement privés. Aucun import du module global `ArcadeData.players` dans une route connectée.

Le pont de lancement HTML fourni est un exemple testable, pas un middleware de sécurité. Il annule
le fallback Canvas immédiatement, traite une seule ouverture à la fois et refuse les destinations
non autorisées. Le serveur garde la responsabilité des sessions, droits, routes, sauvegardes et scores.
Dans une application à composants, appeler directement l’adaptateur depuis un bouton peut être plus simple.

Si le moteur est dans un iframe, une revue spécifique doit couvrir l’origine, les capacités sandbox,
le focus, le stockage, le plein écran et tout `postMessage`. Valider source/origine/structure, jamais
`*` pour un message sensible. Une iframe de code élève non fiable ne partage pas les privilèges du
contexte authentifié de Tween Teach. Ne pas créer cet agencement sans examiner l’existant.

## 7. Livraison et activation

Intégrer d’abord une tranche privée testable derrière le mécanisme de drapeau existant, sans retirer
l’ancienne route tant que le nouveau parcours n’est pas prêt. L’ouverture publique de l’inscription,
des profils et du classement est une décision indépendante. Les noms de drapeaux du corpus sont
conceptuels et doivent être mappés aux conventions du dépôt.

Pas de migrations générées à l’aveugle dans ce pack. Codex documente les changements de schéma
réellement indispensables et leur impact. Tester sur une base locale/jetable autorisée avant toute
proposition d’application réelle. Le retour arrière restaure l’ancien point d’entrée et les drapeaux,
sans supprimer les comptes ou sauvegardes légitimes créés depuis l’intégration.

L’intégration est terminée quand les fonctionnalités non bloquées sont réellement raccordées, que
la matrice de recette a des preuves et que les blocages sont explicités. Une compilation réussie,
un score d’agent ou les captures du prototype ne constituent pas seuls une recette de production.
