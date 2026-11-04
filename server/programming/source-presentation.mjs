// Reviewed declarative text from the source lesson.js. No imported script is evaluated.
// Keep the presentation in the portable lesson so imported courses remain editable.
export function tableauxPresentation() {
 const names=['Je réactive','Je découvre et j’essaie','Je m’entraîne','Je réalise','Je retiens'];
 const leads=['','Lis, prévois et observe ce que fait chaque ligne.','Change une chose. Compare ton résultat à ta prévision.','Construis une solution et vérifie-la sur plusieurs cas.','Retrouve les mots, prends des décisions et conserve ton travail.'];
 const rows=[
  ['for','Tu écris le départ, le test et l’évolution.','Condition, break ou return de la fonction.'],
  ['while','Tu écris le test ; l’évolution doit être prévue.','Condition, break ou return de la fonction.'],
  ['forEach','La méthode appelle ton callback pour les éléments présents.','Un return du callback ne termine pas le parcours. Choisis une autre écriture si nécessaire.']
 ];
 return {
  theme:'array-lab',
  sessionLabels:[{id:'s1',title:'Parcourir et compter'},{id:'s2',title:'Rechercher et décomposer'}],
  headings:[1,2].flatMap(session=>names.map((title,i)=>({blockId:`s${session}-bloc-${i+1}`,title,lead:i?leads[i]:session===1?'Une liste de batteries. Un programme pour préparer la flotte.':'Retrouve tes repères, puis choisis comment parcourir la flotte.'}))),
  openings:[
   {blockId:'s1-bloc-1',tag:'MISSION FLOTTE · PARCOURIR ET COMPTER',title:'Quels drones peuvent partir ?',paragraphs:['La flotte possède quatre drones. Chaque nombre indique une batterie. Un drone est prêt à partir de 50 %, valeur incluse.','Ton programme doit compter les drones prêts, même quand la liste change.'],actionLabel:'Observer la première case',nextBlockId:'s1-bloc-2',arrayName:'batteries',values:[35,80,20,65],stats:[{value:'4',label:'drones au total'},{value:'2',label:'prêts à partir de 50 %'},{value:'1',label:'indice du premier prêt'}],caption:'L’indice 1 désigne le deuxième drone, dont la batterie vaut 80.',note:'Avant de coder : désigne une case, son indice et sa valeur. Les fonctions des premiers exemples sont fournies ; tu apprendras ensuite à les déclarer et à les appeler.'},
   {blockId:'s2-bloc-1',tag:'MISSION FLOTTE · RECHERCHER ET DÉCOMPOSER',title:'Trouver le bon drone. Réutiliser son code.',paragraphs:['Un parcours complet et une recherche du premier résultat ne répondent pas au même besoin. Tu vas comparer leurs étapes et assembler tes fonctions.','Le bilan final réunit trois informations : nombre total, nombre de drones prêts et indice du premier prêt.'],actionLabel:'Reprendre avec une recherche',nextBlockId:'s2-bloc-2',arrayName:'batteries',values:[35,80,20,65],stats:[{value:'4',label:'drones au total'},{value:'2',label:'prêts à partir de 50 %'},{value:'1',label:'indice du premier prêt'}],caption:'L’indice 1 désigne le deuxième drone, dont la batterie vaut 80.',note:'Sans le cours : explique où commencent les indices, à quoi sert le compteur et ce qui fait avancer une boucle. Une difficulté ? Reprends le mémo avant la suite.'}
  ],
  summaries:[
   {blockId:'s1-bloc-5',note:'À la prochaine séance : retrouve les étapes du for et la différence entre paramètre et argument avant de rouvrir le mémo.',actionLabel:'Passer à la séance 2',nextBlockId:'s2-bloc-1'},
   {blockId:'s2-bloc-5',note:'Pour vérifier ce qui reste acquis : reprends plus tard le défi « Serre », avec de nouvelles données et une règle différente.',actionLabel:'Ouvrir le transfert différé',nextBlockId:'s2-bloc-4',nextActivityId:'a10-transfert'}
  ],
  memo:[
   {title:'Indice, valeur et taille',paragraphs:['Dans [35,80,20,65], les indices vont de 0 à 3. batteries[1] vaut 80 ; batteries.length vaut 4. Le dernier indice d’un tableau non vide vaut length - 1.']},
   {title:'Un parcours for',code:'for (let i = 0; i < batteries.length; i++) {\n  console.log(batteries[i]);\n}',paragraphs:['Initialisation une fois → condition → corps si vrai → évolution → nouveau test. Le compteur des éléments retenus est distinct de l’indice qui parcourt les cases.']},
   {title:'Déclaration, paramètres et arguments',code:'function estPret(batterie, seuil) {\n  return batterie >= seuil;\n}\nconst resultat = estPret(80, 50);',paragraphs:['batterie et seuil sont les paramètres. Dans cet appel, 80 et 50 sont les arguments. return transmet la valeur true à l’appelant. console.log sert à afficher.']},
   {title:'Choisir le parcours',paragraphs:[],table:{headers:[],rows:[['for','Départ, condition et évolution réunis dans l’en-tête.'],['while','Répéter tant que la condition est vraie ; prévoir ce qui la fait évoluer.'],['forEach','Appeler une fonction pour les éléments présents du tableau. Son callback reçoit valeur, indice, tableau. Un return quitte ce callback, pas le parcours.']]}},
   {title:'Trois tests utiles',paragraphs:['Liste vide ; valeur exactement à la limite ; résultat trouvé au premier ou au dernier indice, ou absent. Pour une recherche d’indice, 0 est un résultat valide et -1 peut signaler l’absence selon le contrat choisi.']},
   {title:'Décomposer',paragraphs:['Une fonction compte. Une autre recherche. Une troisième appelle les deux et réunit leurs résultats. Chaque fonction doit fonctionner avec d’autres arguments.']}
  ],
  comparisons:[{id:'compare-traversals',description:'Les trois programmes ci-dessous comptent les batteries à partir de 50 %. Choisis une écriture, puis suis ses lectures et ses changements de compteur.',headers:['Écriture','Qui organise le parcours ?','Pour s’arrêter avant la fin'],rows,rules:[
   {id:'for',text:'L’incrémentation est écrite dans l’en-tête et se fait après le corps.'},
   {id:'while',text:'L’incrémentation est écrite dans le corps. Son oubli peut empêcher la boucle de terminer.'},
   {id:'forEach',text:'Le callback reçoit la valeur puis l’indice. forEach renvoie undefined ; la fonction compter renvoie nombre.'}
  ]}],
  workshop:{reflectionLabel:'Ma trace : j’attendais… / j’ai observé… / j’ai corrigé…',reflectionPlaceholder:'Explique une décision ou une correction avec un exemple précis.',continueNote:'Enregistre une explication, même si ton programme ne fonctionne pas encore.',transferNote:'À reprendre lors d’une prochaine séance, sans correction sous les yeux. La règle change : une température égale au minimum ne déclenche pas d’alerte.',transferContinueNote:'Garde cette production comme nouvelle preuve individuelle.',predictionContext:'Modifier les données ou le code ne change pas cette question.'},
  assessmentNote:'Les réponses aux QCM et aux textes à trous complètent ton programme. Le professeur observe aussi ta démarche, ton explication et l’aide utilisée.'
 };
}
