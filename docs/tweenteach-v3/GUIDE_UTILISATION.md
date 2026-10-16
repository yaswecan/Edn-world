# Guide professeur et élève

Utiliser une copie de test de l’application pour les essais. Les scripts de recette créent leurs comptes fictifs automatiquement ; ils ne nécessitent aucun mot de passe scolaire.

## Professeur

1. Ouvrir **Élèves → Référentiel → Administrer les éléments** (`/suivi.html?view=reference-admin`). Créer un référentiel local et son premier élément ; ajouter compétences/sous-compétences et critères. Les codes absents restent vides. Décrire la preuve attendue et les aides autorisées. Le formulaire d’élément permet de nommer un ensemble exhaustif de critères sources pour la couverture.
2. Publier le brouillon après examen des usages. Un référentiel partagé exige le droit dédié ; une édition publiée crée une révision brouillon. Pour importer, examiner l’aperçu avant application. Un conflit est bloquant ; une réimportation identique ne duplique rien.
3. Dans **Grilles et consolidation**, choisir la version de séance, son échelle et les critères réellement évalués. Renseigner les seuils et niveaux maximaux observables. Les critères essentiels et les règles ne sont pas déduits d’une note globale. Une grille déjà commencée exige une nouvelle version de séance.
4. Ouvrir **Planification** (`/suivi.html?view=planning`). Choisir une version, date, durée, activités et objectifs qualifiés. **Ouvrir l’occurrence** donne accès au report, aux conflits connus, au réalisé partiel, aux constats individuels et à la reprogrammation du reste. **Ouvrir et attribuer** sélectionne explicitement les élèves ; la simple planification ne donne pas accès au contenu.
5. Dans les **Copies** de l’occurrence, consulter la production, enregistrer la correction, fermer la passation puis publier la révision. Une nouvelle correction reste privée. **Retirer la publication** exige un motif, conserve l’historique et masque les données dépendantes côté élève.
6. Ouvrir **Pilotage** (`/suivi.html?view=pilotage`). Filtrer passation, version et période ; choisir **Dernières observations** ou **Niveaux retenus**. Une répartition ouvre les élèves, preuves et causes manquantes. Le CSV reprend ce mode et ce périmètre. Les seuils d’alerte sont visibles ; **Traiter cette alerte** enregistre la décision et recontrôle les preuves.
7. Depuis une preuve, **Choisir une action** ouvre les activités adaptées avec l’élève préfiltré. Configurer les prérequis/activités disponibles, calculer la proposition puis valider l’attribution. Après réalisation, ouvrir une vérification indépendante, corriger/publier sa copie et décider de la poursuite. Une réalisation seule ne valide aucun niveau.
8. Pour une production orale ou de groupe, **Documenter une preuve hors plateforme** permet un constat individuel par critère. Utiliser la même famille pour les clones d’exercice ; laisser vide la date réellement inconnue. Publier le constat séparément. Il apparaît dans les preuves de l’élève.
9. **Demandes** présente les questions liées aux résultats publiés. Répondre dans l’application, puis clore la demande. Aucun message externe n’est envoyé.

Pour retrouver toutes les tentatives autorisées d’un élève, utiliser sa fiche **Élèves**, puis ses copies et **Compétences et niveaux retenus**. Les anciennes classes ne deviennent pas implicitement accessibles.

## Élève

Le hub conserve **Aujourd’hui**, **Mes séances**, **Mes évaluations**, **Mes compétences**. Une séance attribuée reste retrouvable après fermeture ; elle devient en lecture seule. Les objectifs futurs attribués sont affichés sans échec supposé.

Dans une copie publiée, **Demander une explication** crée un échange privé. La réponse est disponible dans **Mes demandes d’explication**. Les compétences donnent accès aux preuves publiées et prochaines activités. **Exporter mon bilan** produit uniquement les données personnelles autorisées.

## Recette reproductible

```sh
npm run test:tracking:v3
npm run test:tracking:v3:browser
npm run test:tracking:browser
npm run test:tracking:v2:browser
```

Le script V3 parcourt réellement les formulaires de référentiel/planning, la sauvegarde/remise élève, la correction/publication, les échanges privés, une décision d’alerte et un constat hors plateforme. Le test API `AC3-72` poursuit jusqu’à la reprise et sa vérification. Les captures se trouvent dans `test-results/tracking-v3/`.
