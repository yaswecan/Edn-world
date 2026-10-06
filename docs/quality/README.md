# Préparation approfondie — utilisation et configuration

État du 5 octobre 2026 : parcours intégré et testé avec des données synthétiques. La génération IA réelle, sa qualité et le laboratoire Docker réel restent **NOT RUN** dans cet environnement. Le moteur DOM est implémenté et testé dans Chromium réel via un adaptateur de test local ; son isolation Docker reste à valider. SSH n’est pas proposé. Ces limites ne sont pas masquées par des démonstrations.

## Recette locale

```sh
npm install
npm run preview:quality
```

Ouvrir `http://quality.localhost:4180/`, connexion professeur `professeur` / `quality-preview-only`, puis `/preparation.html`. La base dédiée `.data/quality-preview.sqlite` conserve les préparations entre redémarrages. Aucune variable de `.env.local` n’est chargée. Le nom d’hôte sépare les cookies de l’application habituelle. Ctrl+C arrête l’instance.

Les trois fixtures originales sont dans `tests/fixtures/pedagogy.mjs`. La liste des préparations permet d’ouvrir leur conception, la couverture des objectifs, les sources, les deux rapports de revue simulée et l’aperçu élève. Les fichiers complets et captures sont dans `docs/quality/evidence/{box,logic,shell}`. Le bouton de test fonctionne dans l’aperçu HTML/CSS et JavaScript ; les réponses de l’aperçu ne deviennent pas des copies élèves.

## Parcours professeur

1. Importer un document et choisir son rôle. Un corrigé est toujours privé. L’original, son empreinte, les blocs extraits et leurs localisations restent disponibles au professeur.
2. Vérifier les avertissements. Un PDF scanné ou incomplet ne passe pas pour un document analysé. Un PDF textuel demande une vérification de l’ordre de lecture ; la confirmation précise les vérifications réellement faites. Une page vide exige une transcription complète, pas une simple confirmation.
3. Choisir le créneau et les sources, puis lancer la préparation. La durée doit être confirmée. Le navigateur reçoit un accusé de réception, pas un cours terminé.
4. Retrouver la préparation après rechargement. Les états affichent la conception, la revue du plan, l’unité en rédaction, les contrôles et la revue indépendante. Annuler empêche les résultats suivants d’être installés ; un appel déjà transmis peut rester facturé.
5. Examiner le brouillon, les preuves, les anomalies et les sources. Un état prêt exige la dernière version évaluée, tous les contrôles requis, au moins 90/100 et chaque dimension à 3/4 minimum. Les fixtures ne peuvent jamais satisfaire la publication réelle.
6. La publication reste l’action explicite existante du professeur. Une ancienne publication à la même date est conservée et provoque un conflit plutôt qu’un remplacement silencieux.

Les brouillons issus de ce parcours portent `qualityRequired`. Modifier un texte, un asset, une source ou un runtime invalide sa validation. Une nouvelle préparation crée un brouillon distinct. Les séances publiées et les tentatives historiques restent attachées à leurs identifiants et versions.

## Parcours élève

L’annonce des objectifs précède le diagnostic, première activité pédagogique. Les nouveaux squelettes réservent huit minutes par défaut (`EDEN_DIAGNOSTIC_MINUTES`, 5–20). Les anciens diagnostics restent lisibles. Première réponse enregistrée, dernier essai et remise restent distincts. Un résultat non observable ou un incident n’est pas transformé en maîtrise ou en échec avéré.

Les difficultés identifiées dans les items déclenchent des rappels dans les blocs concernés, avec le même objectif commun. Les réponses ouvertes non relues restent non évaluées. Le bouton « Synthèse du diagnostic » dans la préparation affiche chaque élève, son observation et la suite proposée, y compris les diagnostics non commencés. L’endpoint professeur est `/api/preparation/diagnostic/:lessonId`.

Les ateliers HTML/CSS conservent l’aperçu isolé et les largeurs configurables. JavaScript utilise l’interpréteur borné EDEN, ses sorties et ses tests ; ce n’est pas un moteur JavaScript universel. Le profil DOM fournit trois fichiers, un rendu Chromium cliquable, saisie de texte, console et tests d’interactions. Ce rendu distant rejoue au maximum 40 actions à chaque demande ; ce n’est pas une vidéo temps réel. Les fichiers sont sauvegardés avant l’exécution et la réinitialisation conserve un instantané. L’arrêt ferme l’aperçu ; le calcul distant est borné à 15 secondes. Shell et DOM passent uniquement par le service séparé décrit dans `labs/README.md`. Une panne renvoie un incident technique. Les rapports, paramètres IA et corrigés privés ne figurent pas dans `/api/today`.

## IA et worker

