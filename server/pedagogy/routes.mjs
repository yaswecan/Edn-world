import {findAssignment,resultFor} from '../student-tracking.mjs';
import express from 'express';
import {teacher,student} from '../auth.mjs';
import {requireValue,scoped} from '../store.mjs';
import {importDocument,sourceSummary,fetchAllowedURL,sourceRoles,originalDocument} from './documents.mjs';
import {canReadSource,authorizedSource,searchDocuments,classifySource,buildDocumentIndex,verifyContextAccess} from './documentary-index.mjs';
import {archiveConfig,readAuthorizedArchiveFile} from '../git-archive.mjs';
import {snapshotView} from '../content-snapshots.mjs';
import {editLesson} from '../domain.mjs';
import {compileCorpus} from '../corpus.mjs';
import {enqueueGeneration,cancelGeneration,resumeGeneration,reconcilePreparation,reviseGeneration,choosePreparationSession,ownedJob,jobSummary,qualityEnabled} from './jobs.mjs';
import {coursePolicy,runtimeManifest} from './policy.mjs';
import {aiStatus} from '../ai/settings.mjs';
import {mechanisms,runtimeProfiles} from './catalog.mjs';
import {testActivityCode} from '../workshop-testing.mjs';
import {diagnosticObservation,diagnosticSupport} from './diagnostics.mjs';
import {studentSpec} from '../generator.mjs';

async function jobView(store,job){
 await verifyContextAccess(store,job);
 const candidates=(await store.list('generation_candidates',job.classId)).filter(c=>c.jobId===job.id);
 const pack=(await store.list('corpus_packages',job.classId)).find(c=>c.lessonVersionId===job.lessonVersionId);
 const candidate=candidates.find(c=>c.lessonVersionId===job.lessonVersionId&&(c.revision||1)===(job.revision||1));
 const view=jobSummary({...job,candidateCount:candidates.length,candidateVersionId:candidate?.lessonVersionId||null});
 view.corpus={available:!!pack,versionId:pack?.lessonVersionId||null,complete:!!candidate&&pack?.complete===true,missing:pack?candidate?[]:['Conception, rédaction ou vérifications de la révision en cours non terminées.']:['Export de cette version non compilé.']};
 return view;
}

