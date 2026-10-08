# Documents, remises et projections Git — 7 octobre 2026

Ce lot complète les modifications V2 déjà présentes dans le workspace, sans les remplacer. Il raccorde la recherche documentaire au moteur, le classement aux sources et les remises aux fichiers figés. La livraison globale du cahier des charges reste **partielle** : les trois cours générés par le fournisseur réel n’ont toujours pas franchi leurs contrôles dans les budgets existants. Les fixtures ne remplacent pas cette validation.

## Audit et décisions

Le serveur est Express sous Node 22.14, avec les agrégats SQLite/PostgreSQL de `server/store.mjs`, des artefacts disque/S3 et un worker pédagogique existant. Le dépôt possède une configuration Vercel ; cela ne prouve pas un hébergement actif. Aucun accès Neon ou serveur PostgreSQL distant n’a été utilisé. La restauration est testée sur PostgreSQL embarqué PGlite ; ce n’est pas une recette Neon/RLS.

Avant ce lot, `pedagogy/documents.mjs` conservait les extractions dans `pedagogical_sources` mais ne les raccordait pas à un index documentaire dédié. Le moteur recevait toutes les sections sélectionnées. `retrieval.mjs` cherchait seulement dans la bibliothèque PédagoLab. La route `/api/events` acceptait `lesson_submitted` comme un simple événement ; les fichiers shell/DOM n’étaient pas figés avec ce geste. Le diagnostic disposait déjà d’une remise immuable, préservée et désormais reliée à une projection Git. Aucun dépôt pédagogique ni service Git distant n’était configuré par ce lot.

La base personnelle a d’abord été relue en lecture seule, puis sauvegardée avant la révision ciblée. La [révision 3](evidence-documentary/original-preparation.json) active la politique `tween-depth-2026-10-07.3` et conserve versions historiques et budgets. L’identifiant fourni correspond bien au créneau du 14 septembre, avec une tentative, aucun candidat complet et un budget de 30 minutes expiré. Le constat historique reste décrit dans [l’audit V2](audit-v2.md) : délai de transport de 180 secondes, sortie partielle, issue fournisseur inconnue ; les 204 secondes affichées ne suffisent pas à elles seules à établir la cause. Les trois pilotes réels conservent 9, 8 et 4 appels respectivement et leurs enveloppes expirées. Aucun plafond n’a été relevé, aucun nouvel appel d’inférence n’a été lancé pour ce lot.

Le socle retenu est une recherche lexicale locale avec synonymes techniques, correspondances littérales, filtrage strict et expansion des sections voisines. Les documents centraux de moins de 16 000 caractères sont lus intégralement lorsque le budget le permet. Le contexte est plafonné à 120 000 caractères ; tout passage non transmis est listé. Aucun code ni tableau n’est coupé pour remplir le budget. Un bloc indivisible trop volumineux peut donc rester exclu : sa couverture n’est jamais annoncée comme complète.

