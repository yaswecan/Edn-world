# PROMPT CODEX — REVUE APRÈS INTÉGRATION

Agis comme relecteur de l’intégration World Arcade dans ce dépôt Tween Teach. Lis les instructions
applicables, le diff réel, `02_SPECIFICATION_COMPLETE.md`, `03_PLAN_IMPLEMENTATION_ET_RECETTE.md`,
`04_AUDIT_FRONT_FOURNI.md` et les preuves dans `SUIVI/`. Ne suppose pas qu’un point est résolu parce
que le premier agent l’a écrit. Ne modifie pas la référence visuelle pour faire passer une comparaison.

## Contrôles prioritaires

**P0 — sécurité/données :** aucun compte scolaire exposé au public ; pas de rôle transmis par le
client ; pas de note ou e-mail dans les DTO arcade ; isolation des classes/établissements ; session
existante conservée ; aucun handler d’authentification simulée utilisé en production ; aucun secret
persisté/loggé ; aucune récompense accordée sur simple événement navigateur ; pas de double crédit
concurrent ; absence de migration destructrice non autorisée ; pas de fallback de production vers
les mini-jeux ou les joueurs fictifs. L’inscription publique doit rester fermée tant que ses gates manquent.

**P1 — fonctionnalité :** Commencer ouvre les deux bornes ; les jeux réels sont résolus ; reprise de
sauvegarde exacte ; conditions de déblocage conservées ; galerie paginée dans le bon périmètre ; Top 5
réel de cinq lignes maximum ; pas de barème ou catalogue métier inventé ; erreurs réseau distinctes
des états vides ; liens profonds et retour arrière ; aucune pollution CSS/JS des cours.

**P2 — rendu/accessibilité :** proportions des bornes et des panneaux, navigation et typographie proches
du front, portraits et assets lisibles, textes simples, contraste et focus, pas de débordement mobile,
contrôles tactiles, réduction des animations, arrêt des sons/handlers au départ du module. Les écarts
visuels substantiels sont à corriger, pas à rebaptiser « adaptation premium ».

Compare réellement les captures aux références. Cherche des preuves de test, pas seulement une image.
Teste également les cas refusés via accès direct aux routes et services. Si l’environnement ne permet
pas un test, écris « non exécuté » avec sa raison. N’invente ni résultat de commande ni capture.

## Sortie et boucle de correction

Écris dans `SUIVI/REVIEW.md` un constat par défaut : sévérité, chemin/ligne, scénario reproductible,
impact et correction proposée. Distingue défaut prouvé, risque à vérifier et décision produit manquante.
Fournis un verdict `À CORRIGER`, `BLOQUÉ SUR DÉPENDANCE` ou `RECETTE RÉUSSIE POUR LE PÉRIMÈTRE TESTÉ`.
La dernière formule ne vaut pas homologation juridique ou audit complet de sécurité.

En mode revue, ne change pas le code avant demande de correction, sauf si le prompt de réalisation
qui t’a lancé demande explicitement cette passe de correction. Dans ce cas, corrige les problèmes
concrets puis relance les tests concernés. Après au plus trois passes revue/correction, consigne les
blocages et la suite nécessaire au lieu de boucler indéfiniment ou de masquer les défauts. Une nouvelle
session peut reprendre à partir de ce rapport, sans répéter l’audit déjà documenté et toujours actuel.
