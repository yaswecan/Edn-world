# Paquet Tween Teach, format 1

Extension : `.tweenteach.zip`, ZIP sans chiffrement, entrées régulières STORE ou DEFLATE. Pas de ZIP64, multi-volume, lien symbolique, chemin absolu, répertoire implicite ou entrée non déclarée.

```text
manifest.json
lessons/<identité-portable>.json
files/<sha256>
```

Le manifeste déclare `format: "tweenteach"`, `version: 1`, `packageId`, `lessons` et `files`. Une entrée séance indique `portableId`, `title`, `date` (date civile `YYYY-MM-DD`), `sequence`, `path`, `sha256` du JSON, `revision` pédagogique et `capabilities`. Une entrée fichier indique `path`, `sha256` et `bytes`. Les ressources communes sont dédupliquées par empreinte. L’empreinte SHA-256 garantit l’intégrité ; elle n’est pas une signature d’auteur et ne confère aucune permission.

Le document de séance contient :

| Champ | Contenu |
| --- | --- |
| `spec` | Contrat `DailyLessonSpec` intégral, avec identités techniques neutralisées ; blocs, activités, diagnostic existant, aides, corrigés, tests privés/publics, supports et visibilité native. |
| `context` | Objectif et durée du créneau source, critères utiles et provenance du diagnostic ; aucun planning ou état individuel. |
| `assets` | Illustrations référencées, MIME, dimensions, empreinte du fichier. |
| `documents` | Sources citées/sélectionnées, segments et octets originaux, visibilité pédagogique ; aucun propriétaire ou droit de la source locale. |
| `mission` | Configuration, fichiers, scénarios et validateur de la mission affectée ; aucune partie élève. |
| `corpus` | Supports de la version choisie avec chemin, audience, MIME, taille et empreinte ; le classeur nominatif des groupes est exclu. |
| `preparation` | État incomplet et besoin de reprise professeur ; aucune tâche IA ou connexion. |
| `designContract` | Contrat de conception existant, lorsqu’il est disponible. |
| `external` | Liens permanents conservés nécessitant l’accès au site source. |

Les fichiers HTML/CSS et shell/Git restent du contenu d’exercice. Les chemins de projets ne peuvent pas viser `.git`, des hooks, `.env` ou sortir de leur dossier. Leur analyse ne lance rien. Les références natives des blocs sont vérifiées ; un type absent du schéma courant est refusé.

Les liens gérés sont encodés `tweenteach-file:<sha256>:<mime>`. À destination, les images deviennent des données intégrées dans les ateliers isolés ; les autres fichiers passent par `/api/lesson-transfer-files/:id` avec contrôle de classe, publication et visibilité réelle dans le contrat élève. Les illustrations natives conservent `/api/lesson-assets/:id` avec de nouveaux identifiants liés à la classe cible. Les sources et segments reçoivent des identifiants de destination ; leurs citations sont remappées. Les missions reçoivent un identifiant et une signature du moteur cible.

La révision est le SHA-256 du JSON canonique du contenu remplaçable, comprenant les empreintes des fichiers, avec clés d’objets triées et ordre des tableaux conservé. La date d’export, l’ID du paquet, les identifiants de base, la version technique, la date et le rattachement de destination, les URL générées, les ID du diagnostic et la signature du moteur remappée ne déterminent pas cette révision. Les originaux et ressources binaires restent byte-for-byte identiques. Les liens locaux des supports texte/HTML/CSS/JSON sont remplacés par leurs ressources intégrées ; leurs nouvelles empreintes sont calculées après cette conversion portable, sans modification pédagogique. Les dates de séance sont des chaînes civiles, sans conversion UTC.

Les autorisations et créations viennent exclusivement de la session professeur de destination. Les correspondances sont enregistrées par `(classe, portableId)` et ne donnent aucun droit supplémentaire. Un remplacement manuel préserve l’identité publique de la cible. Une copie ajoutée lorsque cette origine est déjà connue reçoit une nouvelle identité portable.

La prévisualisation ne modifie pas les séances actives. Son jeton correspond à la sélection, aux actions, aux cibles et à l’état des destinations/planning. L’application relit cet état sous transaction et verrou de tables ; une différence impose une nouvelle comparaison. Une entrée bloquante peut être ignorée puis le lot réanalysé. Le reçu est enregistré atomiquement avec le résultat, pour résister aux clics répétés et aux réponses HTTP perdues.

Le parseur vérifie les en-têtes locaux et centraux, les tailles annoncées, les offsets, les doublons de chemins, les types Unix, les références et les empreintes. L’inflation dispose d’une limite de sortie réelle, y compris si un fichier ment sur sa taille. Les ressources non déclarées sont refusées. Les fichiers préparés restent privés jusqu’au commit de toutes les données du lot.
