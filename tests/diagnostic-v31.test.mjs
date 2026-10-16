import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticFixture} from './fixtures/diagnostic-v31.mjs';
import {diagnosticSources,upgradeDiagnostic,diagnosticV31Issues,responseUnits} from '../server/diagnostic-v31.mjs';
import {normalizedSpec} from '../server/lesson-package.mjs';
import {studentSpec} from '../server/generator.mjs';
import {categories} from './fixtures/competency-v2.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectDiagnosticsV31} from '../scripts/migrate-diagnostics-v31.mjs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {reserveDiagnosticLabCapture,saveDiagnosticLabFiles} from '../server/pedagogy/lab-context.mjs';

test('AD08 AD11 AD14 AD23 diagnostic DOM and shell reuse engines, freeze files and reject late results',async t=>{
 const f=await diagnosticFixture(t),image='sha256:'+'a'.repeat(64),savedEnv=Object.fromEntries(['EDEN_LAB_URL','EDEN_LAB_TOKEN','EDEN_LAB_DOM_IMAGE','EDEN_LAB_SHELL_IMAGE'].map(k=>[k,process.env[k]])),files=[{path:'result.txt',base64:Buffer.from('DEMO SERVER FILE').toString('base64')},{path:'.git/config',base64:'cHJpdmF0ZQ=='}];let release,lateStarted;
 const started=new Promise(r=>lateStarted=r),broker=createServer(async(req,res)=>{let raw='';for await(const p of req)raw+=p;const body=JSON.parse(raw);if(req.url==='/dom'&&body.files.some(f=>f.content==='DELAY')){lateStarted();await new Promise(r=>release=r);}const result=req.url==='/sessions'?{id:'synthetic-session',runtime:image}:req.url.endsWith('/snapshot')?{files}:{runtime:image,ok:true,checks:[],files,output:'DEMO',cursor:1};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));});broker.listen(0,'127.0.0.1');await once(broker,'listening');
 Object.assign(process.env,{EDEN_LAB_URL:'http://127.0.0.1:'+broker.address().port,EDEN_LAB_TOKEN:'demo-token',EDEN_LAB_DOM_IMAGE:image,EDEN_LAB_SHELL_IMAGE:image});
 t.after(async()=>{release?.();broker.closeAllConnections();await new Promise(r=>broker.close(r));for(const [k,v]of Object.entries(savedEnv))if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const v=await f.store.get('lesson_versions','lesson:v1');Object.assign(v.spec.diagnostic.tasks[0],{type:'CodeEditor',starter:'console.log(1)',workshop:{profile:'dom',language:'javascript',files:[{path:'index.html',content:'<p>DEMO</p>'},{path:'style.css',content:''},{path:'main.js',content:'console.log(1)'}]}});Object.assign(v.spec.diagnostic.tasks[1],{type:'Terminal',workshop:{profile:'shell-git',language:'shell',files:[]}});await f.store.put('lesson_versions',v);
 const a=await f.start31('alice',false),body={lessonId:'lesson',lessonVersionId:'lesson:v1',assignmentId:a.assignmentId,attemptId:a.id,activityId:'q1',action:'render',files:v.spec.diagnostic.tasks[0].workshop.files};
 assert.equal((await f.post('/api/dom/render',body,'alice')).status,409);await f.start31();await f.ok('/api/dom/render',body,'alice');
 const shell=await f.ok('/api/labs',{...body,activityId:'q2'},'alice');await f.ok('/api/labs/'+shell.id+'/files',{action:'list'},'alice');assert.equal((await f.post('/api/labs/'+shell.id+'/io',{input:'',cursor:0},'bob')).status,403);
 const ls=await f.store.get('lab_sessions',shell.id),actor={...await f.store.get('learners','alice'),role:'student'},older=await reserveDiagnosticLabCapture(f.store,actor,ls),newer=await reserveDiagnosticLabCapture(f.store,actor,ls);await saveDiagnosticLabFiles(f.store,actor,ls,files,newer);await saveDiagnosticLabFiles(f.store,actor,ls,[{path:'result.txt',content:'STALE'}],older);assert.equal((await f.store.get('assessment_attempts',a.id)).labResponses.q2.files[0].content,'DEMO SERVER FILE');
 const late=f.post('/api/dom/render',{...body,files:body.files.map(x=>({...x,content:x.path==='main.js'?'DELAY':x.content}))},'alice');await started;
 const expired=await f.store.get('assessment_attempts',a.id);expired.timing.deadlineAt=new Date(Date.now()-1).toISOString();await f.store.put('assessment_attempts',expired);release();assert.equal((await late).status,409);
 assert.equal((await f.post('/api/labs/'+shell.id+'/files',{action:'write',path:'result.txt',content:'LATE'},'alice')).status,409);
 const s=await f.ok('/api/diagnostics/attempts/'+a.id+'/expire',{},'alice'),copy=await f.store.get('submissions',s.submissionId);assert.equal(JSON.parse(copy.answers.q2).files[0].content,'DEMO SERVER FILE');assert.equal(JSON.parse(copy.answers.q2).files.length,1);assert.equal((await f.store.list('learning_events')).filter(e=>e.type==='lab_validated').length,0);assert.ok(responseUnits(copy.diagnostic,a.id,'lesson:v1',copy.answers).some(u=>u.partId==='file:result.txt'));
});

