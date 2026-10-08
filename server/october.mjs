import {LESSON} from '../legacy/eden-october/docs/app/content.js';
import {EXERCISES} from '../legacy/eden-october/docs/app/exercises.js';
import {block as lessonBlock,teaching} from './lesson-structure.mjs';
const functionReferences={
 major:'function estMajeur(age) { return age >= 18; }',
 play:'function peutJouer(age, accord) { return age >= 14 && accord; }',
 entry:'function peutEntrer(ticket, invitation, ferme) { return (ticket || invitation) && !ferme; }',
 advanced:'function accesParc(age, ticket, accompagne, ferme) { return ticket && !ferme && (age >= 14 || accompagne); }'
};
export function octoberContent(entry){
 if(entry.resourcePack!==LESSON.id||!LESSON.skills.every(c=>entry.skills.includes(c))||entry.duration<175)return null;
 const activities=[],blocks=[];
 const make=(step,extra={})=>({id:step.id,type:'WriteResponse',title:step.title,instruction:[step.task,step.prompt,step.code].filter(Boolean).join('\n'),objective:step.title,skills:LESSON.skills,expectedEvidence:'Production, cas testés et justification.',duration:Math.max(1,step.minutes||5),required:!step.optional,correctionMode:'manual',expectedAnswer:'',reference:[step.takeaway,step.hint,...(step.checks||[])].filter(Boolean).join('\n')||'Vérifier la logique, les cas limites et la justification de l’élève.',starter:step.starter||'',options:[],tests:[],...extra});
 for(const block of LESSON.blocks){
  if(block.id==='diagnostic'){blocks.push({id:'diagnostic',type:'Diagnostic',title:'Évaluation',content:'Produis une réponse autonome avant la correction.',minutes:20,activityIds:[],skills:[]});continue;}
  const steps=LESSON.steps.filter(s=>s.block===block.id),ids=[];
  for(const step of steps){
   if(step.kind==='pause')continue;
   if(step.questions){for(const q of step.questions){const a=make(step,{id:`${step.id}-${q.id}`,type:'Quiz',instruction:[step.task,step.code,q.text].filter(Boolean).join('\n'),options:q.choices,correctionMode:q.answer!==undefined?'exact':'manual',expectedAnswer:q.answer===undefined?'':String(q.answer),reference:q.why||'Comparer la réponse et le raisonnement au critère observable.'});activities.push(a);ids.push(a.id);}}
   else if(['truth','circuit'].includes(step.kind)){
    const cases=Array.from({length:2**step.inputs.length},(_,n)=>step.inputs.map((_,i)=>!!(n&(1<<(step.inputs.length-i-1))))),truth=bits=>step.mode==='AND'?bits.every(Boolean):step.mode==='OR'?bits.some(Boolean):step.mode==='NOT'?!bits[0]:(bits[0]||bits[1])&&!bits[2];
    const a=make(step,{type:step.kind==='truth'?'TruthTable':'CircuitExercise',options:cases.map(bits=>step.inputs.map((name,i)=>`${name}=${Number(bits[i])}`).join(', ')),correctionMode:'structured',expectedAnswer:JSON.stringify(Object.fromEntries(cases.map((bits,i)=>[i,String(Number(truth(bits)))]))),reference:`Règle ${step.mode} : ${step.rule||step.takeaway||'compléter chaque cas'}`});activities.push(a);ids.push(a.id);
   }else{const exercise=EXERCISES[step.exercise],a=make(step,{type:['code','function-code'].includes(step.kind)?'CodeEditor':step.kind==='report'?'Submission':'WriteResponse',...(exercise?{correctionMode:'javascript',tests:exercise.cases.map(c=>({invoke:exercise.fn,argsJSON:JSON.stringify(c.args),expectedJSON:JSON.stringify(c.want)}))}:{})});activities.push(a);ids.push(a.id);}
  }
  blocks.push({id:block.id,type:block.id==='pause'?'Pause':'Activity',title:block.title,content:steps.map(s=>s.takeaway).filter(Boolean).join('\n'),minutes:block.minutes,activityIds:ids,skills:block.id==='pause'?[]:LESSON.skills});
 }
 for(const step of LESSON.steps.filter(s=>s.optional)){const exercise=EXERCISES[step.exercise],a=make(step,{type:step.kind==='function-code'?'CodeEditor':'WriteResponse',...(exercise?{correctionMode:'javascript',tests:exercise.cases.map(c=>({invoke:exercise.fn,argsJSON:JSON.stringify(c.args),expectedJSON:JSON.stringify(c.want)}))}:{})});if(!activities.some(a=>a.id===step.id)){activities.push(a);blocks.find(b=>b.id==='pm09').activityIds.push(a.id);}}
 for(const a of activities)if(a.correctionMode==='javascript'){
  const step=LESSON.steps.find(s=>s.id===a.id),solution=functionReferences[step?.exercise];
  if(solution)a.reference=solution+'\n'+a.reference.split('\n').map(line=>'// '+line).join('\n');
 }
 const phaseById={diagnostic:'diagnostic',retour:'understand',pause:'pause',entrainement:'autonomy',pm09:'extend',bilan:'summary'};
 for(const b of blocks){
  const steps=LESSON.steps.filter(s=>s.block===b.id);
  b.phase=phaseById[b.id]||'guided';
  b.teaching=teaching({steps:b.phase==='guided'?['Prévois le résultat avant de manipuler.','Construis ta réponse, puis essaie aussi un cas de refus.','Compare ton résultat à la règle. Explique un écart.']:[],hint:steps.find(s=>s.hint)?.hint||'Repars des entrées. Applique une seule règle à la fois.',check:steps.flatMap(s=>s.checks||[])[0]||'Ta règle fonctionne pour chaque combinaison, y compris un cas qui refuse l’accès.',takeaways:steps.map(s=>s.takeaway).filter(Boolean)});
  if(b.id==='bilan'){b.type='Reflection';b.teaching.takeaways=['ET exige deux conditions vraies. OU en exige au moins une. NON inverse un booléen.','Teste les cas autorisés et les cas refusés. Un exemple réussi ne suffit pas.','Écris la règle avec tes mots avant de la traduire en code.'];}
 }
 blocks.unshift(lessonBlock('opening','LessonHero','opening',LESSON.title,'La salle s’ouvre avec une carte et une réservation. Comment écrire une règle qui accepte les bons cas et refuse les autres ?',4,[],LESSON.skills));
 blocks.push(lessonBlock('concept-logic','ConceptCard','understand','Une règle. Deux réponses possibles.','Un booléen vaut vrai ou faux. Une comparaison produit un booléen. Avec ET, les deux conditions doivent être vraies. Avec OU, au moins une suffit. NON inverse la réponse.\n\nPour deux entrées, il existe quatre combinaisons. Les tester toutes permet de vérifier une règle avant de la traduire en code.',10,[],LESSON.skills,{takeaways:['ET exige deux conditions vraies. OU en exige au moins une.','Un seul cas réussi ne suffit pas à valider une règle.'],diagram:['Carte valide + réservation → ET → Accès autorisé','Une condition manque → Accès refusé'],hint:'Carte seule : accès refusé. Réservation seule : accès refusé. Les deux ensemble : accès autorisé.'}));
 blocks.push(lessonBlock('demo-logic','LiveCode','observe','Deux conditions, une seule décision.','const aCarte = true;\nconst aReserve = false;\nconst acces = aCarte && aReserve;\nconsole.log(acces); // false',8,[],LESSON.skills,{steps:['Lis les entrées : la carte est valide, la réservation est absente.','Le ET demande deux valeurs vraies. Une seule ne suffit pas.','Le résultat est false : l’accès est refusé.'],check:'Si aReserve devient true, quelle sera la valeur de acces ?',takeaways:['Le résultat dépend de la combinaison des entrées.']}));
 return {title:LESSON.title,objectives:['Combiner ET, OU et NON dans une règle explicite.','Construire une table de vérité et tester les cas limites.','Réparer une condition puis justifier son fonctionnement.'],blocks,activities,slides:LESSON.slides.map(s=>({title:s.title,body:[s.subtitle,s.note].filter(Boolean).join('\n')})),teacherGuide:'Séance du 1er octobre migrée depuis EDEN V6. Les blocs, exercices, questions, cas booléens et exercices de fonctions réutilisent les sources historiques. Le diagnostic reste calculé depuis la dernière réalisation confirmée dans EDEN. Prévoir une démonstration, une production puis une justification par atelier. Les défis finaux sont facultatifs.'};
}
