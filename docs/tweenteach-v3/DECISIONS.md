# Modèle et décisions V3

## Identités et versions

Le stockage existant est conservé. Un référentiel est une succession de snapshots `framework_versions` ; `logicalId` relie ses révisions et `basedOnId` en conserve la filiation. Les identités internes des éléments/critères sont stables dans ces snapshots. La révision exacte est portée par `frameworkVersionId` dans les grilles, preuves et objectifs. Aucun code seul ne sert à fusionner des éléments.

Les versions V2 sans `status` restent publiées pour compatibilité. Une édition publiée crée un brouillon. Les copies distribuées et grilles commencées ne changent pas. Les suppressions sont limitées aux brouillons sans dépendances. Les éléments publiés s’archivent dans une nouvelle révision. Une correspondance pédagogique V2 explicite reste nécessaire pour consolider entre versions.

Le périmètre partagé est une capacité de publication, pas un droit de lecture des élèves : `teachers.permissions` doit contenir `framework:publish`. La création locale reste disponible. Aucun compte n’est promu automatiquement. Le référentiel demeure stocké dans la classe autorisée ; cette livraison ne crée pas un annuaire interétablissements.

## Planning

`lesson_versions` porte le contenu ; `lesson_runs` porte l’occurrence et sa `revision` de planification. Les modifications créent une entrée append-only dans `plan_changes`. `date` reste une date locale ; `initialDate` conserve la première date ; `realization` contient les dates et activités constatées. Le statut de planification est indépendant de `availability`.

Créer une occurrence n’attribue aucun contenu. La date d’ouverture explicite `releasedAt` est vérifiée aussi par les anciennes routes d’attribution et les parcours adaptés. L’ouverture exige une version publiée et des élèves explicitement sélectionnés. Les anciennes attributions conservent leurs dates et travaux : un report n’y déplace pas les copies. Le réalisé partiel conserve ses activités et crée, sur demande, une occurrence liée pour le reste. La grille conserve sa famille de situation, donc une scission ne multiplie pas les preuves indépendantes.

Les conflits contrôlés sont les occurrences de cette classe le même jour et les prérequis déclarés. Le produit n’a pas d’agenda externe ni d’horaires détaillés fiables à consulter. Une confirmation motivée accepte ces avertissements ; elle ne contourne aucun droit.

## Preuves et calcul

Les observations V2 sont conservées. Une preuve hors plateforme utilise une tête de révision `teacher_observations` et des observations immuables `competency_observations`. Elle décrit l’appréciation individuelle d’une production, éventuellement collective. Elle ne fabrique ni remise numérique ni note globale. Une date inconnue reste `null`, ce qui bloque la consolidation automatique concernée. Les publications référencent les observations exactes ; une révision privée laisse l’ancienne publication accessible.

La politique V2 n’est pas remplacée. Sa configuration explicite via l’éditeur produit une version : deux situations récentes pour les essentiels par défaut, règle explicite pour les autres, autonomie documentée, niveau observable maximal, exclusion des clones et chronologie stable. La validation du professeur et la publication restent deux opérations distinctes.

Les liens de grilles V2 sont présentés comme des déclarations de configuration ; seul le pilotage décrit les réalisations et preuves constatées. Les indicateurs séparent observations finales et décisions retenues. Ils dédupliquent les élèves, exposent les exclusions et évitent une distribution lorsque les échelles diffèrent. Les seuils d’alerte et le nombre de situations pour une difficulté répétée sont des paramètres visibles. Les alertes ont une identité stable et une empreinte des preuves ; une décision sur une alerte obsolète est refusée. Aucune alerte ne publie ni ne déplace une séance.

## API et concurrence

Toutes les routes V3 sont déclarées dans `server/tracking-v3-routes.mjs`. Les mutations vérifient compte et classe dans une transaction. `revision` protège référentiels, occurrences et demandes ; `requestId` rend les créations d’occurrences et questions répétables. Une clé réutilisée avec un autre contenu produit un conflit. Les alertes utilisent en plus `evidenceHash`.

Les exports sont trois flux distincts : référentiel JSON autorisé, CSV professeur avec mode explicite, bilan personnel publié. Les cellules CSV commençant par un préfixe de formule sont neutralisées. Les réponses applicatives restent `Cache-Control: no-store`.

## Limites structurelles

Les agrégats JSON sont lus par classe, puis filtrés/calculés en mémoire. La pagination borne les réponses, pas toute la lecture SQL. La mesure locale documentée ne garantit pas une capacité de production. Aucun job, microservice ou cache partagé nouveau n’est introduit.

Les relations de séquence utilisent le libellé existant du planning ; aucune normalisation destructive des séquences historiques n’est faite. Les imports sources contradictoires restent bloqués et exigent une nouvelle version ou une révision explicite ; pas de fusion automatique de modifications concurrentes.
