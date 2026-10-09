import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingFixture} from './fixtures/student-tracking.mjs';
import {migrateTracking,assignmentKey,memberKey} from '../server/student-tracking.mjs';
import {summarizeItems} from '../server/assessment.mjs';
import {studentSpec} from '../server/generator.mjs';
async function fixture(t){const f=await trackingFixture();t.after(f.close);return f;}
const post=(call,path,body,as='teacher')=>call(path,{method:'POST',body,as});
async function correct(f,s,points=10){const c=await f.store.get('corrections',s.submissionId);const r=await post(f.call,`/api/teacher/submissions/${s.submissionId}/correction`,{version:c.version,items:c.items.map(i=>({id:i.id,points,feedback:'La réponse décrit les deux conditions.'})),feedback:'Retour publié seulement après clôture.',reason:'Relecture de la copie'});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}

test('AC01 CSV preview, stable identity, homonyms and retry without account duplicates',async t=>{const f=await fixture(t),input={csv:'username,displayName\ncharlie,Camille Martin\ndana,Camille Martin'};
 const preview=await post(f.call,'/api/tracking/students/preview',input);assert.equal(preview.data.canApply,true);assert.deepEqual(preview.data.rows.map(r=>r.action),['create','create']);
 const applied=await post(f.call,'/api/tracking/students/import',{...input,token:preview.data.token});assert.equal(applied.status,200);assert.notEqual(applied.data.rows[0].password,applied.data.rows[1].password);
 const again=await post(f.call,'/api/tracking/students/preview',input);assert.deepEqual(again.data.rows.map(r=>r.action),['existing','existing']);assert.equal((await post(f.call,'/api/tracking/students/import',{...input,token:again.data.token})).status,200);assert.equal((await f.store.list('learners')).length,4);
 const invalid=await post(f.call,'/api/tracking/students/preview',{csv:'username,displayName\nalice,Autre personne\nx,\ndana,Camille Martin\ndana,Camille Martin'});assert.equal(invalid.data.canApply,false);assert.equal(invalid.data.rows.filter(r=>r.error).length,3);
 assert.equal((await f.call('/api/tracking/mine',{as:'alice'})).data.items.length,1);
 const newStudent=applied.data.rows[0].learnerId;assert.equal((await f.store.list('lesson_assignments')).some(a=>a.learnerId===newStudent),false);
});
test('AC02 AC03 direct access, transfer keeps original class and teacher revocation',async t=>{const f=await fixture(t),{a,s}=await f.submit();
 for(const as of ['bob','outsider']){assert.equal((await f.call('/api/tracking/attempts/'+a.id,{as})).status,404);assert.equal((await f.call('/api/tracking/assignments/'+f.assignment.id,{as})).status,404);}
 assert.equal((await f.call('/api/teacher/submissions/'+s.submissionId,{as:'outsider'})).status,404);
 const l=await f.store.get('learners','alice');l.classId='A2';l.authVersion=1;await f.store.put('learners',l);
 const login=await post(f.call,'/api/login',{role:'student',username:'alice',password:f.password,classId:'A2'},'none');assert.equal(login.status,200);f.cookies.alice=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await f.call('/api/tracking/attempts/'+a.id,{as:'alice'})).status,200);assert.equal((await f.call('/api/tracking/attempts/'+a.id,{as:'outsider'})).status,404);assert.equal((await f.store.get('submissions',s.submissionId)).classId,'A1');
 assert.equal((await f.call('/api/teacher/submissions/'+s.submissionId+'/export')).status,200);assert.equal((await f.call('/api/teacher/submissions/'+s.submissionId+'/export',{as:'outsider'})).status,404);
 const teacher=await f.store.get('teachers','teacher');teacher.classId='A3';await f.store.put('teachers',teacher);assert.equal((await f.call('/api/teacher/submissions/'+s.submissionId)).status,401);
});
test('AC04 archive membership preserves copies; suspension invalidates login; shared account guarded',async t=>{const f=await fixture(t),{a}=await f.submit();
 assert.equal((await f.call('/api/tracking/students/alice',{method:'PATCH',body:{membership:'archived'}})).status,200);assert.equal((await f.call('/api/tracking/students')).data.items.some(l=>l.id==='alice'),false);assert.equal((await f.call('/api/tracking/attempts/'+a.id,{as:'alice'})).status,200);
 assert.equal((await f.call('/api/tracking/students/alice',{method:'PATCH',body:{suspended:true}})).status,200);assert.equal((await f.call('/api/tracking/mine',{as:'alice'})).status,401);
 assert.equal((await post(f.call,'/api/login',{role:'student',username:'alice',password:f.password},'none')).status,401);
 await f.store.insert('enrollments',{id:memberKey('A2','bob'),classId:'A2',learnerId:'bob',status:'active'});
 assert.equal((await f.call('/api/tracking/students/bob',{method:'PATCH',body:{suspended:true}})).status,403);assert.equal((await post(f.call,'/api/teacher/learners/bob/access',{})).status,403);
});
test('AC05 AC06 AC08 past sessions, exact server draft, conflicts and frozen idempotent submission',async t=>{const f=await fixture(t),a=await f.start();
 let list=await f.call('/api/tracking/mine',{as:'alice'});assert.equal(list.data.items[0].state,'À commencer');
 const answers={'demo-diag':'Première réponse','demo-diag-2':'Deuxième réponse'},packet={answers,draftVersion:0,requestId:'save-1'};
 const save=await post(f.call,`/api/assessments/${a.id}/save`,packet,'alice');assert.equal(save.status,200);assert.equal(save.data.draftVersion,1);
 assert.equal((await post(f.call,`/api/assessments/${a.id}/save`,packet,'alice')).data.draftVersion,1);
 assert.equal((await post(f.call,`/api/assessments/${a.id}/save`,{answers:{},draftVersion:0,requestId:'old-tab'},'alice')).status,409);
 assert.deepEqual((await f.call('/api/tracking/attempts/'+a.id,{as:'alice'})).data.answers,answers);
 const code=JSON.stringify({files:[{path:'index.html',content:'<h1>Bonjour</h1>'},{path:'style.css',content:'h1{color:red}'},{path:'main.js',content:'console.log(1)'}]});
 const event={eventId:'files-saved',assignmentId:f.assignment.id,lessonId:'lesson',lessonVersionId:'lesson:v1',progressVersion:0,type:'answer_saved',activityId:'guided-code',payload:{answer:code}};
 assert.equal((await post(f.call,'/api/events',event,'alice')).status,200);
 const repeated=await post(f.call,'/api/events',event,'alice');assert.equal(repeated.status,200);assert.equal(repeated.data.progressVersion,1);assert.equal((await post(f.call,'/api/events',{...event,payload:{answer:'Écrasement'}},'alice')).status,409);
 const context=await f.call('/api/today?assignment='+f.assignment.id,{as:'alice'});assert.equal(context.data.progress.answers['guided-code'],code);
 await post(f.call,'/api/logout',{},'alice');const reconnect=await post(f.call,'/api/login',{role:'student',username:'alice',password:f.password,classId:'A1'},'none');assert.equal(reconnect.status,200);f.cookies.alice=reconnect.headers.get('set-cookie').split(';')[0];
 const restored=(await f.call('/api/today?assignment='+f.assignment.id,{as:'alice'})).data;assert.equal(restored.progress.answers['guided-code'],code);assert.deepEqual(restored.attempt.answers,answers);
 const rem=await post(f.call,`/api/assessments/${a.id}/submit`,{answers,draftVersion:1,score:20},'alice');assert.equal(rem.status,200,JSON.stringify(rem.data));
 const repeat=await post(f.call,`/api/assessments/${a.id}/submit`,{answers:{'demo-diag':'tampered'},draftVersion:0},'alice');assert.equal(rem.data.submissionId,repeat.data.submissionId);assert.equal((await post(f.call,`/api/assessments/${a.id}/save`,{answers:{},draftVersion:1},'alice')).status,409);
 assert.equal((await f.store.get('corrections',rem.data.submissionId)).score,null);
 await f.call('/api/tracking/runs/run',{method:'PATCH',body:{availability:'closed'}});
 const bob=await f.start('bob');assert.equal(bob.error,'Cette passation est fermée. Ton travail reste consultable.');
 list=await f.call('/api/tracking/mine',{as:'bob'});assert.equal(list.data.items[0].state,'À commencer');assert.equal(list.data.items[0].action,'Revoir');
});
test('AC05 closed unsent draft retains advancement and refuses saving or submission',async t=>{const f=await fixture(t),a=await f.start();await post(f.call,`/api/assessments/${a.id}/save`,{answers:{'demo-diag':'Brouillon'},draftVersion:0},'alice');await f.call('/api/tracking/runs/run',{method:'PATCH',body:{availability:'closed'}});
 assert.equal((await f.store.get('lesson_runs','run')).closedAt,null);const closed=await post(f.call,'/api/lessons/lesson/close',{status:'not_completed'});assert.equal(closed.status,200);assert.ok(closed.data.closedAt);
 const row=(await f.call('/api/tracking/mine',{as:'alice'})).data.items[0];assert.equal(row.status,'Fermée — travail non remis');assert.equal(row.state,'En cours');assert.equal((await post(f.call,`/api/assessments/${a.id}/submit`,{answers:{},draftVersion:1},'alice')).status,409);
});
test('AC09 AC10 AC11 AC12 missing vs pending, private solution boundary and revision publication',async t=>{const f=await fixture(t),{a,s}=await f.submit();
 const list=(await f.call('/api/tracking/runs/run')).data.rows.items;assert.equal(list.find(r=>r.learnerId==='bob').status,'Aucun rendu');assert.equal(list.find(r=>r.learnerId==='alice').status,'À corriger');
 for(const path of ['/api/today?assignment='+f.assignment.id,'/api/tracking/attempts/'+a.id,'/api/assessments/'+a.id+'/result']){const r=await f.call(path,{as:'alice'});assert.equal(r.status,200);assert.doesNotMatch(JSON.stringify(r.data),/PRIVATE_SOLUTION|PRIVATE_GUIDE|points|approvedBy/);}
 const c=await correct(f,s);assert.equal((await post(f.call,`/api/tracking/submissions/${s.submissionId}/publish`,{version:c.version})).status,400);
 await f.call('/api/tracking/runs/run',{method:'PATCH',body:{availability:'closed'}});assert.equal((await post(f.call,`/api/tracking/submissions/${s.submissionId}/publish`,{version:c.version})).status,200);
 let r=(await f.call(`/api/assessments/${a.id}/result`,{as:'alice'})).data;assert.equal(r.score,20);assert.equal(r.source,'teacher');
 const next=await correct(f,s,5);r=(await f.call(`/api/assessments/${a.id}/result`,{as:'alice'})).data;assert.equal(r.score,20);assert.equal(r.version,c.version);
 await post(f.call,`/api/tracking/submissions/${s.submissionId}/publish`,{version:next.version});await post(f.call,`/api/tracking/submissions/${s.submissionId}/publish`,{version:next.version});assert.equal((await f.store.list('result_publications')).length,1);assert.equal((await f.call(`/api/assessments/${a.id}/result`,{as:'alice'})).data.score,10);
 assert.match(JSON.stringify((await f.call('/api/tracking/attempts/'+a.id,{as:'alice'})).data),/PRIVATE_SOLUTION/);
});
test('AC13 targeted retake opens only one student; practice never replaces initial evidence',async t=>{const f=await fixture(t),{a,s}=await f.submit();const c=await correct(f,s);await f.call('/api/tracking/runs/run',{method:'PATCH',body:{availability:'closed'}});await post(f.call,`/api/tracking/submissions/${s.submissionId}/publish`,{version:c.version});
 const retake=await post(f.call,`/api/teacher/submissions/${s.submissionId}/reopen`,{reason:'Revoir les conditions',requestId:'retry-1'});assert.equal(retake.status,200);assert.notEqual(retake.data.id,a.id);assert.equal(retake.data.targetedOpen,true);
 assert.equal((await post(f.call,`/api/assessments/${retake.data.id}/save`,{answers:{'demo-diag':'Reprise'},draftVersion:0},'alice')).status,200);assert.equal((await f.store.get('lesson_runs','run')).availability,'closed');
 const practice=await post(f.call,`/api/tracking/submissions/${s.submissionId}/practice`,{requestId:'practice-1'},'alice');assert.equal(practice.status,200);assert.equal(practice.data.mode,'practice');assert.notEqual(practice.data.id,retake.data.id);
 assert.equal((await f.call(`/api/assessments/${a.id}/result`,{as:'alice'})).data.score,20);assert.equal((await f.store.list('submissions')).length,1);
});
test('AC14 stable activity identities and original version remain after content replacement',async t=>{const f=await fixture(t),{a,s}=await f.submit(),updated=structuredClone(f.spec);updated.blocks.reverse();updated.activities=[];updated.diagnostic.tasks[0].instruction='NOUVELLE QUESTION';await f.store.insert('lesson_versions',{id:'lesson:v2',classId:'A1',lessonId:'lesson',version:2,spec:updated});await f.store.put('lessons',{...f.lesson,versionId:'lesson:v2',version:2});
 const context=(await f.call('/api/today?assignment='+f.assignment.id,{as:'alice'})).data;assert.equal(context.lesson.versionId,'lesson:v1');assert.deepEqual(context.lesson.spec.blocks.map(b=>b.id),f.spec.blocks.map(b=>b.id));assert.equal((await f.store.get('submissions',s.submissionId)).diagnostic.tasks[0].instruction,f.spec.diagnostic.tasks[0].instruction);
});
test('AC16 explicit student projection excludes unknown private fields and export endpoints',async t=>{const f=await fixture(t);const unsafe=structuredClone(f.spec);unsafe.privateComment='SECRET';unsafe.activities[0].privateComment='SECRET';unsafe.blocks[0].privateComment='SECRET';unsafe.diagnostic.tasks[0].workshop={profile:'algorithm',files:[],hiddenTests:'SECRET'};assert.doesNotMatch(JSON.stringify(studentSpec(unsafe)),/SECRET|PRIVATE_GUIDE|PRIVATE_SOLUTION/);assert.equal((await post(f.call,'/api/lesson-transfers/export',{lessonIds:['lesson']},'alice')).status,403);assert.equal((await f.call('/api/corpus/lesson/download',{as:'alice'})).status,403);});
test('AC17 manual remediation creates usable targeted attribution after closure without mastery',async t=>{const f=await fixture(t);await f.call('/api/tracking/runs/run',{method:'PATCH',body:{availability:'closed'}});const r=await post(f.call,'/api/tracking/reprises',{learnerId:'alice',runId:'run',activityId:'guided-code',reason:'Combiner les deux conditions.'});assert.equal(r.status,200);assert.notEqual(r.data.assignmentId,f.assignment.id);const context=(await f.call('/api/today?assignment='+r.data.assignmentId,{as:'alice'})).data;assert.equal(context.readOnly,false);assert.equal(context.summary.reprises[0].reason,'Combiner les deux conditions.');assert.equal((await f.store.list('evidence')).length,0);assert.equal((await f.call('/api/tracking/mine',{as:'bob'})).data.items.length,1);});
test('AC18 additive migration reports orphan data and preserves source, rerunnable without duplicates',async t=>{const f=await fixture(t);await f.store.insert('assessment_attempts',{id:'orphan',classId:'A3',learnerId:'unknown',lessonId:'unknown',answers:{legacy:'Original'}});const first=await f.store.transaction(tx=>migrateTracking(tx,'A3')),again=await f.store.transaction(tx=>migrateTracking(tx,'A3'));assert.deepEqual(first,again);assert.equal(first.issues.length,1);assert.equal((await f.store.get('assessment_attempts','orphan')).answers.legacy,'Original');assert.equal((await f.call('/api/tracking/students',{as:'outsider'})).data.total,0);});
test('AC19 class counts and bulk publication report partial results per copy',async t=>{const f=await fixture(t),first=await f.submit(),second=await f.submit('bob'),c=await correct(f,first.s);await f.call('/api/tracking/runs/run',{method:'PATCH',body:{availability:'closed'}});const r=await post(f.call,'/api/tracking/runs/run/publish',{copies:[{id:first.s.submissionId,version:c.version},{id:second.s.submissionId,version:1}]});assert.equal(r.status,200);assert.equal(r.data.published,1);assert.equal(r.data.failed,1);assert.match(r.data.results[1].error,/corriger/);});
test('AC07 stale session actor cannot mutate the newly logged-in account',async t=>{const f=await fixture(t),a=await f.start('bob');const r=await f.call(`/api/assessments/${a.id}/save`,{method:'POST',as:'bob',headers:{'X-Eden-Actor':'alice'},body:{answers:{'demo-diag':'Ancienne session'},draftVersion:0}});assert.equal(r.status,401);assert.deepEqual((await f.store.get('assessment_attempts',a.id)).answers,{});});

