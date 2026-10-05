/** /20, six competencies, same shape/thresholds as the user-provided template.
 * v2: all indicators derive from source code, not multiple-choice answers.
 */
export const RUBRIC_VERSION='fonctions-261001-pratique-v2';
export const CRITERIA=[
 {id:'C1',label:'Déclarer une fonction',max:4,a1:2,a2:3},
 {id:'C2',label:'Appeler une fonction',max:3,a1:2,a2:3},
 {id:'C3',label:'Utiliser paramètres et arguments',max:4,a1:2,a2:3},
 {id:'C4',label:'Afficher avec console.log',max:3,a1:2,a2:3},
 {id:'C5',label:'Renvoyer une valeur avec return',max:3,a1:2,a2:3},
 {id:'C6',label:'Garder puis réutiliser le retour',max:3,a1:2,a2:3}
];
export const ITEMS=[
 ['1.1','C1','annoncerDepart est déclarée, sans paramètre.','diag-demarrer'],
 ['1.2','C1','saluer est déclarée avec un paramètre.','diag-saluer'],
 ['1.3','C1','doubler est déclarée avec un paramètre.','diag-doubler'],
 ['1.4','C1','additionner est déclarée avec deux paramètres.','diag-retour'],
 ['2.1','C2','annoncerDepart est effectivement appelée dans le programme.','diag-demarrer'],
 ['2.2','C2','saluer est appelée avec l’argument Nora.','diag-saluer'],
 ['2.3','C2','saluer est appelée avec l’argument Sami.','diag-saluer'],
 ['3.1','C3','Le message de saluer s’adapte à Nora, Sami et Lina.','diag-saluer'],
 ['3.2','C3','doubler s’adapte aux arguments 6 et 9 : 12 et 18.','diag-doubler'],
 ['3.3','C3','Le premier argument d’additionner est utilisé : 2+3 et 4+3.','diag-retour'],
 ['3.4','C3','Le second argument d’additionner est utilisé : 2+3 et 2+7.','diag-retour'],
 ['4.1','C4','L’appel annoncerDepart affiche une fois La partie commence.','diag-demarrer'],
 ['4.2','C4','console.log affiche la variable scoreDouble : 12.','diag-doubler'],
 ['4.3','C4','console.log affiche les variables total puis totalSuivant : 5 et 9.','diag-retour'],
 ['5.1','C5','doubler(6) renvoie le nombre 12, pas seulement un affichage.','diag-doubler'],
 ['5.2','C5','additionner(2,3) renvoie le nombre 5 avec un retour.','diag-retour'],
 ['5.3','C5','additionner(0,0) renvoie le nombre 0, pas undefined ou du texte.','diag-retour'],
 ['6.1','C6','scoreDouble reçoit effectivement le résultat de doubler(6).','diag-doubler'],
 ['6.2','C6','total reçoit effectivement le résultat d’additionner(2,3).','diag-retour'],
 ['6.3','C6','total est réutilisé comme argument ; totalSuivant reçoit 9.','diag-retour']
].map(([id,criterion,label,step])=>({id,criterion,label,step,max:1}));
export const GLOBAL_THRESHOLDS={NA:0,EC:5,A1:10,A2:15};
export function globalLevel(total){return total==null?'NE':total>=15?'A2':total>=10?'A1':total>=5?'EC':'NA';}
export function aggregate(items){let pending=items.filter(i=>i.point==null).length;const earned=items.reduce((s,i)=>s+(i.point??0),0);return {earned,pending,total:pending?null:earned,level:pending?'NE':globalLevel(earned),criteria:CRITERIA.map(c=>{const points=items.filter(i=>i.criterion===c.id);const total=points.some(i=>i.point==null)?null:points.reduce((a,i)=>a+i.point,0);return {...c,points:total,level:total==null?'NE':total>=c.a2?'A2':total>=c.a1?'A1':total>0?'EC':'NA'};})};}
