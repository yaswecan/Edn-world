# TWEEN TEACH — WORLD ARCADE
## Lot suivant : compte joueur, AKA, avatar, espace personnel et badges

**Document : prompt d’implémentation + spécification fonctionnelle.**
**Statut : tâche à exécuter dans le dépôt Tween Teach ; ce document n’est pas une intégration déjà réalisée.**
**Date : 5 octobre 2026.**

Tu travailles dans mon dépôt Tween Teach existant, ouvert dans VS Code. World Arcade dispose d’un dossier de conception et d’un front de référence. Une partie de l’intégration peut déjà être faite : examine son état réel et complète-la sans repartir de zéro.

Ta mission est de donner à chaque joueur une identité persistante : créer ou retrouver son compte, choisir son AKA et son avatar, personnaliser sa carte, retrouver ses jeux et ses badges, et gérer son mot de passe. Livre les écrans ET leur raccordement réel aux services du dépôt. Ne t’arrête pas à des formulaires décoratifs ou à une proposition d’architecture.

## 0. Examiner l’existant avant de modifier

Lis les `AGENTS.md` applicables, puis les documents disponibles :

- `TWEEN_TEACH_WORLD_ARCADE/00_LIRE_DABORD.md` ;
- `TWEEN_TEACH_WORLD_ARCADE/02_SPECIFICATION_COMPLETE.md` ;
- `TWEEN_TEACH_WORLD_ARCADE/CORPUS/world-arcade.corpus.json` ;
- `TWEEN_TEACH_WORLD_ARCADE/04_AUDIT_FRONT_FOURNI.md` ;
- les contrats de `CONTRATS/` et les constats déjà renseignés dans `SUIVI/` ;
- les captures et assets utiles de `FRONT_REFERENCE/`, sans charger comme texte les images encodées du HTML autonome.

Repère les vraies routes, composants, tables/modèles, fournisseur d’authentification, mécanisme de session, envoi d’e-mails, permissions, profils, avatars, grades, badges et sauvegardes. Vérifie notamment si le bouton actuel « Créer un compte » est encore une simulation. Distingue : fonction opérationnelle / partielle / absente / bloquée par une dépendance externe.

Les noms de services de ce prompt sont conceptuels. Ne crée pas des tables ou endpoints homonymes si des équivalents existent. Réutilise les bibliothèques et conventions déjà en place ; n’impose ni changement de framework ni deuxième fournisseur d’identité.

Le présent lot précise le compte joueur et remplace seulement l’ordre du parcours d’inscription décrit au §4 de la spécification initiale : **e-mail et mot de passe → vérification → AKA et avatar regroupés sur un écran**. Les règles de confidentialité, le Top 5, les déblocages et la priorité du catalogue métier restent inchangés. Si l’inscription hôte impose déjà un pseudo, le reprendre prérempli dans cet écran, sans obliger à le saisir une deuxième fois.

## 1. Décisions produit non négociables

Un joueur possède **un compte Tween Teach** et **un profil arcade lié à ce compte**. L’élève connecté ne crée pas un second compte ni un second mot de passe. Les affiliations scolaires ne sont pas des propriétés que l’on choisit dans un formulaire public.

Distingue cinq notions :

| Notion | Rôle | Modification par le joueur |
|---|---|---|
| Compte | Connexion, sécurité, identité technique stable | Paramètres autorisés seulement |
| AKA | Pseudo de jeu affiché | Oui, suivant les règles du service |
| Avatar et carte | Apparence dans l’arcade | Oui, parmi les choix autorisés |
| Grade | Progression durable déterminée par les règles du jeu | Non |
| Badge | Accomplissement obtenu ; éventuellement mis en avant | Présentation oui, attribution non |

La place dans le classement est encore une autre information : elle dépend du périmètre et de la période. Changer d’AKA ou d’avatar ne modifie jamais la progression, les récompenses, les notes ou les accès.

Le bouton **Commencer** continue d’ouvrir la sélection **Code Station / Cyber Funk 3026**, pas une inscription obligatoire. Un visiteur peut découvrir les jeux. L’identification intervient pour accéder à son espace ou lancer un parcours nécessitant un compte. Les droits réels du jeu restent contrôlés par le serveur.