export function pedagogyRoutes(app,store,{chatgpt}={}){
 app.get('/api/preparation/config',teacher,async(req,res)=>res.json({enabled:qualityEnabled(),...await aiStatus(store,req.user,{chatgpt}),sourceRoles,mechanisms,runtimeProfiles,coursePolicy,capabilities:runtimeManifest(),labConfigured:!!process.env.EDEN_LAB_URL}));
 app.get('/api/preparation/sources',teacher,async(req,res)=>res.json((await store.list('pedagogical_sources',req.user.classId)).filter(s=>canReadSource(s,req.user)).map(sourceSummary)));
 app.get('/api/preparation/search',teacher,async(req,res)=>res.json(await searchDocuments(store,req.user,{query:req.query.q||'',role:req.query.role,technicalVersion:req.query.technicalVersion})));
 app.post('/api/preparation/sources/:id/classification',teacher,async(req,res)=>res.json(sourceSummary(await classifySource(store,req.user,req.params.id,req.body))));
 app.post('/api/preparation/sources/:id/reindex',teacher,async(req,res)=>{const index=await buildDocumentIndex(store,req.user,req.params.id);res.json({id:index.id,status:index.status});});
 app.get('/api/preparation/sources/:id/passages/:segment',teacher,async(req,res)=>{const s=await authorizedSource(store,req.params.id,req.user);const p=s.segments.find(p=>p.id===req.params.segment);requireValue(p,'Passage introuvable.');res.json({sourceId:s.id,version:s.version,sourceHash:s.contentHash,title:s.title,passage:p});});
 app.post('/api/preparation/sources/:id/access',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{const s=await scoped(tx,'pedagogical_sources',req.params.id,req.user);requireValue((s.ownerId||req.user.id)===req.user.id&&typeof req.body.revoked==='boolean','Seul le propriétaire peut modifier cet accès.');s.access={...s.access,revoked:req.body.revoked};await tx.put('pedagogical_sources',s);await tx.audit(req.user,'source.access_changed',s.id,{revoked:s.access.revoked});return {id:s.id,revoked:s.access.revoked};})));
 app.post('/api/preparation/sources/git',teacher,async(req,res)=>{const config=archiveConfig();requireValue(config&&req.body.repositoryId===config.id,'Dépôt non autorisé.');const file=await readAuthorizedArchiveFile(store,req.user,config,req.body.commit,req.body.path);res.status(201).json(sourceSummary(await importDocument(store,req.user,{filename:req.body.path.split('/').at(-1),role:req.body.role||'reference',sourceKey:`git:${config.id}:${req.body.path}`,git:{repositoryId:file.repositoryId,commit:file.commit,path:file.path}},Buffer.from(file.text))));});
 app.post('/api/preparation/lessons/:id/import-git',teacher,async(req,res)=>{const config=archiveConfig();requireValue(config&&req.body.repositoryId===config.id,'Dépôt non autorisé.');const file=await readAuthorizedArchiveFile(store,req.user,config,req.body.commit,'content/lesson.json');const spec=JSON.parse(file.text);requireValue(spec.lessonId===req.params.id,'Le fichier appartient à une autre séance.');const lesson=await editLesson(store,req.params.id,{version:req.body.expectedVersion,spec,reason:`Import contrôlé ${config.id}@${file.commit} (${file.sha256})`},req.user);await compileCorpus(store,lesson.id,req.user);res.json(lesson);});
 app.get('/api/preparation/archives',teacher,async(req,res)=>res.json({configured:!!archiveConfig(),items:(await store.list('archive_outbox',req.user.classId)).map(({lease,...row})=>row)}));
 app.get('/api/preparation/snapshots/:id',teacher,async(req,res)=>res.json(await snapshotView(store,req.params.id,req.user)));
 app.post('/api/preparation/archives/:id/retry',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{const row=await scoped(tx,'archive_outbox',req.params.id,req.user);requireValue(['retry','failed','pending'].includes(row.state),'Archivage actif ou confirmé.');row.state='pending';row.attempts=0;row.availableAt=new Date().toISOString();await tx.audit(req.user,'archive.retry_requested',row.id);return tx.put('archive_outbox',row);})));
 app.post('/api/preparation/sources',teacher,express.raw({type:'application/octet-stream',limit:'8mb'}),async(req,res)=>{
  const input={filename:decodeURIComponent(String(req.headers['x-source-filename']||'')),title:decodeURIComponent(String(req.headers['x-source-title']||'')),role:String(req.headers['x-source-role']||'reference'),declaredVersion:decodeURIComponent(String(req.headers['x-source-version']||''))};
  res.status(201).json(sourceSummary(await importDocument(store,req.user,input,req.body)));
 });
 app.post('/api/preparation/sources/url',teacher,async(req,res)=>{const result=await fetchAllowedURL(req.body.url);const filename=result.contentType.includes('pdf')?'source.pdf':result.contentType.includes('html')?'source.html':'source.txt';res.status(201).json(sourceSummary(await importDocument(store,req.user,{...req.body,filename,sourceKey:result.url,sourceURL:result.url},result.buffer)));});
 app.post('/api/preparation/sources/:id/verify',teacher,async(req,res)=>{
  requireValue(req.body.confirmed===true&&typeof req.body.reason==='string'&&req.body.reason.trim(),'Confirmer et décrire les vérifications de l’extraction.');
  const s=await authorizedSource(store,req.params.id,req.user);requireValue(s.segments.length&&!s.warnings.some(w=>/Page \d+ vide/.test(w)),'Extraction vide ou pages manquantes : importer une transcription complète.');
  s.status='extracted';s.extractionVerification={by:req.user.id,reason:req.body.reason,at:new Date().toISOString()};await store.put('pedagogical_sources',s);res.json(sourceSummary(s));
 });
 app.get('/api/preparation/sources/:id/original',teacher,async(req,res)=>{const s=await authorizedSource(store,req.params.id,req.user);res.type('application/octet-stream').attachment(s.filename).send(await originalDocument(s));});
 app.get('/api/preparation/jobs',teacher,async(req,res)=>{const rows=[];for(const j of (await store.list('generation_jobs',req.user.classId)).filter(j=>j.actor?.id===req.user.id)){try{await verifyContextAccess(store,j);rows.push(jobSummary(j));}catch{rows.push({id:j.id,status:'blocked',stage:j.stage,reason:'Accès documentaire révoqué.',brief:{entry:{objective:'Préparation à accès documentaire restreint'}}});}}res.json(rows.reverse());});
 app.post('/api/preparation/jobs',teacher,async(req,res)=>res.status(202).json(jobSummary(await enqueueGeneration(store,req.user,req.body,{chatgpt}))));
 app.get('/api/preparation/jobs/:id',teacher,async(req,res)=>{const job=await ownedJob(store,req.params.id,req.user);res.json({...await jobView(store,job),callsTrace:(await store.list('generation_calls',req.user.classId)).filter(c=>c.jobId===job.id).map(({output,partialOutput,schema,...c})=>({...c,partialCharacters:partialOutput?.length||0}))});});
 app.get('/api/preparation/jobs/:id/passages/:segment',teacher,async(req,res)=>{const job=await ownedJob(store,req.params.id,req.user);await verifyContextAccess(store,job);requireValue(job.documentContext,'Contexte documentaire absent.');const context=await scoped(store,'document_contexts',job.documentContext.id,req.user),p=context.passages.find(p=>p.segmentId===req.params.segment);requireValue(p,'Passage non transmis dans ce contexte.');const source=job.sources.find(s=>s.id===p.sourceId);res.json({sourceId:p.sourceId,sourceHash:p.sourceHash,title:source?.title||'Référence documentaire',version:source?.version||1,passage:{id:p.segmentId,location:p.location,text:p.text}});});
 app.get('/api/preparation/jobs/:id/preview',teacher,async(req,res)=>{const job=await ownedJob(store,req.params.id,req.user);requireValue(job.lessonVersionId,'Aperçu pas encore disponible.');const version=await scoped(store,'lesson_versions',job.lessonVersionId,req.user);res.json({spec:studentSpec(version.spec),preparation:await jobView(store,job)});});
 app.post('/api/preparation/jobs/:id/cancel',teacher,async(req,res)=>res.json(jobSummary(await cancelGeneration(store,req.params.id,req.user))));
 app.post('/api/preparation/jobs/:id/resume',teacher,async(req,res)=>res.json(jobSummary(await resumeGeneration(store,req.params.id,req.user,req.body,{chatgpt}))));
 app.post('/api/preparation/jobs/:id/reconcile',teacher,async(req,res)=>res.json(jobSummary(await reconcilePreparation(store,req.params.id,req.user))));
 app.post('/api/preparation/jobs/:id/revise',teacher,async(req,res)=>res.json(jobSummary(await reviseGeneration(store,req.params.id,req.user,req.body))));
 app.post('/api/preparation/jobs/:id/session',teacher,async(req,res)=>res.json(jobSummary(await choosePreparationSession(store,req.params.id,req.user,req.body))));
 app.get('/api/preparation/jobs/:id/revisions',teacher,async(req,res)=>{await ownedJob(store,req.params.id,req.user);const rows=(await store.list('generation_revisions',req.user.classId)).filter(r=>r.jobId===req.params.id);for(const r of rows)await verifyContextAccess(store,r.snapshot);res.json(rows.map(r=>({id:r.id,revision:r.revision,reason:r.reason,preparation:jobSummary(r.snapshot)})));});
 app.get('/api/preparation/jobs/:id/candidates',teacher,async(req,res)=>{const job=await ownedJob(store,req.params.id,req.user);await verifyContextAccess(store,job);res.json((await store.list('generation_candidates',req.user.classId)).filter(c=>c.jobId===req.params.id));});
 app.post('/api/preparation/jobs/:id/test',teacher,async(req,res)=>{
  const job=await ownedJob(store,req.params.id,req.user);requireValue(job.lessonId,'Brouillon pas encore disponible.');
  requireValue(!req.body.lessonVersionId||req.body.lessonVersionId===job.lessonVersionId,'L’aperçu a changé : rechargez-le.');
  const spec=(await scoped(store,'lesson_versions',job.lessonVersionId,req.user)).spec;
  const task=[...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===req.body.taskId);requireValue(task&&typeof req.body.code==='string'&&req.body.code.length<=10000,'Exercice et code attendus.');res.json(await testActivityCode(task,req.body.code));
 });
 app.get('/api/preparation/diagnostic/:lessonId',teacher,async(req,res)=>{
  const lesson=await scoped(store,'lessons',req.params.lessonId,req.user),spec=(await store.get('lesson_versions',lesson.diagnosticVersionId||lesson.versionId)).spec;
  const attempts=(await store.list('assessment_attempts',req.user.classId)).filter(a=>a.lessonVersionId===(lesson.diagnosticVersionId||lesson.versionId));
  const observations=[];for(const learner of await store.list('learners',req.user.classId)){const a=attempts.filter(a=>a.learnerId===learner.id).at(-1),correction=a?.submissionId?await store.get('corrections',a.submissionId):null;
   observations.push({learnerId:learner.id,name:learner.displayName||learner.username,attemptId:a?.id||null,status:diagnosticObservation(a,correction),next:!a?'Inviter à commencer le diagnostic.':!correction||correction.score==null?'Relire la réponse avant de conclure.':correction.score<15?'Reprendre l’exemple travaillé puis un essai guidé ; objectif commun conservé.':'Parcours normal puis transfert.'});
  }res.json({lessonId:lesson.id,prerequisites:spec.prerequisites,observations});
 });
 app.get('/api/preparation/remediation/:lessonId',student,async(req,res)=>{
  const assigned=await findAssignment(store,req.user,{lessonId:req.params.lessonId,assignmentId:req.query.assignment});
  const attempt=(await store.list('assessment_attempts',assigned.classId)).filter(a=>a.learnerId===req.user.id&&a.assignmentId===assigned.id).at(-1);
  const spec=(await store.get('lesson_versions',assigned.lessonVersionId)).spec,result=await resultFor(store,attempt),correction=result.status==='published'?result:null;
  res.json({observation:diagnosticObservation(attempt,correction),support:correction?diagnosticSupport(spec,correction):[],message:'Retrouve tes retours publiés dans Mes évaluations.'});
 });
}
