# Bonus PC — ce que l’intégration change réellement

## La bonne place : après la preuve, pas au milieu du cours

La spécification du simulateur réutilise les notions du cours, mais le montage est un nouveau mode de manipulation. Le rendre obligatoire ajouterait une charge inutile aux élèves qui ont déjà besoin de temps pour le ticket. Le bonus apparaît donc uniquement après les 36 écrans du parcours, y compris le ticket et le bilan. Aucun changement au mardi 13h20–16h15 ni à la pause de 14h30–14h45. Le bilan exportable reste disponible avant le bonus.

La barre de progression de la séance ne compte pas le bonus. Pas de note pénalisant ceux qui n’ont pas le temps. Pas de récompense de vitesse ni de classement. Les 10–20 minutes sont une estimation de conception, à vérifier dans votre classe. On peut quitter et reprendre sans recommencer le montage.

## Une consigne à la fois

À l’ouverture : « Place la carte mère dans sa zone ». Une pièce est sélectionnée et sa zone est visible. La prochaine consigne remplace la précédente après l’action. Le rôle de la pièce tient en une phrase. Les explications techniques sont repliées ; elles servent de soutien, pas de préalable.

Le clic fonctionne comme le glisser-déposer. Sur téléphone, il n’y a pas besoin d’un geste de précision continu. Les cibles restent nommées et les boutons sont activables au clavier. La compatibilité de tous les postes élèves et l’objectif « comprendre en moins de 10 secondes » restent à observer en classe, pas à déclarer comme acquis à partir d’un screenshot.

## Le montage n’est pas toute l’évaluation

Placer une pièce dans une silhouette peut se réussir par reconnaissance. C’est un échauffement guidé, pas la preuve d’avoir compris un OS. La preuve importante vient ensuite : un message observé → une zone identifiée → une réparation ciblée → un redémarrage réellement testé → une explication.

L’élève ne reçoit qu’une panne à la fois. L’ordre varie, pas les règles. Avant chaque panne, la machine revient à un état connu : on n’empile pas les sabotages. On exige un démarrage observé avant le diagnostic ; une zone correcte avant la réparation. Une réparation n’est validée qu’après une nouvelle session accessible.

## Un POWER qui change de rôle

Au premier montage, POWER est désactivé tant que le montage n’est pas prêt. En diagnostic, POWER fonctionne même si la RAM ou le SSD est absent : sinon, l’élève ne pourrait jamais observer une panne de démarrage. Pendant l’animation, les doubles clics ne créent pas plusieurs tentatives. Une navigation interrompant l’animation ne crée pas de réussite.

## Les quatre contrastes à faire expliquer

| Cas | Indice du modèle | Action attendue | Phrase de compréhension |
|---|---|---|---|
| RAM absente | Arrêt au POST, aucune RAM | Éteindre puis replacer la RAM | « On n’a pas encore cherché le système. » |
| SSD absent | POST réussi, SSD non détecté | Éteindre puis replacer le SSD pré-câblé | « Les premiers contrôles réussissent sans disque. » |
| Chargeur absent | SSD détecté, chargeur introuvable | Restaurer le chargeur simulé, redémarrer | « Détecté ne signifie pas amorçable. » |
| OS absent | Chargeur lancé, système introuvable | Réinstaller l’OS simulé, redémarrer | « Le chargeur et le système sont deux rôles distincts. » |

Le BIOS simulé n’est pas un bouton magique. Il montre ce qui est détecté et une entrée de boot. Il ne répare rien. Choisir l’USB de données provoque un problème d’entrée non amorçable, distinct du SSD absent. Cette erreur volontaire n’ajoute pas une cinquième panne obligatoire.

## Explication courte, mais non vide

À la fin : une question de transfert et une phrase « J’ai vu… J’ai réparé… J’ai vérifié… ». Une longueur minimale empêche seulement l’envoi vide ; elle ne mesure pas la justesse. Le professeur lit et valide séparément. Les quatre réparations testées sont une preuve de manipulation, pas une certification.

## Ce que le modèle ne doit pas faire croire

Le POST appartient au firmware. Le système est déjà installé sur le SSD pour le premier montage. L’écran et la souris ne sont pas des conditions universelles du boot ; ce sont les périphériques de notre configuration. Le CPU choisi n’a pas de graphique intégré. Hors de notre configuration, une machine peut démarrer sans SSD interne. Les messages et les outils de réparation sont entièrement fictifs : pas de manipulation du vrai BIOS, de formatage ou d’installation.

## Rôle du professeur pendant le bonus

Faire montrer la dernière étape réussie. Demander « Quelle observation écarte ta première idée ? ». Lire la différence entre une erreur de placement et un diagnostic hésitant ; le nombre d’erreurs n’est pas une note. Arrêter l’activité à l’heure de fin même si un poste fictif n’est pas réparé. Le service de suivi garde les essais reçus ; sans ce service, récupérer le bilan exporté.