L’ambiance reste celle de World Arcade : cyberpunk, portraits pixel art, panneaux noirs bleutés, cyan pour Code Station, rose pour Cyber Funk, titres forts et corps lisibles. Ne transforme pas le compte en formulaire administratif générique. Ne transforme pas non plus les champs de sécurité en mini-jeux.

## 2. Parcours à construire

### 2.1 Visiteur et inscription externe

Depuis l’arcade, proposer « Se connecter » et « Créer un compte », sans écran bloquant au premier clic Commencer.

**Écran 1 — Créer un compte.** Champs avec labels visibles : adresse e-mail, mot de passe, confirmation du mot de passe. Afficher les conditions réellement applicables et la notice disponible, sans case marketing précochée. Lier l’entrée « J’ai déjà un compte » à la connexion existante ; proposer le parcours scolaire existant sans auto-attribution de rôle.

Créer le compte avec le service hôte et le rôle externe minimal déterminé côté serveur. Aucun choix public « Professeur », « Administrateur » ou « Ma classe » ne peut accorder un droit. Traiter les inscriptions répétées et adresses déjà utilisées selon la politique anti-énumération du fournisseur ; ne pas exposer une association adresse/élève/classe.

**Écran 2 — Vérifier mon adresse.** Prendre en charge vérification, demande de nouvel envoi limitée, lien expiré et reprise sur un autre navigateur. Un compte en attente ne reçoit pas les droits d’un compte vérifié. La vérification doit fonctionner sans conserver le mot de passe dans le navigateur ni demander de le placer dans une URL.

Ne pas inventer un e-mail reçu ou une validation réussie. La microcopie reflète l’état connu du service. Une réponse publique générique ne garantit ni l’existence du compte ni la livraison du message. Une panne générale du service doit être présentée comme telle, de manière identique pour les adresses existantes et inexistantes.

**Écran 3 — Choisis ton joueur.** Une page de sélection de personnage, avec AKA et avatar côte à côte. Prévisualisation immédiate, puis bouton « Entrer dans l’arcade ». Le bouton enregistre le profil, attend la confirmation serveur et reprend l’intention de navigation autorisée : jeu demandé ou salle des jeux.

Conserver uniquement une destination interne autorisée, via le mécanisme du dépôt. Aucun paramètre de retour ne doit permettre une redirection libre vers un site tiers. Recontrôler le droit de lancer le jeu après la connexion.

### 2.2 Élève ou autre compte déjà existant

Réutiliser la session. Si le profil arcade existe, ouvrir son espace ou son jeu directement. Sinon, créer le lien de profil de façon idempotente, puis présenter uniquement la personnalisation manquante.

Ne pas demander une adresse personnelle à un élève dont le compte scolaire n’en a pas besoin. Ne pas lui imposer la vérification d’un e-mail externe pour conserver son accès scolaire. Son nom administratif et son identifiant de connexion restent inchangés lorsqu’il choisit un AKA.

Un parcours de personnalisation interrompu reprend au bon endroit, sans duplication de compte. Il ne bloque pas les cours ni les autres usages de Tween Teach. Un avatar de base peut être présélectionné ; un AKA ne doit pas être dérivé automatiquement de l’identité réelle pour le publier.

### 2.3 Joueur qui revient

La connexion retrouve le même profil sur un autre navigateur : AKA, avatar, éléments équipés, badges et sauvegardes autorisées. Fermer puis rouvrir une session ne réinitialise rien.

La déconnexion invalide la session selon le service hôte, vide les caches privés et revient à une vue visiteur. Le compte suivant sur le même PC ne voit aucune carte privée, sauvegarde ou adresse du précédent, y compris via le bouton Retour.

## 3. AKA : une identité de jeu, pas un nouvel identifiant scolaire

Le champ porte le label **« AKA — ton pseudo »** à sa première présentation ; « AKA » suffit ensuite. Un court exemple peut aider, mais ne pas préremplir le nom réel de l’élève.

Réutiliser les règles du dépôt. À défaut de règles existantes, appliquer cette proposition produit : de 3 à 20 caractères, lettres latines non accentuées, chiffres, tiret et underscore ; pas d’espace ; unicité insensible à la casse dans le périmètre d’identité arcade défini par le service. Documenter le choix du périmètre, notamment en contexte multi-établissement, sans fusionner des comptes.

