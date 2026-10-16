# Recette Diagnostics V3.1 — 16 octobre 2026

Recette locale sur comptes et contenus fictifs. Six profils DEMO : deux notes identiques avec difficultés distinctes, absence de rendu, incident, contradiction et prérequis démontrés. La source réalise deux critères ; le troisième reste non enseigné. L'approfondissement est vérifié avec une seconde grille DEMO autorisant explicitement A2.

## Commandes et portée

| Commande exécutée | Résultat | Portée |
| --- | --- | --- |
| `node --import tsx --test --test-concurrency=4 tests/*.test.mjs` | **423/423, zéro échec et zéro ignoré** | Suite unitaire/intégration complète, API locales, SQLite isolé et tests existants PGlite |
| `node --import tsx --test tests/diagnostic-v31.test.mjs tests/lesson-editor.test.mjs tests/pedagogy-api.test.mjs tests/chatgpt-process.test.mjs` | 42/42 au premier contrôle des laboratoires | Contrats V3.1 et non-régression ciblée ; moteur simulé pour les requêtes retardées |
| `node --import tsx scripts/diagnostic-v31-browser-check.mjs` | PASS | Préparation par formulaire, début explicite, pause/reprise, panne réseau, remise, commentaires/publication, poste partagé, 360/768/1440 px |
| `node --import tsx scripts/student-tracking-browser-check.mjs` | PASS | Copies historiques, panne, republication, reprise ciblée, retour réseau retenu et véritable runner avec résultat retardé au changement de compte |
| `node --import tsx scripts/tracking-v3-browser-check.mjs` | PASS | Référentiel, planification, correction/publication, demandes privées, preuves, filtres et trois largeurs |
| `node --import tsx scripts/lesson-editor-labs-check.mjs` | PASS | Moteurs Docker DOM et shell existants, édition, réimport et diagnostic chronométré avec fichiers figés |
| `node scripts/check.mjs` | PASS | Syntaxe, export des schémas stricts, DDL et préservation des primitives Drive |
| `git diff --check` | PASS | Espaces et marqueurs de conflit |

Les premiers lancements de tests HTTP sous sandbox ont reçu `listen EPERM` ; ils ont été relancés avec l'autorisation d'ouvrir les serveurs de test locaux. Un passage intégral concurrent a eu un échec d'attente du processus synthétique `chatgpt-process` (marqueur attendu en cinq secondes) ; le test a ensuite passé dans la suite ciblée. La suite finale limite le nombre de fichiers concurrents à quatre. Aucun délai de production n'a été modifié pour faire passer ce test.

Le premier passage des anciens laboratoires a échoué au contrôle de disponibilité DOM lors de l'import, après réussite des exécutions shell/DOM. Une relance sans modification du contrôle de disponibilité a passé. Les nouvelles vérifications navigateur ont aussi nécessité des corrections de script : attendre le chargement de la page de passation et ouvrir le panneau de fichiers avant de le remplir. Le test de protection du commentaire vérifie dans Chrome l'annulation de l'événement `beforeunload` et sa levée après sauvegarde ; il ne prétend pas tester l'apparence de la boîte de dialogue native. Ces échecs exploratoires ne sont pas comptés comme des validations.

## AD01–AD40

« Vérifié » porte sur le scénario automatisé et son périmètre décrit, pas sur une expérimentation en classe. D = `tests/diagnostic-v31.test.mjs` ; B = `scripts/diagnostic-v31-browser-check.mjs` ; H = suites existantes de suivi, compétences, éditeur, import et stockage ; L = `scripts/lesson-editor-labs-check.mjs`.