test('V3.1 migration inventory is repeatable, read-only and never backfills historical comments',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'diagnostic-migration-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'fixture.sqlite'),db=new DatabaseSync(path);
 for(const name of ['lesson_versions','lessons','assessment_attempts'])db.exec(`CREATE TABLE ${name} (data TEXT NOT NULL)`);
 db.prepare('INSERT INTO lesson_versions VALUES (?)').run(JSON.stringify({id:'old:v1',spec:{diagnostic:{tasks:[]}}}));
 db.prepare('INSERT INTO lesson_versions VALUES (?)').run(JSON.stringify({id:'new:v1',spec:{diagnostic:{contract:{version:'diagnostic-3.1'}}}}));
 db.prepare('INSERT INTO assessment_attempts VALUES (?)').run(JSON.stringify({lessonVersionId:'old:v1'}));
 db.prepare('INSERT INTO lessons VALUES (?)').run(JSON.stringify({status:'draft',versionId:'new:v1'}));db.close();
 const before=await readFile(path),one=inspectDiagnosticsV31(path),two=inspectDiagnosticsV31(path);assert.deepEqual(two,one);assert.deepEqual(await readFile(path),before);assert.deepEqual(one.counts,{historicalVersions:1,v31Versions:1,draftsForPreview:1,startedVersionsPreserved:1});assert.equal(one.backfilledComments,0);
});

test('AD01 AD06 AD09 source preview rejects stale provenance and repeated apply keeps N+1',async t=>{
 const f=await diagnosticFixture(t),lesson=await f.store.get('lessons','lesson');lesson.status='draft';await f.store.put('lessons',lesson);
 let p=await f.ok('/api/diagnostics/lessons/lesson/preview',{version:lesson.version});
 const run=await f.store.get('lesson_runs','source-run');run.revision++;await f.store.put('lesson_runs',run);
 const body={version:lesson.version,token:p.token,sourceRunId:'source-run',diagnostic:p.diagnostic,confirmed:true,reason:'Source confirmée DEMO'};
 assert.equal((await f.post('/api/diagnostics/lessons/lesson/apply',body)).status,409);
 p=await f.ok('/api/diagnostics/lessons/lesson/preview',{version:lesson.version});const applied=await f.ok('/api/diagnostics/lessons/lesson/apply',{...body,token:p.token,diagnostic:p.diagnostic});assert.equal(applied.changed,true);
 p=await f.ok('/api/diagnostics/lessons/lesson/preview',{version:applied.version});const repeated=await f.ok('/api/diagnostics/lessons/lesson/apply',{...body,version:applied.version,token:p.token,diagnostic:p.diagnostic});assert.equal(repeated.changed,false);assert.equal(repeated.version,applied.version);assert.equal(p.diagnostic.tasks.length,3);
});

