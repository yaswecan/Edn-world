# Sources, provenance et limites

Consultation des sources publiques : **5 octobre 2026**. Les spécifications de ce pack sont des
choix de conception pour Tween Teach, pas des extraits d’une norme ni une certification juridique.
Les sources ci-dessous appuient quelques garde-fous. Avant une modification liée à un fournisseur,
vérifier la documentation correspondant à la version réellement installée dans le dépôt.

## Sources locales inspectées

**L1 — Front livré par la conversation.** Archive `WORLD_ARCADE_FRONT_HTML_CSS_JS.zip`, sources
HTML/CSS/JS, README, exemple de lanceur, assets et tests. Copie dans `FRONT_REFERENCE/`. Le rapport
d’origine indique 42 vérifications du prototype. Les nouvelles vérifications de ce pack sont
présentées séparément dans `RAPPORTS/` ; elles ne valident pas les services de Tween Teach.

**L2 — Maquette générée dans la conversation.** Copie `REFERENCES/01_MAQUETTE_CONCEPT.png`.
Elle sert à comparer l’intention visuelle, pas à fournir les données d’utilisateurs, les scores,
les autorisations ou les seuils de grades. Aucun personnage illustré n’est présenté comme une
photographie d’un élève réel.

**L3 — Rendu HTML fourni.** `REFERENCES/02_RENDU_FRONT.png` et les dix captures dans `previews/`.
La mise en page exécutée est la référence principale des proportions. Les textes système/de démo
sont remplacés seulement dans le module réellement raccordé, selon la spécification.

## Sources publiques primaires

**S1 — OpenAI, instructions AGENTS.md et extension Codex.** Les instructions de dépôt ont une
portée hiérarchique ; un fichier dans un dossier de ressources ne doit pas remplacer aveuglément
celui du vrai dépôt. Ce pack fournit donc un prompt demandant sa lecture explicite.

`https://developers.openai.com/codex/guides/agents-md`

`https://developers.openai.com/codex/ide`

Ces adresses officielles redirigeaient lors de la consultation vers la documentation OpenAI
sur `learn.chatgpt.com`. Pas de réglage d’agent ou d’autorisation globale modifié par ce dossier.

**S2 — OWASP, Authentication Cheat Sheet.** Réutiliser les mécanismes d’authentification,
prévenir les tentatives abusives et éviter des réponses permettant d’énumérer les comptes.
Le choix de fournisseur et de politique de mot de passe reste celui du dépôt.

`https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html`

**S3 — OWASP, Authorization Cheat Sheet.** Modèle de moindre privilège, refus par défaut et
contrôle des permissions à chaque requête. Dans ce pack : séparation classe/communauté et
absence d’autorisation fondée seulement sur l’affichage du menu.

`https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html`

**S4 — CNIL, recommandation 7 sur l’âge et l’accord parental.** La vérification doit être
adaptée aux risques et respectueuse de la vie privée. Ce pack demande une politique validée
pour le service public, sans imposer une collecte de date de naissance ou de pièce d’identité.
Le régime précis du service doit être examiné par son responsable, séparément du rendu UI.

`https://www.cnil.fr/fr/recommandation-7-verifier-lage-de-lenfant-et-laccord-des-parents-dans-le-respect-de-sa-vie-privee`

**S5 — W3C, compréhension du critère WCAG 2.2 « Target Size (Minimum) ».** Référence pour
contrôler la taille/espacement des cibles et les exceptions. Le pack choisit 44 px comme
cible de confort pour ses commandes principales ; il ne présente pas 44 px comme ce minimum normatif.

`https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html`

**S6 — MDN, prefers-reduced-motion.** Respecter la préférence utilisateur relative aux
animations non essentielles. Le pack combine préférence système et réglage explicite.

`https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion`

## Images, polices et distribution

Les WebP sont repris du front livré ; leur source annoncée est la maquette générée. L’inventaire
indique fichiers, dimensions et empreintes. Il ne constitue pas une garantie d’exclusivité ni une
licence sur des éléments de marques que montrerait une référence. Vérifier la publication commerciale
selon les droits et politiques applicables au produit.

Les deux images Adobe Stock filigranées et les captures de créations tierces jointes initialement
restent des inspirations de conversation ; elles ne sont pas copiées dans le pack comme assets UI.
Aucun fichier de police n’est distribué. Les liens Google Fonts du prototype sont documentés comme
références à adapter ou retirer, pas comme une dépendance de production obligatoire.

## Ce qui n’a pas été contrôlé ici

Code du dépôt Tween Teach ; base réelle ; fournisseurs d’e-mail ; hébergement ; conformité juridique
finale ; catalogue métier historique de grades ; anti-triche des vrais jeux ; appareils physiques
et navigateurs non couverts par les contrôles rapportés. Le dossier donne à Codex la procédure pour
raccorder et vérifier ces éléments dans l’environnement où ils sont accessibles.
