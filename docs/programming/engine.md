# Moteur et visualisations

Le moteur `tweenteach-js` 1.0.0 est maintenu dans `public/programming/runtime.js`. Il dérive de l’interpréteur fourni, après inspection, avec des protections et un protocole applicatifs. L’importeur ne charge jamais le fichier runtime d’un paquet. Les anciens cours continuent d’utiliser leur moteur précédent.

## Langage exécutable

Le sous-ensemble couvre les besoins du corpus : nombres, chaînes simples, booléens, null/undefined, tableaux, objets simples, variables `let/const/var`, déclarations et expressions `function`, portées lexicales, appels, paramètres, retour, `if/else`, `for (départ; condition; évolution)`, `while`, `break`, `continue`, affectations, incréments, opérateurs arithmétiques/comparaisons/logiques et conditionnel ternaire. Les méthodes autorisées sont `push`, `pop`, `forEach`, `join`, `slice`, `includes`, `indexOf` et les deux conversions de casse des chaînes ; `console.log` produit une sortie distincte du retour.

Les arguments déclaratifs du format 1 sont des données JSON primitives ou des tableaux imbriqués (deux niveaux de tableaux par argument). Les objets simples peuvent être construits dans le programme, mais les objets en arguments ne font pas partie du contrat de cette version. Les prototypes, constructeurs, accesseurs, classes, imports, fonctions fléchées, async/await, promesses, expressions régulières, template literals, `for…of/in`, `switch`, exceptions utilisateur et `this` ne sont pas des capacités de ce moteur. Ce n’est pas une implémentation générale d’ECMAScript.

Un `return` dans le callback de `forEach` quitte cet appel du callback. Le moteur continue de visiter les autres cases présentes, en utilisant la longueur initiale ; `forEach` renvoie undefined. Les traces conservent séparément les retours du callback et de la fonction englobante. L’indice 0 est un résultat valide, distinct de -1 et d’un tableau vide.

## Isolation et limites

Aucun `eval`, `Function` ou accès au contexte hôte. L’interpréteur n’expose que ses valeurs et fonctions pédagogiques. Ses marqueurs de fonctions, natives et console sont des Symbols privés, non forgeables depuis des objets élève ; leurs structures internes ne sont pas accessibles. Les fonctions renvoyées sont exportées comme libellés, pas comme environnements internes.

Le navigateur exécute dans un Worker de module applicatif. **Arrêter** termine effectivement le Worker ; le prochain lancement en crée un neuf. Une échéance externe de 3 secondes termine aussi le Worker. Les tests serveur utilisent un thread distinct, échéance de 5 secondes et limites V8 (64 Mio de vieille génération, 16 Mio de jeune génération, pile de 4 Mio).

Budgets pédagogiques supplémentaires : 10 000 caractères de code ; 16 Ko d’arguments ; 6 000 opérations par défaut (plafond interne 12 000) ; 24 appels imbriqués ; 1 000 cases par tableau modifié ; 20 000 cellules allouées ; chaînes calculées de 10 000 caractères ; 100 messages console par défaut ; 600 événements par défaut (plafond 1 500) ; budget cumulé de trace de 2 Mo. Les aperçus de valeurs ont leurs propres plafonds de profondeur, cellules et texte. Les valeurs de travail et le protocole restent bornés. Le navigateur n’offre pas de quota V8 dur configurable par Worker ; les budgets interprétés et la terminaison bornent le travail utile.

Le code élève n’a aucune liaison à `fetch`, au réseau, au DOM, aux cookies, aux jetons, au stockage ou aux globals du Worker. Le Worker sert à la réactivité et à l’interruption ; l’interprétation explicite fournit la séparation des capacités. Les réponses importées sont toujours du texte/données, jamais du HTML exécuté.

`SYNTAX`, `UNSUPPORTED`, `RUNTIME`, `LIMIT`, `STOPPED` et `TEST_FAILED` ont des significations distinctes. Une limite atteinte signale un budget épuisé, jamais une preuve mathématique de boucle infinie. Un incident technique ne certifie pas un niveau de compétence.

## Trace et schémas

Chaque événement contient ligne, nature, explication, variables, pile d’appels et compteur d’opérations. Les lectures ajoutent le nom réel du tableau, l’indice et sa valeur ; les appels ajoutent les arguments et paramètres ; les sorties ajoutent le contenu de console. Le module `public/programming/visuals.js` construit les schémas à partir de ces valeurs et des en-têtes du code affiché.

| `diagramType` | État observé |
| --- | --- |
| `array` | Cases, indices, valeurs, longueur, case lue |
| `for` | Initialisation, condition, corps, incrémentation et variables |
| `while` | Condition, évolution de l’état, arrêt ou limite |
| `function` | Appel, correspondance arguments/paramètres, retour |
| `foreach` | Valeur et indice, appel du callback, retour ignoré |
| `decompose` | Pile d’appels, valeurs transmises, composition des résultats |

Ces six présentations reprennent les cases indice/valeur, le code couleur violet/bleu/orange, les étapes du mécanisme, les liaisons arguments/paramètres, les retours et la pile d’appels du cours source. Elles sont pilotées par la trace réellement obtenue. Les boutons relisent la trace enregistrée ; le retour arrière ne réexécute aucun effet. Console, ligne active, pile et retour suivent la même position. Une modification du code ou des arguments invalide trace et résultats. L’exemple en lecture seule ne remplace pas le brouillon ; il n’est proposé que si `interactive.demo` est renseigné.

Lecture/pause, vitesse, curseur de trace, étapes et état final sont disponibles. Les données de départ et une liste vide peuvent être choisies depuis les arguments de l’appel. Ctrl/⌘ + Entrée lance le programme ; Tab insère deux espaces dans le code modifiable. Le mode sans mouvement et `prefers-reduced-motion` désactivent la lecture animée ; le pas à pas reste disponible. La case et la ligne actives possèdent aussi des libellés/indices, pas uniquement une couleur.

Une comparaison déclare `id`, `blockId`, `invoke`, des arguments communs et plusieurs programmes avec leur `diagramType`. Changer de programme conserve les arguments déclarés de comparaison, puis recalcule résultat et trace. Les descriptions, règles et tableaux d’explication sont des données facultatives de `programming.presentation.comparisons`.

## Présentation et travail élève

`public/programming/original.css` reprend les styles du cours fourni en les limitant à `.programming-reader`. `reader.css` les intègre aux conteneurs TweenTeach. La présentation est native : aucun HTML ou script du ZIP n’est inséré dans la page authentifiée. Les textes de mission, mémo et bilan sont des données échappées au rendu.

Le code, les arguments, la prédiction, les indices, la réflexion et les réponses restent séparés par activité. L’export global `programming-course-work-1` regroupe ces travaux avec l’identité du cours et de sa version. Les anciens exports unitaires `programming-work-1` restent importables. L’import valide toutes les activités avant remplacement, puis supprime les résultats antérieurs pour demander une nouvelle vérification.
