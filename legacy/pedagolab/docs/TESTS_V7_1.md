# Tests V7.1 — Curriculum A1

## Contrôles statiques

PASS :
- syntaxe `server.py` ;
- syntaxe `public/app.js` (`node --check`) ;
- 16 blocs NEXUS ;
- 140 ressources NEXUS uniques ;
- 48 compétences N2 ;
- 106 critères N3 ;
- 63 évaluations ;
- 142 séances planifiées ;
- présence du fichier source XLSX dans le projet.

## Contrôle API preuve professeur

Test local FastAPI / SQLite :
1. initialisation professeur ;
2. connexion professeur ;
3. création d'un élève ;
4. ajout d'une preuve `BC05-C1-3`, score 1 ;
5. relecture via `/api/teacher/students` ;
6. preuve présente dans `progress.platform.evidence`.

Résultat : PASS.

## Limites

- Le classement « trajectoire » est une aide au pilotage, pas une décision automatique.
- Les anciennes missions déjà terminées sont converties en preuves héritées sans date et ne suffisent pas seules à confirmer une maîtrise niveau 3.
- Les ressources consultées ne sont jamais comptées comme preuve de maîtrise.
- La validation visuelle a été limitée à la syntaxe/structure dans cet environnement ; un contrôle sur navigateur réel reste recommandé après déploiement Vercel.
