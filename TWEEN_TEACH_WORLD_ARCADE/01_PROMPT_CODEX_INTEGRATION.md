# PROMPT CODEX — INTÉGRER WORLD ARCADE DANS TWEEN TEACH

Tu es chargé de l’intégration complète du module World Arcade dans **le dépôt existant ouvert
avec VS Code**. Agis comme un développeur senior responsable de la qualité du produit, du rendu
de jeu vidéo et des données d’une plateforme utilisée notamment par des mineurs.

**Réalise les changements dans le code. Ne te limite pas à décrire une architecture ou à générer
un nouveau prototype isolé. N’annonce pas un raccordement que tu n’as pas vérifié.**

## 1. Mission et résultat attendu

L’utilisateur entre dans une salle d’arcade cyberpunk. Un écran d’entrée affiche **World Arcade**
et **Commencer**. Le clic, ou Entrée quand aucun champ/dialogue n’est actif, ouvre le choix des
mondes : **Code Station** et **Cyber Funk 3026**. L’identité visuelle doit rester proche du front
fourni : deux bornes matérielles HTML/CSS, ville futuriste, cyan/rose, grands titres, portraits pixel
art, panneaux sombres. Pas de remplacement par un tableau de bord générique ou deux cartes plates.

Il retrouve les vrais jeux et sa vraie progression, une galerie des joueurs auxquels il a accès,
un classement de cinq personnes maximum, son grade, son profil et ses réglages. Des joueurs
externes peuvent créer un compte e-mail/mot de passe selon le système d’authentification existant,
sans obtenir de rôle scolaire. Les fonctionnalités publiques ne s’ouvrent qu’après leurs contrôles.

Le thème des cours et de l’espace professeur reste inchangé. Ne touche pas à la génération des
séances, aux diagnostics, aux éditeurs pédagogiques ni aux corrections hors nécessité démontrée.

## 2. Lire les bonnes sources

Lis d’abord les `AGENTS.md` applicables et l’état Git. Préserve les modifications non commitées.
Le pack s’appelle `TWEEN_TEACH_WORLD_ARCADE/` dans la racine du dépôt. Ses documents sont :

- `02_SPECIFICATION_COMPLETE.md` : parcours, permissions, données, inscriptions, classements, grades.
- `03_PLAN_IMPLEMENTATION_ET_RECETTE.md` : lots, critères d’acceptation et scénarios à exécuter.
- `04_AUDIT_FRONT_FOURNI.md` : éléments réellement présents et dangers d’une copie directe.
- `CORPUS/world-arcade.corpus.json` et `CORPUS/assets.manifest.json` : textes, design, images,
  catalogue et décisions explicites. Ce n’est pas un fichier de migration ni une preuve de droits.
- `CONTRATS/arcade-host-contract.ts` : interface indicative à adapter aux services déjà présents.
- `CONTRATS/launcher-bridge.mjs` : exemple facultatif pour l’événement du front HTML ; ce code ne
  fournit ni authentification ni validation de score.
- `FRONT_REFERENCE/World_Arcade_Frontend/index.html`, `css/styles.css`, `js/app.js`, `js/data.js`,
  `js/games.js` : référence interactive. Lire les sources séparées plutôt que le HTML base64.
- `REFERENCES/02_RENDU_FRONT.png` et les dix captures dans `FRONT_REFERENCE/World_Arcade_Frontend/previews/`.
  Ouvre réellement les images avec les outils disponibles pour comparer les proportions.

La spécification et le corpus corrigent les comportements de démonstration. Les configurations et
identités métier réellement présentes restent l’autorité pour la progression et les permissions.
La maquette illustrée ne justifie aucun ajout de slogans, de faux noms, de faux statuts ou de grades inventés.

## 3. Audit obligatoire, puis implémentation

Inspecte le dépôt avant de choisir une solution. Identifie les langages, le routeur, les layouts,
les composants UI, les règles de styles, le gestionnaire de paquets et son lockfile, les tests,
l’authentification, les rôles et affiliations de classe, les jeux et leurs sauvegardes, le système
XP/grades et le mode de déploiement. Ne suppose pas React, Next.js, Vite, Prisma, un nom d’API ni une route.

