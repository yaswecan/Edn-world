import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {assignmentAccess,pageRows} from './student-tracking.mjs';
import {digest,observationVisible} from './competency-service.mjs';
import {newest} from './competency-calculations.mjs';
import {revision} from './framework-admin.mjs';

export async function questionAccess(tx,actor,q){
 if(!q||actor.role==='teacher'&&q.classId!==actor.classId||actor.role==='student'&&q.learnerId!==actor.id)fail(404,'Demande introuvable.');
 if(actor.role==='student'){
  await assignmentAccess(tx,q.assignmentId,actor);const p=await tx.get('result_publications',q.submissionId);
  if(!p||p.withdrawnAt||p.version!==q.resultVersion&&!p.publishedVersions?.includes(q.resultVersion))fail(404,'Résultat indisponible.');
 }
 return q;
}
const message=value=>requireValue(typeof value==='string'&&value.trim()&&value.length<=2000,'Message requis, limité à 2 000 caractères.');
export async function askQuestion(tx,actor,input){
 const p=await tx.get('result_publications',input.submissionId);
 requireValue(p&&!p.withdrawnAt&&p.learnerId===actor.id,'Choisissez un de vos résultats publiés.');await assignmentAccess(tx,p.assignmentId,actor);message(input.message);
 requireValue(typeof input.requestId==='string'&&input.requestId.length>=8&&input.requestId.length<=200,'Identité de demande requise.');
 const id='question_'+digest([actor.id,input.requestId]),old=await tx.get('result_questions',id);
 if(old){if(old.submissionId!==p.id||old.message!==input.message)fail(409,'Cette demande contient déjà un autre message.');return old;}
 const row=await tx.insert('result_questions',{id,classId:p.classId,learnerId:actor.id,assignmentId:p.assignmentId,submissionId:p.id,resultVersion:p.version,message:input.message,state:'open',revision:1,authorId:actor.id,replies:[]});await tx.audit(actor,'result.question_created',id);return row;
}
export async function answerQuestion(tx,actor,id,input){
 const q=await questionAccess(tx,actor,await tx.get('result_questions',id));revision(q,input.revision);
 requireValue(['answer','close'].includes(input.action),'Action inconnue.');
 if(input.action==='answer'){message(input.message);q.replies.push({message:input.message,at:now(),authorId:actor.id});q.state='answered';}
 else {requireValue(q.state==='answered','Répondez avant de clore la demande.');q.state='closed';}
 q.revision++;await tx.put('result_questions',q);await tx.audit(actor,'result.question_'+input.action,id);return q;
}
export async function questions(tx,actor,query){
 const rows=[];for(const q of await tx.list('result_questions',actor.role==='teacher'?actor.classId:undefined)){
  if(actor.role==='student'&&q.learnerId!==actor.id||query.submissionId&&q.submissionId!==query.submissionId)continue;
  try{await questionAccess(tx,actor,q);}catch{continue;}rows.push(q);
 }
 return pageRows(rows.reverse(),query);
}
// One read per aggregate, never per matrix cell. No student endpoint exposes this view.
export async function pilotage(tx,actor,query={}){
 const tables=['framework_versions','lesson_runs','lesson_assignments','assessment_attempts','corrections','competency_observations','result_publications','occurrence_participations','adaptation_proposals','learners','teacher_observations','learning_progress','mastery_decisions','learning_alerts'];
 const data=Object.fromEntries(await Promise.all(tables.map(async t=>[t,await tx.list(t,actor.classId)])));
 const inPeriod=d=>(!query.from||d&&d.slice(0,10)>=query.from)&&(!query.to||d&&d.slice(0,10)<=query.to);
 const runs=data.lesson_runs.filter(r=>(!query.runId||r.id===query.runId)&&inPeriod(r.date)),runIds=new Set(runs.map(r=>r.id));
 const assignments=data.lesson_assignments.filter(a=>runIds.has(a.runId)),assignedIds=new Set(assignments.map(a=>a.id));
 const attempts=data.assessment_attempts.filter(t=>assignedIds.has(t.assignmentId)&&t.mode!=='practice');
 const corrections=new Map(data.corrections.map(c=>[c.id,c])),pubs=new Map(data.result_publications.map(p=>[p.id,p]));
 const teacherEvidence=new Map(data.teacher_observations.map(e=>[e.id,e]));
 const allObservations=new Map(data.competency_observations.map(o=>[o.id,o]));
 const publishedProof=p=>{const o=allObservations.get(p.id);if(!o)return false;const a=data.lesson_assignments.find(a=>a.id===o.assignmentId),r=data.lesson_runs.find(r=>r.id===a?.runId);if(!a||a.access==='revoked'||r?.availability==='revoked')return false;if(o.teacherEvidenceId)return !!teacherEvidence.get(o.teacherEvidenceId)?.publishedObservationIds?.includes(o.id);const publication=pubs.get(o.submissionId);return !!publication&&!publication.withdrawnAt&&(publication.version===o.correctionVersion||publication.publishedVersions?.includes(o.correctionVersion));};
 const observations=data.competency_observations.filter(o=>assignedIds.has(o.assignmentId)&&o.validated&&!o.practice&&(o.teacherEvidenceId?teacherEvidence.get(o.teacherEvidenceId)?.revision:corrections.get(o.submissionId)?.version)===o.correctionVersion);
 requireValue(!query.mode||['observations','retained'].includes(query.mode),'Mode de résultat inconnu.');
 const names=new Map(data.learners.map(l=>[l.id,l.displayName]));const population=[...new Set(assignments.map(a=>a.learnerId))];
 const criteria=data.framework_versions.filter(f=>(!f.status||f.status==='published')&&(!query.frameworkVersionId||f.id===query.frameworkVersionId)).flatMap(f=>f.nodes.flatMap(n=>n.criteria.map(c=>({frameworkVersionId:f.id,competencyId:n.id,criterionId:c.id,code:c.code||n.code,title:c.title,frameworkTitle:f.title}))));
 const distributions=[];
 for(const c of criteria){
  if(query.criterionId&&query.criterionId!==c.criterionId||query.competencyId&&query.competencyId!==c.competencyId)continue;
  const cases=[],levels={},missing={};let privateCount=0;
  for(const id of population){
   if(query.mode==='retained'){
    const decision=data.mastery_decisions.filter(d=>d.learnerId===id&&d.frameworkVersionId===c.frameworkVersionId&&d.competencyId===c.competencyId&&d.publishedAt&&d.proofs.every(publishedProof)&&d.rule.criteria.some(k=>k.id===c.criterionId)&&inPeriod(d.lastWorkedAt)).sort((x,y)=>y.publishedAt.localeCompare(x.publishedAt))[0];
    if(!decision){missing.no_decision=(missing.no_decision||0)+1;cases.push({learnerId:id,displayName:names.get(id)||'Élève',cause:'no_decision'});continue;}
    const proof=data.competency_observations.find(o=>decision.proofs.some(p=>p.id===o.id));levels[decision.grade]=(levels[decision.grade]||0)+1;cases.push({learnerId:id,displayName:names.get(id)||'Élève',grade:decision.grade,decisionId:decision.id,observationId:proof?.id,attemptId:proof?.attemptId,workedAt:decision.lastWorkedAt,private:false,scaleKey:decision.rule.scaleKey});continue;
   }
   const rows=observations.filter(o=>o.learnerId===id&&o.frameworkVersionId===c.frameworkVersionId&&o.competencyId===c.competencyId&&o.criteria.some(k=>k.criterionId===c.criterionId&&k.grade)).sort(newest);
   const scales=new Set(rows.map(o=>o.scaleKey)),o=rows[0],a=assignments.filter(a=>a.learnerId===id),ats=attempts.filter(t=>t.learnerId===id),submitted=ats.filter(t=>t.submissionId);
   const participation=data.occurrence_participations.filter(p=>p.learnerId===id&&runIds.has(p.runId)).at(-1);
   let cause=null;
   if(scales.size>1)cause='non_comparable';
   else if(!o)cause=participation?.state==='technical_incident'?'technical_incident':!submitted.length?(participation?.state==='absent'?'absent':'not_submitted'):submitted.some(t=>corrections.get(t.submissionId)?.status!=='approved')?'to_correct':'mapping_missing';
   if(cause){missing[cause]=(missing[cause]||0)+1;cases.push({learnerId:id,displayName:names.get(id)||'Élève',cause,attemptId:submitted.at(-1)?.id||ats.at(-1)?.id||null,assignmentId:a.at(-1)?.id});continue;}
   const criterion=o.criteria.find(k=>k.criterionId===c.criterionId),pub=pubs.get(o.submissionId),isPrivate=!!pub?.withdrawnAt|| (o.teacherEvidenceId?!teacherEvidence.get(o.teacherEvidenceId)?.publishedObservationIds?.includes(o.id):pub?.version!==o.correctionVersion&&!pub?.publishedVersions?.includes(o.correctionVersion));
   levels[criterion.grade]=(levels[criterion.grade]||0)+1;if(isPrivate)privateCount++;
   cases.push({learnerId:id,displayName:names.get(id)||'Élève',grade:criterion.grade,observationId:o.id,attemptId:o.attemptId,submissionId:o.submissionId,workedAt:o.workedAt,private:isPrivate,runId:o.runId,scaleKey:o.scaleKey});
  }
  // Never pool different scales across pupils either.
  const incompatible=new Set(cases.filter(c=>c.grade).map(c=>c.scaleKey)).size>1;
  const denominator=incompatible?0:cases.filter(c=>c.grade).length;
  distributions.push({...c,levels:incompatible?{}:levels,denominator,population:population.length,privateCount,missing,nonComparable:incompatible,cases});
 }
 const coverage=criteria.map(c=>{
  const matches=o=>o.frameworkVersionId===c.frameworkVersionId&&o.competencyId===c.competencyId&&o.criterionId===c.criterionId;
  const planned=runs.filter(r=>r.planStatus!=='cancelled'&&(r.objectives||[]).some(matches));
  const evaluated=observations.filter(o=>o.frameworkVersionId===c.frameworkVersionId&&o.competencyId===c.competencyId&&o.criteria.some(k=>k.criterionId===c.criterionId&&k.grade));
  const realized=planned.filter(r=>r.realization?.activityIds?.length&&(r.objectives||[]).some(o=>matches(o)&&o.activityId&&r.realization.activityIds.includes(o.activityId)));
  return {...c,planned:planned.map(r=>({id:r.id,date:r.date,sequence:r.sequence||''})),realized:realized.map(r=>r.id),observedLearners:new Set(evaluated.map(o=>o.learnerId)).size,evaluationPlanned:planned.some(r=>r.objectives.some(o=>matches(o)&&o.role==='evaluation')),state:planned.length?'planned':'unplanned'};
 });
 const threshold=Number(query.alertProportion??0.5),minimum=Number(query.minimumData??3),expectedGrade=String(query.expectedGrade||'');
 requireValue(Number.isFinite(threshold)&&threshold>0&&threshold<=1&&Number.isInteger(minimum)&&minimum>=1,'Seuils d’alerte invalides.');
 const alerts=[],repeated=[];const repeatCount=Number(query.repeatCount||2);requireValue(Number.isInteger(repeatCount)&&repeatCount>=2&&repeatCount<=10,'Deux à dix situations requises pour une difficulté répétée.');
 if(expectedGrade&&query.mode!=='retained')for(const d of distributions){const failed=d.cases.filter(c=>c.grade&&(()=>{const o=observations.find(o=>o.id===c.observationId),rank=g=>o.categories.find(k=>k.id===g)?.order;return rank(expectedGrade)!==undefined&&rank(c.grade)<rank(expectedGrade);})());
  for(const c of failed){const rows=observations.filter(o=>o.learnerId===c.learnerId&&o.frameworkVersionId===d.frameworkVersionId&&o.competencyId===d.competencyId&&o.workedAt&&o.situationId&&o.criteria.some(k=>k.criterionId===d.criterionId&&k.grade)).sort(newest),uniqueRows=[...new Map(rows.slice().reverse().map(o=>[o.situationId,o])).values()].sort(newest).slice(0,repeatCount);if(uniqueRows.length===repeatCount&&uniqueRows.every(o=>{const k=o.criteria.find(k=>k.criterionId===d.criterionId),target=o.categories.find(k=>k.id===expectedGrade);return target&&o.categories.find(c=>c.id===k.grade)?.order<target.order;}))repeated.push({learnerId:c.learnerId,displayName:c.displayName,criterion:d.title,requiredSituations:repeatCount,proofs:uniqueRows.map(o=>({id:o.id,attemptId:o.attemptId,workedAt:o.workedAt}))});}
  if(d.denominator>=minimum&&failed.length/d.denominator>=threshold)alerts.push({id:'alert_'+digest([actor.classId,query.runId||null,d.frameworkVersionId,d.competencyId,d.criterionId,expectedGrade,query.from||null,query.to||null]),criterion:d.title,numerator:failed.length,denominator:d.denominator,threshold,minimum,expectedGrade,cases:failed,suggestion:'Examiner les preuves et vérifier l’énoncé, la grille ou le correcteur avant de choisir une reprise.'});
 }
 for(const alert of alerts){alert.evidenceHash=digest(alert.cases.map(c=>[c.observationId,c.grade]).sort());const previous=data.learning_alerts.find(a=>a.id===alert.id);alert.revision=previous?.revision||0;alert.state=previous?.evidenceHash===alert.evidenceHash?previous.state:'review';}
 return {repeated,definition:{classId:actor.classId,period:{from:query.from||null,to:query.to||null},mode:query.mode==='retained'?'Niveaux retenus publiés, périmètre de critères de chaque décision':'Dernières observations finales par critère, versions et échelles séparées',selection:'Population des occurrences sélectionnées par date prévue. Dernière observation par date réelle du travail puis identité stable ; niveaux retenus filtrés par date du travail démontré. Une ligne par élève.',population:population.length,assigned:assignments.length,submitted:new Set(attempts.filter(t=>t.submissionId).map(t=>t.learnerId)).size,computedAt:now(),freshness:'live',versions:[...new Set(criteria.map(c=>c.frameworkVersionId))]},distributions:pageRows(distributions,query),coverage,alerts,reprisesToVerify:data.adaptation_proposals.filter(p=>runIds.has(p.runId)&&(p.state==='verification'||p.state==='assigned'&&data.learning_progress.some(g=>g.assignmentId===p.assignmentId&&g.completed?.includes(p.activityId)))).map(p=>({id:p.id,runId:p.runId,learnerId:p.learnerId})),toCorrect:attempts.filter(t=>t.submissionId&&corrections.get(t.submissionId)?.status!=='approved').map(t=>({attemptId:t.id,learnerId:t.learnerId}))};
}
export function csvCell(value){const s=String(value??'');return '"'+(/^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}
export function trackingCSV(view){return '\uFEFF'+[['Classe','Depuis','Jusqu’au','Mode','Référentiel','Code','Critère','Élève','Résultat','Publication'],...view.distributions.items.flatMap(d=>d.cases.map(c=>[view.definition.classId,view.definition.period.from,view.definition.period.to,view.definition.mode,d.frameworkVersionId,d.code,d.title,c.displayName,c.grade||c.cause,c.grade?(c.private?'Privée':'Publiée'):'']))].map(r=>r.map(csvCell).join(';')).join('\r\n');}

export async function decideAlert(tx,actor,input){
 requireValue(['acknowledged','dismissed','resolved'].includes(input.state)&&typeof input.reason==='string'&&input.reason.trim()&&input.reason.length<=2000,'État et motif requis.');
 const view=await pilotage(tx,actor,input.filters||{}),alert=view.alerts.find(a=>a.id===input.id);
 if(!alert||alert.evidenceHash!==input.evidenceHash||alert.revision!==input.revision)fail(409,'Les preuves ou l’alerte ont changé. Actualisez le pilotage.');
 const previous=await tx.get('learning_alerts',alert.id),row={id:alert.id,classId:actor.classId,revision:alert.revision+1,state:input.state,evidenceHash:alert.evidenceHash,reason:input.reason,authorId:actor.id,updatedAt:now(),filters:input.filters||{},proofIds:alert.cases.map(c=>c.observationId)};
 if(previous)await tx.put('learning_alerts',row);else await tx.insert('learning_alerts',row);await tx.audit(actor,'alert.decided',row.id,{revision:row.revision,state:row.state});return row;
}

export async function withdrawResult(tx,actor,id,input){
 const p=await scoped(tx,'result_publications',id,actor);requireValue(input.version===p.version,'La publication a changé. Rechargez la copie.');message(input.reason);
 if(p.withdrawnAt)return {withdrawn:true,version:p.version};
 p.withdrawnAt=now();p.withdrawnBy=actor.id;p.withdrawalReason=input.reason;
 p.withdrawals=[...(p.withdrawals||[]),{at:p.withdrawnAt,by:actor.id,reason:input.reason,version:p.version,publishedVersions:p.publishedVersions||[p.version]}];
 await tx.put('result_publications',p);await tx.audit(actor,'result.withdrawn',id,{version:p.version});return {withdrawn:true,version:p.version};
}
