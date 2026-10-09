import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {randomBytes} from 'node:crypto';
import {diagnosticRevisionFixture} from './fixtures/diagnostic-revision.mjs';
import {openStore,TABLES,schemaSQL,uid,now} from '../server/store.mjs';
import {compileCorpus} from '../server/corpus.mjs';
import {preparePublication} from '../server/publication-readiness.mjs';
import {publishLesson,editLesson,lessonQuality} from '../server/domain.mjs';
import {sha256} from '../server/content-snapshots.mjs';
import {exportLessons,readTransfer,beginUpload,writeChunk,previewTransfer,applyTransfer,ownedTransfer} from '../server/lesson-transfer.mjs';
import {decodePackage,encodePackage,LIMITS,contentFingerprint} from '../server/lesson-package.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';
import {importDocument} from '../server/pedagogy/documents.mjs';
import {seedCatalog,explorationForMission} from '../server/game.mjs';
import {PGlite} from '@electric-sql/pglite';
import {lessonContext} from '../server/student-tracking.mjs';
import {submitAttempt} from '../server/assessment.mjs';

import {transferFixture as fixture,png} from './fixtures/lesson-transfer.mjs';
async function exported(f,ids=[f.lesson.id]){const e=await exportLessons(f.store,ids,f.actor);return {...e,...await readTransfer(f.store,e.id,f.actor)};}
async function upload(f,bytes){const t=await beginUpload(f.store,{bytes:bytes.length,sha256:sha256(bytes)},f.actor);for(let i=0;i<t.chunks;i++)await writeChunk(f.store,t.id,i,bytes.subarray(i*t.chunkBytes,(i+1)*t.chunkBytes),f.actor);return t;}
const preview=(f,t,choices)=>previewTransfer(f.store,t.id,choices?{choices}:{},f.actor);
const apply=(f,t,p)=>applyTransfer(f.store,t.id,{token:p.token,confirmed:true},f.actor);
const businessTables=TABLES.filter(t=>!t.startsWith('lesson_transfer')&&t!=='audit_log');
const snapshot=async store=>Object.fromEntries(await Promise.all(businessTables.map(async t=>[t,await store.list(t)])));
async function addCopy(f,suffix){const id=`${f.lesson.id}-${suffix}`,v=await f.store.get('lesson_versions',f.lesson.versionId),lesson=await f.store.insert('lessons',{...f.lesson,id,versionId:id+':v1'});await f.store.insert('lesson_versions',{...v,id:lesson.versionId,lessonId:id,spec:{...v.spec,lessonId:id}});const pack=(await f.store.list('corpus_packages')).find(p=>p.lessonVersionId===f.lesson.versionId);await f.store.insert('corpus_packages',{...pack,id:'pack-'+suffix,lessonId:id,lessonVersionId:lesson.versionId});return lesson;}
async function close(...fixtures){for(const f of fixtures)await f.store.close();}

