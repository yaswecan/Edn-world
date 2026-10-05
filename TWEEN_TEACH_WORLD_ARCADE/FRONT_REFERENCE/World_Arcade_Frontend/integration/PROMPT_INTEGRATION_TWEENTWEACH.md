# Intégrer World Arcade au dépôt TweenTweach

Tu disposes d’un front autonome HTML/CSS/JS et de captures de référence. Implémente son intégration au dépôt existant ; ne recrée pas les services déjà présents et ne remplace pas les jeux existants par ses démos.

## 1. Inspecter avant de modifier

Identifie les routes réelles, le layout de l’espace élève, l’authentification, les permissions, les comptes, la sauvegarde des jeux et la configuration des grades. Recense les deux points d’entrée Code Station et Cyber Funk 3026. Ne suppose pas de nom de fichier ni de route.

Conserve les identifiants, comptes élèves, corrections, résultats, conditions de déblocage et données professeur. Ne migre pas la base pour le simple plaisir d’adapter ce prototype. N’écrase aucune progression par les fixtures.

## 2. Périmètre visuel

L’arcade est un module à direction artistique propre : fond noir bleuté, chrome sombre, accent cyan pour Code Station, rose pour Cyber Funk, portraits pixel art, grands titres et contrôles rétro. Préserve l’interface claire des cours, diagnostics, exercices et vues professeur.

Reproduis les deux bornes HTML/CSS, la fenêtre de ville, les panneaux, la galerie et l’écran d’entrée. Ne transforme pas une capture d’écran entière en arrière-plan cliquable. Les textes, boutons, champs et listes doivent être de vrais composants accessibles. Encapsule les styles dans un layout dédié ou un espace de noms ; aucune pollution CSS des autres routes.

L’écran « Commencer » ouvre le choix des deux mondes. Pour un élève déjà connecté, ne redemande pas un identifiant. Le clic Jouer reprend le jeu et la progression réels. Débranche la mini-démo uniquement quand son remplacement est fonctionnel. Si un jeu réel n’existe pas encore, conserve une mention de démonstration honnête ; n’affiche pas de lancement fictif.

## 3. Joueurs, classement et grades

Remplace les 18 joueurs fictifs par une source autorisée. Pseudos et avatars sont suffisants pour les profils publics. Ne publie pas les adresses e-mail, noms complets, horaires de présence ou résultats scolaires. Les listes de classe et l’annuaire professeur restent protégés. Aucun compte public ne reçoit un rôle scolaire à partir d’une valeur envoyée par le navigateur.

Le classement affiche cinq joueurs maximum par périmètre et période. La place personnelle d’un joueur hors Top 5 peut être affichée uniquement à ce joueur. Ne présente pas le classement comme un niveau pédagogique. Vérifie la comparabilité des points avant de mélanger les deux jeux.

Conserve le catalogue réel des grades s’il existe. Le front illustre la proposition Rookie → Explorer → Operator → Specialist → Vanguard → Elite → Phantom → Legend → Prestige, divisions I/II/III, avec Explorer à la place de Scout. Ne prétends pas que des seuils XP sont approuvés : inspecte la configuration puis demande une décision si elle manque. Garde séparées progression ludique et évaluation scolaire.

En production, seules les validations serveur de missions doivent alimenter XP, progression et classement. Le `localStorage` et l’événement `worldarcade:demo-complete` ne constituent pas une preuve. Empêche les doubles crédits lors des rejeux et des reprises réseau selon les conventions du backend.

## 4. Inscription des joueurs externes

Les formulaires fournis sont actuellement simulés : remplace leurs handlers avant toute ouverture publique. Réutilise l’authentification existante, ses sessions et ses règles de sécurité. Prévois l’inscription, la vérification d’e-mail, les erreurs utiles, la récupération de mot de passe et les protections contre l’abus. Aucun mot de passe ne doit être conservé dans `localStorage` ou ajouté aux logs.

L’accès externe concerne les jeux publics autorisés, pas les séances privées, dossiers d’élèves ou outils professeur. Documente les règles de confidentialité et les parcours applicables aux mineurs avec le responsable du produit avant publication. Pas de chat public ni de messagerie ajoutés implicitement.

## 5. Comportements et qualité

Navigation clavier, focus visible, libellés de champs, dialogues fermables, absence de débordement, boutons tactiles, réglage du son et réduction des animations doivent rester fonctionnels. Ne remplace pas le frontend par une liste générique de cartes.

N’ajoute ni fausse présence en ligne, ni score de secours qui ressemble à un score réel, ni mot de passe magique. Les états chargement, vide, refus d’accès et erreur doivent être explicites sans vocabulaire interne inutile. Réutilise la session active, ne duplique pas l’identité dans un second compte arcade.

## 6. Recette et livraison

Teste élève connecté, professeur, invité et joueur externe. Vérifie la frontière classe/communauté, la reprise des jeux, les conditions de déblocage, la séparation des grades et notes, les cinq places du classement, l’absence de double crédit, les erreurs réseau et le mobile.

Livre les fichiers modifiés, les migrations réellement nécessaires, les variables de configuration documentées, les tests exécutés et des captures réelles. Liste ce qui reste non connecté ou non vérifié. Ne déclare pas la mise en production sécurisée sur la seule base du rendu visuel.
