# Causes observées et changements

Audit en lecture seule de la base locale le 5 octobre 2026. Les références anonymisées, empreintes et extraits sont dans [baseline-observed.json](evidence/baseline-observed.json). Les modifications préexistantes du module Arcade ont été conservées.

| Constat | Preuve | Correction |
| --- | --- | --- |
| Les trois derniers runs sont locaux, pas des appels IA | `provider:library`, 32, 90 et 65 ms entre les timestamps stockés ; `OPENAI_API_KEY` et `OPENAI_MODEL` absents | Le parcours approfondi affiche un blocage explicite sans configuration. L’accusé de réception HTTP 202 reste distinct d’une séance prête. |
| L’appel historique est unique et ne reçoit aucun effort de raisonnement ni plafond de sortie | `server/generator.mjs:enhanceContent`, délai 90 s | Profils par rôle, Responses high/xhigh documentés, 24k tokens par appel, budgets et traces réservés au professeur. |
| Exemples et ateliers exclus de l’enrichissement historique | `server/lesson-structure.mjs:contentSlots` exclut LiveCode, CodeEditor et les ateliers | Le nouveau contrat d’unité inclut les exemples, consignes, starters, tests et corrections. Les composants et privilèges restent applicatifs. |
| Des minima formels ne suffisent pas à juger le raisonnement | `pedagogyChecks` contrôle longueur, formes d’activité et présence de phases | Contrat de profondeur, plan argumenté, revue indépendante localisée et décision calculée dans le code. Les anciens contrôles sont conservés comme non-régression. |
| Le résumé professeur coupe à 600 caractères | `public/app.js:lessonView` avant modification | Texte complet conservé dans le déroulé professeur ; le rendu élève conservait déjà les paragraphes. |
| Le terminal existant est une simulation textuelle explicitement étiquetée | `public/components.js` | Nouveau profil shell-git relié à un vrai PTY dans un service séparé ; aucune validation sans preuve. Le simulateur historique reste distinct pour lire les anciennes séances. |
| Pas d’ingestion générale reliée à la génération | `server/retrieval.mjs` indexe les unités NEXUS, `server/importer.mjs` le classeur | Import versionné multi-format, localisations, visibilité, dossier sélectionné et analyse au stade conception. |
| Débordement d’un exemple JavaScript à 390 px lors de la nouvelle recette | Première exécution de `scripts/quality-browser-check.mjs`, bloc observe | `min-width:0` sur les enfants de la grille d’observation ; nouvelle recette réussie. |

Le parcours historique observé est : brief + plan + compétences → recherche de six ressources → assemblage local (`localContent` ou profil octobre) → validation et mise en temps → `lesson_versions` → corpus → renderer élève. Il n’existe pas de réponse brute fournisseur pour ces trois runs : aucun appel n’a eu lieu. Les explications enregistrées mesurent plusieurs centaines de caractères, ce qui ne prouve ni une troncature ni une qualité suffisante. Les captures et tests confirment la conservation des textes jusqu’à l’écran.

Hypothèses non démontrées : modèle API antérieur trop faible, ancien cache, limite de tokens, panne fournisseur silencieuse. Le code historique retourne `library` si la configuration manque et refuse les réponses OpenAI non complètes ; il ne prouve pas un fallback fournisseur. Aucune comparaison avec un export GPT Pro n’a pu être réalisée. La latence ne permet pas d’identifier un modèle.

La production nouvelle suit des étapes réellement enregistrées : assemblage → analyse/conception → revue du plan → rédaction de chaque unité → tests/rendu → revue indépendante → corrections → nouvelle revue. Une simulation utilise exactement l’orchestrateur mais fournit des réponses de fixture et ne peut jamais rendre une publication admissible. Les preuves réelles et simulées sont séparées dans la recette.
