import {grantFixture} from './fixtures/tracking-assignment.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {importDocument,originalDocument} from '../server/pedagogy/documents.mjs';
import {searchDocuments,buildDocumentIndex,classifySource,freezeDocumentContext,verifyContextAccess} from '../server/pedagogy/documentary-index.mjs';
import {freezeContent,canonical,sha256,snapshotView} from '../server/content-snapshots.mjs';
import {archiveSnapshot,runArchiveJob,gitCommand,readArchiveFile,readAuthorizedArchiveFile} from '../server/git-archive.mjs';
import {submitWork} from '../server/work-submissions.mjs';
import {saveLearningEvent} from '../server/progress.mjs';
import {pedagogyFixture,pilotDefinitions,buildPilot} from './fixtures/pedagogy.mjs';
import {prepareSnapshot,applySnapshot} from '../scripts/lib/database-migration.mjs';
import {PGlite} from '@electric-sql/pglite';

const actor={id:'teacher-documents',classId:'A1',role:'teacher'};
async function fixture(){return openStore({path:':memory:',url:''});}
async function source(store,text='# Modèle de boîte\nAvec border-box, width comprend padding et bordure.',input={}){return importDocument(store,actor,{filename:'box.md',role:'technical',...input},Buffer.from(text));}
test('original bytes, immutable extraction, idempotent reimport and index activation',async()=>{const store=await fixture();try{
 const a=await source(store),b=await source(store);assert.equal(a.id,b.id);assert.equal((await store.list('document_indexes')).length,1);assert.ok(a.documentId);assert.ok(a.extractionId);assert.equal((await originalDocument(a)).toString(),'# Modèle de boîte\nAvec border-box, width comprend padding et bordure.');
 const c=await source(store,'# Modèle de boîte\nVersion corrigée.');assert.equal(c.documentId,a.documentId);assert.equal(c.version,2);assert.equal(c.supersedes,a.id);
 assert.ok((await searchDocuments(store,actor,{query:'border-box'})).results.every(r=>r.sourceId===c.id));assert.ok((await searchDocuments(store,actor,{query:'border-box',sourceIds:[a.id]})).results.length);
}finally{await store.close();}});
test('literal identifiers, synonyms, code and table context retain verifiable anchors',async()=>{const store=await fixture();try{
 const s=await source(store,'# Boîte\ncontent-box augmente la largeur avec padding.\n```css\n.carte { box-sizing: border-box; }\n```\n| width | total |\n| 300 | 344 |');
 const result=await searchDocuments(store,actor,{query:'modèle de boîte'});assert.equal(result.results[0].sourceId,s.id);assert.match(result.results[0].segment.text,/\.carte \{/);assert.match(result.results[0].segment.text,/300 \| 344/);assert.match(result.results[0].segment.location,/lines:/);
 const exact=await searchDocuments(store,actor,{query:'box-sizing'});assert.ok(exact.results.length);assert.equal(exact.externalCalls,0);
 assert.equal((await searchDocuments(store,actor,{query:'protocole totalement absent zzz'})).gap,'Aucun passage pertinent dans le périmètre autorisé.');
}finally{await store.close();}});
test('annotations survive rebuild, a changed source requests review, classification cannot grant rights',async()=>{const store=await fixture();try{
 const s=await source(store);const updated=await classifySource(store,actor,s.id,{expectedVersion:0,values:{families:['Design'],topics:['css.box'],role:'exercise'}});
 await buildDocumentIndex(store,actor,s.id);const read=await store.get('pedagogical_sources',s.id);assert.equal(read.classification.role,'exercise');assert.equal(read.annotationVersion,1);assert.equal((await store.list('source_annotations')).length,1);
 await assert.rejects(classifySource(store,actor,s.id,{expectedVersion:0,values:{topics:[]}}),/Classement modifié/);
 await assert.rejects(classifySource(store,actor,s.id,{expectedVersion:1,values:{visibility:'student'}}),/Dimension/);
 const changed=await source(store,'# Nouveau texte\nCSS box-sizing.');assert.match(changed.annotationReview,/explicitement/);assert.equal(updated.visibility,'teacher');
}finally{await store.close();}});
test('permissions apply before retrieval and neighbor expansion, including historical context reuse',async()=>{const store=await fixture();try{
 const s=await source(store,'# Énoncé\nDessiner une carte.\n# Corrigé privé\nSECRET-REFERENCE',{role:'reference'});
 for(const user of [{id:'student',classId:'A1',role:'student'},{...actor,id:'other-teacher'},{...actor,classId:'A2'}])assert.deepEqual((await searchDocuments(store,user,{query:'SECRET'})).results,[]);
 const {manifest}=await freezeDocumentContext(store,actor,[s],{queries:['carte']});assert.equal(manifest.passages.length,2);
 s.access.revoked=true;await store.put('pedagogical_sources',s);
 assert.deepEqual((await searchDocuments(store,actor,{query:'SECRET'})).results,[]);
 await assert.rejects(verifyContextAccess(store,{sourceIds:[s.id],actor,documentContext:manifest}),/accessible/);
 assert.ok(await store.get('document_contexts',manifest.id));
}finally{await store.close();}});
test('bounded context keeps code intact, explicitly lists uncovered sections and fixes source versions',async()=>{const store=await fixture();try{
 const s=await source(store,'# Cible\n```js\nconst exemple = true;\n```\n# Annexe\n'+('documentation secondaire '.repeat(1000)));
 const {manifest,sources}=await freezeDocumentContext(store,actor,[s],{queries:['exemple'],maxCharacters:1000});assert.match(sources[0].segments[0].text,/const exemple = true/);assert.equal(manifest.omitted.length,1);assert.equal(manifest.scope[0].sourceHash,s.contentHash);
 const same=await freezeDocumentContext(store,actor,[s],{queries:['exemple'],maxCharacters:1000});assert.equal(same.manifest.id,manifest.id);
 await source(store,'# Version suivante\nAutre contenu.');assert.equal((await store.get('document_contexts',manifest.id)).passages[0].text,manifest.passages[0]?sources[0].segments[0].text:'wrong');
}finally{await store.close();}});
test('incomplete rebuild cannot replace active index and an index loss can be reconstructed',async()=>{const store=await fixture();try{
 const s=await source(store),before=s.activeIndexId;s.segments[0].location='';await store.put('pedagogical_sources',s);await assert.rejects(buildDocumentIndex(store,actor,s.id),/incomplets/);assert.equal((await store.get('pedagogical_sources',s.id)).activeIndexId,before);
 s.segments[0].location='line:1; lines:2-2';await store.put('pedagogical_sources',s);await store.remove('document_indexes',before);const rebuilt=await searchDocuments(store,actor,{query:'padding'});assert.equal(rebuilt.results.length,1);
}finally{await store.close();}});

async function frozen(store,eventId='submit-1',content='Premier état\n'){return store.transaction(tx=>freezeContent(tx,{classId:'A1',event:'work.submitted',eventId,subject:{kind:'work',learnerId:'opaque-student',lessonId:'lesson-1',lessonVersionId:'v1'},files:[{path:'main.js',content,audience:'student'}]}));}
test('receipt snapshot and outbox share a transaction; duplicate identities reject changed bytes',async()=>{const store=await fixture();try{
 await assert.rejects(store.transaction(async tx=>{await freezeContent(tx,{classId:'A1',event:'test',eventId:'rolled-back',subject:{},files:[{path:'x.txt',content:'x'}]});throw Error('rollback');}));assert.equal((await store.list('archive_outbox')).length,0);
 const s=await frozen(store);assert.equal((await frozen(store)).id,s.id);await assert.rejects(frozen(store,'submit-1','Changed'),/différent/);assert.equal((await store.list('content_snapshots')).length,1);assert.equal((await store.list('archive_outbox')).length,1);
 await assert.rejects(store.transaction(tx=>freezeContent(tx,{classId:'A1',event:'test',eventId:'traversal',subject:{},files:[{path:'../secret',content:'x'}]})),/Chemin/);
 await assert.rejects(snapshotView(store,s.id,{id:'other',classId:'A1',role:'student'}),/introuvable/);
}finally{await store.close();}});
test('real Git push reconciles a lost acknowledgement without a duplicate commit or overwritten work',async()=>{const store=await fixture(),directory=await mkdtemp(join(tmpdir(),'eden-archive-'));try{
 const config={repository:join(directory,'local.git'),id:'test-private',remote:join(directory,'remote.git')};await gitCommand(null,['init','--bare','--template=',config.remote]);
 const s=await frozen(store);await assert.rejects(archiveSnapshot(s,config,{afterPush:()=>{throw Error('crash after push');}}),/crash/);
 const archived=await archiveSnapshot(s,config);assert.match(archived.commit,/^[a-f0-9]{40}$/);assert.equal((await gitCommand(config.repository,['rev-list','--count',archived.ref])).trim(),'1');assert.equal(await gitCommand(config.remote,['show',`${archived.commit}:content/main.js`]),'Premier état\n');
 const second=await frozen(store,'submit-2','Nouvelle remise\n');const next=await archiveSnapshot(second,config);assert.notEqual(archived.commit,next.commit);assert.equal((await gitCommand(config.repository,['rev-list','--count',next.ref])).trim(),'2');assert.equal(await gitCommand(config.repository,['show',`${archived.commit}:content/main.js`]),'Premier état\n');
 assert.equal((await readArchiveFile(config,archived.commit,'content/main.js')).text,'Premier état\n');await assert.rejects(readArchiveFile(config,'main','content/main.js'),/SHA complet/);
}finally{await store.close();await rm(directory,{recursive:true,force:true});}});
test('archive outage preserves files; bounded retry and concurrent workers adopt one operation',async()=>{const store=await fixture(),directory=await mkdtemp(join(tmpdir(),'eden-outbox-'));try{
 const s=await frozen(store),config={repository:join(directory,'repo.git'),id:'test'};
 const result=await runArchiveJob(store,{config,project:async()=>{throw Error('Git offline');}});assert.equal(result.state,'retry');assert.equal((await snapshotView(store,s.id,{id:'opaque-student',classId:'A1',role:'student'})).files[0].content,'Premier état\n');
 result.availableAt=new Date(0).toISOString();await store.put('archive_outbox',result);
 let writes=0;await Promise.all([runArchiveJob(store,{config,project:async(...args)=>{writes++;return archiveSnapshot(...args);}}),runArchiveJob(store,{config,project:async(...args)=>{writes++;return archiveSnapshot(...args);}})]);assert.equal(writes,1);assert.equal((await store.get('archive_outbox',s.id)).state,'confirmed');
 assert.equal((await store.get('content_snapshots',s.id)).sha256,s.sha256);
}finally{await store.close();await rm(directory,{recursive:true,force:true});}});
async function learnerFixture(pilot=0){const f=await pedagogyFixture(),job=await buildPilot(f.store,f.actor,pilotDefinitions[pilot]),lesson=await f.store.get('lessons',job.lessonId);lesson.status='published';lesson.runId='synthetic-run';await f.store.put('lessons',lesson);const learner={id:'opaque-student',classId:'A1',role:'student'};await f.store.insert('assessment_attempts',{id:'done',classId:'A1',learnerId:learner.id,lessonVersionId:lesson.versionId,submissionId:'diagnostic-receipt'});await grantFixture(f.store,lesson,learner);return {...f,learner,lesson};}
test('Design and Programming freeze current bytes; late saves are rejected and resubmission preserves the original',async()=>{
 for(const pilot of [0,1]){const f=await learnerFixture(pilot);try{
  const input={requestId:'request-explicit-bytes',progressVersion:0,lessonId:f.lesson.id,lessonVersionId:f.lesson.versionId,answers:{guided:'LATEST EDIT BEFORE AUTOSAVE'}};
  const receipts=await Promise.all([submitWork(f.store,f.learner,input),submitWork(f.store,f.learner,input)]);assert.equal(receipts[0].id,receipts[1].id);
  const copy=await snapshotView(f.store,receipts[0].snapshotId,f.learner);assert.ok(copy.files.some(f=>/LATEST EDIT/.test(f.content)));assert.equal(copy.archival.state,'pending');
  await assert.rejects(saveLearningEvent(f.store,f.learner,{eventId:'later-save',lessonId:f.lesson.id,lessonVersionId:f.lesson.versionId,type:'answer_saved',activityId:'guided',payload:{answer:'NEXT EDIT'}}),/remis/);
  assert.equal((await snapshotView(f.store,copy.id,f.learner)).sha256,copy.sha256);
  const next=await submitWork(f.store,f.learner,{...input,requestId:'intentional-new-submission',answers:{guided:'NEXT EDIT'}});assert.equal(next.id,receipts[0].id);assert.equal((await f.store.list('work_submissions')).length,1);
  await assert.rejects(submitWork(f.store,f.learner,{...input,answers:{guided:'CHANGED SAME REQUEST'}}),/autre état/);
  await assert.rejects(saveLearningEvent(f.store,f.learner,{eventId:'fake-submit',lessonId:f.lesson.id,type:'lesson_submitted',payload:{answers:{}}}),/reçu durable/);
 }finally{await f.store.close();}}
});
test('shell submission requires actual snapshot bytes, excludes Git configuration and survives reset',async()=>{const f=await learnerFixture(2);try{
 const input={requestId:'shell-submission',progressVersion:0,lessonId:f.lesson.id,lessonVersionId:f.lesson.versionId,answers:{guided:'J’ai déplacé le fichier.'}};
 await assert.rejects(submitWork(f.store,f.learner,input),/incomplète/);assert.equal((await f.store.list('work_submissions')).length,0);
 const spec=(await f.store.get('lesson_versions',f.lesson.versionId)).spec;
 for(const a of spec.activities.filter(a=>a.workshop?.profile==='shell-git'))await f.store.insert('lab_sessions',{id:a.id,classId:'A1',assignmentId:(await f.store.list('lesson_assignments'))[0].id,learnerId:f.learner.id,lessonVersionId:f.lesson.versionId,activityId:a.id,remoteId:a.id,runtime:'fixture-runtime'});
 const laboratory=async()=>({files:[{path:'resultat.txt',base64:Buffer.from('Résultat exact').toString('base64')},{path:'.git/hooks/post-commit',base64:Buffer.from('untrusted hook').toString('base64')}],tracked:['resultat.txt'],committed:['resultat.txt']});
 const r=await submitWork(f.store,f.learner,input,{laboratory}),s=await snapshotView(f.store,r.snapshotId,f.learner);assert.ok(s.files.some(f=>f.content==='Résultat exact'));assert.ok(s.files.every(f=>!f.path.includes('.git')));assert.equal(s.manifest.versions.validation,'NOT RUN');
 for(const a of await f.store.list('lab_sessions'))await f.store.remove('lab_sessions',a.id);assert.equal((await snapshotView(f.store,s.id,f.learner)).sha256,s.sha256);
}finally{await f.store.close();}});
test('real pipeline fixture freezes documentary context per call and archives plans and candidate versions',async()=>{const f=await pedagogyFixture();try{
 const job=await buildPilot(f.store,f.actor,pilotDefinitions[0]);assert.ok(['fixture','blocked'].includes(job.status));assert.ok(job.documentContext.id);assert.ok(job.documentary);
 const calls=(await f.store.list('generation_calls')).filter(c=>c.jobId===job.id);assert.ok(calls.length>2);assert.ok(calls.every(c=>c.documentContext?.id===job.documentContext.id));
 const events=(await f.store.list('archive_outbox')).map(o=>o.event);assert.ok(events.includes('plan.validated'));assert.ok(events.includes('lesson.candidate'));assert.ok(events.includes('lesson.corrected'));
}finally{await f.store.close();}});

test('DOM submission freezes all three current files and rejects a missing editor revision',async()=>{const store=await fixture(),learner={id:'learner-dom',classId:'A1',role:'student'};try{
 await store.insert('lessons',{id:'dom-lesson',classId:'A1',status:'published',versionId:'dom-v1'});await store.insert('lesson_versions',{id:'dom-v1',classId:'A1',spec:{activities:[{id:'dom',title:'Interactions',required:true,type:'CodeEditor',workshop:{profile:'dom'}}],diagnostic:{tasks:[]}}});await store.insert('assessment_attempts',{id:'done',classId:'A1',learnerId:learner.id,lessonVersionId:'dom-v1',submissionId:'diagnostic'});
 await grantFixture(store,await store.get('lessons','dom-lesson'),learner);
 const input={requestId:'dom-current-files',progressVersion:0,lessonId:'dom-lesson',lessonVersionId:'dom-v1',answers:{}};await assert.rejects(submitWork(store,learner,input),/fichiers actuels/);
 const files=[{path:'index.html',content:'<button>Essayer</button>'},{path:'style.css',content:'button { color: blue; }'},{path:'main.js',content:'document.querySelector("button").onclick = () => console.log("clic");'}];
 const receipt=await submitWork(store,learner,{...input,answers:{dom:JSON.stringify({files})}}),snapshot=await snapshotView(store,receipt.snapshotId,learner);for(const f of files)assert.ok(snapshot.files.some(saved=>saved.path.endsWith('/'+f.path)&&saved.content===f.content));
}finally{await store.close();}});
test('Git imports require a confirmed ancestor and the same class file allowlist',async()=>{const store=await fixture(),directory=await mkdtemp(join(tmpdir(),'eden-git-import-'));try{
 const snapshot=await frozen(store),config={repository:join(directory,'private.git'),id:'authorized'};const archived=await runArchiveJob(store,{config});assert.equal(archived.state,'confirmed');
 assert.equal((await readAuthorizedArchiveFile(store,actor,config,archived.archive.commit,'content/main.js')).text,snapshot.files[0].content);
 await assert.rejects(readAuthorizedArchiveFile(store,{...actor,classId:'A2'},config,archived.archive.commit,'content/main.js'),/périmètre/);
 await assert.rejects(readAuthorizedArchiveFile(store,actor,config,archived.archive.commit,'config'),/liste autorisée/);
}finally{await store.close();await rm(directory,{recursive:true,force:true});}});

test('SQLite/object/Git restoration into PostgreSQL preserves manifests and rebuilds indexes with teacher annotations',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'eden-document-restore-')),path=join(directory,'source.sqlite'),artifacts=join(directory,'artifacts'),old=process.env.EDEN_ARTIFACT_PATH;
 process.env.EDEN_ARTIFACT_PATH=artifacts;const store=await openStore({path,url:''});let pg;
 try{
  const s=await source(store);await classifySource(store,actor,s.id,{expectedVersion:0,values:{topics:['human-correction']}});
  const snap=await store.transaction(tx=>freezeContent(tx,{classId:'A1',event:'restore-test',eventId:'fixed',subject:{kind:'work',lessonId:'lesson',learnerId:'opaque-student'},files:[{path:'answer.txt',content:'état figé',audience:'student'}],external:[{path:'original.md',...s.original,audience:'student'}]}));
  const config={repository:join(directory,'private.git'),id:'restore-test'};const archive=await runArchiveJob(store,{config});assert.equal(archive.state,'confirmed');
  const backup=await prepareSnapshot({source:path,artifactDirectory:artifacts});assert.equal(backup.report.artifacts.uniqueLocalFiles,1);
  pg=new PGlite();const client={query:(sql,args)=>args?.length?pg.query(sql,args):pg.exec(sql).then(results=>results.at(-1)||{rows:[]})};await applySnapshot(client,backup);
  const read=async(table,id)=>JSON.parse((await pg.query(`select data from ${table} where id=$1`,[id])).rows[0].data);
  const restored=await read('content_snapshots',snap.id);assert.equal(restored.sha256,sha256(canonical(restored.manifest)));assert.equal(restored.files[0].content,'état figé');assert.equal(Buffer.from(restored.externalObjects[0].base64,'base64').toString(),(await originalDocument(s)).toString());
  const sourceRestored=await read('pedagogical_sources',s.id);assert.equal((await originalDocument(sourceRestored)).toString(),(await originalDocument(s)).toString());assert.deepEqual(sourceRestored.classification.topics,['human-correction']);
  // Restored repository is independent, including the historical accepted commit.
  const clone=join(directory,'restored.git');await gitCommand(null,['clone','--bare',config.repository,clone]);assert.equal(await gitCommand(clone,['show',`${archive.archive.commit}:content/answer.txt`]),'état figé');
  await store.remove('document_indexes',s.activeIndexId);await buildDocumentIndex(store,actor,s.id);assert.deepEqual((await store.get('pedagogical_sources',s.id)).classification.topics,['human-correction']);
 }finally{await pg?.close();await store.close();if(old===undefined)delete process.env.EDEN_ARTIFACT_PATH;else process.env.EDEN_ARTIFACT_PATH=old;await rm(directory,{recursive:true,force:true});}
});
