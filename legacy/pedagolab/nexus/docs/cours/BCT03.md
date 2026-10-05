# BCT03 — Performance et démarche green IT (compétence transverse)

## Objectif du socle

Produire des applications efficaces et limiter leur impact environnemental.

Source : `content/source/referentiel-original.md`. Les textes source sont distingués des propositions pédagogiques. Guide professeur, cours introductifs et dossiers de TP ; ce n’est pas une validation de compétence.

---

## BCT03-C1-1 — Auditer une page avec Lighthouse

### POWER AUDIT // Mesurer avant de réparer

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Google Lighthouse

### Situation d’entrée

Le portail du secteur met longtemps à répondre. Le comité veut acheter un serveur, sans aucune mesure. Lance une enquête reproductible.

### Cours d’introduction proposé

Une mesure de performance décrit un scénario, un appareil et des conditions réseau. Lighthouse fournit des audits répartis en catégories ; un score synthétique aide à repérer des pistes mais ne remplace ni les métriques détaillées ni les essais avec des utilisateurs. Une variation entre deux exécutions ne prouve pas à elle seule l’effet d’une modification.

Conserve la même page, le même mode, les mêmes paramètres et plusieurs exécutions. Lis l’explication d’un audit, formule une hypothèse, applique une correction ciblée puis compare. Distingue performance, accessibilité, SEO et bonnes pratiques. Les catégories ne mesurent pas la même chose : un bon résultat dans une catégorie ne démontre pas la conformité dans les autres.

### Exemple

```text
Journal : page / date / version du code / appareil simulé / conditions / métrique avant / modification / métrique après.
```

### Production

Audite une page de TP avec Lighthouse, conserve les rapports avant/après et défends une correction à partir d’un audit précis.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Rapports réels
- conditions comparables
- métrique interprétée
- correction identifiée
- limites de la mesure

### Transfert individuel

Un score baisse sur une seule exécution alors que rien n’a changé. Que vérifies-tu avant d’annuler ton correctif ?

### Jeu d’amorce — questions et correction professeur

Avant une comparaison fiable, tu fixes…

Attendu : Le scénario et les conditions de mesure

Comparer exige un protocole reproductible.

Un score global élevé signifie…

Attendu : Des audits réussis dans un périmètre limité

Le rapport doit être interprété, pas seulement affiché.

### Notions du socle (texte source, ligne 296)

Scores performance / accessibilité / SEO / bonnes pratiques
Installer et utiliser Google Lighthouse

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT03-C1-2 — Optimiser les médias et ressources

### ASSET DIET // Les octets inutiles

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

Le terminal charge une affiche de 8 Mo pour une miniature et attend des vidéos invisibles. Choisis ce qu’il faut réellement transférer.

### Cours d’introduction proposé

Optimiser une ressource commence par son utilité. Une image doit avoir une taille adaptée à son usage, un format pertinent et une qualité suffisante. La compression réduit le poids mais peut dégrader le rendu ; vérifie le résultat. Les dimensions déclarées aident à stabiliser la mise en page.

Le chargement différé convient surtout aux médias hors écran, pas systématiquement à l’image importante visible immédiatement. Minifier retire certains caractères inutiles du code distribué ; conserve les sources lisibles pour maintenir le projet. Mesure les octets transférés et le comportement réel. Réduire le poids ne justifie pas de supprimer une alternative textuelle utile ou une information nécessaire.

### Exemple

```text
<img src="carte-640.webp" width="640" height="360" loading="lazy" alt="Carte des relais du secteur">
```

### Production

Optimise trois médias du TP, justifie leur format et leur chargement, puis mesure les octets dans Network sans dégrader la lisibilité.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Fichiers avant/après
- tailles et formats
- comparaison visuelle
- mesure réseau
- justification du lazy loading

### Transfert individuel

L’image principale devient plus lente après ajout de lazy loading. Quelle hypothèse poses-tu ?

### Jeu d’amorce — questions et correction professeur

Pour une miniature, la première décision est…

Attendu : Adapter les dimensions au besoin

L’usage détermine les dimensions et le poids utiles.

Le lazy loading doit être appliqué…

Attendu : Selon la position et l’importance du média

Les ressources critiques ne doivent pas attendre inutilement.

### Notions du socle (texte source, ligne 297)

Compression d'images, lazy loading, minification CSS/JS

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT03-C2-1 — Optimiser les requêtes et traitements

### REQUEST BUDGET // La tempête de données

**Typologie et niveau source :** Savoir-faire technique · A2

**Outils source :** Non précisés

### Situation d’entrée

Une liste de 20 drones provoque 21 requêtes SQL et 15 appels identiques à l’API. Le tableau clignote sans apporter d’information nouvelle.

### Cours d’introduction proposé

Un traitement doit répondre au besoin avec des ressources proportionnées. Compte les appels API et les requêtes SQL avant de modifier le code. Un appel par ligne peut révéler un problème N+1 ; une jointure ou une récupération groupée peut convenir, selon le modèle. Demande seulement les colonnes et lignes nécessaires.

Côté client, évite les requêtes identiques déclenchées sans raison ; un cache, une temporisation de saisie ou une annulation de requête périmée peuvent aider. Chaque stratégie a une limite : des données mises en cache peuvent devenir anciennes, une temporisation peut retarder le retour utilisateur. Mesure avant/après et vérifie que les résultats restent corrects, notamment après une modification.

### Exemple

```text
SELECT d.id, d.nom, s.nom AS secteur FROM drones d LEFT JOIN secteurs s ON s.id = d.secteur_id;
```

