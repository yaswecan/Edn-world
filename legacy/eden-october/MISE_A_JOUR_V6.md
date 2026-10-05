# Mise à jour V6 · même base et mêmes dossiers

1. Sauvegarder le dépôt actuel, puis remplacer son contenu par ce projet. Racine Vercel inchangée, sortie `docs`.
2. Conserver `DATABASE_URL`, `CLASS_ID`, `CLASS_CODE`, `TEACHER_PASSWORD` et `CRON_SECRET`. Ne jamais les copier dans le JavaScript public.
3. `npm ci`, `npm run build`, puis déployer. Aucun changement de dépendance ; Node 22.x conservé.
4. Ouvrir `/api/health`, puis `/prof.html`. Vérifier un ancien dossier : copie, version de correction et exports toujours présents.
5. Créer un profil de test avec un alias fictif. Exécuter un code faux puis corrigé ; remettre les quatre programmes. Depuis l’espace prof, vérifier premier essai, dernier code, reçu et Excel.
6. Pour un élève qui a déjà remis V5 : utiliser « Rouvrir le diagnostic ». Cela crée une nouvelle tentative sans effacer l’ancienne. Ne pas vider la base ni créer une nouvelle classe involontairement.

## Ce qui reste compatible

Schéma PostgreSQL `eden_logic_261001`, tables et identifiants de classe inchangés. Les nouveaux champs sont dans les JSON existants. Sauvegardes locales V1/V2 relues, contenu V3 ; même clé de stockage. Les anciennes copies utilisent leur grille historique. Une réouverture ne vaut pas une nouvelle remise tant qu’aucun reçu n’est affiché.

## Ce qui est nouveau

Quatre programmes à écrire en 18 minutes + 2 minutes de remise. Console, aperçu, vérifications et arguments libres. Premier code exécuté conservé, derniers tests recalculés côté serveur. Un défi « À reprendre » reste un constat d’inachèvement, jamais une réussite.

Les tests fournis peuvent fonctionner sans Neon via un stockage mémoire **de test uniquement**. La validation sur Vercel et votre vraie base reste obligatoire avant la séance. `RAPPORT_TESTS.md` distingue les contrôles locaux de la recette réelle.
