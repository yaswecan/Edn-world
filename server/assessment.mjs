import {ownedAttempt,checkDraftVersion} from './student-tracking.mjs';
import {aiPreferences} from './ai/settings.mjs';
import {structuralGrade} from './structural-grading.mjs';
import {sqlGrade} from './sql-grading.mjs';
import {rubricGrade} from './rubric-grading.mjs';
import {runSafe} from './safe-js.mjs';
import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {hash} from './importer.mjs';
import {freezeContent,canonical} from './content-snapshots.mjs';
export const level=score=>score==null?'NE':score>=15?'A2':score>=10?'A1':score>=5?'EC':'NA';
export const valueOfLevel={NA:0,EC:1,A1:2,A2:3,NE:null};
export function gradeTask(task,answer) {
 const text=typeof answer==='string'?answer:String(answer?.text??'');
 if(!text.trim())return {ratio:0,confidence:1,status:'auto_corrected_to_review',feedback:'Production absente dans la copie remise.',observations:[]};
 if(['html','css'].includes(task.correctionMode))return structuralGrade(task,text);
 if(task.correctionMode==='exact')return {ratio:text.trim()===task.expectedAnswer.trim()?1:0,confidence:1,status:'auto_corrected_to_review',feedback:'Comparaison déterministe avec la réponse attendue.',observations:[]};
 if(task.correctionMode==='structured'){
  try{const expected=JSON.parse(task.expectedAnswer),actual=JSON.parse(text);const keys=Object.keys(expected);if(!expected||typeof expected!=='object'||!keys.length||!actual||typeof actual!=='object')throw Error('Configuration invalide');const observations=keys.map(key=>({key,ok:JSON.stringify(expected[key])===JSON.stringify(actual[key])}));return {ratio:observations.filter(o=>o.ok).length/keys.length,confidence:1,status:'auto_corrected_to_review',feedback:'Comparaison structurée par élément ; relecture de la démarche requise.',observations};}catch{return {ratio:null,confidence:0,status:'review_required',feedback:'Réponse ou référence structurée illisible ; relecture requise.',observations:[]};}
 }
 if(task.correctionMode==='javascript'&&task.tests.length){
  let tests;try{tests=task.tests.map(t=>{const r=runSafe(text,{invoke:t.invoke,args:JSON.parse(t.argsJSON)});return {ok:r.ok&&JSON.stringify(r.value)===JSON.stringify(JSON.parse(t.expectedJSON)),review:r.unsupported||r.syntax,error:r.error};});}catch{return {ratio:null,confidence:0,status:'review_required',feedback:'Tests de référence illisibles : relecture requise.',observations:[]};}
  if(tests.some(t=>t.review))return {ratio:null,confidence:0,status:'review_required',feedback:'Syntaxe ou construction non prise en charge : relecture requise, aucun zéro automatique.',observations:tests};
  return {ratio:tests.filter(t=>t.ok).length/tests.length,confidence:1,status:'auto_corrected_to_review',feedback:'Résultats des tests bornés. Vérifier la démarche.',observations:tests};
 }
 return {ratio:null,confidence:0,status:'review_required',feedback:'Production ouverte : appliquer la rubrique et relire les preuves.',observations:[]};
}
export function correct(diagnostic,answers) {
 const items=diagnostic.rubric.map(item=>{const task=diagnostic.tasks.find(t=>t.id===item.taskId),result=gradeTask(task,answers[item.taskId]);return {...item,points:result.ratio==null?null:Math.round(result.ratio*item.max*100)/100,...result};});
 const pending=!items.length||items.some(i=>i.points==null),score=pending?null:Math.round(items.reduce((s,i)=>s+i.points,0)*100)/100;
 const criteria=[...new Set(items.map(i=>i.criterion))].map(criterion=>{const rows=items.filter(i=>i.criterion===criterion),points=rows.some(i=>i.points==null)?null:rows.reduce((s,i)=>s+i.points,0),max=rows.reduce((s,i)=>s+i.max,0),a1=rows.reduce((s,i)=>s+i.a1,0),a2=rows.reduce((s,i)=>s+i.a2,0);return {criterion,points,max,level:points==null?'NE':points>=a2?'A2':points>=a1?'A1':points>0?'EC':'NA'};});
 return {score,scoreMax:items.reduce((n,i)=>n+i.max,0)||null,level:items.reduce((n,i)=>n+i.max,0)===20?level(score):null,status:pending?'review_required':'auto_corrected_to_review',confidence:Math.min(...items.map(i=>i.confidence)),items,criteria,feedback:pending?'Une relecture est nécessaire avant de déterminer la note.':'Pré-correction disponible, en attente de validation professeur.',remediationPriorities:criteria.filter(c=>['NA','EC'].includes(c.level)).map(c=>c.criterion)};
}
export function mastery(evidence,{minSpacingDays=7,minEvidence=2,requireTransfer=true,recentWeights=[0.6,0.25,0.15]}={},at=new Date()) {
 // Only latest approved revisions qualify. Game declarations never qualify by themselves.
 const latest=new Map();for(const e of evidence)if(!latest.has(e.sourceId)||(latest.get(e.sourceId).revision||0)<(e.revision||0))latest.set(e.sourceId,e);
 const valid=[...latest.values()].filter(e=>e.approved&&e.level!=='NE'&&Date.parse(e.date)<=+at);
 const autonomous=valid.filter(e=>e.autonomous&&valueOfLevel[e.level]>=2);
 const durable=autonomous.length>=Math.max(2,minEvidence)&&autonomous.some((a,i)=>autonomous.some((b,j)=>i!==j&&a.sourceId!==b.sourceId&&(!requireTransfer||a.transfer||b.transfer)&&Math.abs(Date.parse(a.date)-Date.parse(b.date))>=minSpacingDays*86400000));
 const buckets=[[],[],[]];for(const e of valid){const age=(+at-Date.parse(e.date))/86400000;buckets[age<14?0:age<=28?1:2].push(valueOfLevel[e.level]);}
 let weight=0,total=0;recentWeights.forEach((w,i)=>{if(buckets[i].length){weight+=w;total+=w*buckets[i].reduce((a,b)=>a+b,0)/buckets[i].length;}});
 return {durable,proofCount:valid.length,autonomousCount:autonomous.length,weightedLevel:weight?Math.round(total/weight*100)/100:null,status:durable?'mastered':valid.length?'developing':'unobserved'};
}
export async function submitAttempt(store,attemptId,answers,actor,input) {
 return store.transaction(async tx=>{
 const attempt=await ownedAttempt(tx,attemptId,actor);
 if(attempt.submissionId)return tx.get('submissions',attempt.submissionId);
 await ownedAttempt(tx,attemptId,actor,{write:true});if(input)checkDraftVersion(attempt,input);
 requireValue(answers&&typeof answers==='object'&&!Array.isArray(answers),'Réponses invalides.');if(JSON.stringify(answers).length>150000)fail(413,'Copie trop volumineuse.');
 const lv=await tx.get('lesson_versions',attempt.lessonVersionId);const frozen=Object.fromEntries(lv.spec.diagnostic.tasks.filter(t=>Object.hasOwn(answers,t.id)).map(t=>[t.id,structuredClone(answers[t.id])])),submittedAt=now();
 requireValue(Object.values(frozen).every(a=>typeof a==='string'&&a.length<=100000),'Réponses invalides.');
 actor={...actor,classId:attempt.classId};
 attempt.firstAttempt??={};attempt.lastAttempt??={};
 for(const [taskId,answer] of Object.entries(frozen)){const event={timestamp:submittedAt,type:'answer_submitted',payload:{answer}};attempt.firstAttempt[taskId]??=event;attempt.lastAttempt[taskId]=event;}
 const submission=await tx.insert('submissions',{id:uid('submission'),classId:actor.classId,learnerId:actor.id,attemptId:attempt.id,lessonId:attempt.lessonId,lessonVersionId:lv.id,diagnostic:lv.spec.diagnostic,answers:frozen,history:attempt.history||[],submittedAt,sha256:hash(JSON.stringify(frozen))});
 const snapshot=await freezeContent(tx,{classId:actor.classId,event:'diagnostic.submitted',eventId:submission.id,acceptedAt:submittedAt,subject:{kind:'diagnostic',learnerId:actor.id,lessonId:attempt.lessonId,lessonVersionId:lv.id,attemptId:attempt.id},versions:{criteria:hash(canonical(lv.spec.diagnostic)),validator:'eden-assessment-1'},files:[{path:'answers.json',content:canonical(frozen),audience:'student'}]});submission.snapshotId=snapshot.id;await tx.put('submissions',submission);
 const correction=await correctAsync(lv.spec.diagnostic,frozen);await tx.insert('corrections',{...correction,id:submission.id,classId:actor.classId,learnerId:actor.id,lessonId:attempt.lessonId,submissionId:submission.id,version:1});
 attempt.answers=frozen;attempt.draftVersion=(attempt.draftVersion||0)+1;attempt.submissionId=submission.id;attempt.status='submitted';await tx.put('assessment_attempts',attempt);await tx.audit(actor,'diagnostic.submitted',submission.id,{sha256:submission.sha256});
 return submission;
 });
}
export async function reviseCorrection(store,id,input,actor) {
 return store.transaction(async tx=>{
 const submission=await scoped(tx,'submissions',id,actor),old=await scoped(tx,'corrections',id,actor);
 requireValue(input.reason?.trim(),'Une justification est obligatoire.');if(input.version!==old.version)fail(409,'La correction a changé. Rechargez-la.');
 requireValue(Array.isArray(input.items)&&input.items.length===old.items.length,'Chaque item doit être relu.');
 const items=old.items.map(item=>{const edited=input.items.find(i=>i.id===item.id);requireValue(edited&&(edited.points===null||Number.isFinite(edited.points)&&edited.points>=0&&edited.points<=item.max),'Points hors barème.');return {...item,source:'teacher',evidence:{taskId:item.taskId,answer:submission.answers[item.taskId]||''},points:edited.points,feedback:String(edited.feedback||item.feedback),ratio:edited.points==null?null:edited.points/item.max,status:'approved',confidence:1};});
 const criteria=[...new Set(items.map(i=>i.criterion))].map(criterion=>{const group=items.filter(i=>i.criterion===criterion),points=group.some(i=>i.points==null)?null:group.reduce((s,i)=>s+i.points,0),max=group.reduce((s,i)=>s+i.max,0);return {criterion,points,max,level:points==null?'NE':points>=group.reduce((s,i)=>s+i.a2,0)?'A2':points>=group.reduce((s,i)=>s+i.a1,0)?'A1':points>0?'EC':'NA'};});
 const score=!items.length||items.some(i=>i.points==null)?null:Math.round(items.reduce((s,i)=>s+i.points,0)*100)/100,revision=old.version+1;
 const updated={...old,version:revision,items,criteria,score,scoreMax:items.reduce((n,i)=>n+i.max,0)||null,level:items.reduce((n,i)=>n+i.max,0)===20?level(score):null,status:'approved',feedback:String(input.feedback||old.feedback),approvedBy:actor.id,approvedAt:now(),autonomous:input.autonomous===true,transfer:input.transfer===true};
 await tx.insert('correction_revisions',{id:uid('revision'),classId:actor.classId,submissionId:id,version:revision,oldValue:old,newValue:updated,authorId:actor.id,reason:input.reason});await tx.put('corrections',updated);
 const attempt=await tx.get('assessment_attempts',submission.attemptId);
 for(const c of criteria.filter(c=>c.criterion!=='baseline'&&c.level!=='NE'&&attempt?.mode!=='practice'))await tx.insert('evidence',{id:uid('evidence'),classId:actor.classId,learnerId:submission.learnerId,criterion:c.criterion,sourceId:id,revision,date:submission.submittedAt.slice(0,10),level:c.level,approved:true,autonomous:updated.autonomous,transfer:updated.transfer,correctionVersion:revision,lessonVersionId:submission.lessonVersionId});
 await tx.audit(actor,'correction.approved',id,{revision,reason:input.reason});return updated;
 });
}
export {calculateRemediation as computeRemediation} from './remediation.mjs';

