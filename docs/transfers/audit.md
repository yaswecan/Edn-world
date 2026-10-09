# Audit ciblé — 9 octobre 2026

| Étape | Contrats existants et branchement du transfert |
| --- | --- |
| Démarrage local | `scripts/chatgpt-local.mjs` lance serveur et worker avec une liste de variables autorisées, sans charger les réglages production. SQLite et artefacts sous `.data/chatgpt-personal`. |
| Stockage | `server/store.mjs` : agrégats JSON SQLite ou PostgreSQL, transactions et versions append-only. Les lectures SQLite attendent désormais la fin de la transaction en cours, pour empêcher l’exposition d’un lot partiel sur la même connexion. |
| Préparation | `generator.mjs`, `pedagogy/jobs.mjs`, `lesson-revision.mjs` et `domain.mjs` créent/modifient les versions. La génération classique reçoit aussi une garde contre une écriture tardive ; la préparation approfondie possédait déjà cette garde. |
| Modèle | `contracts.mjs` définit les blocs, activités, fichiers, visualisations, diagnostic et mission. La nouvelle archive valide ce contrat complet, sans créer d’activité supplémentaire. |
| Planification | `plan_entries`, `plan_versions`, `curriculum_versions`, `lesson_runs`, `lesson-plan.mjs`. Le paquet embarque un contexte pédagogique limité ; les rattachements ne sont pris que parmi les créneaux de la destination. Les diagnostics liés à un historique absent ne deviennent pas publiables artificiellement. |
| Corpus | `corpus.mjs` dérive PDF/PPTX/XLSX, fichiers d’ateliers et JSON de la version enregistrée. `artifacts.mjs` lit disque, base ou S3. Le transfert exclut le classeur contenant les groupes/élèves ; il conserve les supports pédagogiques avec leurs audiences. |
| Documents | `pedagogy/documents.mjs` et `documentary-index.mjs` contrôlent l’accès aux originaux et aux segments. Les documents cités et les documents sélectionnés de la préparation voyagent avec leurs fichiers ; les droits de destination sont attribués au professeur connecté. |
| Éditeurs et rendu | `public/app.js`, `lesson-renderer.js`, `workshop-ui.js`, `terminal-lab.js`, `dom-lab.js`. Les mêmes composants servent aux contenus préparés et importés. Les aperçus DOM/shell peuvent maintenant partir d’une version de séance sans dépendre d’un ancien job IA. |
| Jeux | `game.mjs`, `mission-model.js`, catalogue et runtime existants. Les configurations affectées sont copiées, les signatures remappées et les anciennes sauvegardes séparées par mission/run ; aucun catalogue entier transféré. |
| Publication | `publication-readiness.mjs`, `domain.mjs`, `publication-code.mjs` et `pedagogy/quality.mjs`. Un remplacement publié passe les mêmes contrôles pédagogiques et validateurs de corrigés ; les brouillons restent brouillons. |
| Élèves | `assessment_attempts`, `learning_progress`, `work_submissions`, `learning_events`, `game_runs` portent des versions. Le remplacement conserve les anciennes versions et crée un nouveau run. Le navigateur détecte la nouvelle version sans réinitialiser l’éditeur courant. |
| Permissions/cache | Middleware `teacher`, `protectOrigin`, contrôle de classe et de propriétaire des transferts, réponses `no-store`, ressources immuables à nouveaux identifiants. Aucun paquet brut n’est servi aux élèves. |
| Hébergement | `api/index.mjs` exige PostgreSQL ; `vercel.json` utilise un service Node avec 300 s. L’envoi/téléchargement par fragments reste sous 4,5 MB ; les octets importés sont durables en base avant l’activation. |

L’ancien export ZIP de corpus était un livrable documentaire ; il n’offrait pas d’import ciblé. L’import de base complète, distinct dans les réglages, transporte des comptes et données élèves et peut remplacer une installation entière. Le nouveau parcours n’utilise aucune de ces fonctions de remplacement global.

Aucune bibliothèque supplémentaire n’a été installée. L’archive utilise JSZip déjà présent, le parseur borné utilise zlib/crypto natifs, les tests utilisent Node, Playwright et PGlite déjà installés. Les modifications préexistantes du module World Arcade ont été conservées.