Le serveur normalise la clé de comparaison et impose l’unicité, y compris pour deux demandes simultanées. La casse d’affichage peut être conservée. Ne jamais appliquer au mot de passe les transformations du pseudo. Ne jamais faire de l’AKA ou de l’e-mail la clé des sauvegardes : elles restent liées à l’identifiant immuable du compte.

Une vérification de disponibilité peut être proposée, limitée en fréquence, mais l’écriture serveur reste décisive. Un AKA réservé ou déjà utilisé peut être annoncé indisponible ; cette réponse ne doit donner ni profil propriétaire, ni adresse, ni affiliation. Prévoir les noms réservés, l’usurpation de fonction et les contenus interdits suivant la modération du produit. Échapper le texte à l’affichage.

Dans Personnaliser, permettre de modifier son AKA avec « Enregistrer » et « Annuler ». Expliquer seulement lorsque nécessaire : « Ton identifiant de connexion ne change pas. » Actualiser ensuite la barre du compte, la carte, la galerie autorisée et le Top 5. Conserver un historique technique minimal si le service le prévoit, jamais une liste publique des anciens pseudos scolaires.

Ne pas introduire une monnaie, un paiement ou un délai de changement arbitraire. Réutiliser les protections anti-abus existantes.

## 4. Avatars et personnalisation de la carte

### Composition de l’écran

Sur ordinateur : aperçu principal du personnage et de sa carte à gauche ; grille d’avatars et réglages à droite ; action de validation bien visible. Sur mobile : aperçu compact, grille, puis actions sans masquer les champs ni le focus clavier.

Chaque vignette a un état normal, survol/focus et sélectionné. Le choix est identifiable sans la couleur seule. L’aperçu peut changer immédiatement, mais aucun message « Enregistré » ne précède la réponse serveur. Annuler restitue les choix persistés.

Réutiliser le catalogue d’avatars autorisés et vérifier la provenance des assets. Le dossier de référence contient des portraits ; leur présence ne prouve pas automatiquement un droit de redistribution publique. Ne pas utiliser une photo d’élève, Gravatar lié à l’e-mail, une URL d’image arbitraire ou un téléversement personnel dans ce lot. Si des portraits ne peuvent pas être publiés, conserver la fonctionnalité avec des assets de repli originaux déjà autorisés, et signaler l’écart visuel.

Le choix d’avatar est cosmétique : pas de bonus de score, de compétence ou d’accès. L’avatar de profil ne remplace le sprite du personnage dans un jeu que si ce moteur possède déjà une correspondance compatible ; ne pas réécrire ses animations pour ce lot.

### Éléments modifiables

Implémenter l’avatar, l’AKA et une sélection de **zéro à trois badges obtenus** à mettre en avant. Ajouter cadre de carte, bannière ou titre seulement si leur catalogue et leur attribution existent ou sont explicitement définis dans le dépôt. Mieux vaut une personnalisation courte et complète que des onglets vides.

Distinguer « disponible », « sélectionné en aperçu », « équipé » et « verrouillé ». Ne proposer une condition de déblocage que si elle est réelle. Le serveur contrôle qu’un avatar ou élément équipé appartient au catalogue autorisé et, lorsqu’il le faut, a été obtenu par ce joueur.

Pas de boutique, tirage aléatoire, rareté fabriquée, publicité, achat ou récompense liée au temps connecté.

## 5. Mon espace : une carte de joueur et une action claire

Ajouter ou faire évoluer **Mon espace**, accessible depuis l’avatar de la barre supérieure et la navigation arcade. Le menu du compte reste court : Mon espace, Personnaliser, Mon compte, Se déconnecter. Éviter deux écrans concurrents « Mon profil » et « Mon espace » présentant les mêmes informations.

### Partie principale

La carte du joueur affiche son avatar, son AKA, son grade confirmé si disponible et jusqu’à trois badges mis en avant. Le grade est un emblème distinct des badges. Ne pas afficher l’adresse, le nom administratif ou la classe sur cette carte.

Une action principale permet de **Reprendre** la dernière partie accessible. S’il n’y en a pas, proposer **Choisir un jeu**. Le bouton ne doit jamais ouvrir la partie d’un autre compte ou faire passer un jeu verrouillé pour disponible.

