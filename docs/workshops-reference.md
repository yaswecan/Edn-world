# Ateliers générés — 5 octobre 2026

Référence inspectée dans Chrome : `http://127.0.0.1:4173/`, servie depuis `EDEN_HUB_05_OCTOBRE_FLEXBOX_COMPLET/docs`. Lecture de `content.js`, `discovery.js`, `lab.js`, `diagrams.js` et des schémas SVG. Les fichiers `public/assets/boards` proviennent de cette référence fournie par l’utilisateur ; ce sont des illustrations locales, sans script ni ressource distante.

## Écarts corrigés

| Référence | Générateur et interface |
| --- | --- |
| Écrire du HTML/CSS dans la page | `mode: html` produit désormais un éditeur, un vrai fichier de départ, un document support et un rendu isolé ; auparavant ces ressources devenaient des réponses écrites. |
| Prévoir, changer, observer | Laboratoire Flexbox avec une modification par essai, prévision obligatoire, comparaison des positions avant/après, historique et explication sauvegardés. |
| Schémas feutre précis | Parent/enfants, axes et espaces dans le cours ; agrandissement clavier/souris et tableaux SVG exportés. |
| Reconstruire la notion | Tableau à dessiner avec trois feutres, annulation du dernier trait et légende textuelle utilisable sans dessin. |
| Exercices progressifs | Bon parent, centrage, changement de direction ; consignes, indices progressifs et vérifications séparés. |
| Production et dépannage | Quatre cartes à organiser en autonomie, puis débogage d’une consigne en colonne. |
| De vrais essais | `/api/code/run` vérifie les tests de l’activité publiée et conserve l’essai ; l’ancien bouton exécutait le code sans vérifier les cas. |
| Des activités adaptées au sujet | Programmation : code testé, cas limites et schéma ; processus : étapes mélangées à ordonner ; autres notions : associations, schéma et production concrète. |

`demoFlexbox()` appelle `localContent()` : la page publique montre réellement ce que produit le générateur. Le profil enrichit toute entrée couvrant `BC04-C2-2`, quelle que soit sa date. L’ordre des compétences du planning est conservé ; un critère secondaire ne remplace plus le sujet principal dans le titre.

## Contrats et limites

Les champs `workshop` et `boards` sont optionnels pour la compatibilité des versions existantes et définis dans les schémas exportés. Le modèle n’édite pas les ateliers ni les exemples exécutables. Les diagnostics conservent leur source dans la dernière séance réellement réalisée ; avant remise, les aides et modèles des ateliers repris en diagnostic sont retirés.

L’interpréteur serveur étend celui d’EDEN sans modifier l’archive : tableaux, objets simples, boucles bornées et méthodes de tableaux autorisées. Aucun `eval`, accès au serveur, réseau ou prototype. Les limites portent sur le code, les opérations, les appels et la taille des données. Une syntaxe non couverte reste à relire.

Les tests CSS vérifient les déclarations du sélecteur demandé, en tenant compte de l’ordre et de `!important`. Ils ne prouvent pas une géométrie exacte ni toutes les interactions de la cascade ; le rendu à plusieurs largeurs complète la vérification. Les productions ouvertes et schémas restent relus par le professeur. Les activités ne constituent pas à elles seules une preuve de maîtrise.

Le contrat de variété est un seuil de publication, pas une mesure automatique de qualité pédagogique. Les schémas illustrés sont particulièrement approfondis pour Flexbox ; les autres sujets utilisent leurs ressources, cas concrets et schémas de relations. La palette et le logo reprennent désormais l’encre et le turquoise des deux hubs désignés par l’utilisateur. Le même thème couvre les ateliers, l’aperçu professeur et les séances publiées. Les anciens traits violets sauvegardés par un élève restent lisibles ; le nouveau feutre d’accent est turquoise.

## Vérification

- Les 140 ressources passent les minima pédagogiques. Les ressources de programmation comportent un éditeur guidé et autonome ; les corrigés JavaScript sont exécutés contre leurs tests.
- Tests de non-régression : refus d’une séance réduite à des questions, protection des ateliers contre la réécriture du modèle, accès aux tests limités à la séance et à sa version, sauvegarde des essais, interpréteur borné, échappement des dessins et de l’aperçu.
- Playwright : schémas agrandissables, prévisions, manipulation des axes, dessin/annulation, code/rendu/tests, persistance après navigation et rechargement ; captures ordinateur et mobile.
- Le parcours avec le vrai serveur couvre préparation, adaptation, publication, remise élève et correction, ainsi que le runtime PédagoLab conservé.
