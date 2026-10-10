# EDEN Teacher Twin

Le suivi V2 ajoute le **Référentiel**, les grades explicites, les observations par compétence, la validation des niveaux et les activités adaptées. [Utilisation et règles V2](docs/student-tracking/v2.md), [audit](docs/student-tracking/audit-v2.md), [recette AC01–AC40](docs/student-tracking/acceptance-v2.md). Vérifications : `npm run test:tracking:v2` et `npm run test:tracking:v2:browser`.

Le suivi V1 est accessible par **Élèves** côté professeur et **Mes séances / Mes évaluations** côté élève. Il conserve les versions suivies, les brouillons, les copies remises et les révisions publiées. Voir le [guide d’utilisation et les droits](docs/student-tracking/README.md), l’[audit](docs/student-tracking/audit.md) et la [recette AC01–AC20](docs/student-tracking/acceptance.md). Vérifications isolées : `npm run test:tracking` et `npm run test:tracking:browser`.

La recherche dans les documents importés, les classements professeur et la remise de fichiers avec reçu durable sont raccordés au parcours existant. Recette isolée : `npm run preview:documentary`, puis **http://127.0.0.1:4184/preparation.html** (`professeur` / `quality-preview-only`). Cette recette utilise des fixtures signalées, un stockage distinct et un dépôt Git privé local ; aucun appel IA réel ni publication élève. Voir le [rapport du lot documentaire et stockage](docs/quality/documentary-storage.md).

Application locale fonctionnelle construite à partir de la spécification v1.1, du classeur A1 et des quatre projets fournis. L’interface est en français. EDEN conserve le plan versionné, les séances, le cahier de texte, les copies et les preuves ; les corpus et Google Drive sont des exports.

## Accès IA avec ChatGPT

`npm run dev:chatgpt` démarre le parcours personnel sur **http://127.0.0.1:4181/**, avec une base séparée et un worker de préparation. Créez votre compte professeur, importez votre planification puis ouvrez **Ma classe & réglages → Réglages IA · API ou ChatGPT**. Le mode API reste un choix explicite ; aucune bascule de facturation automatique. Les credentials ChatGPT restent hors de la base et des exports.

Le mode Vercel est désactivé en attente d’accès partenaire confirmé. Connexion et génération réelles restent à valider avec un compte éligible. Voir le [démarrage et la configuration](docs/chatgpt/README.md), [l’audit](docs/chatgpt/audit.md), [les sources vérifiées](docs/chatgpt/sources.md) et [la recette](docs/chatgpt/acceptance.md). Aucun déploiement de production.

## Partager avec les élèves sur le même Wi-Fi

Arrêter le lancement personnel avec **Ctrl+C**, puis lancer :

```sh
npm run dev:lan
```

Le terminal affiche **Accès élèves sur le même Wi-Fi** avec le lien à partager, par exemple `http://192.168.1.120:4181/today`. L’adresse dépend du réseau actuel : relancer cette commande après un changement de Wi-Fi. Garder le Mac allumé, éveillé et le terminal ouvert pendant la séance. Le professeur conserve `http://127.0.0.1:4181/`.

Ce mode utilise les mêmes comptes, cours et fichiers que `npm run dev:chatgpt`, dans `.data/chatgpt-personal`. Les réponses élèves sont enregistrées et conservées après redémarrage. Dans **Ma classe & réglages**, préparer leurs accès ; dans **Mes séances**, publier la version voulue. Chaque élève ouvre le lien réseau et se connecte avec son compte. Pour partager une séance précise, remplacer `127.0.0.1` dans son lien **Accès élèves** par l’adresse affichée, en conservant le port et `?lesson=…`. L’aperçu `preview:student` reste une recette en mémoire.

Le partage écoute uniquement sur l’adresse privée détectée, en plus de l’adresse locale du professeur. La connexion personnelle IA et l’initialisation professeur restent réservées à l’accès local. Si plusieurs interfaces sont disponibles : `npm run dev:lan -- --lan-host=192.168.1.120` avec l’adresse du Wi-Fi choisi. Pour arrêter le partage : **Ctrl+C**, puis `npm run dev:chatgpt` pour continuer uniquement sur le Mac.

Si un autre appareil n’arrive pas à ouvrir la page, vérifier qu’il est sur le même réseau, autoriser les connexions entrantes de Node dans le pare-feu macOS et vérifier que le Wi-Fi de l’établissement permet les communications entre appareils. Ce mode HTTP est destiné au réseau local de confiance ; il ne publie pas le site sur Internet.

Recette isolée : `node --import tsx --test tests/local-network.test.mjs tests/chatgpt-launcher.test.mjs`, puis `node --import tsx scripts/student-access-browser-check.mjs --lan` et `node --import tsx scripts/code-runner-browser-check.mjs --lan`. Les contrôles navigateur utilisent des comptes synthétiques et vérifient les sauvegardes, l’arcade et l’exécution JavaScript sur une adresse HTTP du réseau. Les identifiants aléatoires utilisent `crypto.getRandomValues` lorsque `crypto.randomUUID` n’est pas disponible sur cette origine.

## Choisir la séance à faire aujourd’hui

Dans **Vue d’ensemble** ou **Mes séances**, la carte **Séance du jour** permet de choisir une séance déjà publiée, quelle que soit sa date prévue. Vous pouvez aussi cliquer sur **Faire aujourd’hui** dans la liste ou le détail d’une séance : par exemple, reprendre le 9 octobre les quatre cartes Flexbox prévues le 5 octobre.

Les élèves ouvrent `/today` ou cliquent sur **Actualiser** pour retrouver ce choix. La date affichée est celle de la journée ; la planification, le contenu et les réponses déjà enregistrées sont conservés. Les liens vers une séance précise restent utilisables. Le choix est enregistré pour toute la classe, uniquement pour la journée en cours, selon l’heure de Paris. **Revenir au planning du jour** annule ce choix ; le lendemain, le planning reprend automatiquement. Une séance doit être publiée avant d’être choisie.

Vérifications isolées : `node --import tsx --test tests/today-lesson.test.mjs`, puis `node --import tsx scripts/today-lesson-browser-check.mjs`. Redémarrer le serveur local après installation de cette évolution pour charger la nouvelle route.

