import {activity} from './activity.mjs';

const task=(id,title,instruction,extra={})=>activity(id,title,instruction,[],{duration:5,...extra});

function startingTasks(nodes,library){
 // A baseline probes starting knowledge; it never creates evidence for a lesson
 // that has not actually taken place. Its rubric therefore stays « baseline ».
 const prerequisites=[...new Set(nodes.flatMap(n=>n.prerequisiteCodes||[]))];
 const resources=prerequisites.map(code=>library.find(r=>r.code===code)).filter(Boolean);
 if(resources.length){
  const tasks=resources.slice(0,2).flatMap((r,i)=>{
   const q=r.questions?.[0];
   return [
    ...(q? [task(`baseline-${i}-repere`,r.skillLabel,q.prompt,{type:'Quiz',options:[...q.distractors,q.correct],correctionMode:'exact',expectedAnswer:q.correct,reference:`${q.correct}. ${q.feedback}`,expectedEvidence:'Un choix cohérent avec la situation.'})]:[]),
    task(`baseline-${i}-application`,`Mets en pratique · ${r.skillLabel}`,`${r.transfer}\nExplique ton choix avec un exemple concret.`,{reference:`${r.lesson}\nVérifier l’application à la situation et l’exemple proposé.`,expectedEvidence:'Une réponse appliquée au cas et un exemple expliqué.'})
   ];
  });
  if(tasks.length>=2)return tasks;
 }
 if(nodes.some(n=>/^BC04-C2-/.test(n.n3_code))){
  return [
   task('baseline-html','Retrouve la structure HTML','La carte doit contenir un titre principal « Mon projet » et un paragraphe « Première version ». Remplace les deux div par les balises adaptées.',{type:'CodeEditor',starter:'<div>Mon projet</div>\n<div>Première version</div>',correctionMode:'html',tests:[{invoke:'h1',argsJSON:'{"tag":"h1","text":"Mon projet"}',expectedJSON:'true'},{invoke:'p',argsJSON:'{"tag":"p","text":"Première version"}',expectedJSON:'true'}],reference:'<h1>Mon projet</h1>\n<p>Première version</p>',expectedEvidence:'Un titre h1 et un paragraphe p contenant les textes demandés.',workshop:{language:'html'}}),
   task('baseline-css','Cible la bonne carte','Le HTML contient <article class="carte">Mon projet</article>. Écris une règle CSS qui colore uniquement les éléments de classe carte en bleu (blue).',{type:'CodeEditor',starter:'/* Écris ta règle ici. */',correctionMode:'css',tests:[{invoke:'.carte',argsJSON:'{"selector":".carte","property":"color","value":"blue"}',expectedJSON:'true'}],reference:'.carte { color: blue; }',expectedEvidence:'Un sélecteur de classe et une déclaration de couleur valides.',workshop:{language:'css',document:'<article class="carte">Mon projet</article><p>Autre texte</p>'}}),
   task('baseline-verification','Prépare un test de ta page','La carte semble correcte sur un grand écran. Propose deux essais pour vérifier qu’elle reste lisible : indique ce que tu changes et ce que tu observes.',{reference:'Essayer une fenêtre étroite et un texte plus long. Vérifier que tout le contenu reste lisible, sans chevauchement ni texte coupé. Accepter d’autres essais justifiés.',expectedEvidence:'Deux essais distincts, avec une modification et un résultat à observer.'})
  ];
 }
 if(nodes.some(n=>/^BC05-C1-[2-9]$/.test(n.n3_code))){
  return [
   task('baseline-valeurs','Suis les valeurs','Sans exécuter ce code, indique la valeur finale de chaque variable.\nlet score = 3;\nscore = score + 2;\nconst bonus = score * 2;',{type:'FillBlank',options:['Valeur finale de score','Valeur finale de bonus'],correctionMode:'structured',expectedAnswer:'{"0":"5","1":"10"}',reference:'score vaut 5, puis bonus vaut 10.',expectedEvidence:'Les deux valeurs finales.'}),
   task('baseline-condition','Applique une règle','Une entrée est autorisée à partir de 12 ans. Pour les âges 11, 12 et 13, écris « oui » ou « non ».',{type:'FillBlank',options:['11 ans','12 ans','13 ans'],correctionMode:'structured',expectedAnswer:'{"0":"non","1":"oui","2":"oui"}',reference:'11 : non ; 12 : oui ; 13 : oui. La limite de 12 ans est incluse.',expectedEvidence:'Trois décisions, dont le cas à la limite.'}),
   task('baseline-erreur','Repère et explique une erreur','Un programme ajoute un bonus de 2 points à un score de 3, mais affiche 32. Quel résultat attendais-tu ? Propose une cause possible et un essai pour la vérifier.',{reference:'Résultat attendu : 5. Une valeur peut être traitée comme du texte et être concaténée. Vérifier le type ou comparer le calcul avec deux nombres. Relire toute autre hypothèse testable.',expectedEvidence:'Le résultat attendu, une hypothèse et un test précis.'})
  ];
 }
 return [
  task('baseline-ordre','Organise une procédure','Une image doit être modifiée puis remise. Numérote ces actions dans l’ordre : A — vérifier le fichier exporté ; B — ouvrir l’image source ; C — envoyer le fichier vérifié ; D — modifier l’image et exporter une copie.',{type:'FillBlank',options:['Rang de A','Rang de B','Rang de C','Rang de D'],correctionMode:'structured',expectedAnswer:'{"0":"3","1":"1","2":"4","3":"2"}',reference:'B → D → A → C : ouvrir, modifier et exporter, vérifier, envoyer.',expectedEvidence:'Quatre actions organisées dans un ordre exécutable.'}),
  task('baseline-observation','Compare la demande au résultat','La consigne demande un fichier nommé affiche.png de 800 × 600 pixels. Tu obtiens affiche.jpg de 600 × 800 pixels. Identifie les deux écarts et les corrections à effectuer.',{reference:'Le format doit passer de JPG à PNG ; les dimensions doivent devenir largeur 800 et hauteur 600. Réexporter puis contrôler le fichier obtenu.',expectedEvidence:'Les deux écarts et une correction pour chacun.'}),
  task('baseline-test','Vérifie avant de remettre','Le fichier fonctionne sur ton ordinateur. Décris un essai pour vérifier qu’une autre personne pourra aussi l’ouvrir. Précise le résultat attendu et ce que tu ferais en cas d’échec.',{reference:'Ouvrir la copie transmise sur un autre poste ou avec l’outil prévu. Attendre un fichier lisible et complet. En cas d’échec, contrôler le format et le fichier envoyé puis refaire l’essai.',expectedEvidence:'Un essai reproductible, un résultat attendu et une action en cas d’échec.'})
 ];
}