test('AD01 AD02 AD03 AD04 actual dates, confirmed activities, ambiguous tracks and new concepts',async t=>{
 const f=await diagnosticFixture(t);
 await f.store.insert('lesson_runs',{id:'planned-latest',classId:'A1',lessonVersionId:'source:v1',date:'2026-10-04',planStatus:'planned'});
 const choice=await diagnosticSources(f.store,f.teacher,{date:'2026-10-05'});assert.equal(choice.selected.runId,'source-run');assert.equal(choice.selected.date,'2026-10-03');assert.deepEqual(choice.selected.criteria,['DEMO-COMP-01','DEMO-COMP-02']);
 const altered=structuredClone(f.diagnostic);altered.tasks[0].skills=['DEMO-FUTURE'];assert.match(diagnosticV31Issues(altered).join(' '),/notion non confirmée/);
 await f.store.insert('lesson_runs',{...await f.store.get('lesson_runs','source-run'),id:'another-track',trackId:'explicit-track'});
 assert.equal((await diagnosticSources(f.store,f.teacher,{date:'2026-10-05'})).status,'selection_required');
 assert.equal((await diagnosticSources(f.store,f.teacher,{date:'2026-09-01'})).status,'source_required');
 assert.equal((await diagnosticSources(f.store,f.teacher,{date:'2026-10-05',trackId:'explicit-track'})).selected.runId,'another-track');
});

test('AD06 AD07 AD08 AD09 N+1 preview, real transfer, budget, idempotence and frozen copies',async t=>{
 const f=await diagnosticFixture(t),d=f.diagnostic;assert.equal(f.original.tasks.length,2);assert.equal(d.tasks.length,3);assert.equal(d.tasks[2].duration,5);assert.equal(d.duration,20);assert.equal(d.tasks.reduce((n,t)=>n+t.duration,0)+4,20);assert.deepEqual(diagnosticV31Issues(d),[]);assert.deepEqual(upgradeDiagnostic(d,f.source),d);
 const a=await f.start31();assert.equal(a.timing.startedAt!==null,true);
 const lv=await f.store.get('lesson_versions','lesson:v1'),next=structuredClone(lv);next.id='lesson:v2';next.version=2;next.spec.diagnostic.tasks.reverse();await f.store.insert('lesson_versions',next);
 const run=await f.store.get('lesson_runs','source-run');run.realization.activityIds=[];await f.store.put('lesson_runs',run);
 const copy=(await f.call('/api/tracking/attempts/'+a.id,{as:'alice'})).data;assert.equal(copy.diagnostic.tasks[0].id,'q1');assert.equal(copy.diagnostic.contract.source.title,d.contract.source.title);
 const saved=await f.ok('/api/assessments/'+a.id+'/save',{draftVersion:0,answers:{q3:'Je commence par le dernier exercice.'}},'alice');assert.equal(saved.draftVersion,1);
 const invalid=structuredClone(d);invalid.tasks[0].duration=20;assert.match(diagnosticV31Issues(invalid).join(' '),/budget/);
});

test('AD10 explicit start, reconnect, second tab, authorized pause and extension',async t=>{
 const f=await diagnosticFixture(t),prepared=await f.start31('alice',false);assert.equal(prepared.timing.startedAt,null);
 assert.equal((await f.post('/api/assessments/'+prepared.id+'/save',{draftVersion:0,answers:{q1:'avant'}},'alice')).status,409);
 const a=await f.start31(),again=await f.start31();assert.equal(a.id,again.id);assert.equal(a.timing.deadlineAt,again.timing.deadlineAt);
 const extended=await f.ok('/api/diagnostics/attempts/'+a.id+'/time',{revision:0,action:'extend',minutes:10,reason:'Aménagement DEMO'});assert.equal(Date.parse(extended.timing.deadlineAt)-Date.parse(a.timing.deadlineAt),600000);
 await f.ok('/api/diagnostics/attempts/'+a.id+'/time',{revision:1,action:'pause',reason:'Incident de matériel DEMO'});
 assert.equal((await f.post('/api/assessments/'+a.id+'/save',{draftVersion:0,answers:{q1:'pendant pause'}},'alice')).status,409);
 await f.ok('/api/diagnostics/attempts/'+a.id+'/time',{revision:2,action:'resume',reason:'Matériel disponible'});
 assert.equal((await f.post('/api/diagnostics/attempts/'+a.id+'/time',{revision:1,action:'extend',minutes:5,reason:'Obsolète'})).status,409);
});