## Modifier les séances et le code des exercices

Dans **Mes séances → Ouvrir → Modifier**, l’éditeur charge les contenus existants : textes riches, images, sections, activités et vrais fichiers de départ. Les sections et blocs peuvent être déplacés, dupliqués ou supprimés, avec annulation. Le brouillon est enregistré automatiquement et par **Enregistrer**. **Aperçu élève** utilise le rendu partagé ; **Exporter** télécharge le brouillon confirmé. Une séance publiée garde sa version visible jusqu’à **Mettre à jour la séance**.

[Mode d’emploi et installation](docs/editor/README.md), [audit du parcours et contrat](docs/editor/audit.md), [vérifications](docs/editor/acceptance.md). Compilation : `npm run build:editor`. Recette isolée : `npm run test:editor`, `npm run test:editor:browser`, `npm run test:editor:labs`. Aucun déploiement de cette évolution n’a été effectué.

## Transférer des séances entre le poste local et l’espace en ligne

Dans **Mes séances**, sélectionner une ou plusieurs séances puis **Exporter les séances**. Le détail propose aussi **Exporter cette séance**. L’archive `.tweenteach.zip` conserve les contenus, supports, ateliers et missions liés, sans comptes ni réponses élèves.

Sur la destination, **Importer des séances** permet de choisir, ligne par ligne, **Ajouter**, **Remplacer** ou **Ignorer**, puis de valider le récapitulatif. **Remplacer depuis un fichier** présélectionne la séance ouverte. Les remplacements conservent le lien et les rattachements ; les ajouts restent en brouillon. Le transfert est atomique et les réimports identiques ne créent pas de version supplémentaire.

Utiliser `npm run dev:chatgpt` pour préparer dans la base locale séparée. [Mode d’emploi et installation](docs/transfers/README.md), [format du paquet](docs/transfers/format.md), [audit](docs/transfers/audit.md) et [recette](docs/transfers/acceptance.md). Vérifications : `npm run test:transfers` et `npm run test:transfers:browser`. Aucun déploiement de cette évolution n’a été effectué.

## Préparation pédagogique approfondie

Le nouveau parcours est accessible dans **Ressources → Importer des documents et préparer une séance**, à `/preparation.html`, et depuis **Préparer** en développement. Il importe les documents, conserve leurs versions et leurs limites d’extraction, puis prépare un parcours, rédige par unités et soumet chaque candidat à une revue indépendante. Les étapes et budgets sont persistants ; une préparation ne publie jamais automatiquement une séance. Sans clé ou modèle configuré, la demande affiche un blocage explicite.