### Production

Sur le TP API/SQL, compte les appels, corrige une répétition inutile et vérifie une mise à jour pour éviter un cache incohérent.

Mode : TP réel dans l’outil indiqué, hors sandbox

### Critères proposés

- Nombre d’appels avant/après
- requête ou code modifié
- résultats identiques
- essai après mise à jour
- compromis expliqué

### Transfert individuel

L’API répond vite mais affiche une ancienne alerte. Comment arbitrer fraîcheur et réduction des appels ?

### Jeu d’amorce — questions et correction professeur

Une optimisation réussie doit préserver…

Attendu : La correction des résultats

Une réponse rapide mais fausse ne satisfait pas le besoin.

Un cache impose notamment de prévoir…

Attendu : Quand actualiser ou invalider les données

La fraîcheur des données fait partie du contrat.

### Notions du socle (texte source, ligne 298)

Limiter les appels API
Optimiser les requêtes SQL (lien BC08)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT03-C3-1 — Impact du numérique et de l'IA sur l'environnement

### ENERGY COUNCIL // Le coût invisible

**Typologie et niveau source :** Savoir · Non précisé

**Outils source :** Non précisés

### Situation d’entrée

La ville veut ajouter une IA à chaque clic du portail. Les seules mesures proposées sont le temps de réponse et la facture cloud.

### Cours d’introduction proposé

L’impact environnemental du numérique ne se limite pas à l’électricité consommée pendant l’usage. La fabrication des équipements, leur durée de vie, les infrastructures et les usages contribuent à des impacts de différentes natures. Une comparaison doit annoncer son périmètre et ses hypothèses.

Pour une fonctionnalité d’IA, questionne d’abord le besoin : une règle, une recherche ou un contenu existant peuvent-ils suffire ? Le coût dépend du modèle, du matériel, de la tâche et des conditions d’exploitation. N’invente pas une valeur universelle « par prompt ». Distingue mesure, estimation et communication commerciale. Une amélioration technique peut être annulée par une augmentation des usages : surveille aussi la quantité et l’utilité des demandes.

### Exemple

```text
Décision : aide contextuelle fixe / moteur de recherche / modèle génératif. Critères : besoin satisfait, ressources, confidentialité, accessibilité, maintenance.
```

### Production

Mène un atelier de comparaison de trois solutions au même besoin. Cite les sources et expose les données manquantes au lieu de fabriquer un bilan carbone.

Mode : Production et observation humaine

### Critères proposés

- Besoin défini
- périmètre
- sources datées
- hypothèses
- incertitudes
- choix proportionné

### Transfert individuel

Un fournisseur promet une IA « verte » sans détailler sa mesure. Quelles informations demandes-tu ?

### Jeu d’amorce — questions et correction professeur

Une comparaison environnementale exige…

Attendu : Un périmètre et des hypothèses explicites

Une mesure n’a de sens que dans son périmètre.

Avant d’ajouter une IA à chaque action, tu…

Attendu : Vérifies la nécessité et les alternatives

La sobriété commence par l’utilité de la fonctionnalité.

### Notions du socle (texte source, ligne 299)

> Impact du numérique sur l'environnement — fresque du numérique
> Impact de l'usage de l'IA sur l'environnement

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.

---

## BCT03-C3-2 — Identifier les leviers d'éco-conception

### SOBER CITY // Faire moins, mais utile

**Typologie et niveau source :** Savoir-faire technique · Non précisé

**Outils source :** GR491

### Situation d’entrée

Le panneau de crise lance trois vidéos, une animation continue et une carte lourde, alors que l’utilisateur veut lire une adresse.

### Cours d’introduction proposé

L’éco-conception examine le service entier, dès le besoin et pendant son exploitation. Les référentiels comme GR491 proposent des pratiques à sélectionner selon le contexte ; cocher des règles isolées n’est pas une certification. Commence par identifier l’information ou l’action indispensable.

Réduis les médias et traitements superflus, limite les transferts, préserve l’usage sur des équipements moins puissants et organise la maintenance. La sobriété ne consiste pas à rendre le service inutilisable : accessibilité, compréhension et fiabilité restent nécessaires. Documente les choix, les bénéfices observés et les compromis. Un budget de ressources et une recette régulière rendent les décisions vérifiables.

### Exemple

```text
Besoin : lire une adresse et un horaire. MVP : texte structuré + lien d’itinéraire ; carte interactive uniquement à la demande.
```

### Production

Sélectionne trois pratiques GR491, applique-les au portail et justifie une fonctionnalité supprimée ou simplifiée sans perdre le besoin utilisateur.

Mode : Production et observation humaine

### Critères proposés

- Pratiques référencées
- besoin préservé
- changements
- mesures ou observations
- limites

### Transfert individuel

La suppression d’une image retire une explication indispensable. Quelle alternative sobre et accessible proposes-tu ?

### Jeu d’amorce — questions et correction professeur

La sobriété se juge d’abord par…

Attendu : Le service utile rendu avec des moyens proportionnés

La finalité et l’usage guident les choix.

Un référentiel de bonnes pratiques…

Attendu : Aide à choisir et justifier des actions contextualisées

Les pratiques doivent être adaptées et vérifiées.

### Notions du socle (texte source, ligne 300)

Référentiel GR491 / bonnes pratiques (sélection)

**Limite :** la réalisation du jeu n’atteste pas la maîtrise ; un TP externe nécessite une observation dans l’outil réel.