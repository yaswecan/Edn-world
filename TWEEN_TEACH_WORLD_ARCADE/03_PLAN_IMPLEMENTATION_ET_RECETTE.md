# Plan de réalisation et recette

Ce plan est destiné à Codex dans le vrai dépôt. Chaque lot laisse un état fonctionnel et testable.
Aucune case n’est réputée réussie dans Tween Teach au moment de la livraison du pack.

## Lot 0 — Inventaire et protection de l’existant

Lire les instructions hôtes, examiner l’état Git, identifier le routeur, la stack, les sessions,
les permissions, les vrais moteurs, les sauvegardes et les grades. Remplir `SUIVI/AUDIT_DEPOT.json`.
Conserver les changements utilisateur. Prendre les références utiles dans une base de test autorisée,
jamais un dump de production contenant les données d’élèves. Vérifier les scripts avant de les lancer.

**Sortie :** mapping des services et chemins observés, décisions réellement manquantes, stratégie de
styles isolés, commandes de test connues et point de retour arrière. Poursuivre sans attendre les
seules décisions qui ne bloquent pas le lot suivant.

## Lot 1 — Une première tranche visible, sans authentification simulée

Créer la route/layout du module, adapter les assets et styles, intégrer l’entrée puis la salle.
Récupérer la session hôte et conserver une voie de retour vers le produit. Les données non branchées
montrent un état vide/indisponible exact, pas des fixtures déguisées. Garder le nouveau point d’entrée
privé tant que sa recette minimale manque.

**Sortie :** Commencer → deux bornes au bon rendu, navigation clavier et mobile, cours inchangé.

## Lot 2 — Lancer et reprendre les vrais jeux

Brancher Code Station, puis Cyber Funk si son moteur existe. Conserver les IDs, sauvegardes et
verrous professeur. Le manque d’un moteur bloque seulement sa carte de lancement, pas le module.
Tester l’autorisation, le double clic, les réponses tardives, le retour et l’erreur réseau.

**Sortie :** vraie reprise pour chaque moteur disponible ; aucune mini-démo en production.

## Lot 3 — Profils et galerie avec séparation des publics

Brancher profil, avatar, liste paginée, recherche et fiches sur des DTO minimaux. Les périmètres sont
retournés par le serveur. Tester élève, professeur, externe, visiteur et classes différentes avec
comptes synthétiques. Gérer les caches lors de déconnexion/changement de compte/retrait de visibilité.

**Sortie :** tous les joueurs autorisés sont consultables, aucune fuite d’annuaire scolaire.

## Lot 4 — Top 5 et grades réels

Réutiliser le système métier, son validateur et son barème. Créer les raccordements et tests nécessaires,
pas un compteur local. Dédupliquer les attributions concurrentes, définir les périodes supportées,
limiter le Top 5 à cinq lignes. Lire le catalogue réel des grades sans en inventer les seuils.
Si les règles n’existent pas, documenter la décision et conserver un état indisponible honnête.

**Sortie :** classements fiables pour les métriques réellement supportées, ou blocage précisément décrit.

## Lot 5 — Inscription externe derrière ses garde-fous

Raccorder les écrans au fournisseur existant : création, vérification, connexion, récupération et
sortie de session. Profil privé initial, rôle serveur, accès scolaire refusé. Utiliser le fournisseur
de test pour les essais. L’envoi d’un e-mail réel ou l’ouverture du public ne sont pas nécessaires
pour valider le rendu ; leur service et leur politique doivent néanmoins être validés avant publication.

**Sortie :** parcours testé dans l’environnement autorisé, drapeau public fermé si une condition manque.

## Lot 6 — Revue, captures, documentation et activation maîtrisée

Exécuter lint/typecheck/tests/build du dépôt, recette par rôle, comparaison des captures et contrôle
de non-régression. Utiliser `06_PROMPT_CODEX_REVIEW.md` pour une autre passe ; corriger puis retester,
au maximum trois cycles avant rapport des blocages. Ne pas baisser les critères pour annoncer un succès.

**Sortie :** code et tests, captures réelles, décision par critère, impact des migrations éventuelles,
configuration sans secrets et procédure de retour arrière. Aucune publication de production implicite.

## Statuts à employer

- `passed` : scénario exécuté et preuve citée.
- `failed` : échec reproduit et décrit.
- `not_run` : non exécuté ; indiquer pourquoi.
- `blocked` : dépendance ou décision manquante clairement identifiée.
- `not_applicable` : hors périmètre après justification, pas pour éviter un test difficile.