Présenter ensuite :

- **Mes jeux** : Code Station et Cyber Funk 3026, avec l’état réel de progression, Reprendre/Jouer ou l’état d’accès utile ;
- **Mes badges** : les accomplissements obtenus et l’accès à la collection ;
- **Ma progression** : seulement les informations fiables, comme un prochain palier défini et une progression calculable.

Les sections peuvent devenir des onglets sur petit écran. Ne pas multiplier les cartes de chiffres. L’absence de donnée n’est ni zéro, ni une absence d’activité prouvée, ni une compétence non acquise.

Si le service fournit une position personnelle autorisée, « Ta place » peut être visible uniquement au joueur. Le classement collectif reste limité à cinq lignes ; ne pas ajouter un classement complet ou des voisins autour du joueur.

### États à dessiner et implémenter

Prévoir compte nouvellement créé, aucun badge, avatar indisponible, chargement, session expirée, réseau coupé, erreur de sauvegarde et personnalisation non enregistrée. Les messages doivent indiquer une action réelle, pas une promesse de disponibilité inventée.

Exemples de textes : « Choisir un jeu », « Aucun badge pour le moment. », « Tes changements n’ont pas été enregistrés. Réessaie. » Éviter les slogans automatiques et le vocabulaire de développement.

## 6. Badges, grade et progression

Réutiliser le catalogue métier des badges et ses identifiants. Pour chaque badge, afficher l’illustration autorisée, le nom, une condition concise, l’état d’obtention et, lorsque disponible, la date et le jeu associé.

La collection propose « Obtenus » et « À débloquer » uniquement si les règles publiées le permettent. Une progression partielle n’est affichée que si elle est mesurée réellement. Une fiche explique comment l’obtenir et permet « Mettre en avant » pour un badge déjà acquis ; le quatrième ajout propose de remplacer l’un des trois existants.

Un badge obtenu ne peut pas être accordé, modifié ou daté par une requête du navigateur. L’attribution provient d’une action validée côté serveur, dédupliquée avec une clé métier stable et une transaction ou garantie équivalente. Rafraîchir, rejouer une requête, ouvrir deux onglets ou changer d’avatar ne doit pas redonner des XP. Équiper un badge ne rapporte aucun point.

S’il n’existe pas de catalogue de badges, documenter un petit catalogue initial, mais n’activer que les règles réellement vérifiables. Propositions de conception, pas accomplissements supposés déjà présents :

| Badge proposé | Condition à raccorder, seulement si disponible |
|---|---|
| Premier signal | Première mission admissible validée par le serveur |
| Signal rétabli | Fin d’un chapitre Code Station réellement identifié et validé |
| Premier néon | Première mission Cyber Funk 3026 admissible et validée |

Ne pas inventer la structure des jeux pour faire entrer ces exemples. Un bouton Jouer, une visite de page, une durée ou un message client « terminé » ne suffit pas. Si les preuves manquent, ne pas créer de fausse réussite ; livrer la collection et documenter l’attribution encore bloquée.

Les grades existants font autorité. Le corpus visuel propose Rookie, Explorer, Operator, Specialist, Vanguard, Elite, Phantom, Legend et Prestige, mais ses seuils sont volontairement non définis. **Ne pas traiter cette liste comme un barème validé.** Conserver « Explorer » comme libellé préféré à « Scout » sans casser un identifiant métier historique.

Ne pas distribuer Rookie à tous pour remplir un champ absent. Afficher un grade de départ seulement s’il est attribué par une règle réelle. Ne pas inventer un prochain seuil, un pourcentage ou une promotion. Aucun reset automatique des acquis au passage Prestige et aucune rétrogradation liée à une note scolaire.

## 7. Mon compte et mot de passe

Séparer **Personnaliser**, consacré à l’identité de jeu, de **Mon compte**, consacré à la sécurité. Dans Mon compte, afficher les informations privées autorisées du compte courant, l’état de vérification réel et les actions disponibles. L’adresse ne doit jamais passer dans les données de carte publique.

La demande « réécrire mon mot de passe » couvre trois parcours distincts : confirmation à l’inscription, modification lorsqu’on le connaît, et réinitialisation lorsqu’on l’a oublié.

### 7.1 Changer son mot de passe

