# Dashboard annuel A1 — règles de lecture

Source : `curriculum/source/Planification_A1_2026-2027.xlsx`.

Le tableau de bord intègre :
- 48 compétences N2 ;
- 106 critères N3 ;
- 142 séances planifiées ;
- 63 évaluations (49 points de maîtrise, 4 bilans de progression, 10 évaluations officielles) ;
- les ressources et traces de la planification A1.

## Ne pas confondre absence de donnée et retard

Un critère planifié mais sans preuve apparaît **À observer**. Cela ne met pas automatiquement l'élève en remédiation.

La lecture « Remédiation » n'est proposée que lorsque :
- le critère est déjà attendu à la date de référence ;
- le niveau observé reste 0 ou 1 ;
- et il existe plusieurs preuves faibles, ou une preuve faible provenant d'un bilan / d'une évaluation officielle.

## Niveaux

- 0 — À construire
- 1 — Fragile / partiel ou avec aide
- 2 — En consolidation / autonome mais à stabiliser
- 3 — Maîtrisé / transfert autonome
- Non observé — aucune preuve disponible

## Maîtrise

Le plan source demande « 2 preuves autonomes espacées, dont une en transfert ». La V7.1 applique par défaut un espacement de 7 jours entre deux preuves fortes pour confirmer le niveau 3. Ce paramètre est dans `public/data/curriculum-a1.json` (`evidenceSpacingDays`) et peut être ajusté.

## Rythme annuel

Le niveau attendu d'un critère dépend de la planification :
- première rencontre : attendu 1 ;
- au moins deux rencontres : attendu 2 ;
- après un bilan de progression ou une évaluation officielle planifiée : attendu 3.

La date de référence est modifiable dans le dashboard professeur.

## Lecture globale d'un élève

Les catégories sont des aides de pilotage, jamais des étiquettes permanentes :
- **Données insuffisantes** : couverture de preuves trop faible ;
- **Dans le rythme** : écarts faibles par rapport aux attentes ;
- **Rythme à sécuriser** : plusieurs critères observés légèrement sous l'attendu ;
- **Remédiation ciblée** : plusieurs besoins confirmés ;
- **En avance** : résultats au-dessus de l'attendu ou compétences futures déjà transférées.

Un élève peut simultanément être en avance en algorithmique et en remédiation sur CSS. Les groupes du vendredi doivent donc rester temporaires et centrés sur un critère précis.

## Sources de preuve

Les missions validées dans les mondes génèrent des preuves automatiquement :
- mission normale : niveau 2 ;
- production finale : preuve de transfert niveau 3.

Une production finale seule ne suffit cependant pas à confirmer la maîtrise : le moteur demande également une deuxième preuve forte espacée.

Le professeur peut enregistrer manuellement une preuve depuis la fiche élève : point de maîtrise, bilan, évaluation officielle ou observation.

Les ressources simplement consultées ne sont pas utilisées comme preuve de maîtrise.
