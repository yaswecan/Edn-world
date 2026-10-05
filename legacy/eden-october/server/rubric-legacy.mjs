/** Grille ADAPTÉE au diagnostic fonctions ; structure et seuils du modèle CSS fourni.
 * Les anciens critères CSS et les données des élèves ne sont jamais redistribués.
 */
export const RUBRIC_VERSION='fonctions-261001-v1';
export const CRITERIA=[
 {id:'C1',label:'Déclarer une fonction',max:4,a1:2,a2:3},
 {id:'C2',label:'Appeler une fonction',max:3,a1:2,a2:3},
 {id:'C3',label:'Distinguer paramètre et argument',max:4,a1:2,a2:3},
 {id:'C4',label:'Afficher avec console.log',max:3,a1:2,a2:3},
 {id:'C5',label:'Renvoyer une valeur avec return',max:3,a1:2,a2:3},
 {id:'C6',label:'Récupérer le retour dans une variable',max:3,a1:2,a2:3}
];
export const ITEMS=[
 ['1.1','C1','Une fonction nommée saluer est déclarée.','diag-saluer'],
 ['1.2','C1','saluer possède un paramètre.','diag-saluer'],
 ['1.3','C1','Une fonction nommée additionner est déclarée.','diag-retour'],
 ['1.4','C1','additionner possède deux paramètres.','diag-retour'],
 ['2.1','C2','saluer est appelée avec l’argument « Nora ».','diag-saluer'],
 ['2.2','C2','saluer est appelée avec l’argument « Sami ».','diag-saluer'],
 ['2.3','C2','additionner est appelée avec 2 et 3.','diag-retour'],
 ['3.1','C3','Dans la déclaration de doubler, nombre est identifié comme paramètre.','diag-lire'],
 ['3.2','C3','Dans doubler(6), 6 est identifié comme argument.','diag-lire'],
 ['3.3','C3','Le nombre de paramètres de doubler est identifié : un.','diag-lire'],
 ['3.4','C3','Avec doubler(9), nombre reçoit la valeur 9.','diag-lire'],
 ['4.1','C4','La sortie console du programme fourni est prévue : 12.','diag-lire'],
 ['4.2','C4','saluer affiche le message avec le prénom reçu, pour deux prénoms testés.','diag-saluer'],
 ['4.3','C4','console.log affiche la variable total (valeur 5).','diag-retour'],
 ['5.1','C5','additionner utilise return pour renvoyer une valeur.','diag-retour'],
 ['5.2','C5','additionner(2, 3) renvoie le nombre 5, pas seulement un affichage.','diag-retour'],
 ['5.3','C5','Le retour dépend des paramètres : 4 + 7 → 11 et 0 + 0 → 0.','diag-retour'],
 ['6.1','C6','La valeur stockée dans resultat du code fourni est prévue : 12.','diag-lire'],
 ['6.2','C6','Le résultat de l’appel additionner(2, 3) est affecté à total.','diag-retour'],
 ['6.3','C6','Après exécution, total contient le nombre 5, pas undefined.','diag-retour']
].map(([id,criterion,label,step])=>({id,criterion,label,step,max:1}));
export const GLOBAL_THRESHOLDS={NA:0,EC:5,A1:10,A2:15};
export function globalLevel(total){return total==null?'NE':total>=15?'A2':total>=10?'A1':total>=5?'EC':'NA';}
export function aggregate(items){let pending=items.filter(i=>i.point==null).length;const earned=items.reduce((s,i)=>s+(i.point??0),0);return {earned,pending,total:pending?null:earned,level:pending?'NE':globalLevel(earned),criteria:CRITERIA.map(c=>{const points=items.filter(i=>i.criterion===c.id);const total=points.some(i=>i.point==null)?null:points.reduce((a,i)=>a+i.point,0);return {...c,points:total,level:total==null?'NE':total>=c.a2?'A2':total>=c.a1?'A1':total>0?'EC':'NA'};})};}