Remplis `SUIVI/AUDIT_DEPOT.json` à partir du modèle fourni : chemins observés, preuves, points de
raccordement, fonctions existantes à réutiliser et fonctionnalités absentes. Propose un petit plan
exécutable puis commence. L’audit n’est pas la livraison finale.

En cas de dépendance absente, continue les parties indépendantes. Ne pose une question que pour
une décision métier ou un accès non déductible du dépôt. Une migration destructive, une ouverture
publique ou l’affaiblissement d’une authentification ne sont jamais des choix implicites.

## 4. Intégrer le rendu sans casser le produit

Reprends les assets locaux fournis et les proportions des bornes. Les textes, boutons, classements,
listes et formulaires doivent être de vrais éléments accessibles, pas une capture posée en fond
avec des zones cliquables. Préserve le langage visuel et les effets discrets, pas chaque défaut
ou slogan de la démonstration. Les textes de `CORPUS/world-arcade.corpus.json` sont la cible.

Privilégie les composants et le routeur déjà utilisés dans le dépôt. Si l’application est HTML/JS,
une route/layout dédié convient. Un iframe n’est pas la solution par défaut : documenter les
conséquences sur session, focus, historique et communication si l’architecture l’exige vraiment.
Aucun framework, moteur 3D ou paquet d’animation lourd ne doit être ajouté pour reproduire ce front.

Isole le CSS : pas de `:root`, `body`, `.button`, `[hidden]` ou gestionnaire clavier global importé
sans adaptation. Préfixe les tokens et animations ; utiliser le mécanisme de styles local du dépôt
ou un conteneur `.world-arcade`. Vérifie un écran de cours et un écran professeur après intégration.

Prévois bureau, tablette, mobile, clavier, focus visible, dialogues fermables et restitution du
focus. Pas de musique avant une action explicite. Respecte la réduction d’animations du système,
permet de désactiver l’effet CRT et conserve la lisibilité sans effets. Le plein écran reste facultatif.
Les contrôles tactiles doivent refléter la prise en charge réelle du jeu, sans promettre ce qui manque.

## 5. Brancher l’identité réelle et l’annuaire autorisé

Réutilise la session active : pas de seconde connexion pour un élève connecté, pas de mot de passe
magique, pas de copie de compte scolaire vers une nouvelle base arcade. Un profil arcade éventuel
référence l’identité existante sans dupliquer ses identifiants de connexion.

Le formulaire de démo accepte n’importe quelle saisie valide et crée un profil local. **Ne réutilise
pas ce handler, même si tu masques le badge Démo.** Raccorde inscription, connexion, vérification
e-mail, récupération et déconnexion aux mécanismes du dépôt. Le rôle d’un compte créé publiquement
est fixé côté serveur, jamais choisi par un champ caché, une query string ou un payload navigateur.

Le professeur voit les élèves de ses classes autorisées. Un élève voit son périmètre de classe
selon la politique du produit. La communauté voit seulement les profils rendus visibles dans ce
périmètre, jamais l’annuaire scolaire. Pseudo et avatar suffisent ; ne publier ni e-mail, ni nom
complet, ni âge exact, ni note, ni horaire de présence, ni affiliation scolaire dans un DTO public.
La pagination, la recherche et le total respectent les mêmes limites côté serveur. Pas de chat ajouté.

Ne rends pas l’inscription publique accessible tant que les services d’e-mail, les protections
contre l’abus, les règles mineurs/confidentialité et les tests de permissions ne sont pas validés.
Implémente les écrans et les branchements possibles derrière un drapeau maîtrisé. Ne casse pas
l’authentification déjà en service au motif que la nouvelle inscription attend sa configuration.

## 6. Jeux réels, sauvegardes et lancement

Les IDs de référence sont `code-station` et `cyber-funk`. Adapte-les aux IDs réels avec un mapping
explicite ; ne renomme pas des IDs persistés. Trouve la vraie entrée de chaque moteur. Conserve les
missions, sauvegardes et déblocages déjà validés par le professeur. Les démos Canvas de ce dossier
ne doivent jamais remplacer silencieusement les jeux existants.

Le clic Jouer demande une autorisation au mécanisme serveur existant puis lance ou reprend le jeu.
Un jeu manquant reste présent dans le catalogue avec un état exact d’indisponibilité et une action
désactivée. Un jeu réellement verrouillé affiche sa condition seulement si elle est connue.
Ne marque pas Cyber Funk comme intégré si seul le mini-jeu de référence a été branché.

