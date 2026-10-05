# 3.0.0 — Vercel + Neon

- Remplacement du serveur permanent / SQLite par dix fonctions Vercel et le driver Neon HTTPS.
- Migration idempotente PostgreSQL, sessions et limiteurs persistants, déduplication transactionnelle.
- Contrôle des corps déjà analysés par Vercel ; rejet des origines et enveloppes invalides.
- Validation professeur liée à la version de la preuve ; conservation et purge quotidienne authentifiée.
- Configuration racine complète, lockfile, guide de déploiement, tests opt-in Neon et smoke.
- Cours, horaires, dessins, six missions et simulateur conservés. Les anciennes données SQLite ne sont pas importées.

## Historique — version précédente, remplacée pour le déploiement

# 2.0.0 — Bonus simulateur PC

- Parcours initial et horaires du mardi conservés. Aucun écran obligatoire ajouté.
- Simulateur après le bilan : 9 pièces, 7 liaisons, BIOS/boot animé, 4 pannes distinctes, preuve et transfert.
- Style EDEN / Inter / trait de feutre, interactions par clic et glisser-déposer, réduction des animations.
- Sauvegarde et exports du cours étendus au bonus ; anciennes sauvegardes acceptées.
- Service Node/SQLite optionnel, authentification professeur, code de classe, envoi explicite, tableau de suivi et validation humaine.
- Pas de raccordement implicite aux comptes Eden Hub existants. Pages seul reste un mode local.
- Tests moteur, synchronisation, API HTTP et composant DOM ; limites du test navigateur HTTP indiquées dans `enseignant/CONTROLES.md`.