test('rich content, files, citations and private corrections round trip between independent stores',async()=>{
 const source=await fixture({rich:true}),dest=await fixture();try{
  const e=await exported(source),pack=await decodePackage(e.bytes);assert.equal(pack.lessons.length,1);for(const f of pack.lessons[0].payload.corpus.files.filter(f=>/\.(?:html|css|json|txt)$/.test(f.path)))assert.ok(!pack.files.get(f.sha256).toString().includes('http://localhost:4181/assets/eden-logo.png'));assert.ok(!JSON.stringify(pack).includes('passwordHash'));assert.ok(!pack.lessons[0].payload.corpus.files.some(f=>f.path.includes('groupes-remediation')));
  for(const f of pack.lessons[0].payload.corpus.files.filter(f=>f.path.endsWith('.json')))assert.doesNotThrow(()=>JSON.parse(pack.files.get(f.sha256).toString()));
  const t=await upload(dest,e.bytes),before=await snapshot(dest.store),p=await preview(dest,t);assert.deepEqual(await snapshot(dest.store),before);assert.equal(p.rows[0].status,'new');assert.equal(p.canApply,true);
  const attached=await preview(dest,t,p.choices.map(c=>({...c,entryId:'box'}))),r=await apply(dest,t,attached),id=r.lessons[0].id;
  assert.equal(r.lessons[0].publication,'draft');assert.notEqual(id,source.lesson.id);
  const lesson=await dest.store.get('lessons',id),v=await dest.store.get('lesson_versions',lesson.versionId);assert.equal(v.spec.activities.length,source.spec.activities.length);assert.match(v.spec.activities.find(a=>a.workshop?.document).workshop.document,/data:image\/png;base64/);
  assert.ok(v.spec.activities.find(a=>a.workshop?.visual).workshop.visual.id!==sha256(png));assert.equal((await dest.store.list('pedagogical_sources')).length,1);
  const again=await exported(dest,[id]),decoded=await decodePackage(again.bytes);assert.equal(decoded.lessons[0].revision,pack.lessons[0].revision);assert.deepEqual([...decoded.files].sort(),[...pack.files].sort());
  const repeat=await preview(dest,t);assert.equal(repeat.rows[0].status,'identical');const versions=(await dest.store.list('lesson_versions')).length;assert.equal((await apply(dest,t,repeat)).lessons[0].status,'identical');assert.equal((await dest.store.list('lesson_versions')).length,versions);
  assert.deepEqual(await apply(dest,t,attached),r);
 }finally{await close(source,dest);}
});

test('published replacement keeps link and attachments, removes old blocks, separates learner work',async()=>{
 const source=await fixture(),dest=await fixture();try{
  const learner=await dest.store.insert('learners',{id:'student',classId:'A1',role:'student',displayName:'Élève de recette'});
  await preparePublication(dest.store,dest.lesson.id,{version:1},dest.actor);await publishLesson(dest.store,dest.lesson.id,dest.actor,{version:1,confirmed:true});
  const old=await dest.store.get('lessons',dest.lesson.id),v=await source.store.get('lesson_versions',source.lesson.versionId);v.spec.title='Version améliorée';v.spec.blocks=v.spec.blocks.map(b=>({...b,id:b.id==='opening'?'new-opening':b.id,activityIds:b.activityIds.map(id=>id==='transfer'?'new-transfer':id)}));v.spec.activities=v.spec.activities.map(a=>({...a,id:a.id==='transfer'?'new-transfer':a.id}));v.spec.timeline=v.spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));v.spec.studentFlow=v.spec.blocks.map(b=>b.id);await source.store.put('lesson_versions',v);await source.store.put('lessons',{...source.lesson,title:v.spec.title});
  const assignment=(await dest.store.list('lesson_assignments')).find(a=>a.learnerId===learner.id);
  await dest.store.insert('assessment_attempts',{id:'old-answer',classId:'A1',lessonId:old.id,lessonVersionId:old.versionId,runId:old.runId,assignmentId:assignment.id,learnerId:learner.id,answers:{},history:[],draftVersion:0});
  const submission=await submitAttempt(dest.store,'old-answer',{[dest.spec.diagnostic.tasks[0].id]:'Réponse originale'},learner,{draftVersion:0});
  await dest.store.insert('learning_progress',{id:assignment.progressId,classId:'A1',learnerId:learner.id,assignmentId:assignment.id,lessonVersionId:old.versionId,answers:{guided:'old code'},completed:['guided']});
  const beforeAttempts=await dest.store.list('assessment_attempts'),t=await upload(dest,(await exported(source)).bytes),p=await previewTransfer(dest.store,t.id,{targetId:old.id},dest.actor);assert.equal(p.canApply,true,JSON.stringify(p.rows));
  const r=await apply(dest,t,p),updated=await dest.store.get('lessons',old.id),spec=(await dest.store.get('lesson_versions',updated.versionId)).spec;
  assert.equal(r.lessons[0].id,old.id);assert.equal(updated.status,'published');assert.equal(updated.date,old.date);assert.equal(spec.planEntryId,dest.spec.planEntryId);assert.ok(!spec.activities.some(a=>a.id==='transfer'));assert.notEqual(updated.runId,old.runId);assert.equal(updated.diagnosticVersionId,undefined);assert.deepEqual(await dest.store.list('assessment_attempts'),beforeAttempts);assert.equal(await dest.store.get('learning_progress','student:'+updated.versionId),null);
  assert.equal((await preview(dest,t)).rows[0].status,'identical');
  const context=await lessonContext(dest.store,learner,assignment);assert.equal(context.lesson.versionId,old.versionId);assert.ok(context.lesson.spec.activities.some(a=>a.id==='transfer'));assert.equal(context.progress.answers.guided,'old code');assert.equal(context.attempt.submissionId,submission.id);assert.deepEqual((await dest.store.get('submissions',submission.id)).diagnostic,submission.diagnostic);
  const repeat=await preview(dest,t);await apply(dest,t,repeat);assert.equal((await dest.store.list('submissions')).length,1);assert.equal((await dest.store.list('assessment_attempts')).length,1);assert.equal((await dest.store.list('lesson_assignments')).filter(a=>a.learnerId===learner.id).length,2);
 }finally{await close(source,dest);}
});