Pour un compte à mot de passe local, formulaire : **Mot de passe actuel**, **Nouveau mot de passe**, **Confirmer le nouveau mot de passe**, puis **Modifier mon mot de passe**. Exiger la session et la vérification de l’authentifiant actuel via le service hôte. Pour un compte géré par un fournisseur externe, réutiliser son parcours de réauthentification ; ne pas inventer un secret local. [S1]

Afficher/masquer concerne uniquement ce que l’utilisateur saisit à cet instant. Aucun ancien mot de passe ne doit être récupérable, affiché ou prérempli. Appliquer la politique du fournisseur et son stockage sécurisé ; aucun secret en clair dans la base, les logs, les captures ou le stockage navigateur. [S3]

Après changement confirmé, appliquer la rotation/révocation des sessions selon le service et la politique validée ; informer clairement de la conséquence. Ne pas conserver un faux état connecté ni affirmer que toutes les sessions ont été fermées sans preuve. [S1]

### 7.2 Mot de passe oublié

Depuis la connexion : demande par adresse ou identifiant autorisé, réponse ne révélant pas l’existence du compte, lien ou mécanisme de récupération du fournisseur, nouveau mot de passe et confirmation. Les jetons doivent être imprévisibles, limités dans le temps, à usage unique et protégés. Pas de questions secrètes, mot de passe commun, code dérivé du prénom ou contournement par l’AKA. [S2]

Gérer lien expiré, déjà utilisé, invalide et demandes abusives. Ne pas invalider le compte du simple fait d’une demande. Après réinitialisation, invalider les sessions suivant la politique de sécurité, notifier sans inclure le secret et revenir à la connexion habituelle, sans auto-connexion improvisée. Aucune donnée de récupération sensible dans la télémétrie ou les ressources tierces. [S2]

Pour un compte scolaire sans moyen de récupération vérifié, utiliser le parcours d’assistance déjà autorisé. Ne pas permettre à un élève d’ajouter une adresse quelconque pour s’emparer d’un compte. Un enseignant n’obtient une capacité de réinitialisation que si ses permissions réelles l’autorisent dans le bon périmètre. Ne jamais réinitialiser une classe en masse pour livrer cette fonction.

### 7.3 Ergonomie des formulaires

Labels associés aux champs, erreurs utiles, bouton afficher/masquer nommé, `autocomplete` adapté (`current-password`, `new-password`, identifiant/e-mail suivant le formulaire), collage et gestionnaires de mots de passe autorisés. Ne pas empêcher de coller dans la confirmation. Les décorations et animations ne passent pas devant les champs. [S4]

Ne pas créer une nouvelle modification d’adresse ou un système de suppression de comptes scolaires en cascade dans ce lot. Réutiliser les fonctions hôtes lorsqu’elles existent ; toute extension de ces opérations sensibles demande son propre cadrage. Aucun bouton de réglage n’est présenté comme fonctionnel s’il ne l’est pas.

## 8. Confidentialité et permissions

L’espace personnel est privé. La galerie, le Top 5 et la fiche visible par les autres utilisent des projections de données distinctes, choisies côté serveur. Le contrôle porte sur chaque lecture et chaque mutation, avec identité, propriété du profil et périmètre scolaire. Un utilisateur connecté n’est pas autorisé à tout voir. [S5]

Un externe ne voit ni annuaire scolaire, ni classe, ni établissement, ni notes, ni e-mail d’élève, par recherche, URL directe, compteur ou cache. Ne pas simplement masquer ces champs en CSS. Un joueur ne peut pas publier sa classe en activant un réglage de profil.

Le profil est privé par défaut ; la visibilité publique et l’apparition au classement public sont des permissions distinctes. Ne pas activer ces possibilités pour les élèves sans politique autorisée. L’existence d’un AKA ne suffit pas à rendre toute donnée publiable. Un aperçu « Voir ma carte » ne change pas la visibilité.

La politique d’inscription des mineurs doit être validée par le responsable du produit/établissement avant ouverture publique. Ne pas présenter une case d’âge comme une conformité automatique ; les vérifications éventuelles doivent être proportionnées et minimiser les données. Ne pas collecter une date de naissance complète, une pièce d’identité ou un parent par défaut. [S6]

