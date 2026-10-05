# Distribution pédagogique Google Drive

Petite application Next.js déployable sur Vercel pour distribuer un ou plusieurs fichiers dans **n'importe quel dossier / sous-dossier** présent dans les espaces Drive de tous les élèves.

## Fonctionnement

Le dossier configuré par `GOOGLE_DRIVE_ELEVES_FOLDER_ID` doit contenir directement les dossiers élèves :

```text
ELEVES/
├── Alice Martin/
│   ├── 01 - Tech/
│   │   ├── 01 - Cours/
│   │   ├── 02 - Exercices/
│   │   └── 03 - Projets/
│   ├── 02 - Maths/
│   └── ...
├── Bilal Karim/
└── ...
```

L'application **ne connaît aucun nom de matière à l'avance**. Elle analyse les dossiers de chaque élève et construit automatiquement les chemins disponibles.

Exemples de destinations possibles :

- `01 - Tech / 01 - Cours`
- `01 - Tech / 03 - Projets`
- `02 - Maths / Exercices`
- `03 - Français / Ressources / Oral`

Tu peux ensuite demander la création d'un sous-dossier, par exemple :

`BC04 Concevoir des interfaces web accessibles et responsives`

puis y envoyer plusieurs fichiers d'un coup.

## 1. Créer le compte de service Google

1. Ouvre Google Cloud Console.
2. Crée ou sélectionne un projet.
3. Active **Google Drive API**.
4. Crée un **Service Account**.
5. Crée une clé JSON pour ce compte.
6. Récupère `client_email` et `private_key`.

### Important : Drive partagé ou Mon Drive

Un compte de service ne dispose pas de quota de stockage personnel. Deux configurations sont donc supportées :

- **Recommandé :** le dossier `ELEVES` est placé dans un **Drive partagé** Google Workspace et le compte de service est membre/éditeur de ce Drive.
- **Alternative :** si `ELEVES` se trouve dans le **Mon Drive** d'un compte de l'école, active la **Domain-Wide Delegation** sur le compte de service et renseigne `GOOGLE_IMPERSONATED_USER` avec l'adresse d'un utilisateur Workspace autorisé.


## 2. Partager le dossier ELEVES

Dans Google Drive, partage le dossier racine `ELEVES` avec l'adresse du compte de service en **Éditeur**.

Important : le compte de service doit pouvoir voir les sous-dossiers et créer des fichiers/dossiers dedans.

## 3. Configuration locale

Copie `.env.example` vers `.env.local` puis renseigne :

```env
GOOGLE_DRIVE_ELEVES_FOLDER_ID=ID_DU_DOSSIER_ELEVES
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_IMPERSONATED_USER=prof-ou-admin@ecole.fr # laisser vide si Drive partagé
APP_PASSWORD=un-mot-de-passe-prof
DRIVE_DISCOVERY_MAX_DEPTH=5
```

L'ID du dossier est dans son URL :

`https://drive.google.com/drive/folders/ICI_L_ID`

## 4. Lancer en local

```bash
npm install
npm run dev
```

Puis ouvre `http://localhost:3000`.

## 5. Déployer sur Vercel

1. Push ce dossier sur GitHub.
2. Importe le dépôt dans Vercel.
3. Dans **Settings > Environment Variables**, ajoute les 5 variables de `.env.example`.
4. Déploie.

Ne commit jamais `.env.local` ni la clé JSON du compte de service.

## Utilisation

1. Ouvre l'application.
2. Entre `APP_PASSWORD`.
3. Clique **Charger les dossiers**.
4. Choisis n'importe quel chemin détecté.
5. Facultatif : donne un nom au sous-dossier à créer (ex. BC04...).
6. Ajoute un ou plusieurs fichiers.
7. Clique **Distribuer à tous les élèves**.

Le résultat affiche `X/Y élèves servis` et les erreurs individuelles.

## Dossiers manquants

L'option **Créer les dossiers manquants** permet de créer chez les élèves les segments du chemin qui n'existent pas encore. Cela permet par exemple de sélectionner une structure présente chez 16/18 élèves et de compléter automatiquement les 2 autres.

## Doublons

L'option **Ne pas dupliquer un fichier déjà présent** est activée par défaut. Si un fichier du même nom existe déjà dans le dossier cible d'un élève, il est ignoré.

## Limites du MVP

- Sur Vercel, l'envoi direct via une Function est limité à 4,5 Mo. Le projet limite volontairement le total des fichiers à 4 Mo pour garder une marge multipart. Pour de gros PDF/vidéos, il faudra passer à un upload direct (Vercel Blob ou session d'upload Google Drive).
- La découverte des dossiers est séquentielle pour limiter les erreurs de quota Drive. Sur plusieurs centaines d'élèves et une arborescence très profonde, une mise en cache sera utile.
- Le mot de passe partagé est une protection simple. Pour une école, la prochaine étape recommandée est une authentification Google Workspace avec contrôle du domaine et des rôles professeurs.