test('batch mixes add, replace and ignore; subset imports and deliberate copies retain mappings',async()=>{
 const source=await fixture(),dest=await fixture();try{
  const second=await addCopy(source,'two'),third=await addCopy(source,'three'),e=await exported(source,[source.lesson.id,second.id,third.id]),t=await upload(dest,e.bytes),p=await preview(dest,t);
  const choices=p.choices.map((c,i)=>({...c,action:i===0?'replace':i===1?'add':'ignore',...(i===0?{targetId:dest.lesson.id}:{}),entryId:'box'})),review=await preview(dest,t,choices);assert.equal(review.canApply,true);const result=await apply(dest,t,review);assert.equal(result.lessons.length,2);
  const next=await preview(dest,t,p.choices.map((c,i)=>({...c,action:i===2?'add':'ignore'})));assert.equal((await apply(dest,t,next)).lessons.length,1);
  const copied=await preview(dest,t,p.choices.map((c,i)=>({...c,action:i===0?'add':'ignore'})));const copy=(await apply(dest,t,copied)).lessons[0];assert.notEqual((await dest.store.get('lessons',copy.id)).portableId,p.rows[0].portableId);assert.equal((await preview(dest,t)).rows[0].targetId,dest.lesson.id);
 }finally{await close(source,dest);}
});

test('duplicate replacement targets, unknown runtimes and incomplete published content block before activation',async()=>{
 const source=await fixture(),dest=await fixture();try{
  const copy=await addCopy(source,'same');const t=await upload(dest,(await exported(source,[source.lesson.id,copy.id])).bytes),p=await preview(dest,t),dup=await preview(dest,t,p.choices.map(c=>({...c,action:'replace',targetId:dest.lesson.id})));
  assert.equal(dup.canApply,false);assert.match(dup.rows[1].blockers.join(' '),/même cible/);
  const decoded=await decodePackage((await exported(source)).bytes);decoded.lessons[0].payload.spec.activities[0].workshop={language:'text',profile:'shell-git',files:[{path:'notes.txt',content:'hello'}]};const encoded=await encodePackage(decoded.lessons,decoded.files);const lab=await upload(dest,encoded.bytes),lr=await preview(dest,lab);assert.equal(lr.canApply,false);assert.match(lr.rows[0].blockers.join(' '),/Laboratoire/);
  decoded.lessons[0].payload.spec.activities[0].workshop={language:'text'};decoded.lessons[0].payload.preparation.incomplete=true;const partial=await upload(dest,(await encodePackage(decoded.lessons,decoded.files)).bytes);await preparePublication(dest.store,dest.lesson.id,{version:1},dest.actor);await publishLesson(dest.store,dest.lesson.id,dest.actor,{version:1,confirmed:true});
  const pr=await previewTransfer(dest.store,partial.id,{targetId:dest.lesson.id},dest.actor);assert.equal(pr.canApply,false);assert.match(pr.rows[0].blockers.join(' '),/préparation source/);assert.equal((await preview(dest,partial,pr.choices.map(c=>({...c,action:'add'})))).canApply,true);
 }finally{await close(source,dest);}
});

