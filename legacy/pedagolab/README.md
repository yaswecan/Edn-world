# PédagoLab Worlds V7.1 — Curriculum A1

PédagoLab regroupe :
- bibliothèque NEXUS (140 unités) ;
- cinq mondes jouables ;
- comptes élèves / professeur ;
- progression Neon / PostgreSQL ;
- planification annuelle A1 2026–2027 ;
- cartographie de compétences et remédiation.

## Dashboard professeur

Le tableau de bord propose cinq vues :
1. **Vue classe** — trajectoire et couverture des preuves ;
2. **Élève** — progression détaillée, mondes, accès professeur et ajout de preuves ;
3. **Cartographie skills** — compétences N2 × élèves ;
4. **Remédiation** — groupes temporaires suggérés par critère ;
5. **Calendrier** — évaluations et séances à venir.

La classification ne confond pas absence de preuve et retard. Voir `docs/DASHBOARD_ANNUEL.md`.

## Données du plan de formation

Le fichier source est conservé dans :

`curriculum/source/Planification_A1_2026-2027.xlsx`

La version utilisée par le frontend est :

`public/data/curriculum-a1.json`

Elle contient 48 N2, 106 N3, 142 séances et 63 évaluations.

## Déploiement Vercel

Variables obligatoires :

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=...
```

Puis déployer le repo sur Vercel. Les contenus statiques sont servis depuis `/public` et le backend FastAPI depuis `server.py`.

## Tests

```bash
python3 tests/check_project.py
```

Le test vérifie la syntaxe Python/JS et la cohérence des ressources/curriculum.
