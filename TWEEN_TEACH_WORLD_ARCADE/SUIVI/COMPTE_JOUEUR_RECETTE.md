# Recette COMPTE_JOUEUR — 5 octobre 2026

Recette sur l’application Express réelle, bases SQLite `:memory:`, comptes synthétiques de `tests/fixtures/arcade.mjs`, Chrome local. Aucun compte réel, e-mail, service distant ni migration réelle. Les captures utilisent uniquement des identités synthétiques ; les champs de mot de passe sont vides ou masqués dans les captures d’incident.

Preuves : **API** = `COMPTE_JOUEUR_TESTS_API.log` (31/31, dont 16 nouveaux tests compte et 15 tests arcade). **NAV** = `COMPTE_JOUEUR_NAVIGATEUR.json` et `.log` (parcours détaillés et captures). **REG** = `COMPTE_JOUEUR_REGRESSION/navigateur.json` et `COMPTE_JOUEUR_REGRESSION.log` (11/11 groupes historiques adaptés aux nouvelles routes). **UNIT** = `COMPTE_JOUEUR_TESTS_COMPLETS.log` (115/115 à la passe complète ; les deux tests supplémentaires de concurrence et d’abus passent ensuite dans API).

`PASS` décrit le périmètre explicitement précisé dans la preuve. `BLOQUÉ` indique que le parcours complet demandé dépend d’un service/catalogue absent, même si son refus sûr ou une partie indépendante ont été testés. Les mécanismes à trois/quatre badges sont testés avec des entrées unitaires synthétiques, jamais avec des récompenses fictives servies en production.

