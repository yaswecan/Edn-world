# Éditeur de séances

Depuis **Mes séances → Ouvrir → Modifier**, le contenu existant s’ouvre dans l’éditeur. Le bouton est disponible pour les brouillons et les séances publiées.

1. Choisir une section dans le sommaire. Modifier son titre ou ses textes avec la barre de mise en forme. Les images sont importées depuis le bouton **Image** ; renseigner leur texte alternatif et leur légende.
2. Dans une activité, modifier les vrais fichiers sous **Code de départ**. Les fichiers DOM restent `index.html`, `style.css` et `main.js`. Les ateliers HTML/CSS exposent aussi leurs supports. Les ateliers shell permettent d’ajouter, renommer et supprimer des fichiers.
3. **Exécuter** utilise le code affiché. Pour DOM et shell, **Essayer dans l’aperçu élève** utilise le laboratoire configuré sur cette instance. Les réponses d’aperçu restent séparées des élèves. **Correction et tests** est réservé au professeur ; modifier le code de départ ne régénère aucun autre champ.
4. Déplacer les sections avec la poignée ou **Monter / Descendre**. Les blocs internes disposent aussi de commandes de déplacement, duplication et suppression. **Annuler / Rétablir** couvre texte, code et structure. `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` et `Ctrl/Cmd+S` sont disponibles.
5. La sauvegarde du brouillon démarre après 1,2 seconde sans modification ; **Enregistrer** l’exécute immédiatement. Attendre **Enregistré** avant de quitter. Un échec laisse le travail affiché ; le même bouton réessaie. Un conflit propose de télécharger son travail, recharger la version distante ou conserver explicitement sa version.
6. **Aperçu élève** montre le brouillon courant avec le rendu partagé. **Mettre à jour la séance** sélectionne explicitement la nouvelle version publiée, au même lien. Les contraintes pédagogiques peuvent bloquer la publication, jamais la sauvegarde d’un brouillon vide.
7. **Exporter** attend une sauvegarde réussie et télécharge `brouillon.tweenteach.zip`. L’import s’effectue avec **Importer des séances** dans le hub. Les médias sont embarqués. Pour une séance publiée avec modifications, ce bouton exporte le brouillon ; l’export du détail habituel reste celui de la version active.

Le téléchargement **Télécharger mon travail**, proposé en cas de conflit, est une copie de secours JSON locale. Il ne déclare pas la séance enregistrée et ne remplace pas l’archive de transfert.

## Installation et développement

```sh
npm install
npm run build
npm run dev
```

L’éditeur est compilé localement dans `public/lesson-editor.bundle.js`, sans CDN. Après modification du code de l’interface : `npm run build:editor`. Le build d’hébergement reconstruit également le bundle. Aucun nouveau service ni changement de schéma SQL n’est nécessaire ; les documents versionnés utilisent les agrégats existants.

Les moteurs DOM et shell conservent les variables et les images Docker du module `labs`. Sans laboratoire configuré, le message d’indisponibilité est explicite ; l’édition et l’enregistrement des fichiers restent possibles. Aucun moteur alternatif n’est lancé dans la page principale.

Les supports HTML et l’archive portable conservent la structure riche, les médias et les fichiers. Les PDF et présentations existants continuent d’utiliser leurs projections textuelles. Les propositions IA qui supprimeraient la représentation riche ou désynchroniseraient son contenu sont rejetées avec une indication ; le professeur peut modifier ces contenus directement dans l’éditeur.

## Vérifications

```sh
npm run test:editor
npm run test:editor:browser
npm run test:editor:labs
```

La dernière commande demande les images Docker `tweenteach-dom:quality-v2` et `tweenteach-shell:quality-v2`. Ces recettes créent des séances et comptes synthétiques, avec des bases séparées ; elles ne chargent pas `.env.local`. Voir [l’audit](audit.md) et [les résultats de recette](acceptance.md).