export function buildDiagnostic(previous,sourceLesson,nodes,lessonId,library=[]){
 const baseline=!previous;
 let tasks;
 if(baseline)tasks=startingTasks(nodes,library);
 else{
  const allowed=new Set([...previous.coveredSkills,...(previous.reactivatedPrerequisites||[])]);
  const candidates=(sourceLesson?.activities||[]).filter(a=>a.skills.length&&a.skills.every(c=>allowed.has(c))&&(!previous.coveredActivityIds?.length||previous.coveredActivityIds.includes(a.id))&&a.correctionMode!=='none');
  // Cover distinct worked criteria before taking another task for the same one.
  const selected=[],covered=new Set();
  for(const a of candidates)if(selected.length<4&&a.skills.some(c=>!covered.has(c))){selected.push(a);a.skills.forEach(c=>covered.add(c));}
  for(const a of candidates)if(selected.length<4&&!selected.includes(a))selected.push(a);
  tasks=selected.map((a,i)=>({...structuredClone(a),id:`diag-${i}`,duration:5,required:true}));
  if(!tasks.length)for(const [i,c] of previous.coveredSkills.slice(0,3).entries())tasks.push(task(`diag-${i}`,library.find(r=>r.code===c)?.skillLabel||`Exercice ${i+1}`,`Reproduis une partie de la production réellement travaillée : ${previous.coveredContent}. Explique ta démarche.`,{skills:[c],reference:`Relire selon le critère ${c} et le contenu réalisé le ${previous.date} : ${previous.coveredContent}.`,expectedEvidence:'Une production issue de la séance réalisée et une démarche expliquée.'}));
  if(tasks.length===1)tasks.push(task('diag-verification','Vérifie ta démarche',`À partir de la production travaillée lors de la séance précédente (${previous.coveredContent}), décris un test : situation de départ, résultat attendu et erreur qu’il permettrait de repérer.`,{skills:[tasks[0].skills[0]],reference:`Vérifier que le test porte sur le contenu réellement travaillé : ${previous.coveredContent}, avec une entrée et un résultat cohérents.`,expectedEvidence:'Un test précis du travail précédent et une erreur qu’il permet de détecter.'}));
 }
 const criteria=[...new Set(tasks.flatMap(a=>a.skills))];
 const share=(total,count,index)=>Math.floor(total/count)+(index<total%count?1:0);
 const rubric=tasks.flatMap((t,i)=>{
  const skills=t.skills.length?[...new Set(t.skills)]:['baseline'];
  return skills.map((criterion,j)=>{const max=share(share(2000,tasks.length,i),skills.length,j)/100;return {id:`item-${i}-${j}`,taskId:t.id,criterion,label:t.expectedEvidence,max,a1:max/2,a2:max*0.75};});
 });
 return {id:`${lessonId}:diagnostic`,kind:baseline?'baseline':'previous_lesson',sourceLessonRunId:previous?.id||null,sourceLessonVersion:previous?.lessonVersionId||null,duration:tasks.reduce((n,t)=>n+t.duration,0),criteria,tasks,rubric};
}

export function diagnosticChecks(spec){
 const d=spec.diagnostic||{},tasks=d.tasks||[],rubric=d.rubric||[],criteria=d.criteria||[];
 const blocks=spec.blocks.filter(b=>b.type==='Diagnostic');
 const skills=[...new Set(tasks.flatMap(t=>t.skills))];
 return [
  {id:'diagnostic_tasks',ok:tasks.length>=2&&tasks.length<=4&&tasks.every(t=>t.required&&t.correctionMode!=='none'&&t.instruction.trim()&&t.expectedEvidence.trim()&&t.reference.trim()),message:'Évaluation diagnostique obligatoire : 2 à 4 tâches avec consignes, traces attendues et corrigés'},
  {id:'diagnostic_timing',ok:d.duration>=10&&d.duration<=20&&tasks.reduce((n,t)=>n+t.duration,0)===d.duration&&blocks.length===1&&blocks[0].minutes===d.duration,message:'Diagnostic de 10 à 20 minutes intégré au déroulé'},
  {id:'diagnostic_coverage',ok:tasks.length>0&&tasks.every(t=>(t.skills.length?t.skills:['baseline']).every(c=>rubric.some(r=>r.taskId===t.id&&r.criterion===c)))&&criteria.length===skills.length&&skills.every(c=>criteria.includes(c)),message:'Chaque tâche et chaque critère du diagnostic sont couverts par le barème'},
  {id:'diagnostic_flow',ok:blocks.length===1&&spec.studentFlow.filter(id=>id===blocks[0].id).length===1,message:'Diagnostic accessible dans le parcours de chaque séance'}
 ];
}
