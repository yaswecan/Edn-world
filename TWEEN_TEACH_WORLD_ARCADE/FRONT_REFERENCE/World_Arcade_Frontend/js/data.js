/* All players, scores and class labels in this standalone prototype are fictional. */
'use strict';
window.ArcadeData = (() => {
 const ranks = [
  { id:'rookie',name:'Rookie',color:'#b9a4ff', symbol:1, description:'La première étincelle. Apprends les commandes et termine tes premières missions.' },
  { id:'explorer',name:'Explorer',color:'#61dcff', symbol:2, description:'Sors des sentiers battus. Explore, expérimente et répare.' },
  { id:'operator',name:'Operator',color:'#64e5ad', symbol:3, description:'Prends les commandes. Tes solutions remettent le monde en mouvement.' },
  { id:'specialist',name:'Specialist',color:'#edcd7f', symbol:4, description:'Affine ton savoir-faire et relève des missions plus exigeantes.' },
  { id:'vanguard',name:'Vanguard',color:'#ff9873', symbol:5, description:'Ouvre la voie et résous des défis à plusieurs étapes.' },
  { id:'elite',name:'Elite',color:'#eb9ae6', symbol:6, description:'Fais la différence grâce à des solutions solides et précises.' },
  { id:'phantom',name:'Phantom',color:'#aba7ff', symbol:7, description:'Maîtrise les systèmes et trouve la solution que personne n’avait vue.' },
  { id:'legend',name:'Legend',color:'#ffdb8b', symbol:8, description:'Laisse ton empreinte dans chaque univers.' },
  { id:'prestige',name:'Prestige',color:'#fa7696', symbol:9, description:'Le sommet de l’arcade. Un nouveau départ pour aller encore plus loin.' }
 ];
 const raw = [
  ['nova', 'Nova',1,'specialist','II',12450,45120,86240,'class',true],
  ['orbit','Orbit',2,'operator','III',11280,39560,92480,'community',true],
  ['pixel','Pixel',3,'explorer','III',10900,41020,78900,'class',false],
  ['echo','Echo',4,'operator','I',9760,35010,64320,'class',true],
  ['glitch','Glitch',5,'explorer','II',8430,32050,57840,'community',false],
  ['cosmo','Cosmo',6,'explorer','I',7240,28900,46150,'class',true],
  ['ember','Ember',7,'rookie','III',6800,27100,38750,'class',false],
  ['byte','Byte',8,'rookie','II',6350,26400,42360,'class',false],
  ['atlas','Atlas',9,'explorer','I',5980,22300,38460,'community',true],
  ['onyx','Onyx',10,'rookie','III',5260,18900,32600,'class',true],
  ['flux','Flux',11,'rookie','II',4780,17340,28700,'class',false],
  ['vector','Vector',12,'rookie','II',4260,16450,24590,'community',false],
  ['lumi','Lumi',13,'rookie','III',3940,15350,21900,'class',true],
  ['astro','Astro',14,'rookie','I',3320,13300,19800,'class',false],
  ['ruby','Ruby',15,'rookie','II',2850,12180,17750,'community',true],
  ['koda','Koda',2,'rookie','I',2100,8450,15420,'class',false],
  ['zero','Zero',4,'rookie','I',1540,7200,13840,'class',false],
  ['mika','Mika',13,'rookie','I',980,6340,11200,'community',false]
 ];
 const players = raw.map((p,i)=>({id:p[0],name:p[1],avatar:p[2],rank:p[3],division:p[4],scores:{week:p[5],month:p[6],all:p[7]},scope:p[8],online:p[9],missions:Math.max(3,34-i*2),world:i%3===0?'cyber-funk':'code-station'}));
 const games = [
  {id:'code-station',number:'01',title:'CODE STATION',short:'Code Station',eyebrow:'L’ODYSSÉE HÉLIX',tag:'EXPLORATION · LOGIQUE',description:'Le signal est perdu. À toi de rallumer la station.',image:'assets/code-station.webp',color:'#5fe2fb',className:'cyan',chapter:'Pont 01 — Le réveil',keys:'FLÈCHES + E',mission:'Répare les trois terminaux, puis rejoins le sas.',details:'Explore une station spatiale, remets ses terminaux en service et ouvre le sas. Cette mini-mission autonome illustre le lanceur ; elle ne remplace pas ton jeu Code Station existant.'},
  {id:'cyber-funk',number:'02',title:'CYBER FUNK 3026',short:'Cyber Funk 3026',eyebrow:'BIENVENUE À NEO EDEN',tag:'PLATEFORME · EXPLORATION',description:'La ville ne dort jamais. Trouve ton propre chemin.',image:'assets/cyber-funk.webp',color:'#ff537f',className:'pink',chapter:'District 01 — Neon Run',keys:'← → + ESPACE',mission:'Récupère les cinq fragments et rejoins le portail.',details:'Traverse les toits de Neo Eden, saute entre les plateformes et récupère cinq fragments. Cette courte démo de plateforme est une proposition de gameplay, pas une intégration d’un jeu externe.'}
 ];
 const glyphs = {
  A:['01110','11011','11011','11111','11011','11011','11011'],
  D:['11110','11011','11011','11011','11011','11011','11110'],
  E:['11111','11000','11000','11110','11000','11000','11111'],
  N:['11011','11111','11111','11011','11011','11011','11011'],
  W:['11011','11011','11011','11011','11111','11111','01010'],
  O:['01110','11011','11011','11011','11011','11011','01110'],
  R:['11110','11011','11011','11110','11100','11010','11011'],
  L:['11000','11000','11000','11000','11000','11000','11111'],
  C:['01111','11000','11000','11000','11000','11000','01111']
 };
 function pixelText(text){
  const chars=[...text.toUpperCase()];let paths='';
  chars.forEach((char,i)=>{(glyphs[char]||glyphs.E).forEach((row,y)=>{[...row].forEach((cell,x)=>{if(cell==='1') paths+=`M${i*6+x} ${y}h1v1h-1Z`;});});});
  return `<svg viewBox="0 0 ${chars.length*6-1} 7" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="${paths}"/></svg>`;
 }
 return {ranks,players,games,pixelText,avatar:(number)=>`assets/avatars/${String(number).padStart(2,'0')}.webp`};
})();
