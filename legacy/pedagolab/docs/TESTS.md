# Recette PédagoLab Worlds V7

## Contrôles exécutés

- `server.py` compilé avec Python.
- API FastAPI locale : status, setup professeur, login professeur, création élève, login élève, sauvegarde progression, override monde, lecture des accès et frontend statique.
- 140 unités NEXUS chargées dans la bibliothèque.
- Interface navigateur testée en Chromium avec API simulée.
- Login avec animation et première séquence d'indicatif.
- Accueil : 5 cartes de mondes, 1 monde initialement accessible.
- Ressources : 140 cartes disponibles.
- CODE//STATION : 4 missions affichées, test ciblé d'un scénario.
- Parcours complet automatisé : 20 missions sur les 5 mondes.
- Chaque production finale débloque le monde suivant.
- À la fin, les 5 mondes sont accessibles.
- Override professeur testé via l'API sans validation de missions.

## Limites

- Chromium utilisé pour la recette UI ; Safari/Firefox non exécutés.
- Les éditeurs de code utilisent un interpréteur JavaScript pédagogique dans le navigateur, pas un environnement d'exécution isolé de niveau production.
- L'ancien CODE//STATION V6 est fourni comme référence séparée et n'est pas la source de progression du hub V7.
