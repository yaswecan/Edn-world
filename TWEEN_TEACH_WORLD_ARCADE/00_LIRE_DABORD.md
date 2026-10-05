# TWEEN TEACH / WORLD ARCADE
## Dossier d’intégration pour VS Code + Codex

**Livraison : 5 octobre 2026 · Version du dossier : 1.0.0**

Ce dossier réunit le front déjà livré, ses images, le corpus de conception, les spécifications,
les contrats de raccordement, le prompt de réalisation et une recette. Il est destiné à être
lu par Codex **dans le dépôt Tween Teach existant**. Ce n’est ni un nouveau projet à substituer
à Tween Teach, ni un import de séances pédagogiques, ni une mise en production déjà réalisée.

## Démarrer dans ton projet

1. Décompresse l’archive. Place le dossier **`TWEEN_TEACH_WORLD_ARCADE`** à la racine du dépôt
   ouvert dans VS Code, à côté des dossiers de ton application — **pas dans `public/`**.
2. Ouvre Codex dans ce dépôt et colle le contenu de `DEMARRER_DANS_CODEX.txt`, ou directement
   le prompt complet `01_PROMPT_CODEX_INTEGRATION.md`.
3. Codex doit examiner le code existant, réaliser l’intégration puis documenter les tests et
   les points encore bloqués. Les routes réelles et l’authentification seront résolues dans ton dépôt.

```text
TON_DEPOT_TWEEN_TEACH/
├── … fichiers existants inchangés au départ …
└── TWEEN_TEACH_WORLD_ARCADE/
    ├── 00_LIRE_DABORD.md
    ├── DEMARRER_DANS_CODEX.txt
    ├── 01_PROMPT_CODEX_INTEGRATION.md
    ├── 02_SPECIFICATION_COMPLETE.md
    ├── 03_PLAN_IMPLEMENTATION_ET_RECETTE.md
    ├── 04_AUDIT_FRONT_FOURNI.md
    ├── 05_SOURCES_ET_PROVENANCE.md
    ├── 06_PROMPT_CODEX_REVIEW.md
    ├── AGENTS.md
    ├── CORPUS/
    ├── CONTRATS/
    ├── FRONT_REFERENCE/
    ├── REFERENCES/
    ├── OUTILS/
    ├── RAPPORTS/
    └── SUIVI/
```

**Le `AGENTS.md` fourni reste à l’intérieur de ce dossier.** Ne remplace pas celui de la racine
de ton dépôt. Le prompt demande sa lecture explicite ; sa présence dans un sous-dossier ne
signifie pas que ses instructions seront automatiquement appliquées aux fichiers voisins.
Voir la source officielle S1 dans `05_SOURCES_ET_PROVENANCE.md`.

## Ce que Codex doit produire

Une entrée **World Arcade → Commencer → choix de Code Station ou Cyber Funk 3026**, dans la
DA cyberpunk du front fourni ; une galerie de joueurs autorisés ; un Top 5 réel ; le grade
réel de chacun ; les profils et réglages ; le raccordement aux comptes et sauvegardes existants.
L’inscription des joueurs externes doit être implémentée sans leur ouvrir l’espace scolaire.
Son ouverture publique attend la vérification des garde-fous et des services nécessaires.

Le front original est une **référence visuelle et interactive**. Ses formulaires locaux, ses
18 joueurs fictifs, ses récompenses de démo et ses deux mini-jeux ne sont pas des services de production.
Ils restent consultables dans `FRONT_REFERENCE/`, mais ne doivent pas alimenter la base réelle.

## Où regarder

| Besoin | Fichier ou dossier |
|---|---|
| Donner la tâche complète à Codex | `01_PROMPT_CODEX_INTEGRATION.md` |
| Comprendre les écrans et règles métier | `02_SPECIFICATION_COMPLETE.md` |
| Avancer par lots et tester | `03_PLAN_IMPLEMENTATION_ET_RECETTE.md` |
| Savoir exactement ce qui doit être remplacé | `04_AUDIT_FRONT_FOURNI.md` |
| Lire les couleurs, textes et catalogues en JSON | `CORPUS/world-arcade.corpus.json` |
| Adapter les services du dépôt sans en inventer les routes | `CONTRATS/` |
| Ouvrir le rendu sans installation | `FRONT_REFERENCE/WORLD_ARCADE_AUTONOME.html` |
| Consulter les captures exécutées du prototype | `FRONT_REFERENCE/World_Arcade_Frontend/previews/` |
| Faire contrôler le résultat par une autre passe Codex | `06_PROMPT_CODEX_REVIEW.md` |
| Vérifier l’intégrité et lire les contrôles de ce dossier | `OUTILS/` et `RAPPORTS/` |

## Les décisions déjà fixées

Deux jeux dans le lanceur. Le bouton Commencer ouvre le choix des jeux, pas un formulaire obligatoire.
L’élève connecté conserve sa session. Le classement montre **cinq personnes maximum** ; la galerie,
elle, peut montrer tous les joueurs du périmètre autorisé. Le grade n’est pas une note scolaire.
Les comptes externes sont distincts des affiliations scolaires, pas un deuxième système d’identité.
La DA arcade ne remplace pas celle des cours ni des espaces professeur.

## Les éléments à résoudre dans le dépôt

L’emplacement des deux moteurs, les routes et l’authentification réelles, les permissions existantes,
le catalogue métier des grades, les validations de missions, les règles de points et la politique
applicable aux comptes publics. Le dossier contient des solutions de repli sûres : état indisponible,
pas de classement non fiable et ouverture publique désactivée tant que ses conditions manquent.
Cela ne doit pas empêcher Codex de réaliser les parties indépendantes.

## Vérifications du dossier

Depuis la racine du dépôt :

```sh
python3 TWEEN_TEACH_WORLD_ARCADE/OUTILS/verifier_pack.py
node --test TWEEN_TEACH_WORLD_ARCADE/OUTILS/launcher-bridge.test.mjs
```

Sur Windows, `py` peut remplacer `python3` selon l’installation. Pour relancer le prototype sans modifier les références, utiliser `OUTILS/retester_front.py` ;
son exécution demande Playwright et Chromium. Le rapport
`RAPPORTS/VALIDATION_LIVRAISON.md` distingue les vérifications exécutées ici de celles qui doivent
encore être faites dans Tween Teach.

**Aucune connexion à ton dépôt VS Code ou à ta base réelle n’a été effectuée pour constituer
ce dossier. Aucun compte, score, mot de passe ou accès existant n’a été modifié.**