À la déconnexion ou lors d’un changement de compte, invalider les caches privés et les requêtes tardives susceptibles de repeupler l’écran du compte précédent. Le retrait de visibilité doit être répercuté dans les listes, totaux et caches publics concernés sans effacer arbitrairement les traces scolaires.

Pas de messagerie, ajout d’amis, présence en ligne, biographie libre, recherche d’élèves publics ou liens sociaux dans ce lot.

## 9. Raccordement technique attendu

Adapter les services existants à ces opérations, sans supposer leurs noms réels : lire le compte et ses capacités ; lire/créer le profil arcade ; modifier l’AKA ; lister/choisir un avatar ; lire les badges obtenus ; choisir les badges mis en avant ; lire la progression par jeu ; gérer inscription/vérification/connexion/déconnexion/changement/récupération.

Le modèle conceptuel sépare :

- **compte hôte** : identifiant stable et sécurité gérée par l’authentification ;
- **profil arcade** : lien unique au compte, AKA d’affichage et clé canonique, avatar, préférences autorisées et état de personnalisation ;
- **récompenses** : définitions, attributions validées et références mises en avant ;
- **progression** : sauvegardes et règles des moteurs existants, sans copie simplifiée parallèle.

Les noms exacts et la représentation JSON/relationnelle suivent le dépôt. Les champs e-mail, rôle, XP, grade, permissions, propriétaire et badges obtenus ne sont pas des champs modifiables par un endpoint générique de profil. Utiliser une liste explicite des modifications autorisées. Le serveur déduit l’utilisateur courant de la session, pas d’un `userId` arbitraire envoyé par le client.

Un profil créé simultanément dans deux onglets ne doit exister qu’une fois. Les changements d’AKA concurrents et l’équipement de badges sont validés atomiquement. Les brouillons visuels sont locaux et temporaires ; le profil persistant vient du serveur. Ne pas utiliser `localStorage` comme base de comptes ou de récompenses.

Préserver les sauvegardes et les identifiants existants. Si une migration est indispensable, expliquer l’impact, la compatibilité avec les données existantes et le retour arrière ; tester uniquement sur une base locale/jetable autorisée. Ne pas renommer en masse les comptes, initialiser de faux grades ou importer les personnes fictives du prototype.

Utiliser les protections de session, d’origine/CSRF, de transport et de limitation d’abus du framework et du fournisseur ; ne pas créer une cryptographie maison. Les secrets restent dans les variables serveur et ne sont ni committés ni copiés dans ce dossier.

L’ouverture publique nécessite les services et politiques réels. Si l’e-mail, la récupération ou un contrôle indispensable manque, livrer les écrans et les parties indépendantes derrière les capacités/drapeaux existants, tester avec le fournisseur de test, laisser le public fermé et documenter exactement le blocage. Ne pas substituer une simulation à une erreur en production.

## 10. Design et microcopie à appliquer

Réutiliser les tokens, portraits autorisés, cadres et composants du module intégré. Référence couleur : fond `#0B0B13`, panneaux `#11111D`/`#171722`, texte `#F7F3FA`, cyan `#60DCF5`, rose `#FF5078`. Ne pas modifier globalement les cours ou l’espace professeur.

Les titres arcade peuvent être massifs ; les labels, champs, descriptions de badges et messages restent en police de lecture normale. Les textes sont de vrais éléments HTML, pas intégrés à une image. Éviter l’accumulation de néons et de panneaux sur les formulaires.

Une seule action principale par étape. Son désactivé par défaut ou préférence existante respectée, animations réduites suivant le réglage utilisateur et système, navigation clavier complète, focus visible, sélection d’avatar utilisable sans survol. Prévoir noms accessibles et états de sélection des choix, gestion du focus des dialogues, erreurs annoncées sans agressivité et absence de piège clavier.

Microcopie cible :

| Emplacement | Texte |
|---|---|
| Inscription | Créer un compte |
| Connexion | Se connecter |
| Personnalisation initiale | Choisis ton joueur |
| Pseudo | AKA — ton pseudo |
| Choix | Choisir cet avatar |
| Validation initiale | Entrer dans l’arcade |
| Vue privée | Mon espace |
| Apparence | Personnaliser |
| Sécurité | Mon compte |
| Récompenses | Mes badges |
| Mise en avant | Mettre en avant / Retirer de ma carte |
| Modification du profil | Enregistrer / Annuler |
| Confirmation réelle | Modifications enregistrées. |
| Pseudo refusé | Cet AKA n’est pas disponible. |
| Confirmation incorrecte | Les mots de passe ne correspondent pas. |
| Récupération | Mot de passe oublié ? |
| Déconnexion | Se déconnecter |

