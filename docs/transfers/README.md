# Préparer ici, retrouver sa séance en ligne

## Mode d’emploi

1. Sur le poste de préparation : `npm install`, puis `npm run dev:chatgpt`. Ouvrir `http://127.0.0.1:4181/`. Ce lancement ignore `.env.local`, les URL de base et les stockages hérités. Il utilise uniquement `.data/chatgpt-personal/courses.sqlite` et `.data/chatgpt-personal/artifacts`. Garder ce dossier pour retrouver son travail après redémarrage.
2. Créer le compte professeur au premier lancement, importer sa planification et utiliser les fonctions existantes de préparation. Dans **Mes séances**, ouvrir le brouillon, **Modifier le contenu**, enregistrer, puis **Aperçu élève** pour essayer les éditeurs et interactions. La préparation IA nécessite la connexion configurée dans les réglages ; la modification manuelle et le transfert ne font aucun appel IA.
3. Cocher les séances dans **Mes séances**, puis **Exporter les séances** ; ou ouvrir une séance et choisir **Exporter cette séance**. Les supports de la version enregistrée sont préparés si nécessaire. Vérifier les dépendances externes affichées, puis **Télécharger les séances**. Une seule archive `.tweenteach.zip` contient la sélection.
4. Sur l’instance de destination équipée de cette version, se connecter comme professeur, ouvrir **Mes séances → Importer des séances**, choisir ou déposer l’archive et l’analyser. Chaque ligne propose **Ajouter**, **Remplacer** ou **Ignorer**. Un fichier de plusieurs séances peut donc servir à en importer une seule. Une modification des choix exige **Actualiser le récapitulatif**.
5. Pour remplacer une séance précise, ouvrir son détail puis **Remplacer depuis un fichier**. La cible est présélectionnée. Si le fichier contient plusieurs séances, sélectionner la source à utiliser ; les autres commencent sur **Ignorer**. Lire les différences et la conséquence sur la publication, puis valider le bouton qui annonce le nombre d’ajouts/remplacements.

Un ajout est toujours un **brouillon**, attribué au professeur et à sa classe de destination. Choisir un créneau existant dans le récapitulatif pour le rattacher ; sans créneau, les objectifs et le contexte restent conservés dans une préparation distincte. Aucune classe ni planification n’est créée par le paquet. Pour rattacher ultérieurement une préparation, réimporter le même fichier, choisir cette préparation comme cible et sélectionner son créneau.

Un remplacement garde l’URL `/today?lesson=…`, la classe, le créneau, la date et la visibilité de la destination, sauf changement explicite de créneau. Il active une nouvelle version complète, sans accumulation des anciens blocs. Une séance déjà publiée reste publiée si les validations existantes passent. Une préparation incomplète est bloquée pour cette opération : l’ajouter comme brouillon, ou la corriger/reprendre en local puis la réexporter. Une préparation issue de la revue approfondie nécessite une reprise professeur explicite dans le récapitulatif ; les attestations de revue IA ne deviennent pas des autorisations sur la destination.

Les validations structurelles sont affichées dans le récapitulatif. Son analyse n’exécute ni programme ni commande de l’archive. À la confirmation d’un remplacement publié, les corrigés passent aussi les validateurs isolés habituels. Si un corrigé échoue, tout le lot est annulé ; aucun remplacement partiel n’est visible.

Un contenu déjà présent sur la cible indique **Identique — aucune modification**. Deux titres ou dates semblables ne déclenchent jamais un remplacement. Ajouter volontairement une copie d’une séance reconnue crée une identité indépendante. Si la cible change après le récapitulatif, une nouvelle comparaison est demandée.

Les anciens travaux élèves restent liés à leur version. Les élèves déjà connectés reçoivent une invitation à ouvrir la nouvelle version ; leur éditeur n’est pas remplacé automatiquement et leur saisie locale reste conservée. Les acquis, tentatives, missions et réponses de l’ancienne version ne sont pas crédités aux nouveaux exercices.

## Ressources et réseau

