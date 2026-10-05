# World Arcade — consignes locales du dossier d’intégration

Ces consignes décrivent ce dossier de référence. Respecter les instructions applicables du
vrai dépôt ; ne pas écraser son AGENTS.md, ses configurations d’agent ni les changements utilisateur.
Pour la tâche d’intégration hors de ce dossier, lire explicitement le prompt racine du pack.

Lire `00_LIRE_DABORD.md`, puis `01_PROMPT_CODEX_INTEGRATION.md`. Consulter les références à mesure
que la tâche l’exige ; ne pas charger les images encodées du HTML autonome comme texte de contexte.

- `FRONT_REFERENCE/` et `REFERENCES/` sont les références visuelles, pas des services métier.
- `CORPUS/` contient la cible de conception, pas une autorité pour accorder un accès ou des XP.
- Ne pas retoucher les références pour faire passer une comparaison ; adapter le vrai module.
- Les données et règles métier existantes priment sur les fixtures. Signaler les conflits.
- Ne jamais publier la liste scolaire à un visiteur ou à un compte externe.
- Ne pas charger les formulaires de démo ou leur faux état connecté dans une route de production.
- Ni police binaire, ni secret, ni dump de base, ni donnée réelle d’élève dans ce dossier.
- Toutes les modifications d’intégration doivent être testées dans leur contexte réel.
- Écrire les constats et preuves de l’intégration dans `SUIVI/`, sans modifier les rapports de livraison.
- La commande de contrôle du pack est `python3 OUTILS/verifier_pack.py` depuis ce dossier.
- Les tests du pont de lancement sont `node --test OUTILS/launcher-bridge.test.mjs`.
- Ne pas confondre ces contrôles avec des tests de l’authentification ou du backend Tween Teach.