test('stale preview and active generation are rejected; no title/date implicit replacement',async()=>{
 const source=await fixture(),dest=await fixture();try{
  const t=await upload(dest,(await exported(source)).bytes),p=await preview(dest,t);assert.equal(p.choices[0].action,'add');
  const r=await previewTransfer(dest.store,t.id,{targetId:dest.lesson.id},dest.actor);await dest.store.put('lessons',{...dest.lesson,title:'Changed during review'});
  await assert.rejects(apply(dest,t,r),/changé depuis/);
  await dest.store.insert('generation_jobs',{id:'active',classId:'A1',lessonId:dest.lesson.id,status:'running'});
  assert.match((await previewTransfer(dest.store,t.id,{targetId:dest.lesson.id},dest.actor)).rows[0].blockers.join(' '),/génération est en cours/);
 }finally{await close(source,dest);}
});

test('upload interruption is resumable; injected failure rolls back every selected lesson and resource',async()=>{
 const source=await fixture({rich:true}),dest=await fixture();try{
  const pack=(await source.store.list('corpus_packages'))[0],binary=randomBytes(2*LIMITS.chunk+137);pack.files.push({path:'01_ELEVE/support.bin',audience:'student',mimeType:'application/octet-stream',sha256:sha256(binary),bytes:binary.length,base64:binary.toString('base64')});await source.store.put('corpus_packages',pack);
  const other=await addCopy(source,'other'),e=await exported(source,[source.lesson.id,other.id]);const t=await beginUpload(dest.store,{bytes:e.bytes.length,sha256:sha256(e.bytes)},dest.actor);
  await assert.rejects(preview(dest,t),/incomplet/);assert.ok(t.chunks>=3);await writeChunk(dest.store,t.id,0,e.bytes.subarray(0,t.chunkBytes),dest.actor);await writeChunk(dest.store,t.id,0,e.bytes.subarray(0,t.chunkBytes),dest.actor);await assert.rejects(preview(dest,t),/incomplet/);for(let i=1;i<t.chunks;i++)await writeChunk(dest.store,t.id,i,e.bytes.subarray(i*t.chunkBytes,(i+1)*t.chunkBytes),dest.actor);
  const p=await preview(dest,t),before=await snapshot(dest.store);let count=0;
  const failing={...dest.store,transaction:fn=>dest.store.transaction(tx=>fn({...tx,insert:async(table,row)=>{if(table==='lessons'&&++count===2)throw Error('injected failure');return tx.insert(table,row);}}))};
  await assert.rejects(applyTransfer(failing,t.id,{token:p.token,confirmed:true},dest.actor),/injected failure/);assert.deepEqual(await snapshot(dest.store),before);
  const results=await Promise.all([apply(dest,t,p),apply(dest,t,p)]);assert.deepEqual(results[0],results[1]);assert.equal(results[0].lessons.length,2);
 }finally{await close(source,dest);}
});