| ID | Verdict | Preuve et limites |
| --- | --- | --- |
| AD01 | Vérifié | D : source réellement travaillée avant la cible, date réelle distincte du planning ; source changée après aperçu refusée. B : confirmation via formulaire. |
| AD02 | Vérifié | D : séance partielle, seules deux activités confirmées retenues ; troisième activité exclue. |
| AD03 | Vérifié | D : aucun candidat → source requise ; parcours concurrents → sélection requise ; parcours explicite respecté. Tests domaine : publication V3.1 incomplète refusée malgré dérogation générique. |
| AD04 | Vérifié | D : introduction d'un critère non enseigné rejetée ; grille reliée à la source dans `competency-service`. |
| AD05 | Vérifié | D : non-exposition ne devient pas un déficit ; réussite observée conservée. |
| AD06 | Vérifié | D/B : 2→3 tâches, rôle unique ; double préparation idempotente ; deuxième application identique sans nouvelle version ; export garde le rôle et retire les confirmations locales. H : réimport idempotent. |
| AD07 | Vérifié pour le budget estimé ; calibration réelle non vérifiée | D : somme lecture+tâches+remise égale vingt minutes ; budget incohérent rejeté. [Audit](audit-v31.md) : N mesuré, répartition par gabarit, limites. Aucun chronométrage auprès d'élèves. |
| AD08 | Vérifié | D : exercice ajouté requis, propre production et item de grille ; réponse au dernier exercice possible en premier. L : ateliers DOM/shell réutilisés pendant le diagnostic. |
| AD09 | Vérifié | D : nouvelle version réordonnée et source ultérieurement changée n'altèrent pas la copie commencée ; routes de préparation refusent une version commencée. H : anciennes versions/imports conservés. |
| AD10 | Vérifié | D/B : début explicite, même tentative et échéance en reconnexion/deux démarrages ; extensions avec révision ; pause/reprise ; champs bloqués puis réactivés. |
| AD11 | Vérifié en panne simulée | B : véritables requêtes de sauvegarde interrompues ; pas de remise annoncée hors ligne ; reconnexion fige la réponse serveur, saisie locale conservée. D : récupération séparée autorisée, idempotente, copie initiale identique ; retours de laboratoire tardifs refusés. |
| AD12 | Vérifié | D : double remise renvoie le même identifiant ; autosave tardive refusée ; instantané conservé. Captures de fichiers ordonnées pour éviter un remplacement par une réponse plus ancienne. |
| AD13 | Vérifié | D/B : texte et code, contenu exact relu après autosauvegarde ; commentaire adjacent après publication. |
| AD14 | Vérifié | D : sous-réponse, item vide et fichier de laboratoire ont chacun une identité stable. B : vue par question. |
| AD15 | Vérifié | D : ancrages indépendants de l'ordre, tentative et version incluses ; H : retrait/édition dans une nouvelle version sans modifier les copies historiques. |
| AD16 | Vérifié | D : révision périmée rejetée, ancrage d'une autre copie refusé. B : autosauvegarde confirmée ; formulaire conservé en erreur, avertissement de navigation pour modifications non validées. |
| AD17 | Vérifié | D/B/H : notes privées absentes du résultat élève, payload sûr, exports de contenu sans copies ni confirmations locales. |
| AD18 | Vérifié | D/B : clôture, appréciation et finalisation exigées ; publication cohérente de note/niveau/commentaires. Exemple navigateur : 15/20, EC selon la grille DEMO. |
| AD19 | Vérifié | D/B : nouvelle correction privée invisible, ancienne révision publiée inchangée. |
| AD20 | Vérifié | D : publication groupée avec un succès et un conflit ; comptes et détails exacts, aucun mélange de révisions. |
| AD21 | Vérifié | D/B : absence, incident, correction partielle, vide explicite, non abordé et échéance distincts ; dénominateur préservé, aucun zéro par défaut. |
| AD22 | Vérifié | D/B : note 15/20 avec critère essentiel insuffisant → EC ; critères réussis et fragiles restent distincts. |
| AD23 | Vérifié | D : champs score/niveau client ignorés ; laboratoires sans observation de maîtrise ni note officielle automatique. H : tests fonctionnels et décisions professorales distincts. |
| AD24 | Vérifié | D : A2 numérique refusé si plafond observable A1 ; H : grille historique absente → niveau à déterminer, sans seuil inventé. |
| AD25 | Vérifié | D : mêmes totaux, critères faibles différents, priorités et propositions différentes. |
| AD26 | Vérifié | D : rendu manquant/incident → à observer ; observations comparables contradictoires → à vérifier ; correction non validée distinguée d'une preuve recevable. |
| AD27 | Vérifié | D : déficit établi et autre critère inconnu → soutien ciblé avec inconnue conservée. |
| AD28 | Vérifié | D : approfondissement uniquement avec règle, preuve et maximum observable explicitement configurés ; aucun usage de rapidité. |
| AD29 | Vérifié | D : propositions privées sans reprise créée ; accès élève au moteur refusé ; publication exacte requise pour attribuer. |
| AD30 | Vérifié | D/H : activation répétée idempotente ; correction changée invalide le calcul ; droits et disponibilité recontrôlés dans la transaction. |
| AD31 | Vérifié | D : une ancienne publication ne permet pas d'attribuer sur la base d'une nouvelle révision privée. |
| AD32 | Vérifié | D : besoins multiples conservés, priorité traçable, conflit de capacité explicite ; activité absente sans lien ou attribution fictifs. |
| AD33 | Vérifié | D : reprise réalisée, vérification dans une autre situation, difficulté persistante renvoyée au professeur ; original inchangé et aucune décision automatique de maîtrise. |
| AD34 | Vérifié | B : identité/résumé, source, points et critères, preuves accessibles par lien ; vues par copie et par question. |
| AD35 | Vérifié | B : commentaires publiés auprès des réponses, appréciation/note/niveau, historique et demandes d'explication ; H : reprises accessibles. |
| AD36 | Vérifié | B : « Ce diagnostic » et « Suivi cumulé », couverture en nombre de critères, inconnus neutres ; aucune échelle sportive ou classement de classe ajouté. |
| AD37 | Vérifié | D/H : autre élève ou professeur hors périmètre refusés sur copies, fichiers, exports, agrégats et suggestions. Laboratoire d'un autre utilisateur refusé. |
| AD38 | Vérifié | B et navigateur historique : purge des brouillons, ancienne réponse lue après invalidation rejetée ; retour réseau retenu et résultat réel de runner retardé sans réapparition dans le nouveau compte. |
| AD39 | Vérifié | D/B/H : texte HTML/script affiché comme texte, aucune exécution à la lecture ; imports et contenus ne modifient pas les autorisations. |
| AD40 | Vérifié sur les parcours locaux | B et navigateurs V1/V3 : parcours, liens, clavier, 360/768/1440 px. L : HTML/CSS/JS et shell réels, fichiers exacts après export/import, diagnostic avant remise. H : anciens diagnostics et autres modules. Aucun audit exhaustif d'accessibilité revendiqué. |

## Artefacts et limites

Les captures et rapports reproductibles sont écrits dans `test-results/diagnostic-v31/`, `test-results/student-tracking/`, `test-results/tracking-v3/` et `test-results/lesson-editor/`. Ce dossier est ignoré par Git conformément au dépôt. Les captures de la fiche professeur/élève ont été inspectées ; elles montrent la structure latérale et l'empilement mobile, les commentaires adjacents et le contenu script inerte.

Le rapport ne valide pas : le temps réel des élèves et du professeur, une expérimentation pédagogique, la charge d'une grande classe, un serveur PostgreSQL distant ou les services externes. Les appels de génération des tests utilisent des simulations ; aucun accès payant n'a été nécessaire. Les changements ne sont pas déployés.
