import {randomBytes} from 'node:crypto';
import {teacher,student,loggedIn,passwordHash,replacePassword,safeUser} from './auth.mjs';
import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {sha256,canonical} from './content-snapshots.mjs';
import {studentSpec} from './generator.mjs';
import {reviseCorrection,submitAttempt} from './assessment.mjs';
import {migrateTracking,member,memberKey,assignRun,assignmentAccess,assignmentSummary,lessonContext,pageRows,ownedAttempt,safeAttempt,resultFor,publishResult,newAttempt,startAttempt,saveAttempt,availability} from './student-tracking.mjs';

export function parseStudentCSV(text){
 requireValue(typeof text==='string'&&text.length<=300000,'Liste CSV trop volumineuse.');
 const delimiter=text.split(/\r?\n/)[0].includes(';')?';':',',rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===delimiter||c==='\n')){row.push(value.trim());value='';if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}else if(c!=='\r')value+=c;}
 requireValue(!quoted,'Guillemets CSV non fermés.');row.push(value.trim());if(row.some(Boolean))rows.push(row);
 const header=rows.shift()?.map(h=>h.replace(/^\uFEFF/,'').toLowerCase());requireValue(header?.includes('username')&&header.includes('displayname'),'En-têtes attendus : username,displayName.');requireValue(rows.length<=500,'Import limité à 500 élèves.');
 return rows.map((cells,index)=>({line:index+2,username:cells[header.indexOf('username')]||'',displayName:cells[header.indexOf('displayname')]||'',invalid:cells.length!==header.length}));
}
async function previewStudents(tx,actor,input){
 const candidates=input.csv!==undefined?parseStudentCSV(input.csv):[{line:1,...input}],existing=await tx.list('learners',actor.classId),seen=new Set();
 const rows=[];
 for(const r of candidates){const username=String(r.username||'').trim(),displayName=String(r.displayName||'').trim(),matches=existing.filter(l=>l.username===username);let error=null;
  if(r.invalid||!/^[-\p{L}\p{N}_.@]{2,80}$/u.test(username)||!displayName||displayName.length>160)error='Nom ou identifiant invalide.';
  if(seen.has(username))error='Identifiant répété dans ce fichier.';seen.add(username);
  if(matches.length>1||matches.length===1&&matches[0].displayName!==displayName)error='Identité ambiguë : vérifiez le nom associé à cet identifiant.';
  rows.push({line:r.line,username,displayName,action:error?'error':matches.length?'existing':'create',learnerId:matches[0]?.id||null,error});
 }
 return {rows,token:sha256(canonical(rows)),canApply:rows.length>0&&!rows.some(r=>r.error)};
}
async function applyStudents(tx,actor,input){
 const preview=await previewStudents(tx,actor,input);requireValue(preview.canApply,'Corrigez les lignes signalées avant l’import.');if(input.token!==preview.token)fail(409,'La classe a changé. Vérifiez à nouveau l’aperçu.');
 const rows=[];for(const r of preview.rows){if(r.action==='existing'){rows.push(r);continue;}
  const password=randomBytes(12).toString('base64url'),learner=await tx.insert('learners',{id:uid('learner'),classId:actor.classId,role:'student',username:r.username,displayName:r.displayName,passwordHash:passwordHash(password)});await member(tx,learner);
  rows.push({...r,learnerId:learner.id,password});await tx.audit(actor,'learner.created',learner.id);
 }
 return {rows};
}
async function managedLearner(tx,id,actor){
 const l=await tx.get('learners',id),membership=await tx.get('enrollments',memberKey(actor.classId,id));
 if(!l||(!membership&&l.classId!==actor.classId))fail(404,'Élève introuvable.');return l;
}
async function assertGlobalRights(tx,l,actor){
 const classes=new Set([l.classId,...(await tx.list('enrollments')).filter(e=>e.learnerId===l.id&&e.status==='active').map(e=>e.classId)]);
 if([...classes].some(c=>c!==actor.classId))fail(403,'Ce compte est partagé entre plusieurs classes. Seul le rattachement à votre classe peut être administré ici.');
}
export function trackingRoutes(app,store){
 let migration=Promise.resolve();
 app.use('/api',async(req,res,next)=>{
  if(!req.user||!/^\/(tracking|today|assessments|events|labs|dom|lessons|teacher\/submissions|preparation\/remediation|work-submissions)(\/|$)/.test(req.path))return next();
  // Serial and additive. This also captures rosters imported before the upgrade.
  migration=migration.catch(()=>{}).then(()=>store.transaction(tx=>migrateTracking(tx,req.user.classId)));
  await migration;next();
 });
 app.get('/api/tracking/classes',teacher,async(req,res)=>res.json({items:[{id:req.user.classId,title:req.user.classId}]}));
 app.get('/api/tracking/migration',teacher,async(req,res)=>res.json(await store.get('tracking_migrations','tracking-v1:'+req.user.classId)));
 app.post('/api/tracking/students/preview',teacher,async(req,res)=>res.json(await previewStudents(store,req.user,req.body)));
 app.post('/api/tracking/students/import',teacher,async(req,res)=>res.json(await store.transaction(tx=>applyStudents(tx,req.user,req.body))));
 app.get('/api/tracking/students',teacher,async(req,res)=>{
  await store.transaction(async tx=>{for(const l of await tx.list('learners',req.user.classId))await member(tx,l);});
  const memberships=await store.list('enrollments',req.user.classId),q=String(req.query.q||'').toLocaleLowerCase('fr'),rows=[];
  for(const m of memberships){if((m.status==='archived')!==(req.query.archived==='true'))continue;const l=await store.get('learners',m.learnerId);if(!l||!`${l.displayName} ${l.username}`.toLocaleLowerCase('fr').includes(q))continue;
   const assignments=(await store.list('lesson_assignments',req.user.classId)).filter(a=>a.learnerId===l.id&&(!req.query.runId||a.runId===req.query.runId));
   const summaries=await Promise.all(assignments.map(a=>assignmentSummary(store,a,{teacher:true})));
   const toCorrect=summaries.reduce((n,s)=>n+(s.pendingCount||0),0),toResume=summaries.some(s=>s.reprises.some(r=>r.status==='open')),missing=summaries.some(s=>!s.attempts.some(a=>a.submissionId));
   if(req.query.status==='correct'&&!toCorrect||req.query.status==='resume'&&!toResume||req.query.status==='missing'&&!missing)continue;
   rows.push({...safeUser(l),classId:req.user.classId,status:m.status,suspended:!!l.suspended,toCorrect,toResume,context:req.query.runId?'Passation sélectionnée':'Toutes les attributions de cette classe'});
  }res.json(pageRows(rows,req.query));
 });
 app.get('/api/tracking/students/:id',teacher,async(req,res)=>{
  const l=await managedLearner(store,req.params.id,req.user),assignments=(await store.list('lesson_assignments',req.user.classId)).filter(a=>a.learnerId===l.id);
  const memberships=(await store.list('enrollments')).filter(m=>m.learnerId===l.id&&m.status==='active');
  const observations=(await store.list('evidence',req.user.classId)).filter(e=>e.learnerId===l.id).map(e=>({id:e.id,criterion:e.criterion,level:e.level,date:e.date,sourceId:e.sourceId,revision:e.revision,approved:e.approved,source:'correction'}));
  for(const o of await store.list('teacher_observations',req.user.classId))if(o.learnerId===l.id)observations.push({id:o.id,criterion:o.criterion,level:o.level,date:o.date,note:o.note,source:'teacher',approved:true});
  observations.sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.revision||0)-(a.revision||0));
  const latestCriteria=new Set();for(const o of observations){o.latest=!latestCriteria.has(o.criterion);latestCriteria.add(o.criterion);if(o.sourceId){const copy=await store.get('submissions',o.sourceId);o.proofAvailable=!!copy&&copy.classId===req.user.classId;}}
  res.json({student:{...safeUser(l),suspended:!!l.suspended},canManageAccount:l.classId===req.user.classId&&memberships.every(m=>m.classId===req.user.classId),membership:await store.get('enrollments',memberKey(req.user.classId,l.id)),assignments:pageRows(await Promise.all(assignments.map(a=>assignmentSummary(store,a,{teacher:true}))),req.query),observations});
 });
 app.patch('/api/tracking/students/:id',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{
  const l=await managedLearner(tx,req.params.id,req.user),input=req.body;
  if(input.displayName!==undefined||input.username!==undefined||input.suspended!==undefined){await assertGlobalRights(tx,l,req.user);
   if(input.displayName!==undefined){requireValue(typeof input.displayName==='string'&&input.displayName.trim()&&input.displayName.length<=160,'Nom invalide.');l.displayName=input.displayName.trim();}
   if(input.username!==undefined){requireValue(/^[-\p{L}\p{N}_.@]{2,80}$/u.test(input.username),'Identifiant invalide.');if((await tx.list('learners',l.classId)).some(o=>o.id!==l.id&&o.username===input.username))fail(409,'Identifiant déjà utilisé.');l.username=input.username;}
   if(input.suspended!==undefined){requireValue(typeof input.suspended==='boolean','État du compte invalide.');l.suspended=input.suspended;l.authVersion=(l.authVersion||0)+1;}
   await tx.put('learners',l);
  }
  if(input.membership!==undefined){requireValue(['active','archived'].includes(input.membership),'État de rattachement invalide.');const m=await member(tx,l,req.user.classId);m.status=input.membership;await tx.put('enrollments',m);}
  await tx.audit(req.user,'learner.updated',l.id,{fields:Object.keys(input)});return safeUser(l);
 })));
 app.post(['/api/tracking/students/:id/access','/api/teacher/learners/:id/access'],teacher,async(req,res)=>res.json(await store.transaction(async tx=>{const l=await managedLearner(tx,req.params.id,req.user);await assertGlobalRights(tx,l,req.user);const password=randomBytes(12).toString('base64url');await replacePassword(tx,l,'student',password);await tx.audit(req.user,'learner.access_reset',l.id);return {username:l.username,password};})));
 app.get('/api/tracking/runs',teacher,async(req,res)=>{
  const rows=[];for(const r of await store.list('lesson_runs',req.user.classId)){const v=await store.get('lesson_versions',r.lessonVersionId);rows.push({id:r.id,lessonId:r.lessonId,title:v?.spec.title||'Contexte incomplet',date:r.date,availability:await availability(store,{runId:r.id,access:'allowed'})});}res.json(pageRows(rows.reverse(),req.query));
 });
 app.post('/api/tracking/runs',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{
  const lesson=await scoped(tx,'lessons',req.body.lessonId,req.user);requireValue(lesson.publicationId||lesson.status==='published','Publiez la séance avant sa diffusion.');requireValue(/^\d{4}-\d{2}-\d{2}$/.test(req.body.date),'Date attendue.');requireValue(typeof req.body.requestId==='string'&&req.body.requestId.length<=100,'Identité de diffusion attendue.');
  const publication=lesson.publicationId?await scoped(tx,'lesson_publications',lesson.publicationId,req.user):null;
  requireValue(Array.isArray(req.body.learnerIds)&&req.body.learnerIds.length<=500,'Élèves attendus (500 maximum).');
  const requestHash=sha256(canonical({lessonId:lesson.id,date:req.body.date,learnerIds:[...new Set(req.body.learnerIds)].sort()}));
  const id='run_'+sha256(req.user.id+':'+req.body.requestId),existing=await tx.get('lesson_runs',id);if(existing){if(existing.requestHash!==requestHash)fail(409,'Cette demande de diffusion a déjà un autre contenu.');return existing;}
  const r=await tx.insert('lesson_runs',{id,classId:req.user.classId,lessonId:lesson.id,lessonVersionId:publication?.lessonVersionId||lesson.versionId,date:req.body.date,requestHash,status:'planned',availability:'open',closedAt:null});
  for(const learnerId of req.body.learnerIds||[]){const l=await managedLearner(tx,learnerId,req.user);await assignRun(tx,r,l);}
  await tx.audit(req.user,'run.created',r.id);return r;
 })));
 app.patch('/api/tracking/runs/:id',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{
  const r=await scoped(tx,'lesson_runs',req.params.id,req.user);requireValue(['closed','archived','revoked'].includes(req.body.availability),'État de disponibilité invalide.');r.availability=req.body.availability;r.submissionsClosedAt||=now();await tx.put('lesson_runs',r);await tx.audit(req.user,'run.availability',r.id,{availability:r.availability});return r;
 })));
 app.post('/api/tracking/runs/:id/assign',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{
  const r=await scoped(tx,'lesson_runs',req.params.id,req.user);requireValue(Array.isArray(req.body.learnerIds)&&req.body.learnerIds.length<=500,'Élèves attendus.');const rows=[];
  for(const id of req.body.learnerIds){const l=await managedLearner(tx,id,req.user);rows.push(await assignRun(tx,r,l));}return {items:rows};
 })));
 app.get('/api/tracking/runs/:id',teacher,async(req,res)=>{
  const run=await scoped(store,'lesson_runs',req.params.id,req.user),rows=[];
  for(const a of (await store.list('lesson_assignments',req.user.classId)).filter(a=>a.runId===run.id)){const l=await store.get('learners',a.learnerId);rows.push({...await assignmentSummary(store,a,{teacher:true}),displayName:l?.displayName||'Compte conservé'});}
  res.json({run,rows:pageRows(rows,req.query)});
 });
 app.post('/api/tracking/runs/:id/publish',teacher,async(req,res)=>{
  await scoped(store,'lesson_runs',req.params.id,req.user);requireValue(Array.isArray(req.body.copies)&&req.body.copies.length<=100,'Copies attendues (100 maximum).');const results=[];
  for(const copy of req.body.copies){try{const p=await store.transaction(async tx=>{const s=await scoped(tx,'submissions',copy.id,req.user),a=await tx.get('assessment_attempts',s.attemptId),assigned=a?.assignmentId?await tx.get('lesson_assignments',a.assignmentId):null;if(assigned?.runId!==req.params.id)fail(404,'Copie hors de cette passation.');return publishResult(tx,copy.id,req.user,copy);});results.push({id:copy.id,status:'published',version:p.version});}catch(e){results.push({id:copy.id,status:'failed',error:e.status?e.message:'Publication indisponible. Réessayez.'});}}
  res.json({results,published:results.filter(r=>r.status==='published').length,failed:results.filter(r=>r.status==='failed').length});
 });
 app.get('/api/tracking/assignments/:id',loggedIn,async(req,res)=>res.json(await store.transaction(async tx=>{
  const a=await assignmentAccess(tx,req.params.id,req.user);const context=await lessonContext(tx,{...req.user,id:a.learnerId},a,{attemptId:req.query.attempt});
  if(req.user.role==='teacher'){const v=await tx.get('lesson_versions',a.lessonVersionId);context.teacherSpec=v.spec;context.summary=await assignmentSummary(tx,a,{teacher:true});}return context;
 })));
 app.patch('/api/tracking/assignments/:id',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{const a=await assignmentAccess(tx,req.params.id,req.user);requireValue(['allowed','revoked'].includes(req.body.access),'Droit invalide.');a.access=req.body.access;await tx.put('lesson_assignments',a);return {id:a.id,access:a.access};})));
 app.get('/api/tracking/mine',student,async(req,res)=>{
  const q=String(req.query.q||'').toLocaleLowerCase('fr'),rows=[];
  for(const a of (await store.list('lesson_assignments')).filter(a=>a.learnerId===req.user.id&&a.access==='allowed')){const row=await assignmentSummary(store,a);if(row.availability==='revoked')continue;if(!`${row.title} ${row.notion}`.toLocaleLowerCase('fr').includes(q)||req.query.state&&row.state!==req.query.state)continue;rows.push(row);}
  rows.sort((a,b)=>(b.availability==='open'&&b.state==='En cours')-(a.availability==='open'&&a.state==='En cours')||String(b.date).localeCompare(String(a.date)));res.json(pageRows(rows,req.query));
 });
 app.get('/api/tracking/attempts/:id',loggedIn,async(req,res)=>{
  const a=req.user.role==='student'?await ownedAttempt(store,req.params.id,req.user):await scoped(store,'assessment_attempts',req.params.id,req.user),v=await store.get('lesson_versions',a.lessonVersionId),s=a.submissionId?await store.get('submissions',a.submissionId):null;
  const result=await resultFor(store,a),c=req.user.role==='teacher'&&s?await store.get('corrections',s.id):null;
  const original=v?.spec||{title:'Contexte historique incomplet',diagnostic:s?.diagnostic||{tasks:[],rubric:[]}};
  const spec=req.user.role==='teacher'?original:studentSpec(original,{published:result.status==='published'});
  let nextAttemptId=null;if(req.user.role==='teacher'&&a.runId){const copies=(await store.list('assessment_attempts',req.user.classId)).filter(t=>t.runId===a.runId&&t.submissionId);const index=copies.findIndex(t=>t.id===a.id);nextAttemptId=copies[index+1]?.id||null;}
  res.json({attempt:safeAttempt(a),nextAttemptId,runId:a.runId,title:spec?.title,diagnostic:spec?.diagnostic,answers:s?.answers||a.answers,history:req.user.role==='teacher'?s?.history:undefined,correction:c,result,provenance:v?'version-conservée':'contexte-incomplet'});
 });
 app.post('/api/tracking/submissions/:id/publish',teacher,async(req,res)=>res.json(await store.transaction(tx=>publishResult(tx,req.params.id,req.user,req.body))));
 app.post('/api/tracking/attempts/:id/close',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{const a=await scoped(tx,'assessment_attempts',req.params.id,req.user);requireValue(a.targetedOpen,'Fermez la passation collective depuis la vue de classe.');a.closedAt||=now();await tx.put('assessment_attempts',a);return safeAttempt(a);}))); 
 app.post('/api/tracking/submissions/:id/practice',student,async(req,res)=>res.json(await store.transaction(async tx=>{const s=await tx.get('submissions',req.params.id);if(!s||s.learnerId!==req.user.id)fail(404,'Copie introuvable.');await ownedAttempt(tx,s.attemptId,req.user);return newAttempt(tx,s,req.user,{...req.body,reason:'Entraînement personnel',mode:'practice'});}))); 
 app.post('/api/tracking/reprises',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{
  const input=req.body,l=await managedLearner(tx,input.learnerId,req.user),run=await scoped(tx,'lesson_runs',input.runId,req.user),v=await tx.get('lesson_versions',run.lessonVersionId);
  requireValue(typeof input.reason==='string'&&input.reason.trim()&&input.reason.length<=2000,'Motif pédagogique attendu.');requireValue(v.spec.activities.some(a=>a.id===input.activityId),'Activité introuvable.');
  if(input.sourceSubmissionId){const source=await scoped(tx,'submissions',input.sourceSubmissionId,req.user);requireValue(source.learnerId===l.id,'La copie source appartient à un autre élève.');}
  const original=await assignRun(tx,run,l);let assigned=original;
  requireValue(await availability(tx,original)!=='revoked','Rétablissez explicitement l’accès à cette attribution.');
  if(await availability(tx,original)!=='open'){
   const targeted=await tx.insert('lesson_runs',{id:uid('reprise-run'),classId:req.user.classId,lessonId:run.lessonId,lessonVersionId:run.lessonVersionId,date:now().slice(0,10),availability:'open',parentRunId:run.id,targetLearnerId:l.id,status:'planned',closedAt:null});assigned=await assignRun(tx,targeted,l,{provenance:'remediation'});assigned.progressId=assigned.id;await tx.put('lesson_assignments',assigned);
  }
  requireValue(assigned.access==='allowed','Rétablissez explicitement l’accès à cette attribution.');
  return tx.insert('learning_reprises',{id:uid('reprise'),classId:req.user.classId,learnerId:l.id,assignmentId:assigned.id,activityId:input.activityId,reason:input.reason,sourceSubmissionId:input.sourceSubmissionId||null,authorId:req.user.id,status:'open'});
 })));
 // Existing endpoints now share the same owned, versioned work and publication boundary.
 app.post('/api/assessments/:id/start',student,async(req,res)=>res.json(await store.transaction(tx=>startAttempt(tx,req.user,{...req.body,lessonId:req.params.id}))));
 app.post('/api/assessments/:id/save',student,async(req,res)=>res.json(await store.transaction(tx=>saveAttempt(tx,req.user,req.params.id,req.body))));
 app.get('/api/assessments/:id/result',student,async(req,res)=>res.json(await resultFor(store,await ownedAttempt(store,req.params.id,req.user))));
 app.post('/api/assessments/:id/submit',student,async(req,res)=>{const s=await submitAttempt(store,req.params.id,req.body.answers,req.user,{draftVersion:req.body.draftVersion});res.json({submissionId:s.id,sha256:s.sha256,receivedAt:s.submittedAt});});
 app.post('/api/teacher/submissions/:id/reopen',teacher,async(req,res)=>res.json(await store.transaction(async tx=>newAttempt(tx,await scoped(tx,'submissions',req.params.id,req.user),req.user,{...req.body,mode:'retake'}))));
}