test('tampered archives, unsupported schemas, traversals, symlinks and bombs never activate',async()=>{
 const source=await fixture(),dest=await fixture();try{
  const {bytes}=await exported(source),zip=await JSZip.loadAsync(bytes);zip.file('rogue.txt','secret');await assert.rejects(decodePackage(await zip.generateAsync({type:'nodebuffer'})),/Chemin ZIP/);
  const archive=await JSZip.loadAsync(bytes),manifest=JSON.parse(await archive.file('manifest.json').async('string'));manifest.version=99;archive.file('manifest.json',JSON.stringify(manifest));await assert.rejects(decodePackage(await archive.generateAsync({type:'nodebuffer'})),/Version de paquet/);
  const pack=await decodePackage(bytes);pack.lessons[0].payload.spec.blocks[0].type='UnknownBlock';await assert.rejects(encodePackage(pack.lessons,pack.files),/schéma/);
  const missing=await decodePackage(bytes);missing.lessons[0].payload.assets.push({sha256:'a'.repeat(64),mimeType:'image/png',width:1,height:1});const t=await upload(dest,(await encodePackage(missing.lessons,missing.files)).bytes);assert.equal((await preview(dest,t)).canApply,false);
  for(const name of ['../manifest.json','/manifest.json','files/../../secret']){const z=new JSZip();z.file(name,'{}',{createFolders:false});await assert.rejects(decodePackage(await z.generateAsync({type:'nodebuffer'})),/Chemin ZIP/);}
  const symlink=new JSZip();symlink.file('manifest.json','{}',{unixPermissions:0o120777});await assert.rejects(decodePackage(await symlink.generateAsync({type:'nodebuffer',platform:'UNIX'})),/lien/);
  const bomb=new JSZip();bomb.file('manifest.json',Buffer.alloc(LIMITS.file+1));await assert.rejects(decodePackage(await bomb.generateAsync({type:'nodebuffer',compression:'DEFLATE'})),/décompression/);
  const forged=Buffer.from(await bomb.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));const central=forged.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));forged.writeUInt32LE(10,central+24);await assert.rejects(decodePackage(forged),/Décompression/);
 }finally{await close(source,dest);}
});

test('local preparation survives restart and remains editable without production configuration',async()=>{
 const f=await fixture(),directory=await mkdtemp(join(tmpdir(),'tween-transfer-'));let disk;
 try{
  disk=await openStore({url:'',path:join(directory,'courses.sqlite')});disk.inlineArtifacts=true;for(const table of TABLES)for(const row of await f.store.readRows(table))await disk.insertRow(table,row);
  const spec=structuredClone(f.spec);spec.title='Saved before restart';const edited=await editLesson(disk,f.lesson.id,{version:1,spec,reason:'Local preparation'},f.actor);await disk.close();disk=await openStore({url:'',path:join(directory,'courses.sqlite')});disk.inlineArtifacts=true;assert.equal((await disk.get('lessons',f.lesson.id)).versionId,edited.versionId);assert.equal((await disk.get('lesson_versions',edited.versionId)).spec.title,spec.title);assert.equal((await exportLessons(disk,[f.lesson.id],f.actor)).count,1);
 }finally{await disk?.close();await close(f);await rm(directory,{recursive:true,force:true});}
});

test('assigned mission travels with files and canonical identity without copying runs',async()=>{
 const source=await fixture(),dest=await fixture();try{
  await seedCatalog(source.store);const mission=(await source.store.list('game_missions','A1')).find(m=>m.world==='code-station'),v=await source.store.get('lesson_versions',source.lesson.versionId),ex=explorationForMission(mission);
  v.spec.codeStation={missionId:mission.id,missionVersion:mission.version,worldId:mission.world,duration:25,required:true,unlockAfter:'',completionRule:'all_scenarios_pass',mapId:ex.map.id,missionSignature:ex.signature};await source.store.put('lesson_versions',v);
  const e=await exported(source),t=await upload(dest,e.bytes),p=await preview(dest,t);assert.equal(p.canApply,true,JSON.stringify(p.rows));const r=await apply(dest,t,p),lesson=await dest.store.get('lessons',r.lessons[0].id),spec=(await dest.store.get('lesson_versions',lesson.versionId)).spec,imported=await dest.store.get('game_missions',spec.codeStation.missionId);assert.deepEqual(imported.files,mission.files);assert.equal(explorationForMission(imported).signature,spec.codeStation.missionSignature);assert.equal((await preview(dest,t)).rows[0].status,'identical');assert.equal((await dest.store.list('game_runs')).length,0);
 }finally{await close(source,dest);}
});

