# Contrats : points de raccordement, pas un backend prêt à déployer

`arcade-host-contract.ts` décrit ce que la vue demande aux services existants. Le transport,
les schémas de base, les noms de routes et les mécanismes d’authentification restent ceux du dépôt.
Une équipe utilisant JavaScript peut reprendre les contrats sous forme de types/JSDoc ou de schémas
runtime déjà utilisés. Rien n’impose d’introduire TypeScript dans une application qui ne l’utilise pas.

`launcher-bridge.mjs` est un exemple facultatif pour réutiliser l’événement du front autonome.
Il n’est pas inclus dans `index.html` et n’est installé par aucun script du pack. Codex peut préférer
un appel direct depuis ses composants. Tous ses callbacks obligatoires doivent être branchés à des
fonctions hôtes réelles ; l’adaptateur de décision n’est pas fourni ici parce que le dépôt n’a pas
été inspecté. Aucune route de production n’est inventée dans ces fichiers.

## Invariants à conserver

Le serveur infère l’identité de la session ; un `scopeRef` ou `publicId` reçu reste une entrée à
contrôler, pas une preuve de permission. Les DTO publics sont minimaux. La réponse de classement
contient cinq lignes maximum à vérifier à l’exécution : le type TypeScript seul ne l’impose pas.

Les opérations de mutation du profil ne contiennent ni rôle, ni points, ni grade à imposer. Les
tentatives de mission, récompenses et sauvegardes appartiennent aux moteurs/services réels.

Le pont annule l’événement avant de consulter l’adaptateur, bloque les ouvertures concurrentes et
refuse les cibles hors origine/liste blanche. Sa liste blanche doit examiner la route normalisée,
mais aussi les paramètres pertinents et les destinations de retour selon le routeur hôte. Un chemin
sur la même origine peut tout de même exposer une route sensible : l’origine seule ne suffit pas.
Les gardes serveur sont toujours nécessaires sur le jeu et ses API.

Appeler la fonction de démontage quand le module quitte l’écran. Une requête tardive ne doit pas
lancer un jeu après une navigation vers un cours. Les erreurs sont présentées comme des erreurs,
sans routage vers la démo. Le callback de notification doit afficher son argument comme texte.

Les tests du pont sont dans `OUTILS/launcher-bridge.test.mjs`. Ils utilisent des noms de routes
synthétiques uniquement pour tester le code ; ils ne désignent aucun chemin de Tween Teach.