test('AD11 AD12 AD21 deadline keeps server work, late writes fail, recovery is separate and idempotent',async t=>{
 const f=await diagnosticFixture(t),a=await f.start31();await f.ok('/api/assessments/'+a.id+'/save',{draftVersion:0,answers:{q1:'VERSION SERVEUR'},requestId:'save-once'},'alice');
 const actual=await f.store.get('assessment_attempts',a.id);actual.timing.deadlineAt='2026-01-01T00:00:00Z';await f.store.put('assessment_attempts',actual);
 assert.equal((await f.post('/api/assessments/'+a.id+'/save',{draftVersion:1,answers:{q1:'TARDIF'}},'alice')).status,409);
 const s=await f.ok('/api/assessments/'+a.id+'/submit',{draftVersion:0,answers:{q1:'LOCAL NON SYNCHRONISE'}},'alice'),duplicate=await f.ok('/api/assessments/'+a.id+'/submit',{draftVersion:0,answers:{}},'alice');assert.equal(s.submissionId,duplicate.submissionId);assert.equal(s.closure,'deadline');
 const frozen=await f.store.get('submissions',s.submissionId);assert.equal(frozen.answers.q1,'VERSION SERVEUR');assert.equal(frozen.answerStates.q2,'time_limit');assert.equal((await f.store.get('corrections',s.submissionId)).items[1].points,null);
 const input={requestId:'recovery-demo',answers:{q1:'LOCAL NON SYNCHRONISE'},reason:'Récupération autorisée après panne'};
 const r=await f.ok('/api/diagnostics/attempts/'+a.id+'/recovery',input),r2=await f.ok('/api/diagnostics/attempts/'+a.id+'/recovery',input);assert.equal(r.id,r2.id);assert.deepEqual(await f.store.get('submissions',s.submissionId),frozen);
 assert.equal((await f.post('/api/diagnostics/attempts/'+a.id+'/recovery',input,'bob')).status,403);
});

test('AD13 AD14 AD15 AD16 comments anchor text, code, subanswers and empty items; stale revisions conflict',async t=>{
 const f=await diagnosticFixture(t),v=await f.store.get('lesson_versions','lesson:v1');v.spec.diagnostic.tasks[0].answerParts=[{id:'reason',label:'Justification'}];await f.store.put('lesson_versions',v);
 const {attempt:a,submission:s}=await f.submit31('alice',{q1:'{"reason":"Parce que la limite est incluse"}',q2:'return a && b;'}),detail=(await f.call('/api/tracking/attempts/'+a.id)).data,units=detail.responseUnits;
 assert.equal(units.length,4);assert.ok(units.some(u=>u.partId==='reason'));assert.equal(units.find(u=>u.taskId==='q3').answer,'');
 const comments=units.map(u=>({responseId:u.id,text:'Commentaire exact '+u.label}));
 const c=await f.ok('/api/diagnostics/submissions/'+s.submissionId+'/comments',{version:1,responseComments:comments,privateNotes:'PRIVATE SECRET'});assert.deepEqual(c.responseComments.map(c=>c.text),comments.map(c=>c.text));
 assert.equal((await f.post('/api/diagnostics/submissions/'+s.submissionId+'/comments',{version:1,responseComments:[]})).status,409);
 const reversed=structuredClone(v.spec.diagnostic);reversed.tasks.reverse();assert.deepEqual(responseUnits(reversed,a.id,'lesson:v1',detail.answers).map(u=>u.id).sort(),units.map(u=>u.id).sort());
 assert.equal((await f.post('/api/diagnostics/submissions/'+s.submissionId+'/comments',{version:c.version,responseComments:[{responseId:'another-copy',text:'No'}]})).status,400);
});

test('AD17 AD18 AD19 AD20 coherent publication and old revision survive private comments and partial batch',async t=>{
 const f=await diagnosticFixture(t),{attempt:a,submission:s}=await f.submit31(),units=(await f.call('/api/tracking/attempts/'+a.id)).data.responseUnits;
 const c=await f.correct31(s,[8,8,4],{responseComments:[{responseId:units[0].id,text:'PUBLIC COMMENT'}],privateNotes:'PRIVATE SECRET'});
 assert.equal((await f.post('/api/tracking/submissions/'+s.submissionId+'/publish',{version:c.version})).status,400);
 await f.publish31(s,c);const before=(await f.call('/api/tracking/attempts/'+a.id,{as:'alice'})).data;assert.match(JSON.stringify(before),/PUBLIC COMMENT/);assert.doesNotMatch(JSON.stringify(before),/PRIVATE SECRET/);assert.equal(before.result.score,20);assert.equal(before.result.level,'A1');
 const revised=await f.ok('/api/diagnostics/submissions/'+s.submissionId+'/comments',{version:c.version,responseComments:[{responseId:units[0].id,text:'UNPUBLISHED COMMENT'}],feedback:'UNPUBLISHED APPRECIATION'});
 const after=(await f.call('/api/tracking/attempts/'+a.id,{as:'alice'})).data;assert.deepEqual(after.result,before.result);assert.doesNotMatch(JSON.stringify(after),/UNPUBLISHED/);
 assert.equal((await f.post('/api/tracking/submissions/'+s.submissionId+'/publish',{version:c.version})).status,400);
 assert.equal((await f.post('/api/tracking/submissions/'+s.submissionId+'/publish',{version:revised.version})).status,400);
});

