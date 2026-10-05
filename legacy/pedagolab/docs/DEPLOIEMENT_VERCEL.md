# Déploiement Vercel + Neon

1. Pousser le projet sur GitHub.
2. Importer le dépôt dans Vercel.
3. Connecter un projet Neon gratuit au projet Vercel.
4. Vérifier que `DATABASE_URL` existe en Production.
5. Ajouter `SESSION_SECRET` dans Settings > Environment Variables.
6. Redeploy.
7. Vérifier `/api/status`.

Réponse attendue :

```json
{
  "pedagoLabServer": true,
  "version": "7.0",
  "storage": "postgres"
}
```

Le schéma PostgreSQL est créé automatiquement par l'API au premier appel. Le fichier `db/schema.sql` est fourni pour audit ou création manuelle.