test('permissions protect export, uploads, assets, preview and application across accounts/classes',async()=>{
 const f=await fixture();let server;try{
  await f.store.insert('learners',{id:'student',classId:'A1',username:'student',passwordHash:passwordHash('student-password')});server=createApp(f.store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const login=async(role,username,password)=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,username,password})});return r.headers.get('set-cookie').split(';')[0];};const student=await login('student','student','student-password'),teacher=await login('teacher','professeur','quality-preview-only');
  for(const cookie of ['',student]){const r=await fetch(base+'/api/lesson-transfers/export',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({lessonIds:[f.lesson.id]})});assert.equal(r.status,cookie?403:401);}
  const e=await exported(f);await assert.rejects(ownedTransfer(f.store,e.id,{...f.actor,id:'different'}),{status:404});await assert.rejects(ownedTransfer(f.store,e.id,{...f.actor,classId:'B1'}),{status:404});await assert.rejects(exportLessons(f.store,[f.lesson.id],{...f.actor,classId:'B1'}),{status:404});
  const csrf=await fetch(base+'/api/lesson-transfers/export',{method:'POST',headers:{cookie:teacher,Origin:'https://other.invalid','Content-Type':'application/json'},body:JSON.stringify({lessonIds:[f.lesson.id]})});assert.equal(csrf.status,403);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await close(f);}
});

async function pgStore(){
 const pg=await PGlite.create();await pg.exec(schemaSQL);
 const check=t=>{assert.ok(TABLES.includes(t));return t;};
 const tx={
  get:async(t,id)=>{const row=(await pg.query(`SELECT data FROM ${check(t)} WHERE id=$1`,[id])).rows[0];return row?JSON.parse(row.data):null;},
  list:async(t,classId)=>(await pg.query(`SELECT data FROM ${check(t)}${classId?' WHERE class_id=$1':''} ORDER BY version,created_at,id`,classId?[classId]:[])).rows.map(r=>JSON.parse(r.data)),
  insert:async(t,obj)=>{const row={...obj,id:obj.id||uid(t),createdAt:obj.createdAt||now()};await pg.query(`INSERT INTO ${check(t)} VALUES ($1,$2,$3,$4,$5)`,[row.id,row.classId,row.version||1,JSON.stringify(row),row.createdAt]);return row;},
  put:async(t,obj)=>{await pg.query(`UPDATE ${check(t)} SET data=$1,version=$2 WHERE id=$3`,[JSON.stringify(obj),obj.version||1,obj.id]);return obj;},
  remove:async(t,id)=>pg.query(`DELETE FROM ${check(t)} WHERE id=$1`,[id]),
  lockTables:async()=>pg.exec(`LOCK TABLE ${TABLES.join(',')} IN SHARE ROW EXCLUSIVE MODE`),
  audit:async(actor,action,entityId,details)=>tx.insert('audit_log',{classId:actor.classId,actorId:actor.id,action,entityId,details})
 };
 return {...tx,inlineArtifacts:true,kind:'postgres',transaction:async fn=>{await pg.exec('BEGIN');try{const r=await fn(tx);await pg.exec('COMMIT');return r;}catch(e){await pg.exec('ROLLBACK');throw e;}},close:()=>pg.close(),pg};
}

