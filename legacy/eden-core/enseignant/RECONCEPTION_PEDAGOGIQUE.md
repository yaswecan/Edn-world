# Ce qui change pour l’élève

## Le problème de départ

Le portail du corpus de mardi affichait, sur une même mission, l’objectif, le contexte, quatre étapes, le jeu, des réponses, une aide, un schéma, un bonus et les critères de réussite. Les fichiers avaient en plus leurs propres chemins et consignes de rendu. L’élève devait d’abord comprendre l’organisation du support avant d’agir.

## Le choix de cette version

Chaque fiche devient une suite de petits écrans, avec un seul geste central. « Observe le démarrage » n’est pas affiché en même temps que « Reconstruis sans regarder ». Les indices sont disponibles au besoin. On n’ajoute pas de nouvelle matière pour justifier davantage d’écrans.

Le phrasé suit l’esprit des parcours NX Academy fournis : **observe → reconstruis → teste → explique**, puis une modification de situation. Le logo reste EDEN. L’élève reçoit une action précise et une preuve attendue, pas un vocabulaire de référentiel.

| Mission conservée | Geste central | Preuve attendue |
|---|---|---|
| 1. Démarrage | Placer cinq cartes et écarter l’intrus | Frise + explication d’un relais |
| 2. Processus | Observer, prédire, recharger et comparer | Un relevé avec sa source et une comparaison |
| 3. OS | Faire entrer Jeu puis distribuer six tours | Refus observé + organisation valide + explication RAM/CPU |
| 4. Fichier | Suivre le relais puis changer les droits | Accord/refus justifié |
| 5. Code | Fermer l’éditeur de démonstration | Résultat observé et quatre rôles attribués |
| 6. Incidents | Partir d’indices et réparer un nom | Piste argumentée + code exécuté après correction |

## Adaptations explicites, pas des corrections silencieuses du corpus

- Le compteur est intégré à la page et dispose d’un bouton « Recharger seulement le compteur ».
- Le fichier témoin du corpus est affiché dans le parcours et reste consultable comme ressource. Ce n’est pas un fichier créé par la Calculatrice.
- La fermeture de l’éditeur est une **simulation affichée comme telle**. Le professeur peut faire la démonstration réelle avec VS Code en parallèle. Aucun élève n’a à extraire le labo.
- L’erreur JavaScript `socre` est conservée. Le programme est exécuté dans un Worker avec une cible d’affichage minimale simulée, pas dans le DOM du Hub.
- Un rendu HTML unique remplace TXT + app.js + ZIP. Le code réparé est inclus dans le bilan.
- Les bonus ne sont pas affichés pendant l’action obligatoire. Le transfert reste dans la mission 1, le changement de droits dans la mission 4 et le zoom sur les langages dans la mission 5.

## Ce qui ne change pas

Diagnostic limité aux acquis ; six missions ; vocabulaire firmware / chargeur / noyau / processus / pilote ; séparation entre chronologie du démarrage, trajet d’une demande et exécution du code ; rôle central du professeur ; mardi 13h20–16h15 et pause 14h30–14h45.

## Animer sans tout lire

Annonce le résultat attendu. Laisse agir. Demande « Comment le sais-tu ? ». Ne projette pas tous les schémas avant les jeux. Après un essai, utilise le schéma pour nommer ce qui vient d’être observé.

Dans le jeu RAM/CPU, vérifie l’explication, pas la vitesse. Dans les dossiers A et B, ne récompense pas une cause affirmée sans preuve. Dans le labo de code, demande à voir l’erreur initiale, la modification et le nouveau résultat.

Une progression à 100 % ne signifie pas que toutes les notions sont acquises. Le ticket individuel et les phrases d’explication servent à repérer qui a besoin de reprise.

Yacine
