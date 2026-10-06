// Tween Teach adaptations; these are not official methods or imported courses.
export const mechanisms=[
 {id:'problem-project',inspiration:'NX Academy',use:'Sélectionner et ordonner les notions nécessaires à un problème concret.',prerequisites:['Objectif observable','Temps de pratique disponible'],help:['Exemple travaillé','Rappel ciblé'],production:'Une solution justifiée au problème initial.',success:['Chaque notion sert une décision','Les reports sont explicités']},
 {id:'visible-mechanism',inspiration:'C’est pas sorcier',use:'Comprendre une relation causale ou un système.',prerequisites:['Situation observable'],help:['Schéma légendé','Comparaison avant/après'],production:'Une prédiction et une explication causale.',success:['Acteurs, actions et conséquences visibles','Limite de l’analogie explicitée']},
 {id:'tested-kata',inspiration:'Codewars',use:'Consolider une opération de programmation.',prerequisites:['Syntaxe utilisée déjà expliquée'],help:['Cas public','Indice local','Exemple partiel après tentative'],production:'Programme, cas limites et justification ; comparaison de solutions après essai.',success:['Tests conformes à l’énoncé','Solution alternative lisible acceptée','Transfert distinct']},
 {id:'investigation',inspiration:'TryHackMe',use:'Diagnostiquer et réparer un défaut plausible.',prerequisites:['Environnement préparé','Documentation accessible'],help:['Observation','Hypothèse à tester','Indice local'],production:'Réparation avec preuve et explication.',success:['Validation sur le résultat réel','Défi final moins guidé']},
 {id:'terminal-stages',inspiration:'OverTheWire',use:'Devenir autonome au terminal.',prerequisites:['Laboratoire isolé réel','Fichiers de départ'],help:['man/help','Indice progressif','Débrief'],production:'État des fichiers vérifié par le serveur et justification.',success:['Aucun mot de passe public','Validation indépendante','Transfert ultérieur']},
 {id:'fading-project',inspiration:'Codecademy',use:'Mobiliser plusieurs acquis avec une aide décroissante.',prerequisites:['Acquis mobilisés explicités'],help:['Exemple guidé','Variante','Critères et ressources du projet'],production:'Mini-projet autonome et choix argumenté.',success:['Contraintes claires','Décisions laissées à l’élève','Ni simple copie ni changement de noms']}
];
export const runtimeProfiles=[
 {id:'html-css',label:'Intégration HTML/CSS',engine:'opaque-iframe',limits:'Sans scripts ni réseau ; contrôles structurels et inspection du rendu.'},
 {id:'algorithm',label:'Programmation',engine:'eden-interpreter',limits:'Sous-ensemble JavaScript borné ; syntaxe non supportée = observation insuffisante.'},
 {id:'dom',label:'Front-end interactif',engine:'isolated-lab',limits:'Laboratoire externe requis pour les tests de comportements DOM.'},
 {id:'shell-git',label:'Shell/Git',engine:'isolated-lab',limits:'Service de laboratoire externe authentifié ; jamais de shell applicatif.'},
 {id:'concepts',label:'Systèmes et concepts',engine:'native',limits:'Schémas et manipulations sans code artificiel.'}
];