test('independent PostgreSQL engine atomically stores bytes, replacements and rollback',async()=>{
 const source=await fixture({rich:true}),store=await pgStore(),dest={store,actor:source.actor};try{
  for(const table of ['teachers','curriculum_versions','plan_versions','plan_entries'])for(const row of await source.store.list(table))await store.insert(table,row);
  const t=await upload(dest,(await exported(source)).bytes),p=await preview(dest,t);assert.equal(p.canApply,true);
  await store.pg.exec("ALTER TABLE lessons ADD CONSTRAINT reject_transfer CHECK (id NOT LIKE '%import-%')");await assert.rejects(apply(dest,t,p));assert.equal((await store.list('lessons')).length,0);assert.equal((await store.list('lesson_assets')).length,0);
  await store.pg.exec('ALTER TABLE lessons DROP CONSTRAINT reject_transfer');const r=await apply(dest,t,p);assert.equal(r.lessons.length,1);assert.ok((await store.list('lesson_assets')).every(a=>a.base64&&!a.artifactKey&&!a.s3Key));
  assert.equal((await preview(dest,t)).rows[0].status,'identical');assert.equal((await lessonQuality(store,await store.get('lessons',r.lessons[0].id))).quality.publishable,false);
 }finally{await close(source,dest);}
});

test('a fresh reviewed replacement can restore the same package after a later teacher edit',async()=>{
 const source=await fixture(),dest=await fixture();try{
  const t=await upload(dest,(await exported(source)).bytes),p=await preview(dest,t);const result=await apply(dest,t,p),id=result.lessons[0].id,lesson=await dest.store.get('lessons',id),spec=structuredClone((await dest.store.get('lesson_versions',lesson.versionId)).spec);spec.title='Later teacher edit';
  await editLesson(dest.store,id,{version:1,spec,reason:'Amélioration après import'},dest.actor);const review=await preview(dest,t);assert.equal(review.rows[0].status,'matched');const replacement=await apply(dest,t,review);assert.equal(replacement.lessons[0].status,'replaced');assert.equal((await dest.store.get('lessons',id)).title,source.lesson.title);
 }finally{await close(source,dest);}
});

test('private embedded images stay out of the student payload, and oversize fragments are rejected',async()=>{
 const source=await fixture(),dest=await fixture();let server;try{
  const v=await source.store.get('lesson_versions',source.lesson.versionId);v.spec.teacherGuide+=' http://localhost:4181/assets/boards/01-parent.svg';await source.store.put('lesson_versions',v);
  const t=await upload(dest,(await exported(source)).bytes),p=await preview(dest,t),r=await apply(dest,t,p),id=r.lessons[0].id,lesson=await dest.store.get('lessons',id),spec=(await dest.store.get('lesson_versions',lesson.versionId)).spec;
  // Images embedded only in the teacher guide never appear in studentSpec.
  const {studentSpec}=await import('../server/generator.mjs');assert.ok(!JSON.stringify(studentSpec(spec)).includes('data:image/svg+xml'));
  await assert.rejects(writeChunk(dest.store,t.id,0,Buffer.alloc(LIMITS.chunk+1),dest.actor));
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await close(source,dest);}
});

test('adding into a different class assigns destination ownership without creating a timetable',async()=>{
 const source=await fixture({rich:true}),store=await openStore({url:'',path:':memory:'}),dest={store,actor:{id:'destination-teacher',classId:'B1',role:'teacher'}};
 try{
  const t=await upload(dest,(await exported(source)).bytes),p=await preview(dest,t);assert.equal(p.canApply,true,JSON.stringify(p.rows));
  const r=await apply(dest,t,p),lesson=await store.get('lessons',r.lessons[0].id),version=await store.get('lesson_versions',lesson.versionId);
  assert.equal(lesson.classId,'B1');assert.equal(lesson.authorId,dest.actor.id);assert.equal(version.spec.classId,'B1');assert.deepEqual(version.spec.objectives,source.spec.objectives);assert.equal((await store.list('plan_entries')).length,0);assert.equal((await store.list('classes')).length,0);
  assert.ok((await store.list('pedagogical_sources')).every(s=>s.ownerId===dest.actor.id&&s.classId==='B1'));assert.ok((await store.list('lesson_assets')).every(a=>a.classId==='B1'));
  assert.equal((await preview(dest,t)).rows[0].status,'identical');
 }finally{await close(source,dest);}
});