Les états techniques restent dans les logs et rapports. Aucun label « payload », « provider », « profil seedé », « badge simulé » ou « synchronisation runtime » dans les vues réelles. Les environnements de démo isolés doivent néanmoins rester explicitement identifiés comme tels ; ne pas dissimuler leur statut.

## 11. Recette : prouver les parcours complets

Écrire des tests adaptés au dépôt et noter pour chaque scénario : **PASS**, **FAIL**, **NON EXÉCUTÉ** ou **BLOQUÉ**, avec la preuve réelle. Les scénarios ci-dessous ne sont pas des résultats déjà obtenus.

### A — Continuité et inscription

1. Commencer ouvre les deux jeux sans exiger une inscription.
2. Un élève connecté utilise son compte existant et ne reçoit aucun compte doublon.
3. Une inscription externe valide aboutit au profil persistant, sans droit scolaire.
4. Un e-mail non vérifié ne donne pas les capacités réservées aux comptes vérifiés.
5. La vérification peut être reprise sur un autre navigateur ; un lien expiré/consommé échoue correctement.
6. Les doublons d’adresse et les demandes de récupération n’exposent pas d’identité scolaire.
7. Sans fournisseur d’e-mail opérationnel, aucune fausse validation ni ouverture publique n’est annoncée.
8. Un retour vers un jeu est interne et autorisé ; une URL externe et un jeu interdit sont refusés.

### B — AKA et avatar

9. Deux créations simultanées produisent au plus un profil pour le compte.
10. Un AKA modifié apparaît partout où ce joueur est autorisé, sans changer son identifiant scolaire.
11. La même clé d’AKA, y compris en casse différente, ne peut être réservée simultanément par deux comptes dans le même périmètre.
12. Les formats interdits, noms réservés et tentatives d’injection sont traités sans rendu exécutable.
13. Un avatar autorisé se sélectionne au clavier, se prévisualise et persiste après reconnexion.
14. Annuler restaure l’état enregistré ; une panne n’affiche pas un faux succès.
15. Un avatar inconnu ou verrouillé est refusé aussi par requête directe.
16. Les sauvegardes et XP restent identiques après changement d’AKA/avatar.

### C — Espace et récompenses

17. Mon espace utilise les vraies données du compte courant, pas celles du front fictif.
18. Reprendre ouvre uniquement une sauvegarde accessible à ce joueur.
19. Aucun badge et progression indisponible ont des états distincts, sans faux zéros.
20. Équiper/reclasser/retirer jusqu’à trois badges acquis fonctionne et persiste.
21. Un quatrième badge implique un remplacement ; un badge non obtenu est refusé côté serveur.
22. Une réussite validée est attribuée une seule fois malgré deux requêtes ou deux onglets.
23. Un simple événement JavaScript ou un `grade`/`xp` forgé n’accorde aucune récompense.
24. Le grade et ses seuils viennent du catalogue réel ; aucune promotion n’est inventée.
25. Le Top 5 reste limité à cinq personnes ; la position personnelle éventuelle ne révèle aucun voisin.

### D — Mot de passe et session

26. Une confirmation de mot de passe différente empêche la mutation sans perdre les autres champs non sensibles.
27. Changer le mot de passe exige l’authentifiant actuel ou le parcours équivalent du fournisseur.
28. Après changement confirmé, l’ancien secret échoue, le nouveau fonctionne et la politique de session est appliquée réellement.
29. Le parcours de récupération fonctionne ; un jeton expiré, utilisé ou falsifié est refusé.
30. Un compte scolaire sans e-mail et un compte fédéré utilisent chacun leur parcours autorisé, sans secret local improvisé.
31. Aucun mot de passe ni jeton de récupération n’apparaît dans le stockage navigateur, les logs, la télémétrie ou les captures de recette.
32. Le collage, l’auto-remplissage et les boutons afficher/masquer fonctionnent.
33. Après déconnexion puis connexion d’un autre compte sur le même PC, les données du premier restent inaccessibles, y compris via retour et réponses réseau tardives.

