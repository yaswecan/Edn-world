/** Contenu éditorial unique. Horaires conservés du corpus du mardi. */
export const SESSION = {
  id: 'bios-os-mardi-v1', title: 'Du PC éteint au code qui tourne', day: 'Mardi',
  start: '13:20', end: '16:15', breakStart: '14:30', breakEnd: '14:45',
  source: 'EDEN_BIOS_OS_CORPUS_EDEN_HUB_MARDI_13H20_16H15.zip',
};
export const CHAPTERS = [
  {id:'diag', label:'Point de départ', time:'13h20–13h40', start:'13:20',end:'13:40', icon:'file'},
  {id:'correction', label:'Correction ensemble', time:'13h40–13h45',start:'13:40',end:'13:45',icon:'book'},
  {id:'m1', label:'01 · Démarrer le PC', time:'13h45–14h05',start:'13:45',end:'14:05',icon:'power'},
  {id:'m2', label:'02 · Voir ce qui tourne',time:'14h05–14h25',start:'14:05',end:'14:25',icon:'process'},
  {id:'ancrage',label:'Deux idées à garder',time:'14h25–14h30',start:'14:25',end:'14:30',icon:'book'},
  {id:'pause',label:'Pause · 15 min',time:'14h30–14h45',start:'14:30',end:'14:45',icon:'session'},
  {id:'m3',label:'03 · Jouer le rôle de l’OS',time:'14h45–15h05',start:'14:45',end:'15:05',icon:'ram'},
  {id:'m4',label:'04 · Enregistrer un fichier',time:'15h05–15h25',start:'15:05',end:'15:25',icon:'ssd'},
  {id:'m5',label:'05 · Qui exécute mon code ?',time:'15h25–15h40',start:'15:25',end:'15:40',icon:'editor'},
  {id:'m6',label:'06 · Résoudre trois incidents',time:'15h40–16h00',start:'15:40',end:'16:00',icon:'magnifier'},
  {id:'bilan',label:'Expliquer sa démarche',time:'16h00–16h05',start:'16:00',end:'16:05',icon:'session'},
  {id:'ticket',label:'Mon ticket individuel',time:'16h05–16h10',start:'16:05',end:'16:10',icon:'file'},
  {id:'fin',label:'Mon bilan et ma fiche',time:'16h10–16h15',start:'16:10',end:'16:15',icon:'book'},
];
export const SCHEMAS = [
  {id:'01_demarrage',title:'Dans quel ordre le PC démarre-t-il ?',alt:'Allumage, firmware BIOS ou UEFI, chargeur, noyau, puis services et session.',chapter:'m1'},
  {id:'02_processus',title:'Programme, processus, fichier',alt:'Les instructions du programme ; son exécution dans un processus ; les informations enregistrées dans un fichier.',chapter:'m2'},
  {id:'03_ressources',title:'RAM, SSD et CPU',alt:'La RAM est le plan de travail, le SSD le rangement et le CPU exécute les instructions.',chapter:'m3'},
  {id:'04_couches',title:'Une demande, plusieurs rôles',alt:'L’application demande un service à l’OS. Ses services, son noyau et les pilotes coopèrent avec le matériel.',chapter:'m4'},
  {id:'05_code',title:'Écrire n’est pas exécuter',alt:'VS Code écrit le code ; le moteur du navigateur exécute le JavaScript ; l’OS gère les ressources ; le CPU exécute les instructions machine.',chapter:'m5'},
  {id:'06_langages',title:'Changer le niveau de détail',alt:'JavaScript et Python masquent des détails de la machine. L’assembleur est proche d’une architecture. Pas de chaîne obligatoire de traduction entre ces langages.',chapter:'m5'},
  {id:'07_methode',title:'Un indice, une hypothèse, un test',alt:'Observer ce qui fonctionne encore, formuler une hypothèse, tester, vérifier. Une piste n’est pas une cause prouvée.',chapter:'m6'},
  {id:'08_synthese',title:'Les idées à garder',alt:'Démarrer, organiser les ressources, exécuter le code, chercher à partir d’indices.',chapter:'fin'},
];
export const BOOT_CARDS = [
  {id:'session',name:'Services + session',icon:'session'},
  {id:'editor',name:'VS Code',icon:'editor'},
  {id:'firmware',name:'Firmware BIOS / UEFI',icon:'firmware'},
  {id:'power',name:'Allumage',icon:'power'},
  {id:'kernel',name:'Noyau de l’OS',icon:'kernel'},
  {id:'loader',name:'Chargeur de démarrage',icon:'loader'},
];
export const BOOT_ORDER = ['power','firmware','loader','kernel','session'];
export const RELAY_CARDS = [
  {id:'disk',name:'SSD',icon:'ssd'}, {id:'kernel',name:'Noyau',icon:'kernel'},
  {id:'app',name:'Application',icon:'editor'}, {id:'driver',name:'Pilote du SSD',icon:'file'},
  {id:'services',name:'Services de l’OS',icon:'process'},
];
export const RELAY_ORDER = ['app','services','kernel','driver','disk'];
export const APPS = [
  {id:'browser',name:'Navigateur',ram:3,icon:'browser',pattern:'hatch'},
  {id:'music',name:'Musique',ram:2,icon:'file',pattern:'dots'},
  {id:'editor',name:'Éditeur',ram:2,icon:'editor',pattern:'light'},
  {id:'game',name:'Jeu',ram:3,icon:'cpu',pattern:'dark'},
];
export const CODE_START = 'const score = 3;\n\ndocument.querySelector("#score").textContent = "Score : " + socre;';
export const ROLE_OPTIONS = [
  ['editor','VS Code, l’éditeur'],['engine','Le moteur JavaScript du navigateur'],['os','Le système d’exploitation'],['cpu','Le CPU'],
];
export const FIELDS = {
  d_cpu:'Diagnostic — CPU : matériel ou logiciel',d_ssd:'Diagnostic — SSD',d_keyboard:'Diagnostic — clavier',d_editor:'Diagnostic — VS Code',d_browser:'Diagnostic — navigateur',d_ubuntu:'Diagnostic — Ubuntu',
  d_exec:'Diagnostic — exécute les instructions',d_store:'Diagnostic — conserve les fichiers',d_ram:'Diagnostic — accueille les données utilisées',d_version:'Diagnostic — version de note.txt retrouvée',d_why:'Diagnostic — pourquoi les dernières modifications ne sont pas garanties',d_tool:'Diagnostic — application pour modifier du HTML',d_actions:'Diagnostic — actions pour voir la modification',
  m1_relay:'M1 — qui lance quoi ?',m1_intruder:'M1 — pourquoi écarter VS Code ?',m1_transfer:'M1 — session absente : information à demander',
  m2_source:'M2 — observation réelle ou simulée',m2_process:'M2 — processus observé',m2_measure:'M2 — mesure et unité',m2_prediction:'M2 — prédiction avant rechargement',m2_observation:'M2 — compteur et fichier : comparaison',m2_zero:'M2 — 0 % CPU : que peut-on dire ?',
  anchor_boot:'Ancrage — rôle du chargeur',anchor_process:'Ancrage — définition de processus',m3_explanation:'M3 — place en RAM et temps CPU',m4_decision:'M4 — pourquoi refuser dans Bulletins ?',
  m5_prediction:'M5 — prédiction avant fermeture de l’éditeur',m5_observation:'M5 — résultat observé',role_edit:'M5 — écrire app.js',role_engine:'M5 — exécuter JavaScript',role_os:'M5 — organiser les ressources',role_cpu:'M5 — exécuter les instructions machine',
  m6_a:'M6 A — information à demander',m6_a_reason:'M6 A — indice à l’appui',m6_b:'M6 B — zone à examiner',m6_b_reason:'M6 B — ce qui fonctionne encore',m6_c_reason:'M6 C — correction et vérification',bilan:'Bilan — j’ai vu, testé, vérifié',
  t1:'Ticket — firmware / OS et rôle du chargeur',t2:'Ticket — deux responsabilités de l’OS',t3:'Ticket — qui exécute le JavaScript ?',t4:'Ticket — où chercher l’erreur en premier ?',
};
// Une seule consigne principale par écran. Les compléments sont dans « Un indice ».
export const STEPS = [
  {id:'diag-classer',chapter:'diag',kind:'classify',phase:'Individuel · 5 min',title:'Matériel ou logiciel ?',task:'Pour chaque élément, choisis une réponse. « Je ne sais pas » est accepté.',cta:'Continuer'},
  {id:'diag-roles',chapter:'diag',kind:'hardware',phase:'Individuel · 5 min',title:'Retrouve le bon rôle.',task:'Associe CPU, RAM et SSD à ce qu’ils font.',cta:'Continuer'},
  {id:'diag-fichier',chapter:'diag',kind:'save-question',phase:'Individuel · 5 min',title:'Quelle version reste enregistrée ?',task:'Mina enregistre note.txt, puis le modifie sans enregistrer. Pas de sauvegarde automatique. Le PC s’éteint.',cta:'Continuer'},
  {id:'diag-html',chapter:'diag',kind:'html-question',phase:'Individuel · 5 min',title:'La page n’a pas changé.',task:'Noé modifie son HTML local. Aucun outil ne recharge automatiquement la page.',cta:'Terminer mon diagnostic'},
  {id:'correction',chapter:'correction',kind:'correction',phase:'Avec le professeur · 5 min',title:'On compare nos repères.',task:'Écoute la correction. Ton diagnostic reste conservé, sans modification.',cta:'Le professeur donne le départ'},
  {id:'boot-observe',chapter:'m1',kind:'diagram',phase:'Observer · 4 min',title:'Qui commence avant l’OS ?',task:'Suis les flèches. Dans un instant, tu reconstruiras ce trajet sans le modèle.',schema:'01_demarrage',takeaway:'Le firmware prépare ; le chargeur lance le noyau.',cta:'Cacher le modèle et essayer'},
  {id:'boot-game',chapter:'m1',kind:'boot',phase:'Reconstruire · 8 min',title:'Remets le PC dans le bon ordre.',task:'Choisis cinq cartes dans l’ordre. Laisse l’intrus de côté.',help:'L’énergie arrive en premier. Le noyau démarre avant la session. Retire une carte pour changer ton ordre.',cta:'Expliquer mon ordre'},
  {id:'boot-explain',chapter:'m1',kind:'boot-explain',phase:'Expliquer · 4 min',title:'Explique un relais.',task:'Une phrase pour la flèche. Une phrase pour l’intrus.',help:'Utilise « lance » ou « prépare ». Ne confonds pas le programme et la puce qui le stocke.',cta:'Tester sur un autre cas'},
  {id:'boot-transfer',chapter:'m1',kind:'text',field:'m1_transfer',phase:'Transférer · 4 min',title:'La session n’arrive pas.',task:'Quelle information demanderais-tu pour savoir à quelle étape cela bloque ?',placeholder:'Je demanderais quel message s’affiche, car…',help:'Une zone à examiner, pas une panne à affirmer. Ne change aucun réglage.',cta:'Passer à l’observation du PC',takeaway:'Le démarrage est une chronologie. BIOS et UEFI ne sont pas deux étapes successives.'},
  {id:'process-observe',chapter:'m2',kind:'process',phase:'Observer · 8 min',title:'Trouve un programme en cours.',task:'Ouvre le Moniteur système et la Calculatrice. Relève un nom de processus et une mesure.',help:'Sous Ubuntu : cherche « Moniteur système ». Observe seulement. N’arrête aucun processus. Le relevé simulé est disponible en secours.',cta:'Faire une prédiction'},
  {id:'counter-predict',chapter:'m2',kind:'counter-predict',phase:'Prédire puis tester · 7 min',title:'Le score restera-t-il à 3 ?',task:'Ajoute trois points. Prédis le résultat, puis recharge seulement le compteur.',help:'Ce compteur ne sauvegarde pas son score. Recharger cette activité ne vide pas toute la RAM du PC.',cta:'Comparer au fichier'},
  {id:'counter-compare',chapter:'m2',kind:'counter-compare',phase:'Comparer · 3 min',title:'Même page, deux choses différentes.',task:'Le compteur a été réinitialisé. Le fichier de démonstration est toujours là. Explique la différence.',help:'Le fichier est une ressource enregistrée du site. Le score n’était qu’un état de ce programme.',cta:'Expliquer un cas limite'},
  {id:'process-zero',chapter:'m2',kind:'zero',phase:'Expliquer · 2 min',title:'0 % CPU = disparu ?',task:'La Calculatrice utilise 0 % de CPU à cet instant, mais répond encore. Que peux-tu en déduire ?',cta:'Garder deux repères',takeaway:'Un processus peut attendre. Une application peut créer plusieurs processus.'},
  {id:'ancrage',chapter:'ancrage',kind:'anchor',phase:'Se souvenir · 5 min',title:'Deux idées avant la pause.',task:'Complète sans regarder le schéma. Explique ensuite une réponse à ton binôme.',help:'Le noyau est le cœur de l’OS. Un processus correspond à un programme en cours d’exécution.',cta:'Passer à la pause'},
  {id:'pause',chapter:'pause',kind:'pause',phase:'14h30–14h45',title:'Pause. On reprend à 14h45.',task:'Laisse ta page ouverte : tu retrouveras ton travail ici.',cta:'Reprendre au signal du professeur'},
  {id:'os-intro',chapter:'m3',kind:'os-intro',phase:'Se répartir les rôles · 3 min',title:'Cette fois, tu joues l’OS.',task:'Choisissez un gestionnaire, des applications et un observateur. La machine fictive a 8 cases RAM.',help:'Modèle de classe : 1 cœur CPU, 8 cases RAM, sans mémoire virtuelle. Pas une mesure de ton vrai PC.',cta:'Gérer la mémoire'},
  {id:'os-ram',chapter:'m3',kind:'ram',phase:'Manipuler · 7 min',title:'Fais une place au jeu.',task:'Ouvre Navigateur, Musique et Éditeur. Essaie Jeu. Puis libère juste assez de RAM.',help:'3 + 2 + 2 = 7 cases. Jeu en demande 3. Fermer une application libère ses cases dans ce modèle.',cta:'Partager le temps CPU'},
  {id:'os-cpu',chapter:'m3',kind:'cpu',phase:'Organiser · 7 min',title:'Six tours pour les applications.',task:'Donne au moins un tour CPU à chaque application restée ouverte. Utilise exactement six tours.',help:'Un clic donne un tour de calcul. Ce tour ne libère pas de case RAM.',cta:'Défendre notre organisation'},
  {id:'os-explain',chapter:'m3',kind:'text',field:'m3_explanation',phase:'Expliquer · 3 min',title:'De la place ou du temps ?',task:'Explique la différence entre une case RAM et un tour CPU avec votre partie.',placeholder:'Dans notre partie, la RAM… tandis qu’un tour CPU…',help:'Pense au plan de travail et au temps passé à travailler.',cta:'Suivre une demande de fichier',takeaway:'L’OS organise deux ressources différentes : la place en mémoire et le temps de calcul.'},
  {id:'file-observe',chapter:'m4',kind:'diagram',phase:'Observer · 3 min',title:'Le PC est déjà allumé.',task:'Cette fois, les flèches suivent une demande d’enregistrement. Ce n’est plus le démarrage.',schema:'04_couches',takeaway:'Le noyau fait partie de l’OS. Le pilote est un logiciel qui fait le lien avec le matériel.',cta:'Faire circuler la demande'},
  {id:'file-allow',chapter:'m4',kind:'relay',phase:'Manipuler · 6 min',title:'Enregistre score.txt dans Projets.',task:'Reconstitue le relais. Dans ce jeu, Projets autorise l’écriture.',help:'L’application demande un service. Les services de l’OS, le noyau et le pilote coopèrent avec le SSD.',cta:'Changer de dossier'},
  {id:'file-deny',chapter:'m4',kind:'rights',phase:'Modifier à chaud · 6 min',title:'Même demande. Autres droits.',task:'On veut modifier bulletin.txt dans Bulletins. Ce dossier est en lecture seule. Laisse passer ou refuse ?',help:'Lire et modifier sont deux autorisations différentes. Un refus n’est pas forcément une panne.',cta:'Justifier la décision'},
  {id:'file-explain',chapter:'m4',kind:'text',field:'m4_decision',phase:'Expliquer · 5 min',title:'Le refus protège quoi ?',task:'Explique pourquoi l’écriture réussit dans Projets et est refusée dans Bulletins.',placeholder:'Projets… / Bulletins… Ce refus protège…',help:'La règle de l’exercice est fictive. Ne cherche pas à contourner les droits réels du PC.',cta:'Passer au code',takeaway:'L’application demande un service. Les droits peuvent autoriser ou refuser l’action.'},
  {id:'code-predict',chapter:'m5',kind:'editor-predict',phase:'Prédire · 2 min',title:'On ferme seulement l’éditeur.',task:'La page du compteur est déjà chargée. Son bouton fonctionnera-t-il encore ?',cta:'Vérifier mon idée'},
  {id:'code-experience',chapter:'m5',kind:'editor-lab',phase:'Tester · 5 min',title:'Le cahier de recettes ne cuisine pas.',task:'Ferme l’éditeur de démonstration, puis ajoute un point dans la page déjà ouverte.',help:'Cette vue simule la fermeture de l’éditeur, pas celle de ton navigateur. Le professeur peut aussi faire l’expérience avec VS Code.',cta:'Attribuer les rôles'},
  {id:'code-roles',chapter:'m5',kind:'roles',phase:'Distinguer · 4 min',title:'Qui fait quoi ?',task:'Choisis le bon acteur pour chacune des quatre actions.',help:'Écrire le fichier, exécuter le JavaScript, gérer les ressources et exécuter les instructions machine sont des rôles distincts.',cta:'Changer le zoom'},
  {id:'code-zoom',chapter:'m5',kind:'diagram',phase:'Prendre du recul · 4 min',title:'Haut et bas niveau : un autre zoom.',task:'Repère ce qui masque les détails de la machine et ce qui en est plus proche.',schema:'06_langages',takeaway:'Haut niveau ne veut pas dire meilleur. Pas de chaîne obligatoire « JavaScript → C → assembleur ».',cta:'Ouvrir les dossiers d’incident'},
  {id:'incident-a',chapter:'m6',kind:'incident-a',phase:'Dossier A · 5 min',title:'Pas d’écran de connexion.',task:'Lis les indices. Choisis l’information à demander, sans inventer une cause certaine.',help:'SSD détecté ne signifie pas système amorçable disponible. Les entrées de démarrage ne sont pas fournies.',cta:'Examiner le poste suivant'},
  {id:'incident-b',chapter:'m6',kind:'incident-b',phase:'Dossier B · 5 min',title:'Une application est figée.',task:'Ce qui fonctionne encore t’aide à choisir où regarder.',help:'Un processus présent à 0 % CPU peut attendre. Ce relevé ne prouve pas la cause du blocage.',cta:'Réparer le tableau de score'},
  {id:'incident-code',chapter:'m6',kind:'code',phase:'Dossier C · 10 min',title:'Le score n’apparaît pas.',task:'Lance le code, lis l’erreur, corrige le nom incohérent puis relance. Ne repars pas de zéro.',help:'Compare le nom déclaré sur la première ligne avec celui utilisé à la fin. Tu n’as pas besoin de réécrire la ligne d’affichage.',cta:'Préparer ma preuve'},
  {id:'bilan',chapter:'bilan',kind:'text',field:'bilan',phase:'Restituer · 5 min',title:'Montre ta preuve en 30 secondes.',task:'Choisis un incident. Complète : « J’ai vu… J’ai testé… J’ai vérifié… ».',placeholder:'J’ai vu…\nJ’ai testé…\nJ’ai vérifié…',help:'Un résultat correct sans explication ne suffit pas. Appuie-toi sur l’erreur et le résultat de ton test.',cta:'Faire mon ticket seul'},
  {id:'ticket-1',chapter:'ticket',kind:'text',field:'t1',phase:'Seul · question 1/4',title:'Qui commence ?',task:'Qui intervient d’abord : le firmware ou l’OS ? Que lance le chargeur ?',placeholder:'Le… intervient d’abord. Le chargeur lance…',cta:'Question suivante'},
  {id:'ticket-2',chapter:'ticket',kind:'text',field:'t2',phase:'Seul · question 2/4',title:'À quoi sert l’OS ?',task:'Donne deux responsabilités de l’OS vues dans les activités.',placeholder:'Il… et il…',cta:'Question suivante'},
  {id:'ticket-3',chapter:'ticket',kind:'text',field:'t3',phase:'Seul · question 3/4',title:'VS Code est fermé.',task:'La page est encore ouverte. Qui exécute son JavaScript ?',placeholder:'C’est…',cta:'Dernière question'},
  {id:'ticket-4',chapter:'ticket',kind:'text',field:'t4',phase:'Seul · question 4/4',title:'Où cherches-tu d’abord ?',task:'Une page a une erreur JavaScript. La Calculatrice répond. Que regardes-tu en premier, et pourquoi ?',placeholder:'Je regarde… parce que…',cta:'Terminer mon ticket'},
  {id:'fin',chapter:'fin',kind:'finish',phase:'Conserver et remettre · 5 min',title:'Tu sais mieux où regarder.',task:'Relis ton bilan, garde la fiche mémo et remets ton travail à l’endroit indiqué par le professeur.',cta:'Voir mon bilan'},
];
