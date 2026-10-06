# Laboratoire shell séparé — pilote à valider

**NOT RUN en exécution réelle** : Docker est installé dans le workspace mais son daemon est arrêté. Le code du broker a été vérifié syntaxiquement ; authentification, absence de service et accès applicatifs ont été testés. Isolation entre conteneurs, PTY, restauration et charge de 18 élèves nécessitent une recette réelle avant toute utilisation scolaire.

Le broker `broker.py` s’exécute sur une VM Linux dédiée et jetable. Il dispose du Docker CLI de cette VM ; l’application EDEN ne possède ni socket Docker, ni shell, ni montage de la VM. Ne pas installer ce broker sur le serveur applicatif de production. Une frontière de conteneur standard n’est pas une garantie absolue contre une évasion ; le pilote doit rester dans cette VM séparée.

Sur la VM de laboratoire :

```sh
docker build -t tween-shell:pilot labs
docker image inspect tween-shell:pilot --format '{{.Id}}'
# Utiliser exactement l’identifiant sha256 obtenu, sans tag flottant.
export TWEEN_LAB_IMAGE=sha256:REMPLACER_PAR_64_CARACTERES_HEXA
export TWEEN_LAB_TOKEN=REMPLACER_PAR_UN_SECRET_ALEATOIRE_D_AU_MOINS_32_CARACTERES
python3 labs/broker.py
```

Configurer côté application `EDEN_LAB_URL` et `EDEN_LAB_TOKEN` avec le même secret. Le lien distant exige HTTPS ; un lien HTTP n’est accepté que sur loopback. Le broker écoute loopback par défaut : placer un proxy TLS authentifié sur la VM si le serveur applicatif est distant. Les comptes élèves n’obtiennent jamais ce secret. L’image inclut Bash, coreutils, grep, find, man, Git et Python ; noter les versions effectives à la construction. Aucun SSH ou accès Internet n’est fourni.

Les sessions sont dérivées de classe + élève + version de séance + activité. Chaque requête applicative vérifie la session scolaire, la propriété du laboratoire, la publication et le diagnostic. Le terminal xterm envoie entrées, Ctrl+C et dimensions au PTY. Les fichiers de l’éditeur et du terminal partagent `/workspace`. Le validateur compare hors du conteneur les instantanés et l’état Git ; les exigences privées ne sont jamais écrites dans les fichiers élèves. Une solution de référence se teste dans un laboratoire éphémère distinct.

Bornes par conteneur : réseau désactivé, système de fichiers racine en lecture seule, utilisateur 1000, aucune capability, `no-new-privileges`, 192 Mio RAM sans swap, 0,5 CPU, 64 processus, 128 fichiers ouverts, 32 Mio de projet, 8 Mio temporaires, sortie terminal tamponnée à 256 Kio. Une référence s’arrête après cinq secondes puis son conteneur est retiré. Les sessions expirent après 20 minutes d’inactivité ou 90 minutes de durée ; instantané toutes les 30 secondes. Au maximum 18 sessions actives ; les démarrages sont sérialisés par le verrou du pilote (le sémaphore impose aussi un plafond de deux). Ces valeurs sont des limites, pas des mesures de capacité.

Les instantanés restent sur la VM dans `.lab-data` (512 Ko au total, 64 Ko par fichier, 1000 fichiers maximum). La restauration inclut les fichiers Git binaires. La réinitialisation conserve un instantané côté application et côté broker. Un dépassement de quota est un incident technique ; le dernier instantané valide reste disponible. Ne pas utiliser ce pilote pour de gros dépôts. Une VM perdue exige une sauvegarde externe de `.lab-data` ; aucune promesse de haute disponibilité.

Recette restante : démarrage/reconnexion/redimensionnement/interruptions, vrai déplacement, Git, reset puis restauration, deux élèves simultanés sans accès croisé, saturation RAM/PID/disque/sortie, réseau interne inaccessible, arrêt pendant une exécution, puis montée progressive jusqu’à 18 élèves.

## Profil DOM

Le même broker expose `/dom`. Construire `docker build -f labs/Dockerfile.dom -t tween-dom:pilot labs`, relever son identifiant immuable et configurer `TWEEN_DOM_IMAGE`. Configurer côté application `EDEN_LAB_DOM_IMAGE` avec exactement ce digest, et `EDEN_LAB_SHELL_IMAGE` avec celui du shell. Les digests entrent dans le hash de validation ; une image changée invalide l’ancienne revue. Une preuve qui annonce une image différente est refusée.

Chaque rendu DOM utilise un conteneur éphémère, retiré même après un timeout : sans réseau, racine en lecture seule, utilisateur 1000, aucune capability, 512 Mio sans swap, 0,5 CPU, 128 processus, 64 Mio temporaires et 15 secondes maximum. Chromium conserve son propre sandbox. Sur la VM Linux, suivre le [profil seccomp documenté par Playwright](https://playwright.dev/docs/docker#recommended-docker-configuration) pour les espaces de noms utilisateur si nécessaire ; `TWEEN_DOM_SECCOMP` accepte le chemin du profil audité par l’administrateur. Aucun `--no-sandbox`, `SYS_ADMIN`, IPC hôte ou montage de fichiers n’est ajouté. Le profil n’est pas automatiquement téléchargé et sa compatibilité reste **NOT RUN** ici.

Le validateur Node reste hors de la page modifiable, sans secrets. Seuls `index.html`, `style.css` et `main.js` sont servis au navigateur isolé (30 Ko chacun). Les requêtes externes, formulaires, workers, iframes et objets sont bloqués. Les tests déclaratifs privés vérifient clics, remplissages, textes, nombres d’éléments et attributs autorisés ; ils ne sont jamais envoyés au compte élève. La console est bornée à 40 lignes de 1000 caractères. Les fichiers et instantanés DOM sont conservés dans la base applicative ; le rendu renvoie une image PNG et rejoue les interactions, pas du HTML actif dans l’origine EDEN. Les sélecteurs manquants échouent ; une panne ou un dépassement de délai demeure un incident technique.

`npm run test:quality:dom` vérifie ce moteur avec Chromium réel et un adaptateur de test local, uniquement sur des fichiers synthétiques. Ce résultat ne valide pas Docker, le seccomp de la VM ni sa capacité de classe. Le broker pilote sérialise les opérations ; un rendu DOM peut momentanément retarder le polling terminal. Mesurer cette contention et la consommation avant d’ouvrir une classe.
