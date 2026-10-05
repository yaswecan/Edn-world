# EDEN — qualité de la séance du jour

## Réalisé

- Audit des deux ZIP disponibles, empreintes et comparaison des sources dans `docs/`.
- Design system explicite : encre/blanc/turquoise, hiérarchie, cartes, tableau, code sombre et ton élève.
- 16 composants nommés dans `public/lesson-renderer.js`, partagés par Aujourd’hui, l’aperçu et la démonstration.
- Parcours fixé côté serveur ; contrat `LessonContentSpec` limité au contenu d’emplacements existants. Types, ordre, diagnostic, timings et tests ne viennent plus du modèle.
- Notions, exemples, questions NEXUS, indices, vérifications, autonomie, transfert et synthèse intégrés. Explications relues pour logique, conditions, boucles et tableaux.
- Séance V6 conservée avec ses questions et tables ; PédagoLab et son runtime préservés.
- Démonstration de 90 min : `/lesson-demo.html`, sans compte ni données élèves.
- Contrôles de publication pédagogiques, 16 snapshots de composants et captures de régression desktop/mobile.

## Vérification

Tous les contrôles passent : `npm run check`, `npm test` (60 tests), `npm run test:legacy` (128 tests), parcours complet `npm run test:browser`, puis `npm run test:visual` sans mise à jour des baselines (8 scénarios, 28 captures comparées). Voir la revue et le rapport dans `test-results/lesson-report/`.

## Reste à valider

- Hub élève **(4)** et corpus BIOS V4 **(2)** absents ; alignement strict avec ces fichiers impossible à certifier. Sources utilisées : hub **(2)** et diagnostic V6 **(2)**. La demande du 5 octobre désigne les hubs Logique et Flexbox comme références graphiques ; leur palette turquoise prévaut désormais.
- Relecture professeur de chaque séance : les contrôles garantissent des minima structurels, pas une certification automatique du fond.
- Les anciens brouillons doivent être régénérés pour recevoir la nouvelle structure. Les versions publiées et les copies existantes restent conservées.
- Aucun déploiement distant ni appel LLM réel effectué. Les baselines macOS doivent être relues si le navigateur ou l’OS change.

## 5 octobre — ateliers et référence Flexbox

- Référence locale 4173 inspectée ; tableaux feutre intégrés avec agrandissement et versions à compléter.
- Générateur : vrais éditeurs pour les ressources HTML/CSS/JavaScript, laboratoire Flexbox, dessin légendé, exercices progressifs, production et débogage. Ordre des compétences du planning respecté.
- Tests d’activité reliés aux contrats serveur et essais conservés ; sauvegarde des dessins et expériences, reprise après rechargement même après remise du diagnostic.
- Corpus enrichis de fichiers de départ utilisables et tableaux SVG. Seuils de variété, code guidé/autonome et schéma notionnel à la publication.
- Contrôles finaux : `npm run check`, 67 tests unitaires/API, 14 scénarios Playwright ordinateur/mobile et parcours navigateur sur serveur réel réussis.
- Brouillon local `A1:R-261005` régénéré en version 2, durée confirmée de 175 minutes, 20 étapes, 8 types d’activité, 64 fichiers de corpus ; contrôles pédagogiques tous valides. La version 1 reste conservée.
- Serveur local 3000 redémarré. Exemple issu du générateur : `/lesson-demo.html?lesson=flexbox`.
- Détails et limites : `docs/workshops-reference.md`.

## 5 octobre — identité EDEN School

- Deux références inspectées dans Chrome : hub Logique & JavaScript en ligne et hub Flexbox local 4173. L’ancien arbitrage indigo/navy est remplacé par leur charte encre/turquoise.
- Logo PNG original copié à l’identique (empreinte SHA-256 vérifiée), partagé entre connexion, espace professeur et séances. Illustrations du hub Flexbox utilisées dans le tableau d’accueil ; soulignement turquoise des titres.
- Palette commune dans `public/brand.css` : encre #162b32, turquoise #62c6c7, fond #f4f7f7, surfaces #eaf7f7. Navigation, boutons, éditeurs, aperçus HTML/CSS et feutres harmonisés. Les traits élèves déjà sauvegardés gardent leur couleur.
- PDF, présentations, tableurs et exports HTML harmonisés ; logo original dans les PDF, présentations et HTML. Les anciens corpus restent conservés.
- Brouillon `A1:R-261005` révisé en version 3 : seuls les styles des cinq supports ont changé, contenu conservé, corpus recompilé, contrôles de publication valides. Serveur 3000 relancé.
- Vérification : syntaxe JS et CSS, 67 tests unitaires/API, 14 scénarios visuels ordinateur/mobile sans mise à jour des baselines, parcours navigateur complet professeur/élève réussis. Captures de l’accueil, des exercices et des espaces professeur relues ; pas de débordement mobile.
- Aperçu public : `http://127.0.0.1:3000/lesson-demo.html?lesson=flexbox`.