- Textes, contrats de blocs et d’activités, consignes, corrections, tests, fichiers de départ, illustrations, documents cités et missions affectées voyagent dans le paquet. Les corrigés restent réservés au professeur selon les règles existantes du rendu élève.
- Les illustrations gérées et les images de `public/assets` référencées par une URL locale sont embarquées. Les images utilisées dans les ateliers HTML/CSS sont restituées en données intégrées, compatibles avec les iframes isolées existantes. Les autres supports transportés utilisent une route authentifiée.
- Une ressource locale hors des emplacements gérés, un chemin absolu ou un lien de téléchargement temporaire provoque une erreur explicite. L’exporteur ne lit pas arbitrairement le disque et ne télécharge pas d’URL fournie par une archive. Importer le document dans les ressources et le citer dans la séance, ou remplacer la dépendance par un support géré avant de réessayer.
- Les liens HTTP(S) externes conservés sont énumérés avant téléchargement et dans le récapitulatif d’import. Leur site et le réseau restent nécessaires.
- Les laboratoires DOM et shell/Git nécessitent leur hôte isolé et leurs images. L’import contrôle la configuration puis `/capabilities` du broker vérifie le démarrage réel du shell/Git et du navigateur DOM avec des données de santé fixes, sans exécuter le contenu du paquet. Ce contrôle est mis en cache pendant 60 secondes par image. Déployer aussi la modification de `labs/broker.py` si ces activités sont utilisées. Un broker ancien ou inaccessible bloque la séance concernée ; on peut l’ignorer pour importer les autres.
- Les ateliers JavaScript, HTML/CSS et SQL utilisent les composants et validateurs de l’application. Les missions utilisent les cartes et moteurs compatibles de cette même version applicative ; un moteur inconnu est refusé. Le paquet n’installe pas de dépendances.

## Installation sur la destination

La configuration existante est conservée : `api/index.mjs`, `vercel.json`, PostgreSQL par `DATABASE_URL`, comptes et permissions professeur existants. Aucun nouveau service de stockage n’est obligatoire. Les tables supplémentaires sont créées idempotemment par `openStore` ; leur DDL figure dans `database/schema.sql` :

- `lesson_transfers` : propriétaire, taille, intégrité, expiration et récapitulatif courant ;
- `lesson_transfer_chunks` : fragments privés de l’archive ;
- `lesson_transfer_links` : correspondances portables limitées à la classe ;
- `lesson_transfer_receipts` : reçu d’application et reprise du même clic après perte de réponse.

`lessons.portableId` est une propriété JSON attribuée lors du premier export ou import, sans réécriture du corpus. Les anciennes sauvegardes complètes v1 restent lisibles : leur empreinte originale est vérifiée avant ajout de ces tables vides. Cela n’effectue aucune remise à zéro ni migration de catalogue.

La limite Vercel de requête/réponse est de **4,5 MB** ; la configuration du dépôt fixe la durée à **300 secondes**. Le transfert passe par des fragments binaires de **1 Mio**, aussi bien pour l’envoi que le téléchargement, et fonctionne avec plusieurs instances de la fonction. Sources vérifiées le 9 octobre 2026 : [limites Vercel Functions](https://vercel.com/docs/functions/limitations), configuration du dépôt `vercel.json`.

Les limites applicatives sont des choix explicites, distincts de celles de Vercel : **64 Mio** d’archive, **128 Mio** décompressés, **16 Mio** par entrée, **1 000** entrées ZIP, **50** séances. Les contrôles interviennent avant inflation et pendant la préparation. Un paquet dépassant ces limites doit être scindé. Les fichiers sont préparés dans les fragments privés en base, puis leurs octets vérifiés sont insérés avec les versions et les références dans **la même transaction**. Le commit ne dépend ni d’un disque éphémère ni d’un transfert S3 ultérieur. Les exports sources savent lire les artefacts SQLite/disque, inline et S3 existants.

Les fragments expirent après 24 heures ; les transferts expirés sont nettoyés lors du prochain démarrage de transfert dans la classe. Une suppression explicite est aussi possible avec `DELETE /api/lesson-transfers/:id`. Les fragments d’un essai échoué restent temporairement disponibles pour reprendre l’envoi ; aucune ressource active n’a été créée. Le navigateur retrouve le transfert privé en choisissant le même fichier. Les reçus légers et correspondances sont conservés. Un doublon d’application renvoie son reçu ; une nouvelle sélection peut importer d’autres séances du même paquet.

Le déploiement de production n’a pas été effectué dans cette livraison. La vérification distante restante est l’exécution de cette version sur l’URL Vercel cible avec sa base PostgreSQL autorisée, puis, pour DOM/shell, l’accès authentifié au broker et aux images configurées. Les tests décrits dans [la recette](acceptance.md) utilisent des instances indépendantes locales et PostgreSQL embarqué, pas la base en ligne.

## Commandes de vérification

```sh
npm run check
npm run test:transfers
npm run test:transfers:browser
# Optionnel : nécessite Docker et les images de recette existantes
npm run test:transfers:labs
npm test
```

Les fixtures de transfert restent isolées, sans chargement de `.env.local` ni appel IA. Les captures et archives de recette sont dans `test-results/lesson-transfer`, exclu de Git. Voir aussi le [contrat du paquet](format.md) et [l’audit ciblé](audit.md).
