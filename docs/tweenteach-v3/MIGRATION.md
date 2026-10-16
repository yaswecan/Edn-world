# Migration et retour arrière

## Schéma additif

Trois tables : `occurrence_participations`, `result_questions`, `learning_alerts`, au format d’agrégat existant. `server/store.mjs` et `database/schema.sql` exécutent des `CREATE TABLE/INDEX IF NOT EXISTS` compatibles SQLite/PostgreSQL. Les nouveaux champs JSON sont optionnels pour les anciens enregistrements.

Aucune reprise automatique de date réelle, de présence ou de maîtrise. Les anciennes occurrences sans réalisé sont signalées comme contexte à documenter. Aucune suppression ni réécriture de copie ou de résultat.

## Vérifications isolées exécutées

`tests/tracking-v3.test.mjs` crée un fichier SQLite temporaire, retire uniquement les tables V3 vides de sa fixture, vérifie que la simulation laisse les octets inchangés, applique le schéma, le réapplique et contrôle les volumes historiques. La sauvegarde est restaurée dans un autre fichier, puis relue par le store. Les suites de migration existantes exercent aussi la portabilité avec PGlite, sans connexion à une base externe.

## Commandes de test

Ne pas utiliser le chemin de la base scolaire pour ces commandes.

```sh
node scripts/migrate-tracking-v3.mjs --db /chemin/base-test.sqlite
node scripts/migrate-tracking-v3.mjs --db /chemin/base-test.sqlite --apply --isolated-test --backup /chemin/avant-v3.sqlite
npm run test:tracking:v3
node --import tsx --test tests/database-migration.test.mjs tests/database-upload.test.mjs
```

La simulation ouvre SQLite en lecture seule. L’application explicite exige le marqueur de base isolée et un nouveau fichier de sauvegarde ; elle fait un checkpoint WAL avant copie. Elle ne charge pas `.env.local` ni `DATABASE_URL`. Effectuer une copie opérationnelle hors écritures concurrentes ; l’étiquette `--isolated-test` ne prouve pas à elle seule la nature d’une base.

Les sauvegardes navigateur anciennes sans les nouvelles tables sont acceptées après vérification de leur empreinte d’origine, avant ajout de tables vides. Les sessions ne sont pas transportées.

## Mise en service et rollback

Aucune migration de production exécutée. Pour une future mise en service autorisée : sauvegarder base **et artefacts**, préparer une prévisualisation, examiner le rapport, vérifier les accès et appliquer le schéma additif avec le mécanisme existant. Le processus serveur ne doit pas être lancé accidentellement avec les variables de production pendant la recette.

Le rollback applicatif conserve les tables/champs nouveaux. Ne pas supprimer ces tables pour revenir à une ancienne interface : elles peuvent déjà contenir des demandes, constats et décisions d’alerte. Restaurer une sauvegarde antérieure sur la base courante ferait perdre les travaux ultérieurs ; privilégier une correction en avant ou une restauration isolée suivie d’une réconciliation contrôlée.

La restauration locale et les contrats SQL sont testés. La restauration chez l’hébergeur, ses permissions, sa sauvegarde des objets S3 et ses URL signées ne sont pas vérifiées dans cette mission.
