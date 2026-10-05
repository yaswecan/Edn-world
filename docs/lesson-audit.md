# Audit du renderer élève V1

## Périmètre vérifié

Deux archives inspectées et sources extraites consultées : hub élève (2), diagnostic du 1er octobre V6 (2). Inspection visuelle de `legacy/eden-core/enseignant/apercus/01_montage.png`, lecture des CSS, des étapes, des assets SVG et des consignes. `/mnt/data` absent sur cette machine ; hub (4) et BIOS V4 (2) indisponibles. L’alignement avec ces derniers reste à valider.

## Écarts observables avant intervention

| Référence / attente | V1 constatée | Correction requise |
| --- | --- | --- |
| Titres forts, consigne puis atelier, panneaux distincts | `studentBlock` concatène h1 + p ; mêmes surfaces pour toutes les notions | Renderer pédagogique indépendant, grille et hiérarchie fixes |
| Schémas feutre et exemples contextualisés | Diagramme disponible mais non utilisé par le générateur courant | Schémas intégrés aux notions et exemples |
| Objectifs visibles au départ | Présents surtout dans la fiche professeur ; le hero élève affiche l’objectif brut | ObjectiveCard systématique |
| Indices et vérifications explicites | instruction + textarea + trace ; peu d’étayage | Étapes, indice repliable, critère de réussite |
| Observation puis manipulation puis réinvestissement | blocs concept/demo/pratique entrelacés, bilan générique | Phases ordonnées et contrôlées |
| Éditeur et résultat associés | `LiveCode` place même un exemple narratif en code | Distinguer exemple lisible et source monospace |
| Questions et feedback des ressources NEXUS | `localContent` ignore `questions`, `feedback`, `sequence` | Exploiter ces contenus dans le parcours |
| Modèle limité au contenu | `contentSchema` autorise `blocks.type`, `minutes`, ordre et références | Contrat LLM sans présentation ; fusion des seuls champs autorisés |
| Validation pédagogique | schéma, durée, références et corpus ; pas de minima notionnels | Contrôle des phases, apports, exemples, aide, autonomie, bilan |
| Tests visuels | script Playwright produit des captures, sans comparaison | Vraies assertions de screenshots et baselines versionnées |
| Ton direct des étapes V6 | mélange « votre », vocabulaire de preuves et titres administratifs | Tutoiement et transitions centrées sur la tâche |

## Patrimoine à préserver

Diagnostic calculé sur la dernière réalisation réelle, corrections masquées avant remise, reçus serveur, événements et copies immuables, versions, adaptations et contrôle professeur. Garder les jeux PédagoLab et leurs validateurs. La séance V6 possède de nombreuses questions et tables : les conserver avec leurs identifiants, sans les réduire à une démonstration courte.

## Arbitrage chromatique actualisé le 5 octobre

L’ancien arbitrage indigo/navy est remplacé par la demande explicite d’alignement avec les hubs Logique & JavaScript et Flexbox. Logo original, encre #162b32, turquoise #62c6c7, surfaces #eaf7f7 et fond #f4f7f7 sont appliqués au système partagé. Voir `lesson-design-system.md`. Les baselines restent des références de non-régression internes, pas une preuve d’approbation artistique externe.