test('AD21 AD22 AD23 AD24 missing/empty/partial results, fake scores, essential criteria and unobservable A2',async t=>{
 const f=await diagnosticFixture(t),{submission:s}=await f.submit31('alice',{q1:'',q2:'return a || b;'}),c=await f.store.get('corrections',s.submissionId);
 assert.equal(c.score,null);assert.equal(c.scoreMax,20);assert.equal(c.items[0].points,null);assert.equal(c.items[0].answerState,'explicit_empty');assert.equal(c.items[2].answerState,'not_addressed');
 const evaluated=await f.correct31(s,[8,3,4]);assert.equal(evaluated.score,15);assert.equal(evaluated.grade,'EC');assert.ok(evaluated.competencyResults.some(o=>o.grade==='A1'));assert.ok(!evaluated.categories.some(c=>c.id==='A2'));
 const a=await f.start31('bob');await f.ok('/api/assessments/'+a.id+'/save',{draftVersion:0,answers:{q1:'inconnu'},score:20,level:'A2'},'bob');const saved=await f.store.get('assessment_attempts',a.id);assert.equal(saved.score,undefined);assert.equal(saved.level,undefined);
 const partial=await f.correct31(s,[8,null,4],{finalize:false,validateObservations:true,feedback:''});assert.equal(partial.score,null);assert.equal(partial.scoreMax,20);
});

test('AD05 AD25 AD26 AD27 AD29 six DEMO profiles keep targeted needs, unknowns and exposure separate',async t=>{
 const f=await diagnosticFixture(t);
 const rows={};for(const [id,points] of Object.entries({alice:[8,0,0],bob:[0,8,0],incident:[null,null,null],contradiction:[0,8,0],ready:[8,8,4]})){const {submission:s}=await f.submit31(id);rows[id]=await f.correct31(s,points,{finalize:false,validateObservations:true,feedback:''});}
 assert.equal(rows.alice.score,rows.bob.score);
 const rule=await f.rule31(),a=await f.proposal(rule,'alice'),b=await f.proposal(rule,'bob');assert.notEqual(a.priority.criterionId,b.priority.criterionId);assert.equal(a.family,'guided');assert.equal(b.family,'guided');
 for(const id of ['missing','incident']){const p=await f.proposal(rule,id);assert.equal(p.family,'observe');assert.equal(p.readiness,'insufficient');}
 assert.equal((await f.proposal(rule,'ready')).family,'ready');
 assert.equal((await f.call('/api/competencies/adaptation/runs/run',{as:'alice'})).status,403);
 assert.equal((await f.store.list('learning_reprises','A1')).length,0);
 const copy=(await f.store.list('assessment_attempts','A1')).find(a=>a.learnerId==='alice');copy.exposure='not_exposed';await f.store.put('assessment_attempts',copy);const absent=await f.proposal(rule,'alice');assert.equal(absent.family,'observe');assert.ok(absent.needs.some(n=>n.state==='ready'));
 const incident=(await f.store.list('assessment_attempts','A1')).find(a=>a.learnerId==='incident');await f.correct31({submissionId:incident.submissionId},[0,null,0],{finalize:false,validateObservations:true,feedback:''});const mixed=await f.proposal(rule,'incident');assert.equal(mixed.family,'guided');assert.ok(mixed.needs.some(n=>n.state==='insufficient'));
});