**Recette isolée : `npm run preview:quality`**, puis [ouvrir la préparation](http://quality.localhost:4180/preparation.html). Se connecter d’abord à [l’accueil de recette](http://quality.localhost:4180/) avec `professeur` / `quality-preview-only`. Cette commande ne charge pas `.env.local`, utilise `.data/quality-preview.sqlite` et des comptes synthétiques. Les trois pilotes sont des **fixtures**, pas des générations IA validées. Les anciens cours et comptes ne sont pas modifiés.

Voir [le démarrage et les limites](docs/quality/README.md), [l’audit causal](docs/quality/audit.md), [la recette et ses preuves](docs/quality/acceptance.md) et [le laboratoire séparé](labs/README.md). Tests : `npm run test:quality`, `npm run test:quality:browser`, `npm run test:quality:dom`. Aucun déploiement n’a été effectué.

## World Arcade

Le menu présente Code Station, Cyber Funk 3026, Bunker Ops, Rocket Launch, Infiltration Trace et Assault Sim comme des jeux distincts. Un clic sur un jeu jouable ouvre son parcours (`/arcade#parcours/code-station`, par exemple) : missions terminées, en cours et à venir, pourcentage d’avancement et reprise de la sauvegarde. La progression vient des objectifs enregistrés du joueur ; les missions fermées restent visibles et les missions publiées restent jouables sans nouveau prérequis. Quitter une partie ramène au parcours actualisé du jeu.

Les 20 missions du catalogue Code Station, Assault, Bunker, Rocket et Infiltration utilisent désormais un personnage, cinq cartes navigables, des postes physiques et une action finale dans le monde. Le jeu affecté à une séance et sa reprise utilisent le même moteur. Les essais JavaScript s’exécutent dans un Worker borné ; les commandes du bunker restent une simulation locale explicitement indiquée.

Recette des cinq mondes : `npm run preview:exploration`, puis `http://arcade.localhost:4187/arcade#arcade`. Compte synthétique : `student-a`, classe `A1`, mot de passe `synthetic-test-password`. Pour inclure une copie en lecture seule de la séance du 8 octobre : `npm run preview:exploration -- --source .data/chatgpt-personal/courses.sqlite --date 2026-10-08`. Chaque jeu ouvre son propre parcours et ses missions ; les écritures restent en mémoire. Flèches / ZQSD / WASD, clic sur le sol, E pour interagir. Voir le [rapport d’exploration et la matrice des 20 missions](TWEEN_TEACH_WORLD_ARCADE/SUIVI/EXPLORATION_RECETTE.md). Aucun déploiement de cette évolution n’a été réalisé.

Le module intégré est disponible à `/arcade` sur une instance de recette autorisée avec `EDEN_WORLD_ARCADE=1` (désactivé par défaut). Il réutilise les comptes scolaires, les missions PédagoLab affectées et leurs sauvegardes. Les missions Code Station des séances publiées sont accessibles à tous les élèves de la classe dès la connexion, sans prérequis de monde ou d’activité autonome. Chaque élève conserve sa propre partie ; cette ouverture ne valide aucune compétence. Les profils arcade permettent de choisir un pseudo et un avatar ; la galerie respecte les permissions de classe et la visibilité choisie. Le thème reste limité à l’arcade.

Cyber Funk reste indisponible faute de moteur hôte. Les points, le Top 5, les grades et l’inscription externe restent fermés en l’absence de règles métier ou de services validés. Aucun joueur fictif ni score de démonstration n’est importé. Le drapeau du module n’ouvre pas ces fonctions publiques.

Recette isolée, sans charger `.env.local` et sans base réelle : `node --import tsx scripts/arcade-browser-check.mjs`. Ce script utilise Chrome/Chromium et une base en mémoire, puis ferme son serveur local. Tests API : `node --import tsx --test tests/arcade.test.mjs tests/arcade-journey.test.mjs`. Voir le [rapport d’intégration](TWEEN_TEACH_WORLD_ARCADE/SUIVI/RAPPORT_INTEGRATION.md), la [matrice de recette](TWEEN_TEACH_WORLD_ARCADE/SUIVI/RECETTE.json) et la [revue](TWEEN_TEACH_WORLD_ARCADE/SUIVI/REVIEW.md) pour les preuves, les dépendances et le retour arrière. Aucun changement de schéma ni déploiement n’a été exécuté.

Pour essayer soi-même en élève : `npm run preview:student`, puis ouvrir `http://arcade.localhost:4179/today`. Utiliser le compte de test `student-a`, classe `A1`, avec le mot de passe de la fixture locale `synthetic-test-password`. La connexion ouvre la séance du jour. Le bouton **Mode arcade** ouvre les jeux avec la même session ; **Retour à ma séance** conserve le lien de la séance et permet de reprendre le parcours. L’instance utilise l’application réelle avec une base en mémoire, ne charge pas `.env.local` et reste ouverte jusqu’à Ctrl+C. Le serveur redémarre automatiquement lorsque son code change pour garder l’API à jour avec l’interface. Les modifications de test et les sessions disparaissent à chaque redémarrage : reconnectez-vous avec le compte de test. Le nom d’hôte dédié sépare ses cookies de ceux de l’application locale habituelle.

Pour tester une copie de votre séance locale du jour : `npm run preview:student -- --source .data/chatgpt-personal/courses.sqlite`. Ajouter `--date AAAA-MM-JJ` ou `--lesson IDENTIFIANT` pour choisir une autre séance ; le terminal donne aussi son lien direct. La source SQLite est ouverte en lecture seule. Seuls le contenu de la séance et sa mission sont copiés : les comptes et réponses réels restent dans la source. Un brouillon est accessible dans cet aperçu en mémoire, sans publication dans la base originale. Code Station est accessible à tous les comptes élèves de test, comme pour les missions des séances publiées. Recette navigateur : `node --import tsx scripts/student-access-browser-check.mjs` (ou avec `--source` pour vérifier une copie locale). Sur une instance destinée aux élèves, activer `EDEN_WORLD_ARCADE=1` pour afficher le bouton ; la séance doit être publiée par le professeur.

Pour vous connecter dans cet aperçu avec les **comptes élèves et mots de passe existants**, ajouter `--school-accounts` :

```sh
npm run preview:student -- --source .data/chatgpt-personal/courses.sqlite --school-accounts
```

Les comptes élèves de la classe remplacent le répertoire fictif ; leurs mots de passe ne sont pas changés. Les identifiants et empreintes de mots de passe sont lus dans la base locale, jamais les sessions ni les comptes professeur. Les réponses de cet aperçu restent en mémoire et ne sont pas remontées dans la base originale. Relancer l’aperçu après une modification des comptes dans la source.

### Compte joueur

Mon espace rassemble la carte privée, les missions accessibles et les sauvegardes hôtes. Personnaliser permet de modifier l’AKA et l’avatar avec aperçu, annulation et confirmation serveur. Les AKA conservent le format existant (2–24 caractères) et sont uniques sans distinction de casse dans chaque classe, enseignants et élèves compris. Les anciens profils restent compatibles, sans migration ni renommage automatique.

Mes badges présente « Premier signal », obtenu uniquement à partir d’une mission Code Station approuvée par le professeur. La mise en avant contrôle les badges réellement acquis, sans crédit de XP. Les deux autres badges proposés attendent leurs conditions métier. Mon compte permet de changer le mot de passe local (secret actuel + confirmation) et ferme réellement toutes les sessions ; l’assistance professeur existante applique aussi cette révocation. Aucun parcours e-mail ni compte externe n’est simulé.

Recette dédiée : `node --import tsx --test tests/arcade-account.test.mjs`, puis `node --import tsx scripts/arcade-account-browser-check.mjs`. Pour conserver les anciens rapports de non-régression : `ARCADE_REPORT_DIRECTORY=TWEEN_TEACH_WORLD_ARCADE/SUIVI/COMPTE_JOUEUR_REGRESSION node --import tsx scripts/arcade-browser-check.mjs`. Ces commandes n’utilisent que des bases en mémoire et des comptes synthétiques.

Voir les rapports [audit](TWEEN_TEACH_WORLD_ARCADE/SUIVI/COMPTE_JOUEUR_AUDIT.md), [recette des 40 scénarios](TWEEN_TEACH_WORLD_ARCADE/SUIVI/COMPTE_JOUEUR_RECETTE.md) et [livraison](TWEEN_TEACH_WORLD_ARCADE/SUIVI/COMPTE_JOUEUR_LIVRAISON.md). Les services publics, grades et Cyber Funk conservent leurs blocages. Le drapeau, les configurations locales et les bases réelles ne sont pas modifiés par ce lot.

## Démarrer

Node.js 22.14 ou supérieur.

```sh
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:3000**. À la première ouverture, créer le mot de passe professeur (12 caractères minimum). L’identifiant est `professeur`. Il n’existe aucun mot de passe prédéfini.

### Renderer élève EDEN

Les éditeurs JavaScript partagent un bouton **Exécuter** et une **Console** visible. `console.log()` affiche ses arguments dans l’ordre ; chaque lancement vide la console et crée un contexte neuf sans effacer le code. Les erreurs indiquent leur ligne lorsque le navigateur la fournit. L’exécution isolée s’arrête après 1,5 seconde, 100 messages ou 64 000 caractères de sortie. **Vérifier mon code** reste une action pédagogique distincte. Recette navigateur : `npm run test:console:browser` (données de test en mémoire, captures dans `test-results/code-runner/`).

Le générateur compose des ateliers selon les compétences : éditeurs HTML/CSS avec aperçu à plusieurs largeurs, exercices JavaScript testés, manipulations, classements, tableaux à dessiner et productions autonomes. Le profil Flexbox propose un laboratoire « prévoir → modifier une propriété → observer », trois exercices progressifs, les schémas feutre de la référence du 5 octobre, une production de quatre cartes et une mission de débogage. Les dessins, légendes et essais du laboratoire sont sauvegardés comme les autres réponses.

**Essayer la séquence issue du générateur** : [Flexbox](http://127.0.0.1:3000/lesson-demo.html?lesson=flexbox). `npm run demo:lesson` reconstruit les deux exemples ; `npm run demo:serve` les sert sur le port 4178. Les tests des exercices fonctionnent aussi en démonstration. La démonstration ne transmet aucune copie au professeur.

Les vérifications facultatives de publication recommandent au moins trois formes d’activité, une manipulation/reconstruction, un schéma lié aux notions et, pour les compétences de code couvertes, un éditeur en pratique guidée et en autonomie. Le modèle de prose ne peut modifier les fichiers de départ, tests, exemples de code ou ateliers structurés. Les corpus contiennent les fichiers HTML/CSS/JS de départ et les tableaux SVG, dont les versions à compléter. Voir [l’alignement avec la référence Flexbox](docs/workshops-reference.md).

La page **Aujourd’hui** et l’aperçu professeur utilisent désormais `public/lesson-renderer.js` et les tokens de `public/lesson.css`. Le serveur impose les phases : départ/objectifs, diagnostic, comprendre, observer, pratique guidée, autonomie, prolongement et bilan. Une pause s’ajoute aux créneaux longs. Le modèle reçoit uniquement `LessonContentSpec` : il ne peut plus choisir les composants, leur ordre, les durées, les exercices à correction déterministe ou le diagnostic. Les vérifications pédagogiques signalent les éléments manquants ; le professeur peut choisir de publier après sa propre relecture.

Voir la séance exemple **Deux règles. Une décision.** sur **http://127.0.0.1:3000/lesson-demo.html**, sans connexion. Elle utilise le même renderer et des données fictives. Ses réponses restent dans l’onglet ; les remises réelles se font dans la séance publiée. Pour servir uniquement la démonstration : `npm run demo:serve`, puis **http://127.0.0.1:4178/lesson-demo.html**. `npm run demo:lesson` reconstruit son JSON public, sans corrigés.

L’[audit](docs/lesson-audit.md), le [design system](docs/lesson-design-system.md), la [revue visuelle](docs/lesson-visual-review.md) et [PROGRESS.md](PROGRESS.md) détaillent les sources et limites. Les hubs Logique & JavaScript et Flexbox fournis le 5 octobre définissent désormais la cible graphique : logo EDEN School original, encre et turquoise. La palette commune est dans `public/brand.css` ; elle couvre toutes les séances, leurs aperçus et les outils professeur.

Les versions de séances déjà enregistrées restent lisibles. Pour bénéficier de la nouvelle structure et des contenus guidés, régénérer un **brouillon** depuis la planification. Les copies et versions publiées ne sont pas réécrites automatiquement.

Le classeur fourni a été importé dans la base locale de ce workspace : **28 feuilles, 142 entrées de planning (dont 125 avec compétences), 105 critères, 14 séquences et 18 identifiants élèves**. Sur une installation neuve, utiliser **Ma classe & réglages → Importer le classeur → Analyser le classeur fourni → Valider cet import**.

Parcourir **Planification → Préparer**. Le professeur confirme la durée du créneau, que le classeur ne précise pas. Le Twin compose un brouillon, son diagnostic et son corpus. Relire dans **Aperçu élève**, puis publier. Créer les codes élèves dans **Ma classe & réglages** ; ils se connectent à **/today**. Clôturer la séance dans **Cahier de texte** pour alimenter le diagnostic suivant.

Import en ligne de commande, avec prévisualisation par défaut :

```sh
npm run import
npm run import -- --apply
npm run import -- "/chemin/planification.xlsx" --apply
```

## Ce qui fonctionne

- Réconciliation explicite des évaluations et du cahier de texte Excel, ligne par ligne. Le professeur confirme identité, niveaux, autonomie/transfert et contenu réellement réalisé ; chaque décision est auditée et idempotente.
- Import des 28 feuilles, conservation des textes et des cellules/formules source, SHA-256, diff, avertissements, conflits et versions. Réimport identique idempotent. Le contenu prévu du cahier de texte n’est jamais interprété comme une séance réalisée.
- Dashboard, recherche et glisser-déposer du plan, propositions atomiques de déplacement, insertion, scission, fusion, permutation et report. Diff et impacts sur prérequis/évaluations, approbation et rejet des versions périmées. Une intention sans créneau ouvre un brouillon d’insertion à compléter, sans changer le plan avant validation.
- `DailyLessonSpec` et `DailyBundle` ; renderer à composants stables ; index documentaire versionné et recherche pondérée sur les 140 unités NEXUS, avec sources enregistrées dans les runs. Génération locale utilisable sans compte externe. Intégration optionnelle OpenAI pour enrichir les contenus par sortie structurée.
- Adaptations pratiques/différenciées relues avant application. Une adaptation en cours de séance remplace uniquement les ateliers non commencés ; elle conserve le diagnostic initial, les tentatives et les copies, compile le corpus candidat puis bascule atomiquement la version publiée. Si un élève commence un atelier pendant l’aperçu, l’approbation est refusée. Les élèves utilisent **Actualiser** pour recevoir la nouvelle version.
- Séance dense du 1er octobre migrée dans les composants communs : questions, circuits/tables de vérité, fonctions, défis facultatifs et diapositives. Les diagnostics historiques ne sont pas présumés réalisés.
- Évaluation diagnostique obligatoire dans chaque séance : 2 à 4 exercices, 10 à 20 minutes et barème /20 couvrant chaque tâche et critère. Elle reprend la dernière séance réellement clôturée, y compris une réalisation partielle ; séances annulées, reportées, remplacées et événements non évaluables exclus. Sans historique réel, un diagnostic initial propose des exercices sur les prérequis déclarés, des repères HTML/CSS ou de programmation selon la séance, ou des situations de procédure et de vérification. Ce point de départ ne crée aucune preuve d’une séance passée. Les tests HTML/CSS du diagnostic sont exécutables et conservés dans l’historique. Une tentative rouverte ramène l’élève au diagnostic même après restauration de sa progression locale.
- Sessions serveur opaques, cookies HttpOnly/SameSite, accès professeur/élève distincts, périmètre par classe, contrôle d’origine et limitation des connexions. Aucun secret inclus dans le frontend.
- Réponses sauvegardées localement et au serveur avec reçu ; copie remise immuable et empreinte ; réouverture dans une nouvelle tentative ; premiers/derniers essais et historique. Références de diagnostic masquées avant la remise.
- Correction déterministe des réponses fermées/structurées, du JavaScript couvert par l’interpréteur EDEN, de la structure HTML et des déclarations CSS. SQL exécuté dans un processus SQLite éphémère, limité à 1,5 seconde et 64 Mio. Pré-correction des réponses ouvertes par rubrique et modèle, sur demande professeur, avec citation de preuve et seuil de confiance 0,85. Productions non interprétables en `NE / review_required`. Relecture avec justification et historique ; preuves issues des corrections approuvées.
- Maîtrise calculée à partir des preuves approuvées : deux sources autonomes distinctes, espacées d’au moins 7 jours, dont une en transfert. Pondération récente 60/25/15 séparée de cette condition. Une révision ne crée pas une preuve supplémentaire.
- Groupes G0–G3 par critère, historique pondéré, observations professeur, groupe NE séparé, ajustements ciblés conservés et stabilisation hebdomadaire. Activités différenciées et propositions de réactivation de 12 minutes.
- PDF, PPTX, XLSX, JSON et ZIP réellement compilés avec manifestes SHA-256. Artefacts adressés par contenu sur disque ou S3, téléchargement ZIP en flux ; compatibilité avec les anciens exports en base. Corpus complet réservé au professeur. Dossier individuel avec copie, code, premiers essais, historiques, bilans/corrections HTML et PDF, manifestes et classeur à quatre onglets.
- Catalogue extrait des **5 mondes / 20 missions PédagoLab**, gameplay et validateurs préservés. Runtime intégré dans une iframe sans accès à l’origine EDEN ; évaluateurs dans des Workers limités à une seconde et sans réseau. Événements et productions en base. Le professeur valide séparément leur valeur pédagogique.
- Primitives Drive Distributor conservées à l’identique : compte de service, délégation Workspace, Shared Drives, raccourcis et arborescences. Distribution sélective des ressources élèves, du corpus professeur et des dossiers individuels validés depuis le serveur. File de travaux persistante, réservation exclusive avec bail et heartbeat, reprise après interruption, rapport par destinataire et retries. Upload résumable au-delà de 5 Mio. Aucun transit du corpus via une requête navigateur limitée à 4 Mo.

## Configuration externe

### Publier une séance et l’ouvrir côté élèves

Dans une séance en brouillon, **Modifier avec une consigne** propose une révision ciblée avec votre accès IA configuré. Le raccourci **JavaScript · sans dessins** demande de remplacer les dessins par du code et du débogage, tout en conservant les tableaux JavaScript. La comparaison avant/après précède l’enregistrement ; chaque modification crée une version, et les propositions restent accessibles après rechargement. Le diagnostic et la planification sont conservés. Une préparation en cours ou une version modifiée entre-temps empêche l’écrasement du brouillon.

Une préparation interrompue ou annulée peut être **reprise en brouillon professeur**, depuis les vérifications facultatives de publication : le professeur confirme qu’il prend en charge la validation pédagogique. Cette action crée une nouvelle version et conserve la préparation d’origine ; elle ne publie pas la séance. Les contrôles du contenu, du plan, du diagnostic et des corrigés exécutables restent consultables à titre facultatif. Les simulations ne peuvent pas emprunter ce parcours.

Recette de l’édition : `node --import tsx --test tests/lesson-revision.test.mjs`, puis `node --import tsx scripts/lesson-revision-browser-check.mjs` (base isolée et IA simulée). Un serveur déjà lancé doit être redémarré pour charger les nouvelles routes.

Dans **Mes séances → Ouvrir la séance → Publier cette version**, choisissez **Publier et faire aujourd’hui** pour publier et affecter la séance à l’accueil des élèves en une seule confirmation, ou **Publier uniquement** pour la rendre disponible sans modifier le choix du jour. La date prévue reste conservée. Une autre séance publiée à la même date reste accessible par son lien et dans la liste des séances.

**Vérifier la séance (facultatif)** affiche les remarques sur la structure, le plan, la préparation et les corrigés sans empêcher la publication. Le parcours direct compile les supports manquants à la confirmation et ne lance pas les tests des corrigés. La validation du professeur est enregistrée sur la version exacte publiée ; une version obsolète, une séance clôturée ou une préparation encore en cours reste protégée. Publication et affectation du jour sont enregistrées dans la même transaction. L’éditeur professeur utilise également cette validation manuelle. Les appels API sans `validationMode: "teacher"` conservent le contrôle automatique strict.

Après publication, **Accès élèves** donne un lien `/today?lesson=…`, accessible après connexion par les élèves de la classe, et indique si la séance est choisie pour aujourd’hui. La liste **Séances disponibles** permet aussi d’ouvrir une séance publiée à une autre date. Les corrections restent privées avant la remise du diagnostic. Publier dans l’application ne configure pas l’hébergement : un lien `127.0.0.1` reste limité au poste local, ce que le dialogue de partage signale.

Recette isolée : `node --import tsx --test tests/publication.test.mjs`, puis `node --import tsx scripts/publication-browser-check.mjs`. Ces vérifications ne publient aucun cours réel et ne lancent aucun appel IA.

Copier `.env.example` en `.env.local`, puis renseigner uniquement les services souhaités.

| Service | Configuration | Comportement sans configuration |
| --- | --- | --- |
| PostgreSQL / Neon | `DATABASE_URL` | SQLite dans `.data/eden.sqlite` en local |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` ; `OPENAI_GRADING_MODEL` optionnel | Composition à partir des ressources pédagogiques locales |
| Stockage objet | `EDEN_S3_BUCKET`, `AWS_REGION`, identifiants AWS ; `EDEN_S3_ENDPOINT` optionnel | Disque `.data/artifacts` avec SQLite ; binaires en base avec PostgreSQL |
| Google Drive | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_ELEVES_FOLDER_ID`, `GOOGLE_DRIVE_TEACHER_FOLDER_ID` pour le corpus professeur ; impersonation optionnelle | Erreur explicite, aucun faux rapport de publication |

En production, `DATABASE_URL` est obligatoire ; configurer `EDEN_TEACHER_PASSWORD` avant le premier démarrage et servir l’application derrière HTTPS. Les cookies sont `Secure` avec `NODE_ENV=production`. Définir `HOST=0.0.0.0` si le reverse proxy ou le conteneur l’exige. Ne pas exposer la base SQLite ni les archives sources. L’application n’a pas été déployée.

L’API OpenAI utilise le [format JSON Schema strict de Responses](https://developers.openai.com/api/docs/guides/structured-outputs), avec `store: false`. Le contexte de génération ne contient pas de noms ni de copies individuelles. La pré-correction, demandée séparément par le professeur, transmet la copie concernée et sa rubrique sans ajouter d’identité nominative. Drive utilise le [protocole de transfert résumable documenté par Google](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

### OpenAI configuré, mais génération refusée avec 429

Le statut « OpenAI configuré » confirme la présence des variables, sans vérifier les crédits ni l’accès au modèle. Une réponse OpenAI 429 signifie que l’appel a bien été envoyé ; renseigner à nouveau les variables Vercel ne résout pas à lui seul ce refus.

- `credit_balance_exhausted` ou `insufficient_quota` : vérifier les crédits et la facturation API du compte associé à la clé.
- `project_spend_limit_exceeded`, `organization_spend_limit_exceeded` ou `organization_usage_limit_exceeded` : vérifier le plafond indiqué dans OpenAI Platform.
- `rate_limit_exceeded` ou `slow_down` : espacer les générations et respecter le délai `Retry-After` affiché lorsqu’il est fourni.

La génération classique et la préparation approfondie affichent désormais la cause lorsqu’OpenAI la précise. Les réponses sans code exploitable restent explicitement indéterminées. Aucun nouvel appel automatique n’est déclenché. Les messages bruts du fournisseur ne sont pas exposés ; seuls les codes reconnus, le statut et l’identifiant de requête sont conservés pour le diagnostic. Voir les [codes d’erreur officiels OpenAI](https://developers.openai.com/api/docs/guides/error-codes).

## Vercel et worker

Importer le dépôt avec **Root Directory `./`** et **Application Preset `Services`**. Le `vercel.json` déclare un seul service Node nommé `eden`, qui utilise `api/index.mjs` et reçoit tous les chemins publics, dont `/api/*`, sans ajouter de préfixe. Les contrôles de connexion et de rôle restent appliqués dans l’application. Node est limité à la version majeure 22 ; la durée maximale d’une requête est de 300 secondes.

Les applications `legacy/drive` et `legacy/pedagolab` proposées par la détection automatique ne sont pas des services de cette application. EDEN appelle directement les API Google via le SDK Drive et lit le catalogue PédagoLab depuis un fichier JSON. Aucun appel HTTP entre services, donc aucun binding Vercel à déclarer. Les fichiers historiques réutilisés, les workers locaux et les ressources du terminal sont inclus dans la fonction. `.vercelignore` conserve aussi les deux fichiers Drive comparés pendant le build.

Configurer les variables suivantes dans Vercel, pour **Production** et **Preview** (utiliser une base de prévisualisation séparée) :

| Variable | Valeur ou usage |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL PostgreSQL fournie par l’hébergeur de la base, avec ses paramètres TLS |
| `EDEN_TEACHER_USERNAME` | Identifiant initial du professeur, par exemple `professeur` |
| `EDEN_TEACHER_PASSWORD` | Mot de passe initial unique d’au moins 12 caractères |
| `EDEN_QUALITY_PIPELINE` | `0` jusqu’à la mise en service du worker de génération externe |
| `EDEN_WORLD_ARCADE` | `1` pour afficher le bouton Mode arcade et ouvrir Code Station aux élèves connectés |
| `CRON_SECRET` | Secret partagé avec l’appelant du worker HTTP, si utilisé |

Le handler refuse l’initialisation sans `DATABASE_URL`. Aucun secret n’est enregistré dans `vercel.json`. Ajouter les variables OpenAI, Google Drive et S3 de `.env.example` pour les intégrations utilisées. Les artefacts S3 restent privés et ne sont servis qu’après contrôle d’accès EDEN. La limite Vercel de 4,5 Mo par requête s’applique aussi aux imports de fichiers, même lorsque l’application accepte une taille supérieure en local.

Pour reprendre les données locales, lancer d’abord `npm run db:migrate`. Ce contrôle lit `.data/eden.sqlite` sans la modifier et vérifie les documents de `.data/artifacts`. Le rapport donne les effectifs, les séances et leur statut, les comptes disposant déjà d’un accès et le nombre de documents. Aucune connexion distante n’est effectuée sans option supplémentaire.

Pour transférer la base **par upload dans l’interface**, exécuter `npm run db:export` sur l’ordinateur qui possède la base SQLite et ses documents. Le fichier `.data/exports/eden-base-….eden-db.gz` contient toutes les tables et les documents des corpus ; les sessions de connexion sont exclues. La source reste intacte. Les options `--source`, `--artifact-dir` et `--output` permettent de choisir les chemins. Le fichier contient les données des élèves et les empreintes de mots de passe : il reste local, privé et exclu de Git.

Sur la destination, configurer d’abord `DATABASE_URL` et le compte professeur initial, puis déployer le code comprenant l’import. Se connecter comme professeur et ouvrir **Ma classe & réglages → Importer ma base locale → Analyser ma base → Confirmer l’import de ma base**. L’aperçu présente les élèves, les séances et les identifiants professeur qui seront repris. Après confirmation, les comptes et mots de passe locaux remplacent le compte initial ; se reconnecter avec le compte local. Les dates, statuts de publication et accès élèves restent ceux de la sauvegarde.

Pour **effacer la base actuelle et la remplacer par votre sauvegarde locale**, choisir **Effacer et remplacer la base actuelle** dans la fenêtre d’import, sélectionner le fichier `.eden-db.gz`, puis **Analyser ma base**. L’aperçu affiche les élèves, séances et remises actuels à supprimer, puis les élèves, accès activés, séances et documents à importer. Cocher la confirmation de suppression puis cliquer sur **Effacer et importer cette base**. Tous les comptes, résultats, historiques et autres enregistrements de la base sont remplacés : aucune fusion. Les mots de passe du fichier sont conservés ; toutes les sessions sont fermées et il faut se reconnecter avec le compte professeur local. Les séances publiées restent publiées. Cette action concerne la base de l’instance ouverte dans le navigateur ; elle ne supprime pas les fichiers SQLite sur l’ordinateur source ni les exports Drive/S3/Git externes.

Le mode par défaut **Importer dans une base vide** reste réservé à une installation neuve (compte professeur connecté, sessions de ce compte et catalogue initial non modifié). Si elle contient déjà des données, le bouton **Préparer le remplacement** ouvre l’aperçu de suppression. Le remplacement est limité à une installation dédiée à la classe du professeur : la présence d’une autre classe bloque toute suppression. Les préparations, distributions ou archivages actifs et les sessions de laboratoire doivent être résolus avant remplacement. Si le contenu de la base change après l’aperçu, l’opération est refusée et une nouvelle analyse est nécessaire ; les connexions seules n’invalident pas l’aperçu.

Une copie identique est détectée sans réimport. Les documents sont contrôlés par SHA-256 et les lignes relues avant validation d’une transaction unique, sur SQLite comme PostgreSQL. Un échec de suppression, d’insertion ou de vérification annule toute l’opération et préserve la base précédente. Les tâches externes en cours, les sessions de laboratoire et les documents S3 non inclus bloquent l’export navigateur. Limites : 4 Mio compressés / 32 Mio décompressés ; au-delà, utiliser le transfert administrateur ci-dessous. Le JSON d’une séance seule et le fichier SQLite brut ne sont pas acceptés par cet écran.

Vérification de l’upload : `node --import tsx --test tests/database-upload.test.mjs`. Parcours navigateur avec données synthétiques et base en mémoire : `node --import tsx scripts/database-import-browser-check.mjs`.

Renseigner ensuite l’URL PostgreSQL de destination dans le fichier local `.env.migration.local`, exclu de Git et du déploiement :

```dotenv
EDEN_MIGRATION_DATABASE_URL=postgresql://UTILISATEUR:MOT_DE_PASSE@HOTE/BASE?sslmode=require
```

Utiliser la véritable URL fournie par l’hébergeur, avec ses paramètres TLS. Cette même valeur doit être configurée sous **`DATABASE_URL` dans Vercel**. Le nom `EDEN_MIGRATION_DATABASE_URL` est réservé à l’outil local, pour éviter de rediriger accidentellement `npm run dev` vers la production. Ne pas copier le secret dans le dépôt ou le chat.

```sh
npm run db:migrate -- --check-target
npm run db:migrate -- --apply
```

Effectuer la copie vers une base EDEN vide, avant le premier démarrage de l’application distante. Arrêter les modifications locales pendant le transfert et la bascule. Si Vercel a déjà créé un compte professeur ou d’autres données, l’outil refuse de les écraser : utiliser une nouvelle base ou branche vide. Une relance sur une copie strictement identique ne modifie rien. `--source` et `--artifact-dir` permettent de choisir explicitement une autre base SQLite et son dossier de documents.

La copie conserve toutes les tables EDEN, les identifiants, mots de passe hachés existants, dates, versions, historiques et états de publication. Les documents locaux sont vérifiés par SHA-256 puis inclus en base, sans dépendance au disque du poste. Les fichiers déjà sur S3 nécessitent une vérification séparée du stockage avant application. La transaction PostgreSQL est validée uniquement après comparaison intégrale des données relues ; une erreur annule la copie. Les tests SQL utilisent PostgreSQL embarqué PGlite, uniquement en développement.

Une séance en brouillon reste en brouillon après la copie ; utiliser sa publication validée dans EDEN pour la rendre visible aux élèves. Les élèves importés sans mot de passe restent sans accès jusqu’à leur activation depuis l’interface professeur. Le compte professeur transféré conserve son mot de passe existant : `EDEN_TEACHER_PASSWORD` n’écrase pas un compte déjà présent.

Le cron à la minute est retiré : l’offre Hobby n’accepte qu’une exécution quotidienne. La publication vers Drive nécessite donc un worker externe ou un ordonnanceur externe appelant `/api/internal/publication-worker` avec `Authorization: Bearer <CRON_SECRET>`. Cet endpoint traite uniquement les publications ; il ne remplace pas le worker de génération pédagogique. Les distributions restent en attente tant qu’aucun worker ne les traite. En local, `npm run dev` traite les files toutes les cinq secondes. Les distributions validées sont suivies depuis **Corpus → Suivi des distributions**. Une erreur partielle reprend les destinataires en échec ; les succès déjà enregistrés sont conservés. Une version de séance modifiée après la validation ne sera pas distribuée silencieusement.

La génération pédagogique avec contrôles navigateur nécessite un processus Node permanent avec Chrome et accès à la même base PostgreSQL ; les laboratoires ont besoin de leur hôte Docker dédié. Ne pas activer `EDEN_QUALITY_PIPELINE=1` sur Vercel avant que ce worker soit opérationnel. Le fichier `api/index.mjs` ne démarre aucun de ces processus.

Pour tester le routage Services localement : `npx vercel@62.4.0 dev --local`. La commande de développement du service lance le handler serverless, sans worker ni SQLite de secours. Utiliser une base PostgreSQL de test via `DATABASE_URL` ; sans cette variable, une réponse 503 est attendue. Après envoi des changements sur GitHub, relancer l’import Vercel pour qu’il lise la nouvelle configuration. Vérifier `/api/health`, la connexion professeur, `/preparation.html` et les ressources `/assets/*` après déploiement.

Configuration basée sur les documentations [Vercel Services](https://vercel.com/docs/services), [routage Services](https://vercel.com/docs/services/routing), [limites des Functions](https://vercel.com/docs/functions/limitations), [Cron sur Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) et [AWS S3 JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html). Le déploiement distant n’a pas été exécuté.

## Contrats des composants et des tests

Les types disponibles sont exportés dans `schemas/ActivitySpec.json` et `schemas/DailyLessonSpec.json`. Les champs communs suffisent au renderer ; aucun frontend quotidien n’est généré.

- `Quiz` / `MasteryCheck` : `options` contient les choix.
- `FillBlank` : `options` contient les libellés des champs ; réponses JSON indexées par numéro.
- `Matching` : chaque option est `libellé|choix 1|choix 2` ; réponses JSON indexées.
- `TruthTable` / `CircuitExercise` : `options` contient les entrées ; chaque sortie vaut `0` ou `1`.
- `DragDrop` : `options` est la liste à ordonner ; réponse JSON ordonnée. Flèches clavier et glisser-déposer.
- `FileExplorer` : `starter` contient un objet JSON nom de fichier → contenu, affiché comme texte.
- `Simulator` : `starter` contient `{ "inputs": [{ "name": "A", "label": "Entrée A", "values": ["0", "1"] }] }` ; état et explication enregistrés.
- `Preview` : HTML/CSS élève dans une iframe sandbox sans scripts ni réseau. `Terminal` simule uniquement `pwd`, `ls`, `cd`, `cat`, `help` dans un projet fixe.
- `Diagram` / `BlackboardDiagram` : chaînes de nœuds séparés par `→` ou `->`, une chaîne par ligne ; aucun HTML interprété.
- Correction `structured` : `expectedAnswer` contient l’objet ou le tableau JSON de référence, crédit partiel par élément.
- Tests `html` : `argsJSON` décrit `{ "tag": "h1", "text": "Bonjour", "minCount": 1 }` ou un attribut avec `attribute`/`value`.
- Tests `css` : `{ "selector": ".card", "property": "display", "value": "flex" }`.
- Tests `sql` : `argsJSON` contient `{ "tables": [{ "name": "people", "columns": ["name", "age"], "rows": [["Nora", 18]] }] }` ; `expectedJSON` contient les lignes attendues. Seules les requêtes SELECT isolées sont prises en charge.

## Validation

```sh
npm run check
npm test
npm run test:legacy
npx playwright install chromium
npm run test:browser
npm run test:visual
```

Les tests de leçon contrôlent les 140 unités NEXUS, les sections minimales, le refus des changements de structure par le modèle, l’échappement et 16 snapshots HTML de composants. Les tests visuels comparent 28 captures : huit phases de démonstration, quatre composants et deux états de `/today`, sur desktop et mobile. `/today` utilise son véritable `app.js` avec des réponses API déterministes ; `test:browser` vérifie séparément le serveur réel, la publication et PédagoLab.

Les baselines sont dans `tests/visual/baselines/darwin/`. La configuration utilise Chrome système sur macOS, ou le Chromium Playwright ailleurs ; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de fixer le binaire. Conserver le même navigateur et le même système pour une comparaison stricte. Un premier lancement sur un autre OS nécessite une baseline relue. Après un changement visuel intentionnel seulement, exécuter `npm run test:visual:update`, inspecter les captures, puis relancer `npm run test:visual` sans mise à jour. Pour les snapshots HTML : `UPDATE_LESSON_SNAPSHOTS=1 node --test tests/lesson.test.mjs`. Les vérifications structurelles ne remplacent pas la relecture pédagogique.

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet d’utiliser un Chromium déjà installé. Les tests utilisent des bases temporaires en mémoire, sans données ni identifiants de production. Le scénario navigateur teste le parcours professeur → publication → remise élève → correction, le runtime PédagoLab, l’arrêt d’une boucle infinie et le rendu mobile, l’adaptation pratique, l’insertion hors planning, les observations et la stabilisation hebdomadaire. Les captures sont dans `test-results/`.

## Structure

- `server/` : persistance SQLite/PostgreSQL, import, contrats, génération, contrôles, authentification, correction, corpus, jeu et routes API.
- `public/` : interface professeur/élève et runtime PédagoLab encapsulé.
- `data/game-catalog.json` : catalogue migré, indépendant du renderer.
- `schemas/` : schémas stricts exportés par `npm run check`.
- `database/schema.sql` : tables d’agrégats et versions, DDL commun SQLite/PostgreSQL.
- `legacy/` : sources de référence extraites, hors dépendances, caches de build, métadonnées macOS et fichiers `.env` secrets.
- `tests/` : invariants pédagogiques, frontières d’accès, lifecycle API et transferts Drive simulés.

## Limites et validation externe

- Neon, OpenAI, S3 et Google Drive exigent les configurations de l’établissement. Aucun appel réel ni déploiement externe n’a été exécuté ; les tests de transfert et de pré-correction utilisent des réponses simulées.
- La persistance conserve des agrégats JSON versionnés avec index de classe et tables de domaine distinctes. Ce n’est pas la décomposition SQL normalisée exhaustive suggérée par le modèle cible. La recherche est lexicale pondérée, sans service vectoriel externe.
- PDF/PPTX/XLSX sont encore compilés en mémoire avant archivage ; le ZIP est servi en flux. Sans S3, le mode PostgreSQL conserve les binaires en base pour garantir leur durabilité sur un hébergement éphémère.
- Les commandes conversationnelles reconnues produisent des propositions déterministes. Une ambiguïté demande une sélection dans l’interface ; il ne s’agit pas d’un interpréteur universel de toute consigne naturelle.
- Le catalogue initial vient des projets fournis ; le professeur peut adapter un template, relire ses scénarios puis affecter sa version validée à un brouillon. La création libre de nouveaux mondes et validateurs ainsi qu’une simulation universelle de circuit ne sont pas fournies. Les ouvertures professeur ne créent aucune preuve de maîtrise.
- Les réponses ouvertes et les résultats des jeux restent soumis à validation professeur. Le moteur SQL utilise SQLite, pas tous les dialectes ; les tests HTML/CSS vérifient la structure, pas un rendu pixel à pixel. Les formules JavaScript non comprises gardent le statut de relecture.

Préparation pédagogique V2 : [recette et limites](docs/quality/acceptance-v2.md), [audit du cas interrompu](docs/quality/audit-v2.md), [décision d’architecture](docs/quality/architecture-v2.md). `npm run preview:quality:v2` ouvre la base de recette isolée sur le port 4182 sans appel IA automatique.