| N° | Scénario du lot | État | Preuve et limites |
| --- | --- | --- | --- |
| 1 | Commencer ouvre les deux jeux sans inscription | PASS | NAV visiteur, REG entrée ; deux bornes, Cyber Funk indisponible explicite. |
| 2 | Élève existant, même compte | PASS | API profil idempotent et identité préservée ; NAV connexion hôte puis personnalisation. |
| 3 | Inscription externe persistante sans droit scolaire | BLOQUÉ | Fournisseur et cycle externe absents. API register retourne 503, aucun compte créé. |
| 4 | Capacités limitées avant vérification e-mail | BLOQUÉ | Aucun compte externe en attente ni service de vérification. Toutes ces capacités sont désactivées. |
| 5 | Vérification autre navigateur, expiration et consommation | BLOQUÉ | Aucun jeton de vérification émis. Refus uniforme testé, pas de cycle complet prétendu. |
| 6 | Doublons d’adresse et récupération sans énumération | BLOQUÉ | API prouve la même réponse 503 pour adresse existante/inconnue ; les inscriptions répétées et récupérations effectives attendent le fournisseur. |
| 7 | Pas de faux e-mail ou ouverture sans fournisseur | PASS | API lifecycle fermé ; NAV inscription désactivée, confirmation visible, assistance scolaire. |
| 8 | Destination interne et jeu autorisé | PASS | API arcade refuse URL/returnTo/gameId forgés et mission hors classe ; NAV conserve l’intention Code Station après AKA. |
| 9 | Créations simultanées : un profil | PASS | Six requêtes ensure concurrentes, un publicId, nombre de comptes inchangé. |
| 10 | AKA répercuté sans modifier l’identifiant scolaire | PASS | API compte/annuaire autorisé ; NAV barre, aperçu et Mon espace. Classement absent. |
| 11 | Unicité insensible à la casse, demandes simultanées | PASS | API Nova/NOVA : un 200, un 409 ; NFKC et concurrence enseignant/élève dans une classe ; même clé autorisée dans une autre classe. |
| 12 | Formats, noms réservés et injection | PASS | API rejette caractères exécutables, longueurs invalides et noms de fonction réservés ; texte échappé dans les vues. Format existant conservé (2–24, Unicode/espaces). |
| 13 | Avatar au clavier, aperçu et reconnexion | PASS | NAV flèche droite entre radios, aperçu, choix 04 et lecture dans une autre session. |
| 14 | Annuler et erreur de sauvegarde | PASS | NAV brouillon restauré, PUT 503 sans succès prématuré, reprise et confirmation serveur. |
| 15 | Avatar inconnu/verrouillé refusé directement | PASS | API rejette 99, nombre et chemin arbitraire ; catalogue existant sans avatar verrouillé. NAV asset manquant : repli explicite sans changer le profil. Aucun verrou fictif ajouté. |
| 16 | Sauvegardes et XP inchangés | PASS | API comparaison profonde de `player_progression` avant/après AKA/avatar et badge ; identifiants hôtes inchangés. |
| 17 | Mon espace lit le vrai compte courant | PASS | API space ; NAV Aster_Nova synthétique stocké dans le compte hôte, aucun état du prototype. |
| 18 | Reprendre uniquement une sauvegarde autorisée | PASS | API sauvegarde propre, refus compte voisin, retrait après fermeture de séance ; NAV vrai runtime PédagoLab. |
| 19 | Aucun badge et progression indisponible distincts | PASS | API `badges.status=ready` sans obtenu / `progression.status=unavailable` ; NAV messages distincts, aucun faux zéro. |
| 20 | Équiper, ordonner et retirer jusqu’à trois acquis | BLOQUÉ | Un seul badge raccordable en production : équiper/retirer/reconnexion passent API+NAV. Trois emplacements et ordre passent en tests unitaires ; persistance de trois badges métier non testable sans deux autres attributions réelles. |
| 21 | Quatrième badge remplacé, badge non obtenu refusé | PASS | Tests unitaires `nextFeatured` et `validateFeatured` avec quatre entrées synthétiques : remplacement/ordre/plafond ; API refuse badge non obtenu et doublon. Le catalogue métier ne permet pas un parcours quatre badges de bout en bout. |
| 22 | Attribution unique malgré concurrence/rejeu | PASS | API validation via la vraie route professeur, six lectures concurrentes : une attribution, une date, zéro XP modifié ; NAV obtention réelle en recette. |
| 23 | Événement JS, grade/XP forgés sans récompense | PASS | API deux déclarations client restent `review_required` ; mutation refuse XP/grade/attributions ; seul le professeur autorisé valide. |
| 24 | Grade et seuils métier, aucune promotion inventée | BLOQUÉ | Catalogue métier absent ; invariant d’absence de Rookie/grade/palier inventé testé API+NAV. |
| 25 | Top 5 maximum et position privée | BLOQUÉ | Métrique fiable absente ; serveur renvoie indisponible, zéro ligne et aucune position. Limite cliente de cinq conservée ; pas de classement réel prétendu. |
| 26 | Confirmation différente empêche le changement | PASS | API et NAV : message attendu, aucune mutation, identifiant conservé à l’écran. Inscription externe reste fermée. |
| 27 | Secret actuel requis | PASS | API absent/incorrect refusé ; NAV erreur utile. Aucun parcours fournisseur externe inventé. |
| 28 | Ancien secret refusé, nouveau accepté, sessions révoquées | PASS | API deux cookies invalidés, espaces du nouveau secret conservés ; concurrence 200/401 ; NAV seconde session refusée et reconnexion. |
| 29 | Récupération, jetons expirés/utilisés/falsifiés | BLOQUÉ | Pas de fournisseur ni de jetons de récupération. Les demandes fermées répondent uniformément sans modifier le compte. |
| 30 | Assistance scolaire et compte fédéré | BLOQUÉ | Assistance professeur existante testée : propre classe seulement, sessions révoquées. Compte sans secret local refusé. Fournisseur fédéré absent, parcours fédéré non exécuté. |
| 31 | Aucun secret en stockage/log/capture | PASS | NAV localStorage limité aux préférences et sessionStorage vide ; API audit sans secret ; captures avec mots de passe vides/masqués. Aucun jeton de récupération n’existe. |
| 32 | Collage, autocomplete, afficher/masquer | PASS | NAV vrai presse-papiers Chrome, collage clavier et boutons nommés ; `username`, `current-password`, `new-password` présents. Gestionnaires tiers réels non exécutés. |
| 33 | Autre compte, retour et réponses tardives | PASS | NAV réponse de Mon espace retenue puis libérée après logout/login B ; identité privée A absente, Retour sûr ; autre onglet nettoyé et session expirée. REG connexion B après sortie. |
| 34 | Pas de lecture/mutation du profil d’autrui | PASS | API propriété déduite de la session ; identifiants/champs forgés refusés ; accès détail hors classe/private refusé. |
| 35 | Externe : aucune liste/compteur/affiliation scolaire | PASS | API rôle externe synthétique même avec session émise côté serveur : 403 sur annuaire/détail/espace/badges/compte ; visiteurs 401. Réponses `no-store`. |
| 36 | Champs sensibles/métier non modifiables | PASS | API refuse userId, rôle, classe, e-mail, XP, grade, attributions et badges dans profil ; endpoint dédié contrôle les badges équipés. |
| 37 | Aperçu sans publication, visibilité distincte | PASS | NAV Voir ma carte sans mutation ; partage classe existant facultatif ; API refuse communauté/public, retrait de visibilité appliqué immédiatement. |
| 38 | Vues 1440, 1024, 390 px | PASS | NAV quatre vues à chaque taille, douze captures réelles, aucune page en débordement horizontal ; relecture visuelle effectuée. |
| 39 | Clavier, badges, formulaires, sortie, animations | PASS | NAV radios/flèches, dialogue Entrée/Échap et restitution focus, formulaires, préférence système ; REG surface équivalente 200 %. Lecteur d’écran et zoom natif non exécutés. |
| 40 | Cours/professeur et deux moteurs | BLOQUÉ | Cours/professeur et Code Station : REG 11/11, UNIT, visuels 27/28 puis reprise ciblée 1/1. Cyber Funk absent initialement ; sa non-régression fonctionnelle ne peut pas être exécutée. |

## Incidents de recette et reprises

- Les premiers tests API sous sandbox n’ont pas pu écouter sur loopback (`EPERM`). Exécutés ensuite avec permission d’exécution locale élargie, toujours sur SQLite mémoire : 31/31.
- Le script navigateur a été corrigé pour recharger une URL identique et viser le titre du contenu plutôt que le titre caché de l’accueil.
- L’assertion de confidentialité tenait initialement pour privée une carte volontairement partagée avec la classe. Le scénario met maintenant le profil en privé avant de vérifier l’absence de ses données chez le compte suivant ; aucun contrôle métier n’a été assoupli.
- Les tests ont révélé deux défauts applicatifs corrigés : nom accessible afficher/masquer incohérent ; ancienne session mise en cache lors d’une connexion hôte suivie d’une navigation par hash. Les routes privées relisent maintenant la session. La connexion est désactivée jusqu’à la fin réelle du logout.
- Une première passe visuelle s’est interrompue après 14 contrôles bureau ; seuls les processus de cette recette ont été arrêtés. Reprise complète : 27/28, un délai dépassé à l’affichage du diagnostic mobile. Ce test hôte inchangé a réussi seul ensuite (1/1, `COMPTE_JOUEUR_VISUEL_REPRISE.log`). Les baselines n’ont pas été modifiées.

Les blocages ci-dessus ne constituent pas des échecs masqués ni une validation de production. Les captures et tests ne vérifient ni PostgreSQL distant, ni délivrabilité e-mail, ni politique d’inscription des mineurs.
