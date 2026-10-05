# Le jour du cours

Le parcours obligatoire reste le même : mardi **13h20–16h15**, pause **14h30–14h45**. Le simulateur PC est un bonus après le bilan. Il ne remplace pas une des six missions.

## Avant la séance

Publier le site, ouvrir le lien sur un PC élève, tester la reprise après rechargement et le mini-labo. Renseigner le lien de dépôt réel dans `docs/config.js`. Ne pas envoyer le ZIP ou le dépôt GitHub aux élèves : envoyer l’URL du **site publié**.

La publication cible est **Vercel + Neon**. Suis `DEPLOIEMENT_VERCEL.md`, vérifie `/api/health`, ouvre `/prof.html` et connecte-toi avec le mot de passe professeur. Les élèves activent le partage du bonus avec un code de classe distinct. Le service ne reconnaît pas les comptes de ton Eden Hub existant.

Le mode statique local reste disponible pour découvrir les écrans, mais sans réception distante des essais. Même avec Neon, les réponses des six missions restent dans les exports remis manuellement ; seul le bonus et son compteur d’écrans parcourus sont envoyés après activation.
La projection n’authentifie personne et n’envoie aucun essai. Les comptes et données de classe restent derrière le service authentifié, pas derrière un simple bouton masqué.

## Pendant la séance

**13h20** — diagnostic. Les élèves donnent un code ou prénom court. « Je ne sais pas » reste possible. Le minuteur est indicatif ; finir à 13h40.

**13h40** — correction orale. Les réponses du diagnostic sont conservées localement, pas envoyées par le service du simulateur.

**13h45** — départ des missions. Une action par écran. Le mode projection ne pilote pas les appareils à distance.

**14h30** — pause de 15 minutes. Reprise à 14h45.

**16h05** — ticket individuel sans mémo ; ce n’est pas une mesure anti-triche.

**16h10** — bilan HTML. Il contient les réponses, le code et, s’il a été commencé, le bonus. Faire vérifier le fichier puis le remettre au dépôt prévu.

## Ceux qui ont terminé

Le dernier écran propose **« Ouvrir le simulateur PC »**. Il faut avoir parcouru toutes les étapes requises. L’élève place les pièces, relie les câbles puis utilise POWER. Après un premier PC fonctionnel, il résout quatre pannes, une à la fois.

Ne pas transformer ce bonus en course obligatoire de cinq minutes : son estimation de 10–20 minutes n’a pas été mesurée en classe. Un élève peut s’arrêter et reprendre plus tard ; on ne dépasse pas 16h15 pour finir.

Pour projeter directement : `index.html?projection=1#bonus-pc`.

Pour vérifier la compréhension : « Quelle est la dernière étape réussie ? Quel indice te fait choisir cette réparation ? Qu’a montré le nouveau démarrage ? » La réussite du jeu ne vaut pas validation de l’explication.

## Suivi du bonus

Quand le service est déployé, l’élève clique **Partager / synchroniser** et entre le code de classe. L’envoi est explicite et inclut les essais du bonus déjà présents. Le texte « Reçu par le serveur professeur » confirme seulement la réception, pas une note.

Sur `/prof.html` : PC monté, pannes réparées, essais, erreurs, indices, chronologie et explication. Le professeur ajoute un commentaire et marque « Validé » ou « À revoir ». Sans service, importer le JSON dans la même page pour une lecture locale.

Sur poste partagé : après remise, **Mon espace → Effacer ma progression locale**. Cela désactive aussi le partage sur ce navigateur, mais ne supprime pas les données déjà reçues par le professeur. Importer une sauvegarde impose de réactiver le partage pour éviter de réutiliser le jeton d’un autre profil.

## Si une politique de sécurité bloque le site

Ne pas la contourner. Demander à l’administrateur de valider l’hébergement, les modules ES, les Web Workers du mini-labo et l’API même origine ; ou effectuer une démonstration sur un poste autorisé. Aucune installation ni modification du vrai BIOS n’est requise.
