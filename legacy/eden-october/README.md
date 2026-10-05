# EDEN Hub · 1er octobre 2026 · version 6

Application élève et professeur, prête à configurer pour **Vercel + la base Neon existante**.
Point d’entrée élève : `/`. Espace professeur : `/prof.html`.

## Ce qui change

Le diagnostic de **20 minutes** devient entièrement pratique : **annoncerDepart (3 min), saluer (4 min), doubler (5 min), additionner et réutiliser son retour (6 min), remise (2 min)**. Aucun QCM dans ce diagnostic, aucun projet à créer. Chaque défi possède un éditeur avec coloration et numéros de ligne, une console, un aperçu pédagogique des valeurs, des tests « attendu / obtenu » et, à partir du deuxième défi, un appel personnalisable.

Le premier code exécuté reste conservé. Les essais suivants montrent la progression ; les indices sont facultatifs, comptés sans retrait automatique de points. « Je bloque : garder mon essai et passer » permet de remettre une copie incomplète **sans valider la compétence**. Les 20 minutes incluent toutes les reprises : on n’impose pas d’achever tous les défis avant le cours.

Le cours de logique conserve ses six missions. Trois exercices gradués réutilisent ensuite les fonctions : seuil, ET, règle avec exception. Le défi facultatif `accesParc` teste 24 situations. Le planning proposé reste de **175 minutes, pause de 15 minutes comprise**. Le début du jeudi se règle côté professeur ; le mardi n’est pas repris.

**Sauvegardes serveur, copies datées, remise diagnostique figée, pré-correction, relecture et export Excel par élève** sont ajoutés. La présentation (26 diapositives), la trame, les fiches et le mémo sont accessibles depuis `/prof.html`.

## Déploiement sur Vercel

1. Dézipper côté professeur et pousser **le contenu de ce dossier** dans le dépôt GitHub. Ne pas créer un deuxième niveau de racine par erreur.
2. Importer / redéployer dans Vercel : **Other**, racine du dépôt, Node **22.x**, installation `npm ci`, build `npm run build`, sortie **`docs`**. `vercel.json` contient ces réglages.
3. Renseigner les variables de `.env.example`. Réutiliser **la même `DATABASE_URL` Neon complète**. Ne jamais la mettre dans `docs/config.js`.
4. Vérifier `/api/health` : `{ "ok": true, "backend": "neon", "schema": 2 }`. L’API applique une migration additive idempotente. Aucun `DROP`, aucune remise à zéro des dossiers existants.
5. Ouvrir `/prof.html`, se connecter avec `TEACHER_PASSWORD`, créer un profil élève fictif avec `CLASS_CODE`, remettre un diagnostic et télécharger le ZIP de ce dossier.

Voir **DEPLOIEMENT_VERCEL.md** pour les détails et la recette indispensable sur le compte réel.

## Même base, pas de collision de données

Le schéma de cette séance reste **`eden_logic_261001`**. Les nouvelles tables sont `assessment_sessions`, `submissions` et `grade_history`. Les tables du précédent hub BIOS et celles des autres applications sont laissées intactes. Cela partage la base physique, **pas les identités ni les comptes de l’autre hub**.

Si ce dépôt remplace la version précédente du 1er octobre, conserver `CLASS_ID`, `CLASS_CODE` et `TEACHER_PASSWORD` pour retrouver la même classe et ses sessions encore valides. `production` et `preview` restent séparés dans la portée de classe. Le stockage conserve sa clé locale et migre son contenu en schéma 3. Les JSON V5 sont relus avec leurs anciens identifiants. Une copie déjà remise garde son barème d’origine ; le professeur peut ouvrir une nouvelle tentative, sans supprimer la précédente.

## Comment l’élève remet son travail

L’élève entre un prénom/code et le code de classe. Chaque connexion neuve crée un **dossier distinct** : deux prénoms identiques ne donnent pas accès au même travail. Pour reprendre sur un autre appareil, il utilise sa **clé privée de reprise**, accessible dans Mon espace, pas seulement son prénom.

- Les modifications sont conservées localement puis transmises automatiquement. Le bandeau distingue « en attente » de « sauvegardé sur le serveur ».
- **Sauvegarder au professeur** crée une copie datée supplémentaire. Le reçu comporte un identifiant.
- **Remettre mon diagnostic** fige les réponses du diagnostic. Les travaux de cours restent modifiables. Une nouvelle sauvegarde du cours ne remplace jamais cette copie figée.
- En cas d’échec réseau, le travail local reste présent. Une remise n’est acquise que si le reçu est affiché. Exporter un JSON/HTML de secours avant de quitter.

Les jetons élèves expirent après 7 jours. La clé est un accès privé au dossier : ne pas la publier, ne pas partager un même profil entre élèves. Le mot de passe professeur reste côté serveur. La conservation par défaut est de 30 jours, configurable ; exporter les dossiers avant leur purge.

