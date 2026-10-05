# Contrôles exécutés sur cette livraison

**Date : 5 octobre 2026. Périmètre : pack, prototype fourni et pont d’intégration indicatif.**
Le dépôt Tween Teach, ses utilisateurs et son backend n’ont pas été accessibles ni testés ici.

## Résultats

| Contrôle | Résultat réel | Preuve |
|---|---|---|
| Copie fidèle du front d’origine | 40 fichiers référencés par empreinte SHA-256 | `CORPUS/reference-source.manifest.json`, contrôle du pack |
| Images du corpus | 18 WebP, dont 15 portraits ; chemins et empreintes contrôlés | `CORPUS/assets.manifest.json` |
| Corpus JSON | Structure et invariants contrôlés ; validation Draft 2020-12 exécutée avec jsonschema | `pack-validation.json` |
| Pont de lancement | **23 tests réussis, 0 échec** | `launcher-bridge.tap` |
| Types de contrat | TypeScript strict, sans émission : code de retour 0 | `syntaxe-et-types.json` |
| Syntaxe JavaScript/Python | Contrôles statiques réussis | `syntaxe-et-types.json` |
| Prototype autonome | **42 vérifications réussies**, relancées sur une copie temporaire via le wrapper | `retest_front_reference.json` et `.log` |
| Capture de contrôle | Salle rendue par Chromium lors du nouveau test | `retest_arcade_desktop.png` |
| Polices binaires et dossiers de dépendances | Aucun fichier de police ni node_modules/.git embarqué | `pack-validation.json` |

Les 44 scénarios de `SUIVI/RECETTE.json` concernent **l’intégration future dans le dépôt hôte**.
Ils sont volontairement marqués `not_run` à la livraison. Ce nombre n’est pas un nombre de tests
Tween Teach déjà réussis.

## Ce que les 23 tests du pont prouvent

Annulation synchrone avant attente, rejet d’un jeu inconnu, un lancement à la fois, traitement séparé
de la connexion et de la vérification e-mail, refus d’un moteur indisponible/verrouillé, absence de
navigation sur erreur, destinations contrôlées par origine et liste blanche, annulation au démontage,
reprise après échec et refus de réponses mal formées. Les services sont simulés dans ces tests.
Le pont ne fournit pas d’authentification, d’autorisation serveur ou de validation de récompense.

## Limites des 42 vérifications du front

Chromium, viewports 1440×1050 et 390×844. HTML autonome injecté dans about:blank, requêtes externes
bloquées et stockage local remplacé par un adaptateur mémoire pour tester la sérialisation.
Les interactions et l’absence de débordement sont vérifiées dans ce banc. Le rapport du test est
reproduit sans le rebaptiser test d’intégration réseau.

Non vérifiés : authentification réelle, accès API, fournisseur e-mail, sauvegardes du vrai moteur,
anti-triche serveur, déduplication en base, persistance native file://, Safari sur appareil physique,
conformité complète d’accessibilité, conformité juridique et mise en production.

## Rejouer et poursuivre

Les commandes sont dans `OUTILS/README.md`. `OUTILS/verifier_pack.py` peut écrire un rapport avec
`--report`; les rapports de contrôle générés sont exclus de l’empreinte de livraison pour éviter
une auto-référence. Le manifeste ne constitue pas une signature d’authenticité.

Codex doit réaliser et vérifier la vraie intégration dans VS Code, remplir `SUIVI/` et conserver
les preuves propres à ce dépôt. Aucun résultat du pack ne doit être utilisé pour cocher à l’avance
une permission, un parcours public ou un contrôle de données qui n’a pas été testé.
