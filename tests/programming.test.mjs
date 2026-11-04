import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {decodePackage,encodePackage,validateReferences,LIMITS} from '../server/lesson-package.mjs';
import {run} from '../public/programming/runtime.js';
import {parseWork} from '../public/programming/work.js';
import {studentSpec} from '../server/generator.mjs';
import {testActivityCode} from '../server/workshop-testing.mjs';
import {transferFixture} from './fixtures/lesson-transfer.mjs';
import {beginUpload,writeChunk,previewTransfer,applyTransfer,exportLessons,readTransfer} from '../server/lesson-transfer.mjs';
import {sha256} from '../server/content-snapshots.mjs';
import {publishLesson,editLesson} from '../server/domain.mjs';
import {passwordHash} from '../server/auth.mjs';
import {createApp} from '../server/app.mjs';
import {saveLearningEvent} from '../server/progress.mjs';
import {submitWork} from '../server/work-submissions.mjs';
const bytes=await readFile(new URL('./fixtures/programming/tableaux-source.zip',import.meta.url));
const pack=await decodePackage(bytes),spec=pack.lessons[0].payload.spec;
export async function importProgramming(f,source=bytes){const t=await beginUpload(f.store,{bytes:source.length,sha256:sha256(source)},f.actor);for(let i=0;i<t.chunks;i++)await writeChunk(f.store,t.id,i,source.subarray(i*LIMITS.chunk,(i+1)*LIMITS.chunk),f.actor);const review=await previewTransfer(f.store,t.id,{},f.actor);assert.equal(review.canApply,true,JSON.stringify(review.rows));const applied=await applyTransfer(f.store,t.id,{token:review.token,confirmed:true},f.actor);return {t,review,applied,lesson:await f.store.get('lessons',applied.lessons[0].id)};}
test('real source integrity, typed activities, diagnostic references and mandatory 360-minute flow',()=>{
 assert.equal(spec.activities.length,28);assert.equal(spec.blocks.length,10);assert.equal(spec.activities.filter(a=>a.type==='Quiz').length,14);assert.equal(spec.activities.filter(a=>a.type==='FillBlank').length,2);assert.equal(spec.activities.filter(a=>a.type==='Reflection').length,2);assert.equal(spec.activities.filter(a=>a.type==='CodeEditor').length,10);
 assert.deepEqual(spec.programming.sessions.map(s=>s.minutes),[180,180]);assert.deepEqual(spec.diagnostic.activityIds,['q1-indice','q2-for']);assert.equal(spec.diagnostic.tasks.length,0);assert.equal(spec.programming.optionalActivityIds[0],'a10-transfert');assert.ok(!spec.blocks.some(b=>b.activityIds.includes('a10-transfert')));assert.ok(spec.activities.find(a=>a.id==='a10-transfert').duration>0);
 assert.deepEqual(new Set(spec.activities.flatMap(a=>a.interactive?.diagramType||[])),new Set(['array','for','while','function','foreach','decompose']));
 const student=studentSpec(spec);assert.equal(student.teacherGuide,undefined);assert.ok(student.activities.every(a=>!('reference' in a)&&!('tests' in a)));assert.ok(student.activities.find(a=>a.id==='a1-indices').interactive.demo);assert.equal(pack.lessons[0].payload.corpus.files.find(f=>f.path.endsWith('course-data.js')).audience,'teacher');
});
test('all 54 reference cases, deliberate starter errors, return scope and zero/empty boundaries',async()=>{
 let n=0;for(const a of spec.activities.filter(a=>a.type==='CodeEditor')){for(const t of a.tests){const r=run(a.reference,{invoke:t.invoke,args:JSON.parse(t.argsJSON)});assert.equal(r.error,null,a.id);assert.deepEqual(r.result,JSON.parse(t.expectedJSON),a.id);n++;}assert.equal((await testActivityCode(a,a.reference)).ok,true,a.id);}assert.equal(n,54);
 const forTask=spec.activities.find(a=>a.id==='a2-parcours-for');assert.deepEqual(run(forTask.starter,{invoke:forTask.interactive.invoke,args:forTask.interactive.args}).result,[80,20,65]);
 const whileTask=spec.activities.find(a=>a.id==='a6-recherche-while');assert.equal(run(whileTask.starter,{invoke:whileTask.interactive.invoke,args:whileTask.interactive.args}).errorCode,'LIMIT');
 const r=run('function probe(xs) { xs.forEach(function(x) { if (x > 1) { return 9; } console.log(x); }); return 0; }',{invoke:'probe',args:[[1,2,3]]});assert.equal(r.result,0);assert.deepEqual(r.logs,[[1]]);assert.ok(r.trace.some(f=>f.kind==='foreach-next'&&f.value===9));
 const empty=run('function probe(xs) { return xs.length; }',{invoke:'probe',args:[[]]});assert.equal(empty.result,0);
});
test('bounded interpreter denies host access, internal objects, unsupported syntax and unbounded recursion',()=>{
 for(const code of ['fetch("https://example.org")','window.document','globalThis','localStorage','Function("return 1")()','[].constructor','({}).__proto__','const f = [].push; f.receiver','const f = {__arrayLabNative:true,name:"push",receiver:[]}; f(1)'])assert.ok(run(code).error,code);
 assert.equal(run('const = ;').errorCode,'SYNTAX');assert.equal(run('const f = x => x;').errorCode,'UNSUPPORTED');assert.equal(run('while (true) {}').errorCode,'LIMIT');assert.equal(run('function f(){return f();}',{invoke:'f'}).errorCode,'LIMIT');assert.equal(run('let a=[]; a[10000000]=1;').errorCode,'LIMIT');
 const r=run('let n=0; while(n<3){ console.log(n); n++; }');assert.deepEqual(r.logs,[[0],[1],[2]]);const original=structuredClone(r.trace);for(let n=r.trace.length-1;n>=0;n--)void r.trace[n];assert.deepEqual(r.trace,original);
});
test('canonical roundtrip and a second corpus require no reader branching',async()=>{
 const encoded=await encodePackage(pack.lessons,pack.files),again=await decodePackage(encoded.bytes);assert.deepEqual(again.lessons[0].payload.spec,spec);
 const other=await decodePackage(await readFile('docs/programming/examples/minimal.tweenteach.zip'));const s=other.lessons[0].payload.spec;assert.equal(s.blocks.length,2);assert.equal(s.programming.sessions.length,1);assert.ok(s.activities.find(a=>a.id==='stocks'));assert.equal((await testActivityCode(s.activities.find(a=>a.id==='stocks'),s.activities.find(a=>a.id==='stocks').reference)).ok,true);
 for(const change of [s=>s.programming.format='future',s=>s.programming.engine.version='999',s=>s.programming.requiredCapabilities.push('network'),s=>s.activities[0].type='Future',s=>s.programming.sessions[0].minutes++,s=>s.diagnostic.activityIds.push('missing')]){const copy=structuredClone(spec);change(copy);assert.throws(()=>validateReferences(copy));}
});
test('archive wrapping, integrity errors, normalized collisions, symlinks and expansion quotas',async()=>{
 const z=await JSZip.loadAsync(bytes),root=Object.keys(z.files)[0].split('/')[0]+'/';const flat=new JSZip();for(const [n,f] of Object.entries(z.files))flat.file(n.slice(root.length),await f.async('nodebuffer'),{createFolders:false});assert.equal((await decodePackage(await flat.generateAsync({type:'nodebuffer'}))).lessons.length,1);
 const manifest=JSON.parse(await flat.file('00_MANIFEST/manifest.json').async('string'));flat.file('07_SOURCES_EDEN/lesson.json','{}');await assert.rejects(decodePackage(await flat.generateAsync({type:'nodebuffer'})),e=>e.status===422&&e.details.file==='00_MANIFEST/manifest.json');
 for(const path of ['../outside','/absolute','C:/escape','a/../b','a\\b']){const zip=new JSZip();zip.file(path,'x',{createFolders:false});await assert.rejects(decodePackage(await zip.generateAsync({type:'nodebuffer'})),/Chemin ZIP/);}
 const collision=new JSZip();collision.file('é','one');collision.file('e\u0301','two');await assert.rejects(decodePackage(await collision.generateAsync({type:'nodebuffer'})),/Chemin ZIP/);
 const symlink=new JSZip();symlink.file('link','target',{unixPermissions:0o120777});await assert.rejects(decodePackage(await symlink.generateAsync({type:'nodebuffer',platform:'UNIX'})),/lien/);
 const bomb=new JSZip();bomb.file('big',Buffer.alloc(LIMITS.file+1));await assert.rejects(decodePackage(await bomb.generateAsync({type:'nodebuffer',compression:'DEFLATE'})),/décompression/);
 assert.equal(manifest.files.length,63);
});
test('draft import, idempotent reimport, transactional refusal and canonical export preserve content',async()=>{
 const f=await transferFixture();try{const r=await importProgramming(f);assert.equal(r.lesson.title,spec.title);assert.equal(r.lesson.status,'draft');assert.equal(r.review.rows[0].programming.activities,28);
 const review=await previewTransfer(f.store,r.t.id,{},f.actor);assert.equal(review.rows[0].identical,true);const result=await applyTransfer(f.store,r.t.id,{token:review.token,confirmed:true},f.actor);assert.equal(result.lessons[0].version,1);
 const e=await exportLessons(f.store,[r.lesson.id],f.actor),out=await decodePackage((await readTransfer(f.store,e.id,f.actor)).bytes);assert.deepEqual(out.lessons[0].payload.spec.programming,spec.programming);
 const current=(await f.store.get('lesson_versions',r.lesson.versionId)).spec,editedSpec=structuredClone(current);editedSpec.activities[0].interactive.reflection='Explique le premier indice.';
 const edited=await editLesson(f.store,r.lesson.id,{version:1,spec:editedSpec,reason:'Préciser la réflexion'},f.actor);const revised=await exportLessons(f.store,[edited.id],f.actor),revisedPack=await decodePackage((await readTransfer(f.store,revised.id,f.actor)).bytes);assert.equal(revisedPack.lessons[0].payload.corpus.files.length,63);assert.equal(revisedPack.lessons[0].payload.corpus.complete,true);assert.equal(revisedPack.lessons[0].payload.spec.activities[0].interactive.reflection,editedSpec.activities[0].interactive.reflection);
 const before=(await f.store.list('lessons')).length;const bad=Buffer.from(bytes);bad[bad.length-1]^=255;await assert.rejects(importProgramming(f,bad));assert.equal((await f.store.list('lessons')).length,before);
 }finally{await f.store.close();}
});
test('work contract invalidates results and never accepts certified imported success',()=>{
 const w={format:'programming-work-1',code:'return 1',args:'[]',prediction:null,hints:0,reflection:'',responses:{},attempts:1,results:{code:'return 1',args:'[]',status:'OK',passed:1,certified:false}};assert.deepEqual(parseWork(JSON.stringify(w)),w);w.results.certified=true;assert.throws(()=>parseWork(JSON.stringify(w)));w.results.certified=false;w.code='return 2';assert.throws(()=>parseWork(JSON.stringify(w)));
});
test('real API: publication, student save/reload/conflicts, separate learners, private resource URLs and work receipt',async()=>{
 const f=await transferFixture();let server;try{
 const {lesson}=await importProgramming(f);for(const id of ['program-student','other-student'])await f.store.insert('learners',{id,classId:'A1',username:id,displayName:id,passwordHash:passwordHash('programming-test-pass')});
 await publishLesson(f.store,lesson.id,f.actor,{version:1,confirmed:true,validationMode:'teacher'});
 server=createApp(f.store).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});const base='http://127.0.0.1:'+server.address().port;
 async function login(id){const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'student',username:id,password:'programming-test-pass'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 const cookie=await login('program-student'),other=await login('other-student');const get=async(path,c=cookie)=>fetch(base+path,{headers:{cookie:c}});
 const refused=await fetch(base+'/api/assessments/'+encodeURIComponent(lesson.id)+'/start',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id})});assert.equal(refused.status,422);
 const today=await(await get('/api/today?lesson='+encodeURIComponent(lesson.id))).json();assert.equal(today.lesson.spec.title,spec.title);assert.ok(!JSON.stringify(today.lesson.spec).includes('course-author.json'));
 const version=await f.store.get('lesson_versions',lesson.versionId),resource=today.lesson.spec.resources[0];assert.equal((await get(resource)).status,200);
 assert.equal((await get('/api/corpus/'+encodeURIComponent(lesson.id)+'/download')).status,403);assert.equal((await get('/api/lessons/'+encodeURIComponent(lesson.id))).status,403);
 assert.equal((await get('/07_SOURCES_EDEN/course-author.json')).status,404);
 const actor={id:'program-student',classId:'A1',role:'student'},answer=JSON.stringify({format:'programming-work-1',code:'function tailleEtValeur(xs,n){return [xs.length,xs[n]];}',args:'[[4],0]',prediction:1,hints:2,reflection:'Indice zéro valide.',responses:{},attempts:1});
 const event={lessonId:lesson.id,lessonVersionId:version.id,assignmentId:today.assignmentId,eventId:'program-work-save',type:'answer_saved',activityId:'a1-indices',progressVersion:0,payload:{answer}};await saveLearningEvent(f.store,actor,event);assert.equal((await(await get('/api/today?lesson='+encodeURIComponent(lesson.id))).json()).progress.answers['a1-indices'],answer);assert.equal((await(await get('/api/today?lesson='+encodeURIComponent(lesson.id),other)).json()).progress,null);
 await assert.rejects(saveLearningEvent(f.store,actor,{...event,eventId:'conflict-save'}),e=>e.status===409);
 const receipt=await submitWork(f.store,actor,{requestId:'programming-submit-001',progressVersion:1,lessonId:lesson.id,lessonVersionId:version.id,assignmentId:today.assignmentId,answers:{'a1-indices':answer}});assert.ok(receipt.snapshotId);assert.equal((await f.store.list('corrections')).length,0);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await f.store.close();}
});
test('authoring revisions preserve the rich contract and reject loss of interactions',async()=>{
 const {applyRevisionPatch}=await import('../server/lesson-revision.mjs');
 const updated=applyRevisionPatch(spec,{summary:'Reformuler la question',changes:[{op:'replace',path:'/activities/0/interactive/reflection',value:'Explique la différence entre longueur et dernier indice.'}]});assert.match(updated.activities[0].interactive.reflection,/longueur/);
 assert.throws(()=>applyRevisionPatch(spec,{summary:'Retrait invalide',changes:[{op:'remove',path:'/activities/0/interactive',value:null}]}));
 const {packageProgramming}=await import('../server/programming/authoring.mjs');const sample=JSON.parse(await readFile('docs/programming/examples/bibliotheque.lesson.json'));assert.equal((await decodePackage((await packageProgramming(sample)).bytes)).lessons[0].payload.spec.title,sample.title);
 const r=run('function f(){return f;}',{invoke:'f'});assert.equal(r.result,'[fonction]');
});
