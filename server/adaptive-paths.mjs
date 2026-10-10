import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {assignRun,assignmentAccess,availability} from './student-tracking.mjs';
import {digest,learnerInScope,activeGrid,latestObservations,currentRule,evidenceCurrent,invalidateDerived} from './competency-service.mjs';
import {unique,rank,validateCategories,newest} from './competency-calculations.mjs';
export async function activityTarget(tx,actor,target){
 requireValue(target&&typeof target.runId==='string'&&typeof target.activityId==='string','Choisissez une activité publiée.');
 const run=await scoped(tx,'lesson_runs',target.runId,actor),version=await scoped(tx,'lesson_versions',run.lessonVersionId,actor),activity=version.spec.activities.find(a=>a.id===target.activityId);
 requireValue(activity&&run.availability!=='revoked','Activité publiée introuvable ou accès retiré.');
 const lesson=await scoped(tx,'lessons',run.lessonId,actor);requireValue(lesson.status!=='draft'||lesson.publicationId,'Cette activité doit être publiée.');
 return {runId:run.id,activityId:activity.id,lessonVersionId:version.id,title:activity.title};
}
export async function saveAdaptationRule(tx,actor,input){
 const run=await scoped(tx,'lesson_runs',input.runId,actor),common=await activityTarget(tx,actor,{runId:run.id,activityId:input.activityId});
 const prior=(await tx.list('adaptation_rules',actor.classId)).filter(r=>r.runId===run.id&&r.activityId===input.activityId).at(-1);
 if((prior?.version||0)!==(input.version||0))fail(409,'La règle de parcours a changé.');
 requireValue(input.reason?.trim()&&input.continuation?.trim(),'Décrivez l’objectif et la condition de poursuite.');
 requireValue(Array.isArray(input.prerequisites)&&input.prerequisites.length>0&&input.prerequisites.length<=20,'Définissez les prérequis de cette activité.');
 const prerequisites=[];
 for(const p of input.prerequisites){const f=await scoped(tx,'framework_versions',p.frameworkVersionId,actor),n=f.nodes.find(n=>n.id===p.competencyId);requireValue(n&&Array.isArray(p.criterionIds)&&p.criterionIds.length&&p.criterionIds.every(id=>n.criteria.some(c=>c.id===id)),'Critères prérequis invalides.');validateCategories(p.categories);requireValue(p.categories.some(c=>c.id===p.expectedGrade),'Attendu du prérequis invalide.');prerequisites.push({frameworkVersionId:f.id,competencyId:n.id,criterionIds:unique(p.criterionIds),title:n.title,code:n.code,categories:p.categories,expectedGrade:p.expectedGrade,newConcept:p.newConcept===true});}
 const targets={ready:common};for(const key of ['fragile','insufficient','verify','extension'])if(input.targets?.[key])targets[key]=await activityTarget(tx,actor,input.targets[key]);
 for(const [key,t] of Object.entries(targets))if(key!=='ready')requireValue(!(t.runId===run.id&&t.activityId===common.activityId),'La reprise ne peut pas dépendre d’elle-même.');
 const others=(await tx.list('adaptation_rules',actor.classId)).filter(r=>r.id!==prior?.id),origin=run.id+':'+common.activityId;
 const edges=new Map(others.map(r=>[r.runId+':'+r.activityId,Object.entries(r.targets).filter(([k])=>k!=='ready').map(([,t])=>t.runId+':'+t.activityId)]));edges.set(origin,Object.entries(targets).filter(([k])=>k!=='ready').map(([,t])=>t.runId+':'+t.activityId));
 const visit=(key,path)=>{requireValue(!path.has(key),'Dépendance circulaire entre activités.');for(const next of edges.get(key)||[])visit(next,new Set([...path,key]));};visit(origin,new Set());
 const maxCycles=input.maxCycles??1;requireValue(Number.isInteger(maxCycles)&&maxCycles>=1&&maxCycles<=5,'Limite de cycles attendue (1 à 5).');
 const row=await tx.insert('adaptation_rules',{id:uid('path-rule'),classId:actor.classId,runId:run.id,activityId:common.activityId,version:(prior?.version||0)+1,reason:input.reason,continuation:input.continuation,help:String(input.help||''),prerequisites,targets,maxCycles,approvedBy:actor.id,approvedAt:now()});await invalidateDerived(tx,actor.classId);return row;
}
export async function pathInputs(tx,rule,learnerId){return (await latestObservations(tx,rule.classId,learnerId)).filter(o=>o.validated&&!o.practice&&!o.afterCorrection&&rule.prerequisites.some(p=>p.frameworkVersionId===o.frameworkVersionId&&p.competencyId===o.competencyId&&o.criteria.some(c=>p.criterionIds.includes(c.criterionId))));}
export async function proposePath(tx,actor,input){
 const learner=await learnerInScope(tx,input.learnerId,actor),rule=await scoped(tx,'adaptation_rules',input.ruleId,actor);
 requireValue((await currentRule(tx,'adaptation_rules',rule,['runId','activityId'])).id===rule.id,'Utilisez la version actuelle de la règle.');
 const source=(await tx.list('lesson_assignments',actor.classId)).find(a=>a.runId===rule.runId&&a.learnerId===learner.id);requireValue(source&&await availability(tx,source)!=='revoked','Le diagnostic doit être attribué avec un accès actif.');
 const inputs=await pathInputs(tx,rule,learner.id),all=inputs.filter(o=>o.workedAt),proofs=new Map(),states=[];
 for(const p of rule.prerequisites){
  if(p.newConcept){states.push({...p,state:'ready',reason:'Notion nouvelle à introduire.'});continue;}
  const observations=all.filter(o=>o.frameworkVersionId===p.frameworkVersionId&&o.competencyId===p.competencyId&&o.scaleKey===digest(p.categories)).sort(newest),conditions=[];
  for(const id of p.criterionIds){const rows=observations.filter(o=>o.criteria.some(c=>c.criterionId===id&&c.grade)),o=rows[0],c=o?.criteria.find(c=>c.criterionId===id);
   if(!o){conditions.push('insufficient');continue;}
   proofs.set(o.id,{id:o.id,submissionId:o.submissionId,correctionVersion:o.correctionVersion,gridId:o.gridId,workedAt:o.workedAt});
   if(rank(p.categories,c.maximumGrade)<rank(p.categories,p.expectedGrade)){conditions.push('insufficient');continue;}
   const meets=rank(p.categories,c.grade)>=rank(p.categories,p.expectedGrade),previous=rows.find(r=>r.situationId!==o.situationId),prior=previous?.criteria.find(c=>c.criterionId===id);
   if(prior&&(rank(p.categories,prior.grade)>=rank(p.categories,p.expectedGrade))!==meets){proofs.set(previous.id,{id:previous.id,submissionId:previous.submissionId,correctionVersion:previous.correctionVersion,gridId:previous.gridId,workedAt:previous.workedAt});conditions.push('verify');}else conditions.push(meets?'ready':'fragile');
  }
  const state=['insufficient','verify','fragile'].find(s=>conditions.includes(s))||'ready';states.push({...p,state,reason:{insufficient:'Preuves insuffisantes sur le prérequis.',verify:'Observations contradictoires : situation de confirmation.',fragile:'Consolidation ciblée du prérequis.',ready:'Attendu démontré sur les critères nécessaires.'}[state]});
 }
 const state=['insufficient','verify','fragile'].find(s=>states.some(p=>p.state===s))||'ready',target=rule.targets[state]||null;
 const signature=digest([rule.id,learner.id,inputs.map(o=>o.id).sort(),state]),existing=(await tx.list('adaptation_proposals',actor.classId)).find(p=>p.inputHash===signature);if(existing)return existing;
 return tx.insert('adaptation_proposals',{id:uid('path'),classId:actor.classId,learnerId:learner.id,runId:rule.runId,sourceAssignmentId:source.id,ruleId:rule.id,ruleVersion:rule.version,inputHash:signature,inputObservationIds:inputs.map(o=>o.id).sort(),readiness:state,prerequisites:states,proofs:[...proofs.values()],target,activityId:target?.activityId||null,continuation:rule.continuation,reason:states.map(s=>`${s.title} : ${s.reason}`).join(' '),state:'suggested',missingActivity:!target,authorId:actor.id});
}
export async function configureAutomatic(tx,actor,runId,input){
 const run=await scoped(tx,'lesson_runs',runId,actor),id='automatic:'+runId,old=await tx.get('adaptation_authorizations',id);
 if(input.version!==(old?.version||0))fail(409,'L’autorisation automatique a changé.');
 if(input.enabled!==true){const row={...old,id,classId:actor.classId,runId,enabled:false,version:(old?.version||0)+1,revokedAt:now(),authorId:actor.id};old?await tx.put('adaptation_authorizations',row):await tx.insert('adaptation_authorizations',row);return row;}
 requireValue(Array.isArray(input.ruleIds)&&input.ruleIds.length&&Array.isArray(input.learnerIds)&&input.learnerIds.length,'Choisissez les règles et les élèves autorisés.');
 requireValue(Number.isFinite(Date.parse(input.expiresAt))&&Date.parse(input.expiresAt)>Date.now()&&Date.parse(input.expiresAt)<=Date.now()+31*86400000,'Fixez une fin de validité dans les 31 prochains jours.');
 requireValue(Number.isInteger(input.budget)&&input.budget>=1&&input.budget<=1000,'Budget d’attributions invalide.');
 const rules=[];for(const ruleId of unique(input.ruleIds)){const r=await scoped(tx,'adaptation_rules',ruleId,actor);requireValue(r.runId===run.id&&(await currentRule(tx,'adaptation_rules',r,['runId','activityId'])).id===r.id,'Règle obsolète ou d’une autre occurrence.');for(const target of Object.values(r.targets))await activityTarget(tx,actor,target);rules.push({id:r.id,version:r.version,targets:r.targets});}
 for(const learnerId of unique(input.learnerIds)){await learnerInScope(tx,learnerId,actor);requireValue((await tx.list('lesson_assignments',actor.classId)).some(a=>a.runId===run.id&&a.learnerId===learnerId&&a.access==='allowed'),'Élève non attribué à cette occurrence.');}
 const row={id,classId:actor.classId,runId,enabled:true,version:(old?.version||0)+1,rules,learnerIds:unique(input.learnerIds),budget:input.budget,used:0,expiresAt:new Date(input.expiresAt).toISOString(),authorId:actor.id,activatedAt:now()};old?await tx.put('adaptation_authorizations',row):await tx.insert('adaptation_authorizations',row);await tx.audit(actor,'adaptation.automatic_enabled',id,{version:row.version});return row;
}
export async function pathCurrent(tx,p){const r=await tx.get('adaptation_rules',p.ruleId);if(!r)return false;if(p.inputObservationIds&&digest((await pathInputs(tx,r,p.learnerId)).map(o=>o.id).sort())!==digest(p.inputObservationIds))return false;return r&&(await currentRule(tx,'adaptation_rules',r,['runId','activityId']))?.id===r.id&&await evidenceCurrent(tx,p.proofs);}
export async function authorizedProofs(tx,p){
 for(const proof of p.proofs){const o=await tx.get('competency_observations',proof.id);if(!o||o.learnerId!==p.learnerId)return false;try{await assignmentAccess(tx,o.assignmentId,{id:p.learnerId,role:'student'});}catch{return false;}
  const published=await tx.get('result_publications',o.submissionId);if(published?.version!==o.correctionVersion){const run=await tx.get('lesson_runs',o.runId),correction=await tx.get('corrections',o.submissionId);if(!run?.formativePolicy?.enabled||correction?.status!=='approved'||correction.version!==o.correctionVersion)return false;}
 }return true;
}
export async function assignActivity(tx,actor,p,target){
 const checked=await activityTarget(tx,actor,target);if(checked.lessonVersionId!==target.lessonVersionId)fail(409,'La version de l’activité a changé.');
 const run=await scoped(tx,'lesson_runs',target.runId,actor),learner=await learnerInScope(tx,p.learnerId,actor),original=await assignRun(tx,run,learner);requireValue(await availability(tx,original)!=='revoked','L’accès à cette activité a été retiré.');
 // Isolated persistent work, even when a previous occurrence is still open.
 const id='adapted-run_'+digest([p.id,target.runId,target.activityId]);let targeted=await tx.get('lesson_runs',id);
 if(!targeted)targeted=await tx.insert('lesson_runs',{id,classId:actor.classId,lessonId:run.lessonId,lessonVersionId:target.lessonVersionId,date:now().slice(0,10),availability:'open',parentRunId:run.id,targetLearnerId:learner.id,status:'planned',closedAt:null,adaptationProposalId:p.id});
 const a=await assignRun(tx,targeted,learner,{provenance:'adaptation'});a.adaptationProposalId=p.id;a.adaptationActivityId=target.activityId;await tx.put('lesson_assignments',a);
 const repriseId='path-reprise:'+p.id+':'+target.activityId;if(!await tx.get('learning_reprises',repriseId))await tx.insert('learning_reprises',{id:repriseId,classId:actor.classId,learnerId:learner.id,assignmentId:a.id,activityId:target.activityId,reason:'Prochaine activité : '+target.title+'. '+p.continuation,authorId:actor.id,status:'open',adaptationProposalId:p.id});return a;
}
export async function activatePath(tx,actor,id,input={}){
 const p=await scoped(tx,'adaptation_proposals',id,actor);
 await assignmentAccess(tx,p.sourceAssignmentId,{id:p.learnerId,role:'student'});
 if(!await pathCurrent(tx,p))fail(409,'Les preuves ou la règle ont changé. Recalculez le parcours.');
 if(p.assignmentId&&p.state!=='reconsider')return p;
 requireValue(p.state==='suggested'||p.state==='validated','Cette proposition ne peut plus être attribuée.');
 requireValue(await authorizedProofs(tx,p),'Publiez les révisions exactes des observations avant attribution.');
 requireValue(p.target,'Aucune activité adaptée disponible. Le parcours commun reste accessible.');
 const rule=await scoped(tx,'adaptation_rules',p.ruleId,actor),history=(await tx.list('adaptation_proposals',actor.classId)).filter(o=>o.learnerId===p.learnerId&&o.runId===p.runId&&o.id!==p.id&&o.assignmentId&&o.readiness!=='ready');
 const overlap=h=>h.prerequisites.some(a=>p.prerequisites.some(b=>a.frameworkVersionId===b.frameworkVersionId&&a.competencyId===b.competencyId&&a.criterionIds.some(id=>b.criterionIds.includes(id))));
 if(history.filter(overlap).length>=rule.maxCycles)fail(409,'La limite de consolidation est atteinte. Une intervention du professeur est nécessaire.');
 let authorization=null;
 if(input.automatic){authorization=await tx.get('adaptation_authorizations','automatic:'+p.runId);requireValue(authorization?.enabled&&authorization.expiresAt>now()&&authorization.learnerIds.includes(p.learnerId)&&authorization.rules.some(r=>r.id===p.ruleId&&r.version===p.ruleVersion)&&authorization.used<authorization.budget,'Autorisation automatique absente, expirée, révoquée ou épuisée.');requireValue(p.readiness!=='insufficient'&&p.proofs.length>0,'Preuves insuffisantes pour une attribution automatique.');}
 else requireValue(input.confirmed===true,'Validez la proposition avant attribution.');
 const a=await assignActivity(tx,actor,p,p.target);p.assignmentId=a.id;p.state='assigned';p.validatedAt=now();p.validatedBy=actor.id;p.automatic=!!authorization;p.authorizationVersion=authorization?.version||null;await tx.put('adaptation_proposals',p);
 if(authorization){authorization.used++;await tx.put('adaptation_authorizations',authorization);}await tx.audit(actor,'adaptation.assigned',id,{assignmentId:a.id,automatic:p.automatic});return p;
}
export async function beginVerification(tx,actor,id){
 const p=await scoped(tx,'adaptation_proposals',id,actor);requireValue(['assigned','realized','started_context_preserved'].includes(p.state),'Réalisez la reprise avant vérification.');
 const a=await scoped(tx,'lesson_assignments',p.assignmentId,actor),progress=await tx.get('learning_progress',a.progressId||a.id),work=(await tx.list('work_submissions',actor.classId)).filter(w=>w.assignmentId===a.id);
 requireValue(progress?.completed?.includes(p.activityId)||work.some(w=>w.completedActivityIds?.includes(p.activityId)),'La réalisation de l’activité doit être enregistrée.');
 const rule=await scoped(tx,'adaptation_rules',p.ruleId,actor);requireValue(rule.targets.verify,'Configurez une situation de vérification distincte.');
 if(p.verificationAssignmentId)return p;
 const verificationGrid=await activeGrid(tx,rule.targets.verify.lessonVersionId);requireValue(verificationGrid,'Configurez la grille de la situation de vérification avant son attribution.');for(const proof of p.proofs){const observed=await tx.get('competency_observations',proof.id);requireValue(observed.situationId!==verificationGrid.situationId,'La vérification doit avoir une origine pédagogique indépendante du diagnostic.');}
 const assigned=await assignActivity(tx,actor,p,rule.targets.verify);p.verificationAssignmentId=assigned.id;p.state='verification';await tx.put('adaptation_proposals',p);return p;
}
export async function verifyPath(tx,actor,id,input){
 const p=await scoped(tx,'adaptation_proposals',id,actor);if(['closed','teacher_required'].includes(p.state))return p;requireValue(p.state==='verification','Ouvrez d’abord la situation de vérification.');
 requireValue(input.reason?.trim(),'Justifiez la décision de poursuite.');
 const observations=(await latestObservations(tx,actor.classId,p.learnerId)).filter(o=>o.assignmentId===p.verificationAssignmentId&&o.submissionId===input.submissionId&&o.validated&&!o.practice),origins=[];
 for(const proof of p.proofs){const o=await tx.get('competency_observations',proof.id);origins.push(o.situationId);}
 requireValue(observations.length&&observations.every(o=>o.situationId&&!origins.includes(o.situationId)),'La vérification exige une nouvelle situation évaluée indépendante.');
 const passed=p.prerequisites.filter(r=>!r.newConcept).every(r=>r.criterionIds.every(id=>observations.some(o=>o.frameworkVersionId===r.frameworkVersionId&&o.competencyId===r.competencyId&&o.scaleKey===digest(r.categories)&&o.criteria.some(c=>c.criterionId===id&&rank(r.categories,c.grade)>=rank(r.categories,r.expectedGrade)&&rank(r.categories,c.maximumGrade)>=rank(r.categories,r.expectedGrade)))));
 const verificationProofs=observations.map(o=>({id:o.id,submissionId:o.submissionId,correctionVersion:o.correctionVersion,gridId:o.gridId}));requireValue(await authorizedProofs(tx,{...p,proofs:verificationProofs}),'Publiez la vérification avant de rendre sa décision visible.');
 if(passed){const rule=await scoped(tx,'adaptation_rules',p.ruleId,actor),next=await assignActivity(tx,actor,p,rule.targets.ready);p.continuationAssignmentId=next.id;}
 p.verification={submissionId:input.submissionId,proofs:verificationProofs,passed,reason:input.reason,authorId:actor.id,at:now()};p.state=passed?'closed':'teacher_required';await tx.put('adaptation_proposals',p);return p;
}
// Called in the same transaction as starting/saving work. Rights are rechecked even after start.
export async function assertPathStart(tx,a){
 if(!a.adaptationProposalId)return;
 const p=await tx.get('adaptation_proposals',a.adaptationProposalId);if(!p)fail(409,'Parcours à réexaminer.');
 await assignmentAccess(tx,p.sourceAssignmentId,{id:a.learnerId,role:'student'});
 const continuing=p.continuationAssignmentId===a.id;
 const target=continuing?(await tx.get('adaptation_rules',p.ruleId))?.targets.ready:p.verificationAssignmentId===a.id?(await tx.get('adaptation_rules',p.ruleId))?.targets.verify:p.target;
 const run=await tx.get('lesson_runs',target?.runId);if(!run||run.availability==='revoked')fail(404,'Accès retiré.');
 const originals=(await tx.list('lesson_assignments',a.classId)).filter(o=>o.runId===target.runId&&o.learnerId===a.learnerId);if(originals.some(o=>o.access==='revoked'))fail(404,'Accès retiré.');
 const progress=await tx.get('learning_progress',a.progressId||a.id),started=!!progress?.answers?.[a.adaptationActivityId||p.activityId]||progress?.completed?.length||(await tx.list('assessment_attempts',a.classId)).some(t=>t.assignmentId===a.id);
 if(!started&&(continuing?!await evidenceCurrent(tx,p.verification.proofs):!await pathCurrent(tx,p)))fail(409,'Cette activité doit être réexaminée par le professeur. Le parcours commun reste accessible.');
}
export async function classReadiness(tx,actor,ruleId){
 const rule=await scoped(tx,'adaptation_rules',ruleId,actor),assigned=(await tx.list('lesson_assignments',actor.classId)).filter(a=>a.runId===rule.runId),attempts=(await tx.list('assessment_attempts',actor.classId)).filter(a=>a.runId===rule.runId&&a.mode!=='practice'),proposals=(await tx.list('adaptation_proposals',actor.classId)).filter(p=>p.ruleId===rule.id),counts={assigned:assigned.length,submitted:unique(attempts.filter(a=>a.submissionId).map(a=>a.learnerId)).length,interpretable:0,ready:0,fragile:0,verify:0,insufficient:0};
 for(const a of assigned){const p=proposals.filter(p=>p.learnerId===a.learnerId).at(-1);if(!p||!await pathCurrent(tx,p)){counts.insufficient++;continue;}counts[p.readiness]++;if(p.readiness!=='insufficient')counts.interpretable++;}
 return {...counts,proposal:counts.fragile?`Proposer un rappel sur les prérequis : ${counts.fragile} élève(s) avec difficulté parmi ${counts.interpretable} observé(s), sur ${counts.assigned} attribué(s). À décider par le professeur.`:'Aucun ajustement collectif proposé.',calendarChanged:false};
}

