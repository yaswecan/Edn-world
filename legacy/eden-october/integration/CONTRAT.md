# Contrat d’intégration · version 6

Application autonome, mêmes variables Neon que le projet logique précédent. Aucune reconnaissance automatique des comptes d’un autre Eden Hub. Schéma fixe `eden_logic_261001` ; périmètre classe/environnement conservé. Les tables BIOS restent intactes. Migration SQL additive v2 dans `database/schema.sql`.

## Identification
`POST /api/enroll` : alias + code de classe. Jeton aléatoire remis uniquement au navigateur ; son empreinte est stockée au serveur. Le prénom n’est pas une preuve d’identité. La clé privée de reprise doit rester privée. Le professeur utilise un mot de passe distinct, un cookie HTTP-only SameSite Strict (Secure en HTTPS) et des routes protégées.

## Progression et copies
`POST /api/events` : progression autosauvegardée avec Bearer, paquet et ordre, `state` de version 3 pour `R-261001`. Les anciens imports JSON v1/v2 sont acceptés sans effacer leurs réponses ; le nouveau diagnostic repart du premier écran. Le serveur borne les valeurs et recalcule la progression. Un reçu serveur, et non une sauvegarde locale, indique la réception.

`GET /api/assessment` : état du diagnostic, originaux et reçus de cet élève, pas la grille de correction. `POST /api/assessment` : `start`, `save` (copie du travail), `submit` (diagnostic immuable). Une clé de requête rend les relances idempotentes. Même clé / autre contenu : conflit. Aucun `eval` du JavaScript élève : analyse Acorn puis interprétation d’un sous-ensemble borné. Le code non interprétable passe à relire, pas automatiquement à zéro.

## Professeur et évaluations
`GET /api/teacher/assessment` : liste synthétique, détail, historique, export individuel ZIP ou fichiers encodés pour l’assemblage local de l’archive de classe. Tous les accès vérifient le périmètre de classe et l’authentification. `POST` : relecture de 20 points observables, commentaire, statut et réouverture motivée. La révision attendue empêche d’écraser une correction concurrente. Modification d’un point pré-corrigé : justification demandée.

L’original remis n’est pas remplacé par les exercices faits ensuite. Une seconde tentative garde l’original précédent. La note visible est provisoire tant que le professeur n’a pas validé ; un test automatique réussi ne prouve pas l’autonomie. Un diagnostic non remis reste NE sans note. Les corrections pédagogiques publiques ne constituent pas une protection anti-triche.

## Export
Un répertoire par identifiant élève : code, toutes les réponses reçues, original du diagnostic, correction JSON/HTML, exemple corrigé, premiers essais, journal de tests et `feuille_correction.xlsx`. Les formules du classeur sont conservées ; les textes élèves sont des chaînes, pas des formules. Le tableau classe charge les exports séparément puis assemble le ZIP dans le navigateur, afin de ne pas demander une réponse serveur géante.

## Conservation
30 jours par défaut (`RETENTION_DAYS`), purge quotidienne authentifiée. Exporter avant expiration. La suppression locale ne supprime pas la base ; la suppression serveur est explicite. Sur le même navigateur partagé : remettre, puis effacer la session locale. Un import JSON ne réutilise pas le jeton d’un autre élève.

## Limites
Pas de synchronisation vers un autre système scolaire. Pas d’identité forte, d’anti-triche ni de chronométrage certifié. Pas de transfert automatique du travail non reçu en cas de coupure : conserver localement, puis reconnecter et remettre. Aucun accès distant aux fichiers du poste. Le mode projection ne sauvegarde pas et ne pilote pas les élèves.

## Version du diagnostic

Une nouvelle remise prend le barème actif côté serveur (`fonctions-261001-pratique-v2`), pas un choix envoyé par le navigateur. Les copies enregistrées antérieurement gardent `fonctions-261001-v1` et leur ancien modèle Excel. Pas de recalcul silencieux des originaux. Les sources et notes sont stockées dans les JSONB existants ; pas de migration destructive.
