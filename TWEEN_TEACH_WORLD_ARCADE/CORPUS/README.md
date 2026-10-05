# Corpus d’intégration — à lire, pas à importer aveuglément

`world-arcade.corpus.json` est la source structurée de la conception : palette exacte, textes UI,
parcours, deux jeux, neuf grades de référence, décisions à résoudre et garde-fous. Son schéma
JSON est fourni séparément. Les chemins sont relatifs à la racine du pack, pas au dossier CORPUS.

`assets.manifest.json` décrit les 18 images WebP réelles et leurs empreintes. Les 15 portraits sont
illustrés ; ils ne représentent pas des fiches d’élèves. Aucun jeu de données utilisateur réel n’est
inclus. Les 18 joueurs fictifs du prototype restent dans sa copie de référence uniquement.

`reference-source.manifest.json` permet de contrôler que la copie du front correspond à l’archive
fournie. `manifest.json` indique les documents et le parcours de lecture.

## Interprétation

Les champs `null` de routes, IDs hôtes et seuils sont intentionnels : ne pas les convertir en
valeurs arbitraires. Réaliser le mapping après audit, dans le vrai code ou sa configuration existante.
Les drapeaux du corpus sont des propositions de comportement sûr, pas des variables d’environnement
prêtes à coller sans adaptation. Les noms de capacités ne remplacent pas les autorisations du serveur.

La liste de grades est une référence visuelle, sans barème validé. La configuration du dépôt prime.
Les règles de points, les comptes et les sauvegardes ne se chargent pas depuis ce fichier.

Pour produire les composants, extraire seulement les sous-ensembles utiles (textes, tokens, catalogue
public résolu). Ne pas embarquer le corpus entier et ses décisions internes dans l’interface élève.
Ne pas placer ce dossier ou ses rapports dans `public/`, un importeur de séances ou une base de production.

Les ajouts de rédaction suivent le français direct : un titre, une information utile et une action.
Les données réelles absentes restent absentes. Un état d’erreur ne doit pas produire de faux scores.