Configurer `OPENAI_API_KEY` et un modèle explicitement disponible sur le compte : `EDEN_AI_MODEL` ou `OPENAI_MODEL`. Les profils vérifiés sont centralisés dans `server/pedagogy/provider.mjs` : `gpt-4.1` sans raisonnement, `gpt-5.4` et `gpt-6.1-sol` avec les efforts documentés. Le modèle n’est pas sélectionné automatiquement en fonction d’un abonnement. Aucun profil n’a été retenu comme meilleur sur la base d’un essai réel dans cette livraison.

Les rôles design/write/review/repair peuvent être configurés séparément avec `EDEN_AI_<ROLE>_MODEL` et `_EFFORT`. La revue de plan utilise le rôle review. Les profils high/xhigh envoient réellement `reasoning.effort` à Responses. Le budget de 24 000 tokens par appel couvre sortie visible **et** raisonnement. `store:false`, `service_tier:default`, schéma strict, statut final obligatoire, refus des réponses tronquées ou vides, aucun retry automatique fournisseur.

Plafonds par défaut : 24 appels, 1,50 USD réservés par appel, 6 USD réservés par séance, 30 minutes, 180 secondes par appel, un brouillon + trois réécritures. Une réservation conservatrice utilise un token par octet UTF-8, le schéma et le prompt, 20 000 tokens réservés par image jointe, le budget complet de sortie et une marge tarifaire de 40 %. La revue reçoit deux captures mobiles représentatives lorsqu’elles sont disponibles ; elle ne doit pas prétendre avoir inspecté les autres vues. La réservation n’est pas remboursée pour permettre un appel supplémentaire. Les tokens du fournisseur et l’estimation au tarif standard sont enregistrés séparément ; ils ne constituent pas une facture. Un dossier trop grand est refusé, jamais tronqué silencieusement.

`npm run dev` démarre le worker persistant, une étape à la fois. Les appels réussis sont enregistrés avec une clé d’opération et réutilisés après interruption. Si la requête est partie mais que son résultat n’a pas été enregistré, le travail s’arrête en résultat incertain : pas de refacturation aveugle. La source originale et les sorties structurées sont réservées au professeur ; aucun raisonnement interne brut n’est enregistré.

Le plan retenu ordonne effectivement les unités et les blocs au sein des phases historiques. Il ne peut déclarer un acquis « connu » sans preuve structurée ; en l’absence de preuve, il prépare un rappel et un diagnostic. La structure générale de phases demeure compatible avec les séances historiques.

Le chemin HTTP de publication conserve sa fonction historique. Pour une installation serverless, utiliser un worker Node dédié pour la génération et l’inspection Chrome. Les durées longues ne doivent pas être exécutées dans un onglet. La file existante utilise des transactions SQLite ou PostgreSQL et des baux ; les nouvelles tables sont additives.

Comparer les paramètres sans appeler le fournisseur : `node --import tsx scripts/quality-compare.mjs`. `--live` active les chemins corrigés dans un plafond global explicite. La référence A historique reste un export : son appel non borné est volontairement refusé par ce petit harness. Deux répétitions du même brief permettent de préparer une comparaison ; le rapport présent indique **NOT RUN** partout pour les appels réels. L’ancienne mention « GPT Pro » ne permet pas d’identifier un modèle, un effort ou un produit exact ; aucun export historique identifié ne permet de la reconstituer.

## Import et limites

Formats : Markdown/TXT et code texte ; HTML/URL ; DOCX ; PPTX (texte des diapositives) ; XLSX (lignes, valeurs/formules enregistrées) ; PDF textuel. Limites : 8 Mio à l’entrée, PDF 200 pages et worker 30 secondes/192 Mio, archives Office 32 Mio décompressés. Les documents ne sont jamais exécutés. OCR, lecture sémantique des figures, notes de présentations et reconstruction parfaite des tableaux PDF ne sont pas disponibles.

Les URLs exigent une liste exacte `EDEN_SOURCE_HOSTS`, HTTPS, aucune information d’authentification, adresses publiques vérifiées et épinglées, et validation de chaque redirection. L’import réel de MDN a été vérifié dans `evidence/url-import.json`. Les notions/citations sont analysées au stade conception ; une extraction seule conserve le statut non analysé. Les métadonnées auteur/date inconnues restent nulles. Des versions contradictoires d’une même source ne sont pas fusionnées.

## Retour arrière

`EDEN_QUALITY_PIPELINE=0` rétablit le chemin historique de génération. Le drapeau est activé par défaut en développement et désactivé par défaut en production. Il ne supprime ni versions, ni sources, ni preuves. Garder les nouvelles tables lors d’un retour arrière ; ne pas publier avec un ancien binaire un brouillon marqué `qualityRequired`. Les données historiques ne nécessitent aucune réécriture. Aucun schéma de production n’a été migré pendant cette mission.
