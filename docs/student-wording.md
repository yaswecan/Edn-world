# Textes de l’espace élève — inventaire et recette

Implémentation du plan `PROMPT_CODEX_WORDING_ELEVE_PREMIUM.txt`, le 5 octobre 2026.

## Périmètre réel

- `/` et `/today` : connexion avec sélection du rôle. `/today` présélectionne Élève. Le champ est un **mot de passe**, vérifié par `passwordMatches` ; aucun changement d’authentification.
- `/today` : accueil de séance, progression, évaluation notée sur 20, cours, exercices, ateliers HTML/CSS/JavaScript, laboratoire, tableau, indices, rendu, résultat, bilan et lancement de mission.
- `/play/:world/:mission` utilise déjà le même point d’entrée que `/today` ; son comportement est conservé.
- `/game/index.html` : mission PédagoLab intégrée et ressources ouvertes depuis une mission. Les noms, scénarios, grades, tests et déblocages sont conservés.
- `/lesson-demo.html` et sa variante `?lesson=flexbox` : même renderer que la séance publiée ; exemples synthétiques régénérés.
- Aperçu élève du professeur : `POST /api/lessons/:id/preview`, puis le même `renderLessonBlock` que la séance publiée.
- Documents élèves produits localement par `compileCorpus` et `individualExport` : titres, attendus, correction et historique des essais.

Il n’existe pas de page de profil élève, de centre de notifications ou de bibliothèque élève indépendante dans l’application montée. La bibliothèque accessible est celle d’une mission. Les applications archivées sous `legacy/` ne sont pas montées. Les anciens écrans de connexion et de catalogue présents dans le fichier du jeu ne sont pas appelés par son point d’entrée intégré ; aucune refonte de ces applications historiques.

## Inventaire des décisions

| Emplacement | Texte ou donnée auparavant visible | Décision et cible |
| --- | --- | --- |
| `public/app.js`, connexion Élève | Teacher Twin, Reprendre le fil, slogan | Supprimer ; titre « Connexion » |
| Connexion et accès transmis par le professeur | Mot de passe / code d’accès | Raccourcir : « Mot de passe », « Se connecter » |
| Sélecteur de rôle et champs | Professeur / Élève, Identifiant | Conserver ; `aria-pressed`, labels associés |
| Accueil sans séance | Promesse d’ouverture par le professeur | Supprimer la promesse ; « Aucune séance pour le moment. » |
| `public/lesson-renderer.js`, en-têtes/navigation | Séquence technique, minutes par étape et activité | Supprimer de l’affichage ; données et vues professeur conservées |
| Hero, objectifs et pied de page | « min pour explorer », slogans, encouragements permanents | Supprimer les éléments et leurs conteneurs |
| Cours, exemples, schémas, code, console, indices | Contenu pédagogique | Conserver, y compris API, JSON, serveur, tests, pipeline lorsqu’ils sont enseignés |
| Présentation optionnelle | Schéma générique de remplacement | Supprimer ; aucun faux contenu si le champ est vide |
| Évaluation | « Fais le point », source de séance clôturée, durées | « Évaluation », nombre d’exercices et « Note sur 20 » ; consignes sans aide et condition de rendu conservées |
| Exercice | « Ta trace », « À toi de jouer », durée | « À rendre », « Exercice » ou « Facultatif », sans durée |
| Vérification du code | « Tester mon code », `1/1 vérifications réussies` | « Vérifier mon code », « 1 test réussi sur 1 » ; erreurs du code conservées |
| Enregistrement et rendu | Serveur, heure de réception, hash | « Enregistrer », « Rendre mon travail », confirmations après réponse réussie |
| Échec réseau d’envoi | Erreur brute, détails techniques | « L’envoi n’a pas pu être confirmé. Réessaie. » ; ne présume pas que le travail est perdu |
| Résultat | NE /20, vocabulaire de preuve, `items` absent | « Aucun travail rendu » ou « Non évalué » selon le cas ; score et niveau existants conservés ; statut provisoire/validé explicite |
| Erreurs et modales | Messages fournisseur, détails JSON | Messages élèves centralisés ; détails professeur conservés ; titre accessible et bouton Fermer |
| Remédiation générée/adaptée | G1, codes de critères, consignes de pilotage | « Entraînement » ; métadonnées déplacées dans `teacherGuide`, véritables exercices conservés |
| Générateur et pré-correcteur | Mélange de microcopie et métadonnées | Consignes de génération séparant élèves/professeur ; titres/transitions internes refusés à la fusion |
| Mission | Slogan de lancement, condition de réussite inventée en secours | Brief et condition réelle ; « Jouer » ; absence de condition = aucun texte inventé |
| Jeu intégré | Confirmation de sauvegarde avant réponse ; promesse de déblocage | Supprimer ; confirmation du parent uniquement après réponse API ; réussite de mission conservée |
| Ressource de mission | Codes de référentiel, « Preuve attendue » | Codes omis pour Élève ; « À réaliser » ; cours intégral conservé |
| Exports élèves | ID de séance en titre d’évaluation, IDs de tâche, statut technique | Titres pédagogiques et états lisibles ; archives techniques JSON inchangées |
| Espace professeur | Planification, durées, sources, versions, critères, contrôles | Conserver |