La [recherche plein texte PostgreSQL](https://www.postgresql.org/docs/current/textsearch-controls.html) offre un chemin d’évolution lorsque le volume le justifie. Ici, les trois sources des pilotes représentent 2 024 caractères et 13 sections. Le [jeu mesuré](evidence-documentary/search.json) retrouve la bonne source parmi les trois premiers résultats pour 8/8 requêtes, avec des citations vérifiées et aucune consommation externe. Les critères étaient fixés avant l’exécution. Cela valide ce petit corpus, sans établir le rappel sur un fonds important. **Vecteurs désactivés ; comparaison hybride NOT RUN**, faute de besoin démontré sur cet échantillon. Aucune promesse de gain sémantique non mesuré.

## Autorités et versions

| Objet | Autorité et identité | Copie dérivée / modification |
| --- | --- | --- |
| Source originale | Artefact disque/S3, ou contenu en base lorsque l’adaptateur est inline ; SHA-256 | `documentId` logique, version `source_*`, provenance et extraction liées en base ; ancien `originalBase64` encore lisible |
| Extraction et passages | `pedagogical_sources`, extraction versionnée, localisations réellement produites | Index reconstructible ; figures/OCR non interprétés restent signalés |
| Classement professeur | `source_annotations` et version active sur la source | Rebuild sans écrasement ; modification de document demande une revue du rapprochement |
| Index | `document_indexes`, build complet immuable | Activation transactionnelle ; permissions relues dans la source ; aucune catégorie ne donne accès |
| Contexte IA | `document_contexts`, scope, recherches, passages exacts, empreintes, omissions | Manifeste attaché à la préparation et à chaque tentative avant envoi |
| Plan/corpus | Versions et contrôles du moteur existant ; `content_snapshots` aux étapes significatives | Projection Git privée avec manifeste, commit résolu et chemins ; aucun statut pédagogique déduit du push |
| Brouillon élève | Sauvegardes de progression/diagnostic/laboratoire existantes | DOM : trois fichiers conservés dans la réponse ; shell : sauvegarde des modifications avant navigation/remise |
| Remise | `work_submissions` ou diagnostic `submissions`, instantané, empreinte et date serveur | `archive_outbox` dans la même transaction ; validations et archivage rattachés sans changer l’empreinte |

Les schémas sont exportés dans `schemas/DocumentContext.json` et `schemas/ContentSnapshotManifest.json`, avec validation serveur. L’ancien rendu et les versions publiées ne sont pas remplacés. Les fichiers remis, critères, version de séance et runtime/validateur sont identifiés ; aucune validation non exécutée ne devient une réussite. Les comptes, jeux et progressions World Arcade ne sont pas refondus.

Toutes les sources brutes importées sont privées au professeur autorisé. L’absence de séparation sûre entre énoncé et corrigé conserve le document dans ce périmètre. Les élèves accèdent aux supports publiés par les routes existantes, pas au fonds brut. Le endpoint de recherche refuse les sessions élèves. Les annotations distinguent famille, notions, rôle, origine, format et état ; le classifieur local propose une simple mention, sans inventer un prérequis ou une maîtrise.

## Reprise et Git

Les contrôles de bail, révision, issue inconnue, annulation et budget de V2 restent actifs. Un appel garde le contexte documentaire exact transmis. Une nouvelle source s’adopte explicitement dans une révision ; le bouton professeur utilise les versions cochées. Les analyses compatibles sont réutilisées. Une révocation interdit un nouveau transfert et la consultation des dossiers concernés ; aucun cache ne contourne ce contrôle. Elle ne retire pas les données déjà transmises auparavant à un fournisseur.

Le navigateur transmet les réponses actuelles lors de la remise et conserve l’identité de l’opération avant la requête. Un rechargement après perte de l’accusé de réception réutilise cette identité. Le serveur contrôle acteur, classe, séance, version, activités et fichiers ; il accepte le reçu et l’événement d’archivage dans la même transaction. Les sauvegardes tardives ne changent pas la remise. Une nouvelle remise volontaire possède une autre identité. Les fichiers shell sont réellement récupérés du laboratoire ; un service indisponible produit une remise incomplète, jamais une confirmation fondée sur une vieille copie. Les fichiers binaires sont conservés comme artefacts et référencés dans le manifeste.

`git-archive.mjs` projette les textes avec [les objets et commits Git](https://git-scm.com/docs/git-commit-tree), sans checkout, filtre ou hook fourni par l’élève. Le dépôt bare doit être dédié. Une référence par objet logique regroupe ses versions ; le verrou local et le [contrôle de l’ancienne valeur de référence](https://git-scm.com/docs/git-update-ref) empêchent d’écraser une écriture concurrente. Un rejet du push conserve l’événement en reprise. Chaque reprise rapproche l’historique et le manifeste avant de produire un nouveau commit, y compris après un push réussi dont l’accusé a été perdu. Les essais utilisent un vrai dépôt distant **sur le filesystem local**, pas un hébergeur Git externe.

Événements projetés : plan accepté, candidat complet, candidat corrigé, sélection explicite pour publication, diagnostic remis et travail remis. Pas de commit par frappe, essai console, revue inchangée ou export. La mention d’auteur est `EDEN automated archive`. Les traces de commits élèves restent distinctes de ces commits de service. Ni l’un ni l’autre ne prouve à lui seul la compétence.

L’import contrôlé est disponible par API depuis le dépôt configuré, un commit complet et un fichier autorisé appartenant à une projection de la classe. Une source crée une version documentaire. `/api/preparation/lessons/:id/import-git` valide le schéma et crée une version d’un **brouillon**, avec `expectedVersion` et provenance exacte ; une séance publiée est refusée. Il n’existe pas d’édition concurrente implicite entre Git et la base. L’interface graphique d’édition/import Git n’est pas fournie.

## Recette et exploitation

```sh
npm run preview:documentary
```

Ouvrir `http://127.0.0.1:4184/`, compte synthétique `professeur`, mot de passe `quality-preview-only`, puis `/preparation.html`. La base est `.data/documentary-preview/courses.sqlite`, le dépôt `.data/documentary-preview/archive.git`. Le lanceur ne charge aucun fichier de secrets, ne lance pas de worker IA et ne publie pas de séance. Les trois pilotes sont consultables dans les préparations ; le shell reste bloqué par ses contrôles d’exécution si le laboratoire n’est pas configuré. La première construction inspecte le rendu dans Chrome.

```sh
npm run test:documentary
npm run test:documentary:search
npm run test:documentary:browser
node --import tsx scripts/documentary-shell-check.mjs
npm test
npm run check
```

Le dernier script shell exige l’image locale `tweenteach-shell:quality-v2`, lance un broker temporaire et supprime uniquement son conteneur de recette. Les tests navigateur utilisent une publication synthétique dans une base mémoire ; aucune route de publication d’une vraie classe n’est appelée.

Configuration facultative dans `.env.local`, ou dans `.env.chatgpt.local` pour le lanceur personnel : `EDEN_ARCHIVE_REPOSITORY` (chemin bare dédié), `EDEN_ARCHIVE_ID`, `EDEN_ARCHIVE_REMOTE` (destination explicite facultative). Sans dépôt, les événements restent en attente et les remises sont consultables. Le serveur local exécute l’archivage dans une boucle distincte du travail IA. Sur un hébergement sans disque persistant, il faut exécuter ce worker sur un hôte durable connecté à la même base ; aucun archivage éphémère Vercel n’est proposé comme durable. Ne pas exposer le dépôt entier aux élèves : les branches ne sont pas une frontière de confidentialité.

Les tables ajoutées sont créées de façon additive. Retour arrière : arrêter les workers, remettre le code antérieur, conserver tables/artefacts/dépôt ; ne jamais supprimer les reçus ou remplacer une base active pour revenir au code. Les comptes et publications existantes restent les autorités de leurs droits.

Sur l’hôte durable, un worker distinct se lance avec `node --env-file-if-exists=.env.local --import tsx scripts/archive-worker.mjs`. En production, `DATABASE_URL` est obligatoire. Superviser ce processus avec le service existant ; le dépôt et le stockage d’artefacts exigent leurs volumes persistants. Le même contrôle de bail protège les traitements lorsqu’un serveur et ce worker partagent la file.

Sauvegarde : base cohérente, artefacts externes et clone bare de toutes les références, puis coffre de connexion séparé selon sa procédure existante. `prepareSnapshot` inclut désormais les originaux et objets des remises locaux, vérifie leurs empreintes et garde leurs liens. Le test de restauration SQLite → PostgreSQL/PGlite vérifie originaux, instantanés, annotations et clone Git, puis reconstruit un index. S3 distant/LFS et restauration sur un hôte de production : NOT RUN. Git LFS n’est pas activé.

Rétention : aucun effacement automatique ajouté. Conserver sources utilisées, reçus, critères et versions tant que leur rétention est requise ; reconstruire/supprimer les index uniquement à partir des sources encore autorisées. Un objet écrit avant un rollback peut rester orphelin : il n’accorde pas de reçu et son nettoyage exige un inventaire des références, un délai et une sauvegarde. La suppression distribuée d’un historique Git nécessite une procédure dédiée ; supprimer la version courante ne supprime pas les anciennes copies. L’automatisation de cette politique et le nettoyage des objets orphelins restent à configurer selon les durées de conservation de l’établissement.

La page professeur affiche les archivages en attente/en échec, leur reprise et le commit confirmé. Les résultats de recherche exposent sources non exploitables et latence. Aucun indicateur de tokens/embeddings fictif.

## État de livraison

| Contrôle | État | Preuve / limite |
| --- | --- | --- |
| Recherche, citations, huit requêtes représentatives, versions et droits | PASS | [Mesures](evidence-documentary/search.json), corpus restreint explicite |
| Reimport, classifications, rebuild, contexte figé, révocation | PASS | `tests/documentary-storage.test.mjs` |
| Instantané/outbox atomiques, doublons, écritures tardives, panne Git | PASS | Tests transactionnels et vrai Git local |
| Push confirmé puis accusé perdu, nouvelle remise, comparaison historique | PASS | Test Git avec remote bare local, aucun remplacement d’historique |
| Recherche et classement depuis l’interface mobile | PASS | [Navigateur](evidence-documentary/browser.json) |
| Derniers fichiers navigateur remis, réponse HTTP perdue puis rechargement | PASS | Même reçu et mêmes octets ; tests Chromium réels |
| Remise shell réelle, panne d’archive, reset après remise | PASS | [Docker](evidence-documentary/shell.json), image identifiée |
| Restauration base/objets/Git et reconstruction d’index | PASS | SQLite/PGlite et dépôts locaux, S3 distant exclu |
| Suite complète de non-régression | PASS | 227 tests, zéro échec/annulation/ignoré ; contrôles finaux dans `evidence-documentary/verification.json` |
| Trois rendus pilotes ouvrables | PASS | Fixtures via moteur ; états et contrôles détaillés dans le rapport navigateur |
| Trois corpus IA réels complets et comparaison pédagogique avant/après | FAIL | Budgets V2 expirés, aucun nouveau coût autorisé par modification implicite |
| Comparaison vectorielle, OCR, SSH, charge de classe représentative | NOT RUN | Capacités/évaluations non ajoutées par ce lot |
| Git hébergé, authentification distante, déploiement et restauration production | NOT RUN | Aucun service distant configuré ou déployé |

L’implémentation est intégrée et la recette logicielle est accessible. Le pipeline IA réel enrichi n’est pas vérifié jusqu’à trois cours terminés ; aucune qualité pédagogique finale nouvelle n’est revendiquée. Les paramètres réels historiques restent ceux des traces V2 (`gpt-6-astra`, effort omis sur les anciens appels, `high` sur les profils vérifiés suivants). Le coût de ce lot en appels IA applicatifs est nul ; son gain mesuré porte sur récupération, conservation et reprise. **Production non déployée ; aucune séance publiée aux élèves.**