test('AD30 AD31 AD32 stale or private proposals cannot assign; capacity conflict preserves needs',async t=>{
 const f=await diagnosticFixture(t),s1=(await f.submit31()).submission,s2=(await f.submit31('bob')).submission,c1=await f.correct31(s1,[8,0,0]),c2=await f.correct31(s2,[8,0,0]),rule=await f.rule31({capacity:1}),p=await f.proposal(rule);
 assert.equal((await f.post('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true})).status,400);
 await f.publish31(s1,c1);await f.publish31(s2,c2);const assigned=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true}),again=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true});assert.equal(assigned.assignmentId,again.assignmentId);
 const p2=await f.proposal(rule,'bob');assert.equal((await f.post('/api/competencies/adaptation/'+p2.id+'/activate',{confirmed:true})).status,409);
 await f.correct31(s2,[8,1,0]);assert.equal((await f.post('/api/competencies/adaptation/'+p2.id+'/activate',{confirmed:true})).status,409);
 const privateProposal=await f.proposal(rule,'bob');assert.equal((await f.post('/api/competencies/adaptation/'+privateProposal.id+'/activate',{confirmed:true})).status,400);
});

test('AD37 AD39 API access, safe text payloads and exports omit local confirmation',async t=>{
 const f=await diagnosticFixture(t),{attempt:a,submission:s}=await f.submit31('alice',{q1:'<script>window.attack=1</script>',q2:'// do not execute'});
 for(const as of ['bob','outsider'])assert.equal((await f.call('/api/tracking/attempts/'+a.id,{as})).status,404);
 assert.equal((await f.call('/api/teacher/submissions/'+s.submissionId,{as:'bob'})).status,403);
 const v=await f.store.get('lesson_versions','lesson:v1'),portable=normalizedSpec(v.spec);assert.equal(portable.diagnostic.contract.source,null);assert.equal(portable.diagnostic.contract.sourceConfirmed,false);assert.equal(portable.diagnostic.tasks.length,3);
 const safe=studentSpec(v.spec);assert.ok(safe.diagnostic.tasks.every(t=>!t.reference&&!t.tests));assert.equal(safe.diagnostic.contract.confirmedBy,undefined);
});

test('AD20 batch publication reports one success and a stale revision without mixing results',async t=>{
 const f=await diagnosticFixture(t),a=(await f.submit31()).submission,b=(await f.submit31('bob')).submission,ca=await f.correct31(a),cb=await f.correct31(b);
 await f.correct31(b,[8,3,4]);const run=await f.store.get('lesson_runs','run');run.availability='closed';await f.store.put('lesson_runs',run);
 const batch=await f.ok('/api/tracking/runs/run/publish',{copies:[{id:a.submissionId,version:ca.version},{id:b.submissionId,version:cb.version}]});assert.equal(batch.published,1);assert.equal(batch.failed,1);assert.equal(batch.results[1].status,'failed');assert.equal(await f.store.get('result_publications',b.submissionId),null);
});

test('AD26 comparable contradictory history requires verification, never a weakness label',async t=>{
 const f=await diagnosticFixture(t),s=(await f.submit31('contradiction')).submission;await f.correct31(s,[0,8,0]);
 const current=(await f.store.list('competency_observations','A1')).find(o=>o.learnerId==='contradiction'&&o.competencyId==='conditions');
 await f.store.insert('corrections',{id:'historical-demo',classId:'A1',version:1,status:'approved'});
 await f.store.insert('competency_observations',{...current,id:'historical-observation-demo',submissionId:'historical-demo',correctionVersion:1,runId:'historical-run',situationId:'independent-history',workedAt:'2026-01-01T12:00:00Z',grade:'A1',criteria:current.criteria.map(c=>({...c,grade:'A1'}))});
 const rule=await f.rule31(),p=await f.proposal(rule,'contradiction');assert.equal(p.readiness,'verify');assert.equal(p.family,'observe');assert.equal(p.proofs.length,3);
});

