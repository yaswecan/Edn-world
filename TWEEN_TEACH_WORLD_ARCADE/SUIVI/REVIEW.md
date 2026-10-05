# Revue après intégration — 5 octobre 2026

**Verdict global : BLOQUÉ SUR DÉPENDANCE.** Recette réussie pour le périmètre intégré testé (entrée, salle, Code Station, profils, galerie autorisée, réglages). Cette revue suit `06_PROMPT_CODEX_REVIEW.md`, en seconde passe de lecture/tests par le même agent ; elle ne prétend pas être une revue indépendante par un autre développeur.

## Défauts concrets corrigés

| Sévérité | Chemin / point de contrôle | Reproduction et impact | Correction et preuve |
| --- | --- | --- | --- |
| P0 | `server/game.mjs:9`, routes contexte/événements/progression de `server/app.mjs` | Un ancien run vérifiait son propriétaire mais pas la publication courante ni les verrous de mission ; l’URL pouvait reprendre une partie après fermeture. | `authorizeRun` partage les contrôles d’affectation, version, publication, monde et activité autonome. Test « existing runs cannot bypass… », `tests-arcade.log`. |
| P1 | `server/arcade.mjs:57` | L’accès statique par `/%77orld-arcade/index.html` doit rester fermé lorsque le module est désactivé. Un contrôle du seul préfixe non décodé serait contournable. | Le drapeau vérifie le chemin décodé, test explicite URL encodée. |
| P1 | `public/world-arcade/app.js:125` | Ouvrir Connexion, puis Créer un compte et fermer : remplacer l’élément déclencheur par un bouton de dialogue détruit perdait la cible de focus. | La première cible de focus est conservée tant que le dialogue reste ouvert. Recette finale clavier réussie. |
| P1 | `scripts/game-runtime.mjs` | Le générateur historique réintroduisait « Brouillon enregistré » avant confirmation et les métadonnées de ressources retirées dans la microcopie élève. | Les adaptations sont désormais dans le générateur. Tests existants `embedded game…` bureau/mobile, parcours hôte et tests de panne/retry passent. |
| P1 | `server/arcade.mjs:44` | Une sauvegarde d’une autre mission du même monde ne justifie pas le libellé Reprendre pour toute mission. | La présence du brouillon/résultat est résolue par monde et `localId` de mission ; format de sauvegarde inchangé. |

Les deux défauts du harnais navigateur (interception déjà traitée, `goto` identique sans reload) ont été corrigés dans le test, sans assouplir ses assertions. La passe complète finale contient 11 scénarios réussis et aucun `pageerror`.

## Dépendances et décisions non résolues

- **P1, moteur absent — `server/arcade.mjs:7`** : Cyber Funk n’existe pas dans les moteurs hôtes examinés. Livrer le vrai moteur et son contrat de persistance avant raccordement. La borne reste indisponible.
- **P0, ouverture publique — `server/arcade.mjs:105`** : aucun fournisseur externe, vérification e-mail, récupération ou politique publique/mineurs validée. Les endpoints refusent les demandes et le formulaire reste fermé. Ne pas créer d’externe dans `learners` en prétendant avoir un rôle séparé : le mécanisme d’identité hôte doit d’abord être étendu proprement par son fournisseur. Aucun compte externe de production créé.
- **P1, points et Top 5 — `server/arcade.mjs:100`** : pas de métrique approuvée ni validateur arcade serveur. Les XP client du jeu ne sont pas une preuve. Les tests de 3/5/8 scores, ex æquo, bornes temporelles, rang personnel et comptabilité de récompenses restent bloqués. L’état indisponible est testé ; ce n’est pas un classement fonctionnel.
- **P1, grades — `server/arcade.mjs:104`** : aucun catalogue métier. Pas de seuils, promotions ou Rookie attribué arbitrairement. Il faut une décision métier avant toute attribution.

## Limites vérifiées explicitement

- Visiteur, élève A, élève B, professeur A/B et session externe synthétique testés par requêtes directes. Les DTO arcade choisissent leurs champs ; aucune note, identité civile, e-mail, affiliation ou présence exposée dans la galerie.
- Profil privé par défaut ; retrait du partage avec la classe immédiatement appliqué aux lectures `no-store`. La communauté publique n’a jamais été ouverte : retrait de visibilité public non testé.
- Nouvelle iframe : contrôle `source`/origine opaque, transfert de port, contexte minimal (pseudo), aucune donnée sensible dans le handshake `*`. Ancien lanceur hôte conservé ; cette tâche n’est pas un audit exhaustif de son protocole historique.
- Les résultats clients ne changent pas les grades, le Top 5 ou les preuves approuvées. Plusieurs événements restent une seule preuve déclarative pour le run. Cela ne valide pas une future comptabilité de XP inexistante.
- Comparaison des captures entrée/salle/profil/mobile et des écrans hôtes effectuée. Les 28 tests visuels antérieurs passent sans mise à jour de leurs baselines ; aucune refonte des cours ou du professeur.
- Cinq viewports contrôlés et zéro débordement. Le confort au zoom utilise une surface de viewport équivalente ; zoom natif, lecteurs d’écran et appareils physiques restent non vérifiés.
- Pas de Git dans le workspace ; empreintes et inventaire fournis, pas de commit prétendu. Aucun serveur réel ni base réelle démarré pour la validation. PostgreSQL et services distants non vérifiés.

## Résultat de la passe finale

`tests-arcade.log` : 15/15. `navigateur.json` : 11/11 scénarios groupés, captures réelles, zéro erreur navigateur non interceptée. `tests-visuels.log` : 28/28. `parcours-hote.log` : réussi. Les critères de recette bloqués restent marqués tels quels dans `RECETTE.json` ; ni la compilation ni les captures ne les remplacent.