export async function adaptiveAccessAllowed(tx,a){
 if(!a.adaptationProposalId)return true;
 const p=await tx.get('adaptation_proposals',a.adaptationProposalId);if(!p)return false;
 const source=await tx.get('lesson_assignments',p.sourceAssignmentId),sourceRun=source?await tx.get('lesson_runs',source.runId):null;
 if(!source||source.access!=='allowed'||!sourceRun||sourceRun.availability==='revoked')return false;
 const ownRun=await tx.get('lesson_runs',a.runId),parent=ownRun?.parentRunId?await tx.get('lesson_runs',ownRun.parentRunId):null;
 if(!parent||parent.availability==='revoked')return false;
 const original=(await tx.list('lesson_assignments',a.classId)).find(o=>o.runId===parent.id&&o.learnerId===a.learnerId);
 return !!original&&original.access==='allowed';
}

export async function applyAutomaticIfEnabled(tx,actor,p){
 const authorization=await tx.get('adaptation_authorizations','automatic:'+p.runId);
 if(!authorization?.enabled||p.state!=='suggested'||p.readiness==='insufficient')return p;
 try{return await activatePath(tx,actor,p.id,{automatic:true});}
 catch(error){if(!error.status)throw error;p.automaticError=error.message;await tx.put('adaptation_proposals',p);return p;}
}
export async function refreshPublishedPaths(tx,actor,runId,learnerId){
 for(const rule of (await tx.list('adaptation_rules',actor.classId)).filter(r=>r.runId===runId)){
  if((await currentRule(tx,'adaptation_rules',rule,['runId','activityId'])).id!==rule.id)continue;
  const p=await proposePath(tx,actor,{ruleId:rule.id,learnerId});await applyAutomaticIfEnabled(tx,actor,p);
 }
}