test('AD28 extension requires configured demand and evidence; caps prevent invented A2',async t=>{
 const f=await diagnosticFixture(t),cats=[...categories,{id:'A2',order:3,description:'DEMO : transfert justifié dans cette situation'}],cond=(ids,value)=>({itemIds:ids,metric:'points',op:'gte',value,label:'Transfert DEMO'});
 const grid=structuredClone(f.grid);grid.categories=cats;grid.globalRules.unshift({grade:'A2',conditions:[cond(['r1','r2','r3'],20)]});
 for(const m of grid.competencies){m.maximumGrade='A2';m.rules.unshift({grade:'A2',conditions:[cond(m.criteria[0].itemIds,m.competencyId==='conditions'?12:8)]});for(const c of m.criteria){c.maximumGrade='A2';c.rules.unshift({grade:'A2',conditions:[cond(c.itemIds,m.competencyId==='conditions'?12:8)]});}}
 await f.ok('/api/competencies/grids',grid);const s=(await f.submit31('ready')).submission,c=await f.correct31(s);assert.equal(c.grade,'A2');
 const rule=await f.rule31({targets:{extension:{runId:'run',activityId:'transfer'},verify:{runId:'run',activityId:'extension'}},prerequisites:[['conditions','comparisons'],['decisions','combined']].map(([competencyId,id])=>({frameworkVersionId:f.framework.id,competencyId,criterionIds:[id],categories:cats,expectedGrade:'A1',extensionGrade:'A2',guidedGrades:['NA'],consolidationGrades:['EC']}))});
 const p=await f.proposal(rule,'ready');assert.equal(p.family,'extension');assert.equal(p.target.activityId,'transfer');assert.equal(p.proofs.length,2);
 // Distinct fixture explicitly caps all tasks at A1 despite the numeric rule.
 const capped=await diagnosticFixture(t),cappedGrid=structuredClone(capped.grid);cappedGrid.categories=cats;cappedGrid.globalRules.unshift({grade:'A2',conditions:[cond(['r1','r2','r3'],20)]});await capped.ok('/api/competencies/grids',cappedGrid);const s2=(await capped.submit31('alice')).submission;
 const limited=await capped.correct31(s2);assert.equal(limited.grade,null);assert.match(limited.gradeReasons.join(' '),/observable/);
});

test('AD32 unavailable activity is explicit and no link or assignment is fabricated',async t=>{
 const f=await diagnosticFixture(t),s=(await f.submit31()).submission;await f.correct31(s,[8,0,0]);const rule=await f.rule31({targets:{}}),p=await f.proposal(rule);assert.equal(p.missingActivity,true);assert.equal(p.target,null);assert.equal(p.needs.length,2);assert.equal((await f.store.list('learning_reprises')).length,0);
});

test('AD33 remediation and independent verification preserve the original and return persistent difficulty to teacher',async t=>{
 const f=await diagnosticFixture(t),s=(await f.submit31()).submission,c=await f.correct31(s,[8,0,0]);await f.publish31(s,c);
 const v=structuredClone(await f.store.get('lesson_versions','lesson:v1'));v.id='verification:v1';await f.store.insert('lesson_versions',v);
 const run=await f.store.insert('lesson_runs',{id:'verification-run',classId:'A1',lessonId:'lesson',lessonVersionId:v.id,date:'2026-10-06',availability:'open'});
 await f.ok('/api/competencies/grids',{...f.grid,lessonVersionId:v.id,version:0,situationId:'independent-verification-demo'});
 const rule=await f.rule31({targets:{guided:{runId:run.id,activityId:'transfer'},verify:{runId:run.id,activityId:'extension'}}}),p=await f.proposal(rule),active=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true});
 await f.ok('/api/events',{lessonId:'lesson',lessonVersionId:v.id,assignmentId:active.assignmentId,eventId:'v31-answer',type:'answer_saved',activityId:'transfer',payload:{answer:'Production de reprise DEMO'},progressVersion:0},'alice');
 await f.ok('/api/events',{lessonId:'lesson',lessonVersionId:v.id,assignmentId:active.assignmentId,eventId:'v31-completed',type:'step_completed',activityId:'transfer',payload:{}},'alice');
 const checking=await f.ok('/api/competencies/adaptation/'+p.id+'/verification');
 const a=await f.ok('/api/assessments/lesson/start',{assignmentId:checking.verificationAssignmentId,begin:true},'alice'),verified=await f.ok('/api/assessments/'+a.id+'/submit',{draftVersion:a.draftVersion,answers:{q1:'12',q2:'a || b',q3:'Limite'}},'alice');
 const vc=await f.correct31(verified,[8,0,0]);const ownRun=await f.store.get('lesson_runs',a.assignmentId?(await f.store.get('lesson_assignments',a.assignmentId)).runId:run.id);ownRun.availability='closed';await f.store.put('lesson_runs',ownRun);await f.ok('/api/tracking/submissions/'+verified.submissionId+'/publish',{version:vc.version});
 const done=await f.ok('/api/competencies/adaptation/'+p.id+'/verify',{submissionId:verified.submissionId,reason:'Le besoin persiste : intervention professeur.'});assert.equal(done.state,'teacher_required');assert.equal((await f.store.get('corrections',s.submissionId)).version,c.version);assert.equal((await f.store.list('mastery_decisions')).length,0);
});