Mettre les résultats dans `SUIVI/RECETTE.json`, sans modifier les rapports du pack dans `RAPPORTS/`.
Un blocage ne devient pas un résultat positif. Les tests de permissions ne sont jamais « non applicables »
au motif que le front masque un menu.

## Matrice de recette

| ID | Priorité | Scénario | Résultat attendu |
|---|---|---|---|
| UI-01 | P1 | **Entrée / clavier** — Visiteur et élève connecté | Commencer et Entrée ouvrent les deux bornes ; un champ ou dialogue actif ne déclenche pas la salle. |
| UI-02 | P1 | **Lien profond / retour** — Session autorisée | Retour depuis le jeu vers la salle, refresh et retour navigateur sans réinitialisation ni passage forcé au splash. |
| UI-03 | P1 | **Rendu bureau** — 1440×1050 et 1280×720 | Deux silhouettes de bornes, ville, cyan/rose et panneaux comparables aux captures ; pas de cartes génériques. |
| UI-04 | P1 | **Mobile / tablette** — 768×1024, 390×844, 360×800 | Pas de débordement horizontal ; bornes empilées et contrôle tactile lisible. |
| UI-05 | P1 | **Focus / zoom** — Clavier et zoom 200 % | Focus visible, dialogues fermables, retour du focus et champs utilisables. |
| UI-06 | P2 | **Son / mouvements** — Préférence système réduite | Aucun son automatique ; réduction des mouvements respectée ; CRT désactivable. |
| UI-07 | P1 | **Démontage du module** — Dix navigations aller-retour | Aucun listener, canvas ou son résiduel ; cours et espace professeur inchangés. |
| UI-08 | P1 | **Chargement / absence / panne** — Réponses 200 vide, 403, 500, hors réseau | États distincts sans fixtures de secours, traces techniques ni fausse confirmation. |
| AUTH-01 | P0 | **Session élève** — Élève connecté | Même identité et session ; aucune seconde création de compte ; sauvegarde retrouvée. |
| AUTH-02 | P0 | **Inscription externe** — Fournisseur de test configuré | Compte réel de test créé via service hôte ; rôle externe fixé côté serveur et vérification e-mail appliquée. |
| AUTH-03 | P0 | **Élévation de rôle** — Payload/query/storage role=teacher ou student | Aucun privilège scolaire accordé ; champs non autorisés refusés/ignorés côté serveur. |
| AUTH-04 | P0 | **Handlers simulés** — Bundle de production et interception réseau | Aucun handler créant une fausse session locale ; aucune connexion réussie sur simple validation HTML. |
| AUTH-05 | P0 | **Secrets** — Connexion, inscription, logs et stockage de test | Ni mot de passe ni jeton sensible en localStorage, URL, rapport ou log ; captures masquées. |
| AUTH-06 | P1 | **Vérification / récupération** — Jeton expiré, réutilisé et renvoi | Récupération via fournisseur hôte ; messages utiles et aucune fausse promesse d’envoi. |
| AUTH-07 | P0 | **Drapeau public fermé** — E-mail non prêt ou politique non validée | Inscription nouvelle fermée en production sans bloquer la connexion scolaire existante. |
| AUTH-08 | P1 | **Déconnexion / changement de compte** — Compte A puis compte B | Session invalidée selon le fournisseur ; aucune fiche privée de A servie à B par le cache. |
| ACL-01 | P0 | **Annuaire scolaire public** — Visiteur et externe | Refus via UI, requête directe, recherche, compteur, pagination, fiche et export. |
| ACL-02 | P0 | **Isolation entre classes/écoles** — Compte autorisé à classe A seulement | Classe B inaccessible même avec identifiant deviné ; isolation des caches et des totaux. |
| ACL-03 | P0 | **Professeur** — Professeur classe A | Galerie complète de ses périmètres autorisés, pas de lecture automatique de toutes les écoles. |
| ACL-04 | P0 | **Profil privé** — Profil non public | Ni profil ni grade ni affiliation révélés à un contexte non autorisé ; DTO public minimal. |
| ACL-05 | P0 | **Retrait visibilité** — Profil précédemment visible | Retrait effectif des listes/Top 5/caches publics sans suppression non autorisée des archives scolaires. |
| GAME-01 | P1 | **Code Station réel** — Moteur hôte présent | Le vrai moteur et sa sauvegarde sont lancés, pas la mini-démo Canvas du pack. |
| GAME-02 | P1 | **Cyber Funk réel ou absent** — Moteur hôte inspecté | Vrai moteur lancé ou état indisponible honnête ; aucun remplacement silencieux par la démo. |
| GAME-03 | P0 | **Déblocage / accès direct** — Niveau verrouillé | Refus côté serveur même par URL directe ; condition professeur conservée. |
| GAME-04 | P1 | **Annulation asynchrone** — Réponse lanceur retardée | Événement annulé avant await ; aucune démo ouverte pendant l’autorisation. |
| GAME-05 | P0 | **Route / cible falsifiée** — Jeu inconnu, URL externe, retour malveillant | Destination refusée ; pas de redirection arbitraire ni de hausse de droits. |
| GAME-06 | P1 | **Concurrence / démontage** — Double clic puis sortie du module | Une ouverture à la fois ; réponse tardive ignorée après démontage. |
| GAME-07 | P0 | **Sauvegarde d’un autre** — Compte A demande sauvegarde B | Refus serveur ; progression A préservée et aucune donnée B révélée. |
| SCORE-01 | P0 | **Fausse réussite** — Console/storage/événement terminé=true | Aucun point ni grade attribué par le simple signal client. |
| SCORE-02 | P0 | **Double crédit** — Réussite simultanée via deux onglets | Une attribution selon clé métier stable, y compris si la clé client change. |
| SCORE-03 | P1 | **Reprise réseau** — Même réussite renvoyée après interruption | Pas de double crédit ; état confirmé uniquement après réponse persistée. |
| TOP-01 | P1 | **Limite de cinq** — 0, 3, 5 et 8 joueurs éligibles | 0 à 5 lignes maximum ; aucun remplissage fictif ni curseur vers des lignes suivantes. |
| TOP-02 | P1 | **Ex æquo** — Égalité à la cinquième ligne | Départage stable/documenté ; cinq personnes maximum, pas de sixième ligne. |
| TOP-03 | P0 | **Périmètre et place privée** — Externe et élève hors Top 5 | Données du bon scope ; propre position seulement en encart privé, aucun voisin supplémentaire. |
| TOP-04 | P1 | **Périodes / jeux** — Bornes temporelles et métriques différentes | Filtres calculés serveur ; pas d’addition inter-jeux non comparable ni remise à zéro des XP cumulés. |
| RANK-01 | P1 | **Grades réels** — Catalogue métier présent | Mêmes IDs et règles, grade réel affiché ; aucun seuil importé de la proposition. |
| RANK-02 | P1 | **Catalogue absent** — Aucune configuration métier | Pas de promotion automatique ni grade personnel de secours ; proposition réservée à la validation privée. |
| RANK-03 | P0 | **Indépendance pédagogique** — Note modifiée ou absence d’évaluation | Aucun changement de grade ou score arcade déduit d’une note ou d’une absence. |
| REG-01 | P0 | **Non-régression données** — Snapshot base de test avant/après | Comptes, notes, missions, conditions de déblocage et sauvegardes existants conservés. |
| REG-02 | P1 | **Non-régression visuelle** — Cours élève et page professeur | Aucun style global ou raccourci arcade n’affecte les pages non arcade. |
| OPS-01 | P1 | **Build / dépendances** — Commandes du dépôt | Lint/typecheck/tests/build pertinents exécutés ; lockfile respecté ; aucune dépendance lourde sans besoin. |
| OPS-02 | P0 | **Activation / rollback** — Environnement local ou preview autorisé | Drapeaux documentés, retour vers ancienne entrée possible, aucune activation publique ou migration réelle implicite. |
| OPS-03 | P1 | **Distribution du pack** — Bundle et répertoire public | Pas de docs internes, corpus complet, référence HTML ou fixtures servis dans les routes de production. |
| OPS-04 | P1 | **Rapport honnête** — Rapport de livraison de Codex | Commandes/captures réellement obtenues ; statuts non exécutés explicites et aucun verdict inventé. |


## Preuves attendues et limites

Captures minimales : entrée, salle, galerie, Top 5, profil, grades réellement configurés, formulaire
public en environnement de test, erreur/indisponibilité et mobile. Associer chaque capture à la route,
au rôle synthétique, au viewport, à la commande/outil utilisé et au commit ou diff concerné.
Les images déjà fournies dans ce pack sont des références, pas les captures de l’intégration finale.

Pour une logique serveur, citer test automatisé et résultat, pas uniquement capture UI. Pour le
classement, couvrir nombre de lignes, scoping, ex æquo, bornes de périodes et intégrité des points.
Pour les régressions, comparer les structures et données pertinentes dans une base jetable de test.

Les contrôles locaux du pack et le test de son pont ne prouvent rien sur l’authentification réelle,
les règles d’un hébergement ou les appareils physiques. Ne jamais transformer « compilation réussie »
en « production sécurisée ». Les sources et les limites de cette livraison sont dans `05_SOURCES_ET_PROVENANCE.md`.