Si tu réutilises l’événement `worldarcade:launch`, annule son comportement par défaut **avant**
tout `await`. Sinon la démo peut partir avant la réponse de l’adaptateur. En production, aucun retour
à la mini-démo après un échec réseau, une route absente ou un refus d’accès. Le pont fourni illustre
ce point mais ne remplace pas le contrôle d’accès des routes et API du serveur.

## 7. Top 5 et grades

Le Top 5 repose sur les validations serveur réelles. Aucun score fictif de secours. N’utilise ni
le `localStorage` du prototype, ni `worldarcade:demo-complete`, ni un booléen client « terminé » pour
attribuer des points. Empêche les doubles crédits sur rejouage, concurrence et reprise réseau.
Une clé d’idempotence librement renouvelable par le client ne suffit pas à bloquer le farming.

Réutilise les règles de points du dépôt. En leur absence, ne crée pas de barème arbitraire : garde
le classement sans scores et consigne la décision. Sépare les jeux si leur métrique n’est pas
comparable. Le Top 5 renvoie au maximum cinq lignes côté serveur et client ; les ex æquo n’ajoutent
pas de sixième personne. Une place personnelle hors Top 5 est un encart privé distinct, pas un
moyen d’exposer tout le classement. Respecte la définition serveur des périodes.

Le catalogue illustratif est Rookie → Explorer → Operator → Specialist → Vanguard → Elite →
Phantom → Legend → Prestige, divisions I/II/III. **Seuls Rookie et le choix du nom Explorer sont
retracés comme demandes explicites dans le contexte ; ne présente pas les neuf grades comme une
configuration historique validée.** La configuration métier du dépôt prime. Si elle manque, le
catalogue reste une proposition à valider, sans seuils XP, promotions ou remise à zéro inventés.
Une ancienne clé métier `scout` peut garder son ID et adopter le libellé Explorer sans perdre les données.

## 8. Qualité, sécurité et régression

Crée les tests du périmètre touché, y compris les cas refusés. Vérifie les interactions réelles,
pas seulement l’existence d’un texte. Teste l’accès direct aux routes/API, pas uniquement la visibilité
des menus. Les erreurs ne doivent exposer ni secrets ni traces serveur ; une indisponibilité n’est
pas un classement vide, et une sauvegarde n’est confirmée qu’après sa persistance effective.

Ne déploie pas, n’envoie pas de vrais e-mails de masse, ne touche pas à une base de production et
ne remplace pas le schéma pour faire correspondre la démo. Prépare uniquement les migrations
additives réellement nécessaires, avec impact et retour arrière documentés, puis teste-les sur
une base locale/jetable autorisée. Aucun secret du dépôt dans les rapports ou captures.

Lance les commandes de lint, typecheck, tests et build réellement définies. Produis des captures
aux tailles pertinentes, compare-les aux références, corrige et reteste. N’exécute pas un script
npm inventé. Une absence d’outil ou de fournisseur doit apparaître comme « non vérifié », pas « réussi ».

## 9. Livrables et fin de tâche

Livre dans le dépôt : le module intégré, ses raccordements, les tests, les migrations éventuelles,
la configuration documentée sans secrets et un suivi dans `SUIVI/`. Utilise la matrice de recette.
Le rapport doit distinguer **intégré et testé**, **implémenté non vérifié**, **en attente de service**,
**en attente de décision** et **hors périmètre**. Donne les chemins réellement modifiés et les
commandes réellement exécutées. N’active pas le public par défaut pour pouvoir annoncer un succès.

Effectue ensuite une passe de revue selon `06_PROMPT_CODEX_REVIEW.md`. Corrige les défauts concrets
et relance les tests affectés ; consigne les blocages restants. Pas de boucle sans fin vers un
« score parfait », pas d’auto-certification de sécurité sur la base d’une capture.

**Commence maintenant par inspecter le dépôt et ouvre la capture du front. Puis implémente la
première tranche fonctionnelle : entrée → salle → raccordement Code Station existant, sans
régression sur une séance élève. Continue les tranches suivantes tant qu’elles ne sont pas bloquées.**