### E — Confidentialité et rendu

34. Modifier l’identifiant de ressource dans une requête ne permet pas de lire/modifier le profil d’autrui.
35. Un externe ne peut pas obtenir de liste, compteur, fiche ou affiliation scolaire par URL/API/cache.
36. Les champs sensibles et champs métier non modifiables sont refusés par la mutation de profil.
37. L’aperçu de carte ne publie pas le profil ; les choix de visibilité sont contrôlés séparément.
38. Contrôler les vues à 1440 px, 1024 px et 390 px : pas de champ, bouton, badge ou message tronqué.
39. Tester sélection d’avatar, dialogue de badge, formulaires et déconnexion au clavier ; respecter la réduction d’animation.
40. Les parcours cours/professeur et les deux moteurs existants ne régressent pas après intégration.

Les comptes de test sont synthétiques et confinés à l’environnement autorisé. Ne pas tester les réinitialisations sur de vrais élèves ni envoyer des e-mails à leurs adresses. Une simulation de fournisseur teste le code, pas la délivrabilité du service réel : distinguer les deux résultats.

## 12. Ordre de travail et résultat attendu

Avancer par tranches fonctionnelles : audit et raccordements existants ; identité/avatar et espace privé pour comptes déjà connectés ; inscription/vérification externes ; sécurité/récupération ; collection et mise en avant des badges ; confidentialité, états d’erreur et recette.

Cet ordre ne dispense pas de traiter la sécurité dès chaque tranche. Ne pas ouvrir l’inscription publique avant que son cycle de compte complet soit prêt.

Produire dans le dépôt : les modifications applicatives, les migrations justifiées éventuelles, les tests, les captures réellement exécutées et une documentation de configuration sans secret. Sous `TWEEN_TEACH_WORLD_ARCADE/SUIVI/`, créer sans écraser les rapports précédents :

- `COMPTE_JOUEUR_AUDIT.md` : état réel initial, choix réutilisés, mapping des capacités ;
- `COMPTE_JOUEUR_RECETTE.md` : les 40 scénarios et leurs preuves ;
- `COMPTE_JOUEUR_LIVRAISON.md` : fichiers modifiés, commandes réellement lancées, fonctions prêtes, limites et conditions d’activation ;
- `COMPTE_JOUEUR_CAPTURES/` : captures sans identités réelles, mots de passe ou jetons.

Effectuer une passe de revue après implémentation : parcours utilisateur complet, cohérence de l’identité visuelle, fuite de données, permissions, mutation des badges, récupération et non-régression. Corriger puis relancer les tests concernés ; ne pas se contenter d’une auto-note.

Ne pas réécrire les références pour faire passer une comparaison. Ne pas remplacer l’application par le HTML autonome. Ne pas déployer, changer une politique globale, ouvrir le public ou migrer une base réelle sans validation explicite. Respecter les modifications utilisateur déjà présentes.

**Commence par l’examen du dépôt, puis implémente les parties non bloquées. Une jolie page sans persistance n’est pas la fonctionnalité demandée. Une dépendance absente doit être signalée précisément, pas remplacée par un faux résultat.**

---

## Références de sécurité et d’accessibilité

Sources primaires consultées le 5 octobre 2026. Elles étayent les garde-fous signalés dans le texte ; les choix d’interface, libellés, limites de personnalisation et exemples de badges sont des décisions de conception de ce lot, pas des standards externes. Examiner les versions applicables du fournisseur et de ses bibliothèques dans le dépôt avant de coder.

```text
[S1] OWASP — Authentication Cheat Sheet
https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

[S2] OWASP — Forgot Password Cheat Sheet
https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

[S3] OWASP — Password Storage Cheat Sheet
https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

[S4] W3C WAI — Understanding SC 3.3.8: Accessible Authentication (Minimum)
https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html

[S5] OWASP — Authorization Cheat Sheet
https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

[S6] CNIL — Recommandation 7 : vérifier l’âge de l’enfant et l’accord des parents
https://www.cnil.fr/fr/recommandation-7-verifier-lage-de-lenfant-et-laccord-des-parents-dans-le-respect-de-sa-vie-privee
```
