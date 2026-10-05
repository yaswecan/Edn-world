# Rapport de contrôle · version 6.0.0

## Contrôles exécutés

- `npm run build` puis `npm run check:deployment` : réussis sous Node 22.16.0. 52 fichiers publics, 31 écrans, 26 diapositives. Liens locaux, syntaxe, diagnostic en premier, quatre programmes en 18 min + remise 2 min, planning total 175 min et configuration Vercel vérifiés.
- `npm test` : **186 tests réussis**, aucun échec. Interpréteur borné, quatre diagnostics pratiques, arguments variables, retours, capture et réutilisation, cas 0, console vs return, premier essai, état incomplet, ancien barème, API de remise/relecture/export, contrôle d’accès et conflits.
- Fixture DOM Chromium + pont HTTP Python vers l’API à stockage mémoire : **92 contrôles réussis**. Tous les écrans, console, aperçu réel des valeurs, modification après erreur, appel personnalisé, indices, remise, reprise simulée, premier/dernier code professeur, validation manuelle, ZIP individuel et groupe, Excel à 19/20 après ajustement de test, viewport 390 px. Aucune erreur JavaScript non traitée dans cette fixture.
- Exemple pédagogique fictif : quatre codes finaux réussis, premier `doubler` sans retour, un indice, progression 2/7 → 7/7. Excel produit par le même export que le professeur : 20/20, A2, **à relire** ; quatre onglets. Valeurs/formules et rendus vérifiés avec artifact_tool, aucune erreur de formule détectée.
- PDF : diagnostic 4 pages, carnet 15 pages, mémo 3 pages, trame 2 pages, fiche récap 2 pages. Contrôle des limites de page, pas de chevauchement avec les pieds de page. Rendus visuels contrôlés. PowerPoint/PDF de 26 diapositives synchronisés avec la présentation web.

## Portée exacte et limites

`npm ci` a été tenté mais le registre npm n’était pas joignable dans l’environnement (EAI_AGAIN). Le build local utilise la copie Acorn déjà fournie dans le projet source, dont l’empreinte SHA-256 est vérifiée. **Cela ne prouve pas une installation npm réussie.** Les versions restent verrouillées dans package-lock.json ; Vercel doit réellement effectuer `npm ci` pour disposer du pilote Neon.

La navigation HTTP native de Chromium a été tentée ; elle est bloquée par la politique de l’environnement (`ERR_BLOCKED_BY_ADMINISTRATOR`). Aucune politique n’a été désactivée. Les vérifications d’interface ont utilisé une fixture DOM sans navigation, sans requête réseau du navigateur, sans stockage/cookie natif : les opérations serveur passent par un pont Python HTTP et une base mémoire de test. La navigation native, le chargement ES modules et les cookies réels restent à vérifier sur un poste autorisé (`npm run test:e2e`).

Aucune connexion à la vraie base Neon ni aucun déploiement Vercel n’a été effectué. Le test opt-in Neon a été adapté aux quatre programmes mais **n’a pas été lancé contre une base**. Suivre la recette dans DEPLOIEMENT_VERCEL.md sur une branche de test avant utilisation en classe.

Les timings sont un budget pédagogique, pas une durée mesurée auprès des élèves. Le diagnostic est formatif : les tests et indices font progresser. Les compteurs et dates des essais sont déclaratifs, pas une preuve d’autonomie ou un dispositif anti-triche. Les points sont recalculés par le serveur et restent à relire par le professeur.

## Reproduction

`tests/RESULTATS_BUILD.txt`, `tests/RESULTATS_NODE.txt` et `tests/RESULTATS_DOM.json` consignent ces contrôles. Le dossier enseignant fournit un exemple fictif de ZIP et d’Excel, recréable avec `node scripts/example-export.mjs`. Le stockage mémoire est injecté uniquement dans les tests, jamais comme remplacement silencieux de Neon en production.