## Correction et export professeur

Dans `/prof.html`, ouvrir un dossier → lire l’original → vérifier les 20 indicateurs → ajuster les points et commentaires → choisir le statut → **Enregistrer la correction**. Une modification de point impose un commentaire. Les modifications sont versionnées ; une relecture concurrente ne peut pas écraser silencieusement une autre.

L’automatisation est une **pré-correction**, pas une certification d’autonomie. Une copie non remise a le statut **NE sans note**, pas 0/20. Un code non pris en charge par le mini-interpréteur donne des items à relire, sans zéro automatique. L’enseignant peut attribuer les points après lecture.

Boutons : **Rendu + correction + Excel** (un élève) et **Télécharger les dossiers élèves** (la classe). Le ZIP contient pour chaque profil :

```
PRENOM_identifiant/
  rendu/ensemble_des_reponses.json
  rendu/bilan.html
  rendu/code/*.js
  evaluation/rendu_original.json
  evaluation/diag-demarrer.js
  evaluation/diag-saluer.js
  evaluation/diag-doubler.js
  evaluation/diag-retour.js
  evaluation/premiers_essais/*.js
  evaluation/essais_et_tests.json
  evaluation/progression.html
  evaluation/correction.json
  evaluation/correction.html
  evaluation/exemple_corrige/*.js
  feuille_correction.xlsx
  manifest.json
  LIRE.txt
```

Sans remise, les fichiers d’évaluation originale ne sont pas inventés et la feuille reste NE. Le classeur a quatre onglets : **Correction, Barème, Repères, Essais**, des indicateurs observables, des formules, les indications d’aide et un retour individuel. Le premier essai est pré-corrigé séparément ; un essai manquant ne devient pas un zéro inventé. Les horodatages et compteurs sont des déclarations du navigateur, pas une preuve anti-triche. Changer l’Excel téléchargé ne modifie pas la base ; la relecture officielle s’effectue dans le site professeur.

**Le modèle fourni est adapté, pas recopié avec ses anciens critères CSS.** Les niveaux globaux NA/EC/A1/A2, la structure par indicateurs, le traitement de l’aide inconnue et l’absence de verrou par critère sont conservés. Les pondérations et critères décrivent les fonctions. Aucun nom, note ou rendu d’ancien élève du fichier source n’est redistribué. Détails : `enseignant/GRILLE_ET_CORRECTION.md`.

## Développement et tests

```sh
npm ci
npm run build
npm test
# Connexion réelle : copier .env.example en .env.local et renseigner ses valeurs.
npm run dev
```

Le code des élèves passe par un petit interpréteur AST borné (Acorn), **pas `eval`, `Function`, `vm`, shell ou Node exécutant le code élève**. Les fonctions, variables, conditions et opérations étudiées sont prises en charge. Les boucles, objets, DOM et accès réseau ne le sont pas. Les limites du sous-ensemble doivent être expliquées aux élèves ; ce n’est pas tout JavaScript.

Les tests API utilisent une base mémoire de test explicitement injectée, **jamais une persistance mémoire en production**. Voir `RAPPORT_TESTS.md` pour les contrôles effectués et les limites : aucune connexion à la vraie base de classe n’a été effectuée dans l’environnement de fabrication.

## Dossiers

`docs/` : fichiers publics, cours, schémas, app élève/prof, PDF et PowerPoint. `api/`, `server/`, `database/` : serveur, grille privée et migration. `enseignant/` : guide, barème détaillé et sources éditables HTML. `tests/` : tests reproductibles, non publiés dans Vercel. Aucun fichier de police distribué.

En mode local de secours, « Continuer sans envoi » permet de poursuivre les activités mais indique **NON transmis**. Le diagnostic reste à remettre. Cette action ne crée aucune correction officielle et n’est jamais présentée comme un reçu serveur.

## Reprendre le dépôt précédent sans effacer les élèves

Remplacer les fichiers du projet, conserver les variables d’environnement et redéployer. Aucun reset ni DROP. Le schéma Neon et la séance `R-261001` restent les mêmes. Les copies anciennes gardent le barème `fonctions-261001-v1` ; les nouvelles utilisent `fonctions-261001-pratique-v2`. Les tables JSONB existantes portent les essais supplémentaires ; aucune nouvelle colonne obligatoire. Voir `MISE_A_JOUR_V6.md`.

L’aperçu est construit par le hub à partir de la console et des variables. Ce n’est **pas** une page HTML arbitraire écrite par l’élève. Les noms de fonctions/variables de réception demandés servent aux contrôles ; les noms des paramètres peuvent varier. Les tests exécutent le sous-ensemble JavaScript annoncé, jamais du code serveur non borné.