## Arborescence attendue (version matières)

Le dossier défini par `GOOGLE_DRIVE_ELEVES_FOLDER_ID` doit contenir les élèves :

```text
ELEVES PARIS/
├── NOM Prénom/
│   ├── 01 - Tech/
│   │   ├── 01 - Cours/
│   │   ├── 02 - Exercices/
│   │   └── 03 - À rendre/
│   ├── 02 - Enseignement Humain/
│   ├── 03 - Math Sciences/
│   └── ...
└── ...
```

L'interface charge d'abord les matières présentes directement sous les élèves, puis les dossiers disponibles à l'intérieur de la matière choisie. Les raccourcis Drive vers des dossiers sont également reconnus.

## IMPORTANT — dossiers partagés / PARTAGE / ELEVES PARIS

Si ton compte humain voit les dossiers élèves dans Google Drive mais que l'application affiche 0 élève, ce n'est pas un problème de détection des matières : le compte utilisé par l'application n'a pas les mêmes droits que ton compte Google Workspace.

La version actuelle affiche maintenant le dossier racine réellement lu et le mode d'authentification.

### Cas recommandé pour EDEN / dossiers partagés

Si `ELEVES PARIS` contient des dossiers élèves partagés individuellement, utilise l'impersonation Workspace :

```env
GOOGLE_IMPERSONATED_USER=ton.compte@ecole.fr
```

Le compte impersonné doit être celui qui voit déjà dans Drive :

```text
ELEVES PARIS
  ├─ YOUSSSOUFI Ines
  │   ├─ 01 - Tech
  │   ├─ 02 - Enseignement Humain
  │   ├─ 03 - Math Sciences
  │   ├─ 04 - Histoire Géographie
  │   ├─ 05 - Français
  │   └─ 06 - Anglais
  └─ ...
```

Il faut autoriser le Client ID du compte de service dans Google Admin > Sécurité > Contrôle des API > Délégation à l'échelle du domaine, avec le scope exact :

```text
https://www.googleapis.com/auth/drive
```

Puis redémarrer l'application.

## Patch Shared Drive

Cette version force les appels Drive à supporter les Drives partagés :

- `supportsAllDrives: true`
- `includeItemsFromAllDrives: true`
- `corpora: "drive"` + `driveId` quand le dossier appartient à un Drive partagé

Elle ajoute aussi des logs détaillés dans le terminal pour :

- le dossier ELEVES réellement lu ;
- le `driveId` détecté ;
- les enfants bruts visibles dans ELEVES ;
- les dossiers élèves reconnus ;
- les matières trouvées dans chaque dossier élève.

Après remplacement, lance :

```bash
npm install
npm run dev
```

Puis clique sur `Lire ELEVES` et surveille le terminal VS Code.

## V5 — sélection d'élèves, arborescences et dossiers complets

Cette version ajoute :
- sélection d'un, plusieurs ou tous les élèves ;
- choix matière + dossier existant ;
- création d'une arborescence supplémentaire avec `/` (ex. `BC04 / Séance 01 / Ressources`) ;
- upload de plusieurs fichiers ;
- upload d'un dossier complet via `webkitdirectory`, en conservant les sous-dossiers contenant des fichiers ;
- rapport par élève.

### Limite navigateur
Un navigateur ne transmet pas les dossiers totalement vides lors d'un upload de dossier. Pour créer des dossiers vides, utilise le champ « Arborescence supplémentaire à créer ».

### Limite Vercel
Cette version conserve la limite de sécurité de 4 Mo au total par requête, à cause du passage des fichiers par la Function Vercel. Pour des dossiers volumineux, une prochaine évolution doit utiliser un upload direct vers Google Drive ou un mécanisme par lots.


## V6 — Collecte des rendus

Nouvel onglet **Récupérer les rendus** :

1. Lire ELEVES.
2. Sélectionner les élèves à vérifier.
3. Choisir la matière.
4. Choisir le dossier de rendu (par exemple `03 - À rendre`).
5. Indiquer facultativement le sous-dossier du travail (par exemple `BC04 - CSS3`).
6. Cliquer sur **Collecter les rendus**.
7. L'application classe chaque élève en `Rendu`, `Dossier vide`, `Non rendu` ou `Erreur`.
8. Sélectionner les rendus voulus et cliquer sur **Télécharger les rendus (.zip)**.

Le ZIP contient :
- un dossier par élève ;
- toute l'arborescence de son rendu ;
- `_rapport.csv` avec statut, nombre de fichiers et dernière modification.

Les Google Docs sont exportés en PDF, Sheets en XLSX et Slides en PPTX.

### Note taille
La génération du ZIP est volontairement simple et se fait côté serveur en mémoire. Pour de très gros rendus (centaines de Mo), prévoir ensuite une V7 avec ZIP en streaming ou stockage temporaire.
