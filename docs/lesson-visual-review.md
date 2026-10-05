# Revue visuelle — actualisée le 5 octobre 2026

## Comparaison avec les sources disponibles

Inspection de `legacy/eden-core/enseignant/apercus/01_montage.png` : grandes zones blanches, titre très gras, panneaux arrondis, numérotation, schéma construit au trait, indice près de l’action. Lecture des écrans V6 : un objectif de manipulation, une consigne courte, éditeur sombre, cas de vérification, indice repliable et bilan. Les fichiers source consultés sont identiques aux membres correspondants des ZIP : voir `reference-manifest.json`.

Les deux hubs indiqués le 5 octobre ont été inspectés dans Chrome : Logique & JavaScript en ligne et Flexbox sur le port 4173. Le renderer partagé utilise maintenant leur logo original, leur palette encre/turquoise, leurs boutons sombres, leurs fonds gris-vert et leurs repères bleu clair. Le hero reprend les quatre illustrations locales dans un tableau au trait, ainsi qu’un soulignement turquoise. Les écrans de code, de dessin et de manipulation suivent la même charte. Les captures ordinateur et mobile ont été comparées visuellement aux références.

Le modèle ne produit pas de CSS ni de logo. Les fichiers de marque locaux et `brand.css` fixent le rendu de toutes les séances. Les fichiers d’export reprennent aussi le logo et l’encre, sans modifier les copies élèves ni les anciens corpus.

## Captures à examiner

- [Hero desktop](../tests/visual/baselines/darwin/desktop/lesson-hero.png)
- [Hero mobile](../tests/visual/baselines/darwin/mobile/lesson-hero.png)
- [Notion et schéma](../tests/visual/baselines/darwin/desktop/lesson-concept.png)
- [Exemple commenté mobile](../tests/visual/baselines/darwin/mobile/lesson-observation.png)
- [Atelier guidé](../tests/visual/baselines/darwin/desktop/lesson-guided.png)
- [Bilan](../tests/visual/baselines/darwin/desktop/lesson-summary.png)
- [Page Aujourd’hui](../tests/visual/baselines/darwin/desktop/today-hero.png)

## Acceptation interne

- [x] Titres extra-bold, texte sombre dominant, fond blanc, accents mesurés.
- [x] Objectifs au départ, phases identifiables et durées visibles.
- [x] Même système pour démonstration, aperçu et espace élève.
- [x] Exemple lu pas à pas, indice repliable, vérification, exercice autonome et synthèse.
- [x] Schéma ET revu : les deux entrées sont réunies, le cas de refus est explicite.
- [x] Navigation mobile repliable ; contenus conservés à 390px ; aucun débordement de page sur les huit phases.
- [x] Réponses conservées entre étapes, indice actionnable au clavier, champs avec labels.
- [x] Progression basée sur les étapes terminées, sans afficher un score de maîtrise fictif.
- [x] Diagnostic bloquant jusqu’à remise, reçu et progression testés dans `/today`.
- [x] Parcours réel et PédagoLab vérifiés dans le test navigateur existant.
- [x] Logo original et couleurs comparés aux deux hubs demandés le 5 octobre.

Les baselines sont des références internes de non-régression, après inspection des captures. Elles ne représentent pas une approbation du commanditaire ni une comparaison pixel à pixel avec les hubs fournis. Les tests API du modèle sont couverts au niveau du contrat et de la fusion ; aucun appel à un fournisseur LLM réel n’est nécessaire pour ces tests.
