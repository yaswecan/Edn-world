import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {studentSpec} from './generator.mjs';
import {sha256,canonical} from './content-snapshots.mjs';

export const assignmentKey=(runId,learnerId)=>'assignment_'+sha256(runId+'\0'+learnerId);
export const memberKey=(classId,learnerId)=>'membership_'+sha256(classId+'\0'+learnerId);
export const meaningful=answers=>Object.values(answers||{}).some(v=>typeof v==='string'?v.trim():v!=null);
export async function member(tx,learner,classId=learner.classId){
 const id=memberKey(classId,learner.id),existing=await tx.get('enrollments',id);
 if(existing)return existing;
 return tx.insert('enrollments',{id,classId,learnerId:learner.id,status:'active'});
}
export async function assignRun(tx,run,learner,{versionId=run.lessonVersionId,provenance='publication'}={}){
 const id=assignmentKey(run.id,learner.id),old=await tx.get('lesson_assignments',id);if(old)return old;
 return tx.insert('lesson_assignments',{id,classId:run.classId,learnerId:learner.id,lessonId:run.lessonId,runId:run.id,lessonVersionId:versionId,date:run.date,progressId:provenance.startsWith('legacy')?`${learner.id}:${versionId}`:id,access:'allowed',provenance,assignedAt:now()});
}
export async function distributeRun(tx,run){
 for(const l of await tx.list('learners',run.classId)){
  const enrollment=await member(tx,l);if(enrollment.status==='active'&&!l.suspended)await assignRun(tx,run,l);
 }
}
// Additive and restartable: original rows stay intact. No title/name matching.
export async function migrateTracking(tx,classId){
 const key='tracking-v1:'+classId,done=await tx.get('tracking_migrations',key);if(done)return done;
 const issues=[],learners=await tx.list('learners',classId),lessons=await tx.list('lessons',classId),attempts=await tx.list('assessment_attempts',classId),progress=await tx.list('learning_progress',classId),runs=await tx.list('lesson_runs',classId);
 for(const l of learners)await member(tx,l);
 for(const lesson of lessons){
  if((!lesson.runId||!runs.some(r=>r.id===lesson.runId))&&lesson.status!=='draft'){
   const version=await tx.get('lesson_versions',lesson.versionId);if(!version){issues.push({lessonId:lesson.id,reason:'Version de séance absente'});continue;}
   const run=await tx.insert('lesson_runs',{id:lesson.runId||'legacy-run:'+lesson.id,classId,lessonId:lesson.id,lessonVersionId:version.id,date:lesson.date||version.spec.date,status:lesson.status,availability:lesson.status==='published'?'open':'closed',closedAt:lesson.status==='published'?null:lesson.createdAt||now(),provenance:'legacy'});
   lesson.runId=run.id;await tx.put('lessons',lesson);runs.push(run);
  }
  const run=runs.find(r=>r.id===lesson.runId);if(!run)continue;
  // Only the existing roster is captured at upgrade. Future enrolments require
  // explicit distribution; historical attribution from this roster is labelled.
  for(const learner of learners){
   const a=attempts.find(a=>a.learnerId===learner.id&&a.lessonId===lesson.id&&a.lessonVersionId===run.lessonVersionId),p=progress.find(p=>p.learnerId===learner.id&&p.lessonVersionId===run.lessonVersionId);
   if(lesson.status==='draft'&&!a&&!p)continue;
   if(!await tx.get('lesson_versions',run.lessonVersionId)){issues.push({learnerId:learner.id,lessonId:lesson.id,reason:'Contexte historique introuvable, réponses originales conservées'});continue;}
   await assignRun(tx,run,learner,{provenance:a||p?'legacy-stable-id':'legacy-roster'});

  }
 }
 // Link only an explicit run or a unique matching version. Multiple dates for
 // the same version remain unresolved instead of merging the pupils' work.
 for(const [table,rows] of [['assessment_attempts',attempts],['learning_progress',progress],['work_submissions',await tx.list('work_submissions',classId)],['lab_sessions',await tx.list('lab_sessions',classId)]])for(const row of rows){
  if(row.assignmentId||row.preview)continue;
  const l=typeof row.learnerId==='string'?await tx.get('learners',row.learnerId):null,v=typeof row.lessonVersionId==='string'?await tx.get('lesson_versions',row.lessonVersionId):null;
  const matching=runs.filter(r=>r.lessonVersionId===row.lessonVersionId&&(!row.lessonId||r.lessonId===row.lessonId)&&(!row.runId||r.id===row.runId));
  if(l&&v&&matching.length===1){const a=await assignRun(tx,matching[0],l,{provenance:'legacy-stable-id'});row.assignmentId=a.id;row.runId=matching[0].id;if(table==='assessment_attempts')row.draftVersion??=0;if(table==='learning_progress'){a.progressId=row.id;await tx.put('lesson_assignments',a);}await tx.put(table,row);}
  else issues.push({table,recordId:row.id,reason:!v?'Version historique absente : données originales conservées':matching.length>1?'Plusieurs passations correspondent : rattachement manuel nécessaire':'Attribution historique non déterminée'});
 }

 for(const c of await tx.list('corrections',classId))if(!await tx.get('submissions',c.submissionId||c.id))issues.push({correctionId:c.id,reason:'Correction existante sans copie liée : résultat conservé'});
 return tx.insert('tracking_migrations',{id:key,classId,issues,policy:'Attributions initiales du registre existant, provenance signalée ; aucune nouvelle publication de résultat.'});
}
export async function assignmentAccess(tx,id,actor){
 const a=await tx.get('lesson_assignments',id);
 const run=a?await tx.get('lesson_runs',a.runId):null;
 if(!a||actor.role==='student'&&run?.availability==='revoked'||(actor.role==='student'?(a.learnerId!==actor.id||a.access!=='allowed'):a.classId!==actor.classId))fail(404,'Travail introuvable.');
 return a;
}
export async function availability(tx,a){
 const run=await tx.get('lesson_runs',a.runId);if(!run)return 'closed';
 if(a.access!=='allowed'||run.availability==='revoked')return 'revoked';
 if(run.availability==='archived')return 'archived';
 if(run.closedAt)return 'closed';
 if(run.openAt&&run.openAt>now()||a.openAt&&a.openAt>now())return 'waiting';
 return run.availability|| (run.closedAt?'closed':'open');
}
export async function assertWritable(tx,a){if(await availability(tx,a)!=='open')fail(409,'Cette passation est fermée. Ton travail reste consultable.');}
export async function findAssignment(tx,actor,{assignmentId,lessonId,lessonVersionId}={}){
 if(assignmentId){const a=await assignmentAccess(tx,assignmentId,actor);if(lessonId&&a.lessonId!==lessonId)fail(404,'Séance introuvable.');if(lessonVersionId&&a.lessonVersionId!==lessonVersionId)fail(409,'Le travail appartient à une autre version.');return a;}
 const rows=[];for(const a of await tx.list('lesson_assignments'))if(a.learnerId===actor.id&&a.lessonId===lessonId&&a.access==='allowed'&&(!lessonVersionId||a.lessonVersionId===lessonVersionId)&&await availability(tx,a)!=='revoked')rows.push(a);
 if(rows.length){for(const row of rows){const p=await tx.get('learning_progress',row.progressId||`${actor.id}:${row.lessonVersionId}`);const attempts=(await tx.list('assessment_attempts',row.classId)).filter(a=>a.assignmentId===row.id);if(meaningful(p?.answers)||attempts.some(a=>meaningful(a.answers)||a.submissionId))return row;}return rows.at(-1);}
 fail(404,'Cette séance ne t’a pas été attribuée.');
}
export async function ownedAttempt(tx,id,actor,{write=false}={}){
 const a=await tx.get('assessment_attempts',id);if(!a||a.learnerId!==actor.id)fail(404,'Tentative introuvable.');
 if(a.assignmentId){const assigned=await assignmentAccess(tx,a.assignmentId,actor);if(write){if(a.mode==='practice'){if(await availability(tx,assigned)==='revoked')fail(404,'Travail introuvable.');}else if(a.targetedOpen===true){if(a.closedAt)fail(409,'Cette reprise est fermée.');}else await assertWritable(tx,assigned);}}
 else if(a.classId!==actor.classId)fail(404,'Tentative introuvable.');
 if(write&&a.submissionId)fail(409,'Copie déjà figée.');return a;
}
export function safeAttempt(a){if(!a)return null;return {id:a.id,assignmentId:a.assignmentId,lessonId:a.lessonId,lessonVersionId:a.lessonVersionId,answers:a.answers||{},submissionId:a.submissionId||null,draftVersion:a.draftVersion||0,mode:a.mode||'diagnostic',afterCorrection:!!a.afterCorrection,number:a.number||1,savedAt:a.savedAt||null,closedAt:a.closedAt||null,targetedOpen:!!a.targetedOpen};}
export async function startAttempt(tx,actor,input){
 const assigned=await findAssignment(tx,actor,input),all=(await tx.list('assessment_attempts',assigned.classId)).filter(a=>a.learnerId===actor.id&&a.assignmentId===assigned.id);
 if(input.attemptId){const a=await ownedAttempt(tx,input.attemptId,actor);if(a.assignmentId!==assigned.id)fail(404,'Tentative introuvable.');return safeAttempt(a);}
 const existing=all.find(a=>!a.previousSubmissionId&&a.mode!=='practice')||all.filter(a=>a.mode!=='practice').at(-1);if(existing)return safeAttempt(existing);
 await assertWritable(tx,assigned);
 return safeAttempt(await tx.insert('assessment_attempts',{id:uid('attempt'),classId:assigned.classId,learnerId:actor.id,lessonId:assigned.lessonId,lessonVersionId:assigned.lessonVersionId,assignmentId:assigned.id,runId:assigned.runId,mode:'diagnostic',number:1,draftVersion:0,status:'started',answers:{},history:[],firstAttempt:{},lastAttempt:{},executions:0,hints:0}));
}
export function checkDraftVersion(a,input){if(input.draftVersion!==(a.draftVersion||0))fail(409,'Le travail a changé dans un autre onglet. Recharge la copie avant de réessayer ; ta saisie reste disponible.',{draftVersion:a.draftVersion||0});}
export async function saveAttempt(tx,actor,id,input){
 const a=await ownedAttempt(tx,id,actor,{write:true});
 requireValue(input.answers&&typeof input.answers==='object'&&!Array.isArray(input.answers)&&JSON.stringify(input.answers).length<=150000,'Réponses invalides.');
 const signature=sha256(canonical({answers:input.answers,draftVersion:input.draftVersion}));
 if(input.requestId&&a.lastSave?.requestId===input.requestId){if(a.lastSave.signature!==signature)fail(409,'Cette sauvegarde a déjà un autre contenu.');return {attemptId:a.id,receivedAt:a.savedAt,draftVersion:a.draftVersion};}
 checkDraftVersion(a,input);
 const v=await tx.get('lesson_versions',a.lessonVersionId),known=new Set(v.spec.diagnostic.tasks.map(t=>t.id));
 // The existing page keeps workshop and diagnostic answers together; save only
 // diagnostic fields, never browser-computed scores or arbitrary properties.
 a.answers=Object.fromEntries(Object.entries(input.answers).filter(([id])=>known.has(id)));
 for(const value of Object.values(a.answers))requireValue(typeof value==='string'&&value.length<=100000,'Réponse invalide.');
 a.draftVersion=(a.draftVersion||0)+1;a.savedAt=now();a.lastSave={requestId:input.requestId,signature};await tx.put('assessment_attempts',a);
 return {attemptId:a.id,receivedAt:a.savedAt,draftVersion:a.draftVersion};
}
export function publicCorrection(c){return {version:c.version,status:'published',score:c.score,scoreMax:c.scoreMax,level:c.level,feedback:c.feedback,source:'teacher',approvedAt:c.approvedAt,items:(c.items||[]).map(i=>({id:i.id,taskId:i.taskId,label:i.label,criterion:i.criterion,points:i.points,max:i.max,feedback:i.feedback,source:i.source||'teacher',evidence:i.evidence||null})),criteria:(c.criteria||[]).map(i=>({criterion:i.criterion,points:i.points,max:i.max,level:i.level}))};}
export async function resultFor(tx,a){
 if(!a?.submissionId)return {status:'not_submitted'};
 const p=await tx.get('result_publications',a.submissionId);if(p)return {...p.result,publishedAt:p.publishedAt};
 const c=await tx.get('corrections',a.submissionId);return {status:c?.status==='approved'?'results_pending':'submitted'};
}
export async function publishResult(tx,id,actor,input){
 const s=await scoped(tx,'submissions',id,actor),c=await scoped(tx,'corrections',id,actor),a=await tx.get('assessment_attempts',s.attemptId);
 requireValue(a?.mode!=='practice','Un entraînement ne publie pas un résultat diagnostique.');
 requireValue(c.status==='approved','Cette copie reste à corriger.');
 if(input.version!==c.version)fail(409,'La correction a changé. Relisez-la avant publication.');
 const assigned=a?.assignmentId?await tx.get('lesson_assignments',a.assignmentId):null;
 const run=await tx.get('lesson_runs',assigned?.runId||a?.runId);
 requireValue(a?.targetedOpen?a.closedAt:run&&(run.closedAt||['closed','archived'].includes(run.availability)),'Fermez cette passation avant de publier ses résultats.');
 const old=await tx.get('result_publications',id);if(old?.version===c.version)return old;
 const row={id,classId:s.classId,learnerId:s.learnerId,assignmentId:assigned?.id,version:c.version,result:publicCorrection(c),publishedAt:now(),publishedBy:actor.id};
 if(old)await tx.put('result_publications',row);else await tx.insert('result_publications',row);
 await tx.audit(actor,'result.published',id,{revision:c.version});return row;
}
export async function newAttempt(tx,s,actor,{mode='retake',reason,requestId}={}){
 requireValue(reason?.trim()&&reason.length<=2000,'Indiquez le motif de la reprise.');
 const original=await tx.get('assessment_attempts',s.attemptId);requireValue(original?.assignmentId,'Le contexte de cette copie doit être réconcilié avant une reprise.');
 const assigned=await assignmentAccess(tx,original.assignmentId,actor),all=(await tx.list('assessment_attempts',s.classId)).filter(a=>a.assignmentId===assigned.id);
 if(requestId){const same=all.find(a=>a.requestId===requestId);if(same)return safeAttempt(same);}
 const current=all.find(a=>a.mode===mode&&!a.submissionId&&!a.closedAt);if(current)return safeAttempt(current);
 requireValue(await availability(tx,assigned)!=='revoked','L’accès à cette activité a été retiré.');
 const p=await tx.get('result_publications',s.id);
 const a=await tx.insert('assessment_attempts',{id:uid('attempt'),classId:s.classId,learnerId:s.learnerId,lessonId:s.lessonId,lessonVersionId:s.lessonVersionId,assignmentId:assigned.id,runId:assigned.runId,number:all.length+1,mode,afterCorrection:!!p,targetedOpen:true,openedAt:now(),previousSubmissionId:s.id,reason,requestId,draftVersion:0,status:'started',answers:mode==='practice'?structuredClone(s.answers):{},history:[],firstAttempt:{},lastAttempt:{},executions:0,hints:0});
 await tx.audit(actor,'attempt.authorized',a.id,{mode,previousSubmissionId:s.id,reason});return safeAttempt(a);
}
export function pageRows(rows,query={}){const offset=Math.max(0,Number(query.offset)||0),limit=Math.min(100,Math.max(1,Number(query.limit)||30));return {items:rows.slice(offset,offset+limit),total:rows.length,offset,limit};}
export async function assignmentSummary(tx,a,{teacher=false}={}){
 const v=await tx.get('lesson_versions',a.lessonVersionId),p=await tx.get('learning_progress',a.progressId||`${a.learnerId}:${a.lessonVersionId}`),attempts=(await tx.list('assessment_attempts',a.classId)).filter(t=>t.assignmentId===a.id),works=(await tx.list('work_submissions',a.classId)).filter(w=>w.assignmentId===a.id),available=await availability(tx,a);
 const significant=meaningful(p?.answers)||attempts.some(t=>meaningful(t.answers)||t.submissionId),required=(v?.spec.activities||[]).filter(a=>a.required!==false),done=attempts.some(t=>t.mode!=='practice'&&t.submissionId)&&required.every(t=>p?.completed?.includes(t.id)||works.some(w=>w.completedActivityIds?.includes(t.id)));
 const state=done?'Terminée':significant?'En cours':'À commencer';
 const initial=attempts.find(t=>!t.previousSubmissionId&&t.mode!=='practice'),result=await resultFor(tx,initial);
 const status=initial?.submissionId?(result.status==='published'?'Résultats disponibles':result.status==='results_pending'?'Résultats en préparation':teacher?'À corriger':'Rendu'):available!=='open'?(significant?'Fermée — travail non remis':'Fermée — aucun rendu'):teacher?'Aucun rendu':significant?'En cours':'À faire';
 const reprises=(await tx.list('learning_reprises',a.classId)).filter(r=>r.assignmentId===a.id&&r.learnerId===a.learnerId);
 const attemptRows=[];for(const t of attempts){const c=teacher&&t.submissionId?await tx.get('corrections',t.submissionId):null;attemptRows.push({id:t.id,number:t.number||1,mode:t.mode||'diagnostic',afterCorrection:!!t.afterCorrection,submissionId:t.submissionId||null,targetedOpen:!!t.targetedOpen,closedAt:t.closedAt||null,...(teacher?{correctionVersion:c?.version,correctionStatus:c?.status}: {})});}
 return {id:a.id,learnerId:a.learnerId,lessonId:a.lessonId,runId:a.runId,title:v?.spec.title||'Contexte historique incomplet',date:a.date,notion:(v?.spec.skills||[]).join(' · '),state,status,availability:available,action:available!=='open'||done||works.length?'Revoir':significant?'Reprendre':'Commencer',provenance:teacher?a.provenance:undefined,attempts:attemptRows,pendingCount:teacher?attemptRows.filter(t=>t.submissionId&&t.correctionStatus!=='approved').length:undefined,reprises:reprises.map(r=>({id:r.id,activityId:r.activityId,reason:r.reason,status:p?.completed?.includes(r.activityId)?'completed':'open'})),workSubmissions:works.map(w=>({id:w.id,acceptedAt:w.acceptedAt})),result:result.status==='published'?result:null};
}
export async function lessonContext(tx,actor,a,{attemptId}={}){
 const summary=await assignmentSummary(tx,a),v=await tx.get('lesson_versions',a.lessonVersionId);if(!v)fail(409,'Le contexte historique est incomplet. Contacte ton professeur.');
 const all=(await tx.list('assessment_attempts',a.classId)).filter(t=>t.assignmentId===a.id),attempt=attemptId?all.find(t=>t.id===attemptId):(all.find(t=>!t.previousSubmissionId&&t.mode!=='practice')||all.filter(t=>t.mode!=='practice').at(-1));
 if(attemptId&&!attempt)fail(404,'Tentative introuvable.');
 const published=attempt?await resultFor(tx,attempt):null;
 const selectedVersion=attempt?await tx.get('lesson_versions',attempt.lessonVersionId):v;
 const spec=studentSpec(v.spec,{published:published?.status==='published'});if(attempt)spec.diagnostic=studentSpec(selectedVersion.spec,{published:published?.status==='published'}).diagnostic;
 const writable=(summary.availability==='open'&&!summary.workSubmissions.length||attempt?.targetedOpen&&!attempt.closedAt)&&a.access==='allowed';
 return {assignmentId:a.id,readOnly:!writable,summary,lesson:{id:a.lessonId,title:spec.title,date:a.date,version:v.version,versionId:a.lessonVersionId,runId:a.runId,status:writable?'published':'completed',assignmentId:a.id,spec},attempt:safeAttempt(attempt),progress:await tx.get('learning_progress',a.progressId||`${actor.id}:${a.lessonVersionId}`),events:[],date:a.date,displayDate:a.date};
}

export async function lessonForWork(tx,actor,input){
 const assigned=await findAssignment(tx,actor,input);await assertWritable(tx,assigned);
 const submitted=(await tx.list('work_submissions',assigned.classId)).some(s=>s.assignmentId===assigned.id);
 if(submitted)fail(409,'Cette copie a déjà été remise.');
 return {id:assigned.lessonId,classId:assigned.classId,versionId:assigned.lessonVersionId,runId:assigned.runId,assignmentId:assigned.id};
}
