# Contrôles locaux

Ces outils n’ont aucun accès au backend de Tween Teach et ne déploient rien.
Depuis la racine du dépôt contenant le dossier `TWEEN_TEACH_WORLD_ARCADE` :

```sh
python3 TWEEN_TEACH_WORLD_ARCADE/OUTILS/verifier_pack.py
node --test TWEEN_TEACH_WORLD_ARCADE/OUTILS/launcher-bridge.test.mjs
```

Le premier contrôle les chemins, empreintes, assets et invariants du corpus. La bibliothèque
Python `jsonschema`, lorsqu’elle est installée, ajoute la validation complète du schéma ; si elle
manque, ce point est marqué non exécuté. Les contrôles d’intégrité standard restent disponibles.
Le second ne dépend que des modules intégrés à Node.js ; l’exécution de cette livraison a utilisé
Node 22.16.0. Il teste uniquement le petit pont de lancement, avec services simulés.

Pour relancer les 42 vérifications du prototype **sans écraser ses références**, utiliser :

```sh
python3 TWEEN_TEACH_WORLD_ARCADE/OUTILS/retester_front.py
```

Playwright et Chromium doivent déjà être installés. Le paramètre `--chromium` accepte le chemin
vers un Chromium existant. Aucune installation ni requête réseau n’est lancée par le wrapper.
Il copie temporairement le prototype puis dépose le rapport sous `SUIVI/RETEST_FRONT_REFERENCE/`.
Le test d’origine injecte le HTML dans about:blank et simule le stockage ; il ne teste pas une
inscription réelle, la persistance native file:// ni les API de l’application hôte.

Ne pas lancer directement le script historique dans `FRONT_REFERENCE/` pour une nouvelle recette :
il écrirait ses résultats et captures dans les références. Utiliser le wrapper ci-dessus.
Le dossier `SUIVI/` est exclu des empreintes de livraison, car Codex doit y écrire ses observations.