## Organisation

`public/student-copy.js` centralise la microcopie partagée, les messages d’erreur élèves et la présentation des retours automatiques connus. Il ne transforme pas les valeurs métier. Les retours libres du professeur et le code de l’élève restent intacts.

La sélection des champs se fait dans le renderer, sans masquage CSS. La palette, les polices, les assets et les composants restent ceux du dépôt. Les blocs sans texte utile ne produisent plus de conteneur vide. L’aperçu et la séance publiée partagent les mêmes fonctions de présentation ; le mode aperçu désactive les actions qui envoient du travail.

Les contrats, identifiants, durées et barèmes sont inchangés. Les champs de contenu existants acceptent des chaînes vides ; aucun système de traduction ni dépendance supplémentaire n’a été introduit. Les anciennes transitions de groupes reconnaissables sont omises à l’affichage, sans modifier les séances enregistrées. Les nouveaux brouillons et adaptations placent ces métadonnées dans le guide professeur.

La vérification de génération cible les titres et l’introduction de séance, avec des expressions spécifiques à la plateforme. Elle ne filtre pas globalement les notions, exemples, instructions ou programmes. Les consignes du modèle demandent également des transitions utiles, sans slogans ou métadonnées. Un test simule le fournisseur sans accès réseau.

## Vérification et captures

Les nouveaux tests utilisent des données synthétiques et un fournisseur simulé. Les tests API existants conservent leurs fixtures locales. Aucun service payant n’est appelé et aucune publication Drive n’est effectuée.

- Tests unitaires/API : génération simulée, métadonnées professeur, adaptation, parité aperçu/publié, notes et niveaux, absence de copie, erreurs, exports et intégrité des archives.
- Tests Playwright à 1440 × 1050 et 390 × 844 : connexion, clavier, changement de rôle, état vide, sauvegarde, échecs d’envoi, rendu confirmé, verrouillage, résultat, code, schémas, laboratoire, jeu et ressources. Absence de débordement horizontal vérifiée.
- Captures avant/après : connexion, accueil et sept étapes de séance, dans `test-results/student-wording/`. Les états vide, reçu, résultat et ressource du jeu disposent de captures après modification.
- Références visuelles actualisées dans `tests/visual/baselines/darwin/` ; rapport Playwright dans `test-results/lesson-report/`.
- Examen visuel réalisé sur les captures de connexion bureau/mobile, accueil bureau/mobile et résultat mobile. Les autres captures sont produites et comparées par Playwright.

| Écran | Avant | Après |
| --- | --- | --- |
| Connexion bureau | [Avant](../test-results/student-wording/before-desktop-login.png) | [Après](../test-results/student-wording/after-desktop-login.png) |
| Connexion mobile | [Avant](../test-results/student-wording/before-mobile-login.png) | [Après](../test-results/student-wording/after-mobile-login.png) |
| Aujourd’hui bureau | [Avant](../test-results/student-wording/before-desktop-today.png) | [Après](../test-results/student-wording/after-desktop-today.png) |
| Aujourd’hui mobile | [Avant](../test-results/student-wording/before-mobile-today.png) | [Après](../test-results/student-wording/after-mobile-today.png) |
| Résultat mobile | — | [Après](../test-results/student-wording/after-mobile-result.png) |

Résultats : 86 tests unitaires/API et 128 tests historiques réussis. La suite visuelle complète de 26 cas a passé sans mise à jour des références, puis les 12 cas ciblés (dont deux nouveaux cas bureau/mobile sur une sauvegarde lente) ont passé après le dernier ajustement : 28 cas navigateur distincts vérifiés. `npm run check` passe. Le parcours complet `npm run test:browser` passe également : connexion professeur, préparation, aperçu, publication en mémoire, connexion élève, sauvegarde/rendu, jeu, correction professeur et affichage mobile. Les identités de ses captures sont synthétiques ; le fournisseur payant est désactivé.

L’état de sauvegarde distingue aussi les réponses envoyées des modifications saisies pendant une requête lente. Une confirmation d’activité ne confirme pas par erreur une évaluation ouverte entre-temps.

Commandes : `npm test`, `npm run check`, `npm run test:visual`, `npm run test:legacy`, `npm run test:browser`. Le script des captures comparables est `test-results/student-wording/capture.mjs` (`before` ou `after`).

Limites : pas de vérification sur un site déployé, sur un appareil physique ou avec un fournisseur réel. Les documents PDF sont générés et contrôlés par les tests de corpus, sans inspection visuelle de chaque PDF. Les fichiers déjà distribués et les corpus précédemment compilés n’ont pas été réécrits. Le parcours complet autonome des cinq mondes n’est pas accessible via l’intégration actuelle et n’a pas été joué ; la mission intégrée, ses tests et sa ressource ont été vérifiés. Les règles d’accès et de progression restent couvertes par les tests existants.
