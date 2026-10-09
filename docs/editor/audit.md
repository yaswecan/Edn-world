# Audit et contrat de l’éditeur — 9 octobre 2026

## Parcours initial

`public/app.js` exposait **Modifier le contenu** uniquement sur les brouillons. L’action ouvrait un formulaire de champs texte pour les sections et activités, ignorait le diagnostic et ne proposait ni réorganisation ni mise en forme riche. `PUT /api/lessons/:id` appelait `editLesson`, avec numéro de version, justification et validation du schéma. Le moteur DOM utilisait `activity.starter` pour `main.js`, même si un autre contenu existait dans `workshop.files`.

Les séances sont des agrégats `lessons`, leur contenu est figé dans `lesson_versions`. Le déroulé est `spec.blocks` : ce sont les **sections** de l’interface. Leurs activités sont référencées par `activityIds` dans `spec.activities`. Le diagnostic dispose de sa collection de tâches et de son barème. Le rendu partagé est `public/lesson-renderer.js`, utilisé par le parcours `/today` et les aperçus. Les réponses, événements et laboratoires sont associés aux identités et versions existantes.

Les propositions IA contrôlent la version de base et la présence d’une génération en cours. Les transferts déjà présents utilisent `server/lesson-package.mjs`, `lesson-transfer-content.mjs`, `lesson-transfer.mjs` et leurs routes. Ils transportent les contenus, sources, ressources et missions ; leurs contrôles ont été utilisés dans la recette, et pas seulement supposés présents.

## Source de vérité

Le contrat v1 reste lisible. `editorVersion: 1` signale une préparation éditée. Une section peut ajouter `editor: {version: 1, items: [...]}` : textes riches ProseMirror, références d’activités, tableaux pédagogiques, objectifs, diagnostic ou mission. Le tableau ordonné fait autorité. `content`, `teaching`, `boards`, `activityIds`, `timeline`, `studentFlow` et les diapositives sont des projections pour les services existants. Une section sans cette propriété conserve son rendu historique et n’est pas convertie lors d’une simple ouverture.

Les textes d’activité utilisent des champs riches optionnels séparés de `starter`, `reference`, `tests` et `workshop.files`. Les champs privés sont retirés dans `studentSpec`. La représentation riche est validée par une liste de nœuds et d’attributs autorisés ainsi que par le schéma ProseMirror effectif. Un type inconnu provoque une erreur contrôlée. Les liens et images sont validés ; le HTML est dérivé et échappé par un renderer partagé. Le code exécutable n’emprunte jamais ce traitement.

Déplacer ou renommer conserve les identités. Dupliquer remappe celles de la section, de ses blocs et des activités copiées. Supprimer une référence d’activité ne supprime l’activité du brouillon que lorsqu’aucune section ne l’utilise. Supprimer la dernière section diagnostic retire aussi ses tâches et son barème du contenu courant. Les anciennes versions, réponses et ressources restent conservées.

Les fichiers DOM sont fixes conformément au moteur. `starter` reste la source du script, et `workshop.files.main.js` sa projection cohérente. Le code conserve ses espaces, tabulations, chaînes vides et retours LF/CRLF ; l’adaptateur de CodeMirror préserve les fins de ligne originales lors des modifications et du collage.

## Sauvegarde et publication

`GET/PUT /api/lessons/:id/editor` utilise un jeton fondé sur la version active et la version de brouillon. Chaque écriture est sérialisée et vérifiée dans une transaction, puis inscrite dans une version et un instantané durable. Le client attend la confirmation et n’acquitte que la photographie réellement envoyée. Il garde les changements arrivés pendant la requête et les envoie ensuite.

Pour une séance déjà publiée, `editorDraftVersionId` désigne la préparation ; `versionId`, le titre, la publication et le parcours élève continuent de désigner la version active. La mise à jour compile la version candidate, revérifie le jeton et les contrôles de publication, puis sélectionne atomiquement la nouvelle version. Une préparation issue de l’IA nécessitant une reprise professeur exige une relecture explicite et conserve la trace de cette décision ; une préparation encore active ou une simulation ne peut pas l’utiliser.

Le mécanisme existant de notification de changement de version protège le formulaire élève ouvert. Les anciennes réponses restent dans leur version et ne créditent pas la nouvelle. Les réinitialisations DOM/shell utilisent les sources de la révision concernée. Le contrôle de publication DOM a été raccordé au laboratoire navigateur existant ; il ne passe plus les tests DOM au validateur JavaScript simple.

## Ressources et transferts

Les images importées sont conservées dans `lesson_assets`, avec type raster vérifié, empreinte et appartenance à la classe. Leur suppression d’un document n’efface pas la ressource partagée. L’archive utilise le contrat de transfert existant. À l’import, les images des documents riches deviennent des références durables du serveur destination, ce qui évite de gonfler le document avec leurs données binaires. Les fichiers de code et supports qui embarquent des médias conservent le traitement portable existant.

L’export de l’éditeur cible explicitement sa version confirmée et produit aussi un cours HTML riche dans le corpus. Un remplacement distant invalide le jeton d’une édition ouverte et sélectionne le contenu importé ; il ne conserve pas un pointeur vers un ancien brouillon susceptible de réintroduire les sections supprimées.

## Bibliothèques

L’application utilise des modules JavaScript et Express, sans framework de composants. Aucune bibliothèque riche n’était installée. Choix : [Tiptap en JavaScript](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript), son [extension de tableaux](https://tiptap.dev/docs/editor/extensions/nodes/table) et [CodeMirror](https://codemirror.net/examples/basic/). Versions exactes dans `package.json` et le lockfile. Le bundle est chargé seulement sur la page d’édition.