export function summarizeItems(items){const pending=!items.length||items.some(i=>i.points==null),score=pending?null:Math.round(items.reduce((s,i)=>s+i.points,0)*100)/100,criteria=[...new Set(items.map(i=>i.criterion))].map(criterion=>{const rows=items.filter(i=>i.criterion===criterion),points=rows.some(i=>i.points==null)?null:rows.reduce((s,i)=>s+i.points,0),max=rows.reduce((s,i)=>s+i.max,0);return {criterion,points,max,level:points==null?'NE':points>=rows.reduce((s,i)=>s+i.a2,0)?'A2':points>=rows.reduce((s,i)=>s+i.a1,0)?'A1':points>0?'EC':'NA'};});return {items,score,scoreMax:items.reduce((n,i)=>n+i.max,0)||null,level:items.reduce((n,i)=>n+i.max,0)===20?level(score):null,criteria,status:pending?'review_required':'auto_corrected_to_review',confidence:Math.min(...items.map(i=>i.confidence)),remediationPriorities:criteria.filter(c=>['NA','EC'].includes(c.level)).map(c=>c.criterion)};}
export async function correctAsync(diagnostic,answers){const base=correct(diagnostic,answers),tasks=new Map();for(const task of diagnostic.tasks.filter(t=>t.correctionMode==='sql')){const answer=String(answers[task.id]||'');if(answer.trim())tasks.set(task.id,await sqlGrade(task,answer));}if(!tasks.size)return base;const items=base.items.map(item=>{const result=tasks.get(item.taskId);return result?{...item,...result,points:result.ratio==null?null:Math.round(result.ratio*item.max*100)/100}:item;});return {...base,...summarizeItems(items)};}
export async function proposeRubricCorrection(store,id,actor,input,options={}){
 if((await aiPreferences(store,actor)).provider==='chatgpt_plan')fail(409,'La pré-correction utilise l’API OpenAI. Choisissez explicitement le mode API dans les réglages pour cette fonction. Aucun appel effectué.');
 const submission=await scoped(store,'submissions',id,actor),old=await scoped(store,'corrections',id,actor);requireValue(input.version===old.version,'Rechargez la correction.');requireValue(old.status!=='approved','Une correction validée se révise manuellement.');
 const result=await rubricGrade(submission.diagnostic,submission.answers,options);if(!result)fail(503,'Configurez le modèle de pré-correction et la clé OpenAI.');
 return store.transaction(async tx=>{const current=await scoped(tx,'corrections',id,actor);if(current.version!==old.version)fail(409,'Correction modifiée pendant l’analyse.');const items=current.items.map(item=>{const proposed=result.items.find(i=>i.id===item.id);const task=submission.diagnostic.tasks.find(t=>t.id===item.taskId);if(!['manual','rubric'].includes(task.correctionMode))return item;return {...item,points:proposed.points,confidence:proposed.confidence,feedback:proposed.feedback,observations:[{source:'rubric_model',evidence:proposed.evidence}],status:proposed.points==null?'review_required':'auto_corrected_to_review'};});const updated={...current,...summarizeItems(items),version:current.version+1,gradingModel:result.model,gradingResponseId:result.responseId,feedback:'Pré-correction par rubrique proposée. Relisez chaque preuve avant validation.'};await tx.insert('correction_revisions',{id:uid('revision'),classId:actor.classId,submissionId:id,version:updated.version,oldValue:current,newValue:updated,authorId:actor.id,reason:'Pré-correction par rubrique demandée par le professeur'});await tx.put('corrections',updated);await tx.audit(actor,'correction.proposed',id,{model:result.model,version:updated.version});return updated;});
}