test('AC05 AC08 repeated occurrences keep work receipts, drafts and completion independent',async t=>{
 const f=await fixture(t);await f.submit();
 const first=await post(f.call,'/api/lessons/lesson/work/submit',{requestId:'first-work-receipt',assignmentId:f.assignment.id,lessonVersionId:'lesson:v1',progressVersion:0,answers:{'guided-code':'return true;'}},'alice');assert.equal(first.status,200,JSON.stringify(first.data));
 const r=await post(f.call,'/api/tracking/runs',{lessonId:'lesson',date:'2026-10-10',learnerIds:['alice'],requestId:'second-date'});assert.equal(r.status,200);
 const assigned=assignmentKey(r.data.id,'alice');
 let d=(await f.call('/api/today?assignment='+assigned,{as:'alice'})).data;assert.equal(d.readOnly,false);assert.equal(d.progress,null);assert.deepEqual(d.summary.workSubmissions,[]);assert.equal(d.summary.state,'À commencer');
 const wrong=await post(f.call,'/api/events',{eventId:'wrong-run-receipt',assignmentId:assigned,type:'lesson_submitted',payload:{submissionId:first.data.id}},'alice');assert.equal(wrong.status,400);
 const conflict=await post(f.call,'/api/tracking/runs',{lessonId:'lesson',date:'2026-10-11',learnerIds:['alice'],requestId:'second-date'});assert.equal(conflict.status,409);
 d=(await f.call('/api/today?assignment='+f.assignment.id,{as:'alice'})).data;assert.equal(d.summary.state,'En cours');assert.equal(d.readOnly,true);
});
test('AC02 revoked assignments are absent from Today, receipts and direct downloads',async t=>{
 const f=await fixture(t);await f.submit();const s=await post(f.call,'/api/lessons/lesson/work/submit',{requestId:'revoke-work-receipt',assignmentId:f.assignment.id,lessonVersionId:'lesson:v1',progressVersion:0,answers:{}},'alice');assert.equal(s.status,200);
 await f.call('/api/tracking/runs/run',{method:'PATCH',body:{availability:'revoked'}});
 assert.equal((await f.call('/api/today?lesson=lesson',{as:'alice'})).status,404);assert.equal((await f.call('/api/today',{as:'alice'})).data.lesson,null);
 assert.deepEqual((await f.call('/api/work-submissions',{as:'alice'})).data,[]);
 for(const as of ['alice','bob'])for(const suffix of ['', '/file?path=answers.json'])assert.equal((await f.call('/api/work-submissions/'+s.data.id+suffix,{as})).status,404);
 assert.equal((await post(f.call,'/api/tracking/reprises',{learnerId:'alice',runId:'run',activityId:'guided-code',reason:'Revoir cette activité'})).status,400);
});
test('AC05 required work completion excludes optional activities and never implies mastery',async t=>{
 const f=await fixture(t),v=await f.store.get('lesson_versions','lesson:v1');for(const a of v.spec.activities)a.required=a.id==='guided-code';await f.store.put('lesson_versions',v);await f.submit();
 const r=await post(f.call,'/api/lessons/lesson/work/submit',{requestId:'required-work-receipt',assignmentId:f.assignment.id,lessonVersionId:'lesson:v1',progressVersion:0,answers:{'guided-code':'return aCarte && aReserve;'}},'alice');assert.equal(r.status,200);
 assert.equal((await f.call('/api/tracking/mine',{as:'alice'})).data.items[0].state,'Terminée');assert.deepEqual(await f.store.list('evidence'),[]);
});
test('AC09 AC10 diagnostics without a numeric rubric never invent a score or common scale',async t=>{
 const f=await fixture(t),v=await f.store.get('lesson_versions','lesson:v1');v.spec.diagnostic.rubric=[];await f.store.put('lesson_versions',v);const {s}=await f.submit(),c=await correct(f,s);assert.equal(c.score,null);assert.equal(c.scoreMax,null);assert.equal(c.level,null);
 const summary=summarizeItems([{points:3,max:4,a1:2,a2:3,confidence:1,criterion:'custom'}]);assert.equal(summary.score,3);assert.equal(summary.scoreMax,4);assert.equal(summary.level,null);
});
test('AC09 existing observations retain levels, dates and missing-proof anomalies',async t=>{
 const f=await fixture(t);await f.store.insert('evidence',{id:'old-proof',classId:'A1',learnerId:'alice',criterion:'logic',level:'A1',date:'2026-10-01',sourceId:'missing-copy',revision:2,approved:true});
 await f.store.insert('teacher_observations',{id:'observation',classId:'A1',learnerId:'alice',criterion:'logic',level:'EC',date:'2026-10-02',note:'Hésitation observée sur OU.',authorId:'teacher'});
 const profile=(await f.call('/api/tracking/students/alice')).data;assert.equal(profile.observations[0].latest,true);assert.equal(profile.observations[0].note,'Hésitation observée sur OU.');assert.equal(profile.observations[1].level,'A1');assert.equal(profile.observations[1].proofAvailable,false);assert.equal(profile.observations[1].latest,false);
});
