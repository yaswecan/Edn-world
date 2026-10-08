import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {diagnosticFrom,qualityCheck,studentSpec} from '../server/generator.mjs';
import {diagnosticChecks} from '../server/diagnostic.mjs';
import {activity} from '../server/activity.mjs';
import {demoLesson} from '../server/demo-lesson.mjs';
import {demoFlexbox} from '../server/demo-flexbox.mjs';
import {diagnosticSchema,validate} from '../server/contracts.mjs';
import {parseWorkbook} from '../server/importer.mjs';
import {gradeTask,correct} from '../server/assessment.mjs';
import {testActivityCode} from '../server/workshop-testing.mjs';
import {DIAGNOSTIC_POLICY} from '../server/diagnostic-practice.mjs';
import {prepareScaffold} from '../server/pedagogy/scaffold.mjs';
import {renderActivity,DiagnosticIntro} from '../public/lesson-renderer.js';

const previous={id:'real-run',lessonVersionId:'real:v2',date:'2026-10-01',coveredSkills:['A','B'],coveredContent:'Une fonction et ses cas de test.',coveredActivityIds:[],reactivatedPrerequisites:[]};
const sourceTask=(id,skills,extra={})=>activity(id,id,'Écris une réponse et vérifie un exemple.',skills,extra);
const withDiagnostic=d=>{const spec=demoLesson();spec.diagnostic=d;spec.blocks.find(b=>b.type==='Diagnostic').minutes=d.duration;spec.timeline=spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));return spec;};
const quality=spec=>qualityCheck(spec,{entry:{id:spec.planEntryId,date:spec.date,duration:180,durationConfirmed:true,status:'planned'},criteria:spec.skills.map(n3_code=>({n3_code})),previous:null,corpusComplete:true});

test('every planned pedagogical session has a complete, timed baseline and a /20 rubric',async()=>{
 const file=(await readdir('.')).find(n=>n.startsWith('Planification_A1_')&&n.endsWith('.xlsx'));
 const curriculum=await parseWorkbook(await readFile(file));
 const entries=curriculum.entries.filter(e=>e.skills.length);
 assert.ok(entries.length>=125);
 for(const entry of entries){
  const nodes=entry.skills.map(code=>curriculum.criteria.find(c=>c.n3_code===code)).filter(Boolean);
  const d=diagnosticFrom(null,null,nodes,entry.id);
  validate(diagnosticSchema,d);
  assert.deepEqual(diagnosticChecks(withDiagnostic(d)).filter(c=>!c.ok),[],entry.id);
  assert.equal(d.sourceLessonRunId,null);
  assert.equal(d.policyVersion,DIAGNOSTIC_POLICY);
  assert.equal(d.tasks.length,4);assert.equal(d.duration,20);
  assert.ok(d.tasks.every(t=>t.type==='CodeEditor'||t.observation?.code));
  assert.ok(Math.abs(d.rubric.reduce((n,r)=>n+r.max,0)-20)<1e-9);
  assert.ok(d.rubric.every(r=>r.criterion==='baseline'));
  assert.ok(d.tasks.some(t=>['structured','exact','html'].includes(t.correctionMode)));
 }
});

test('Flexbox starts with concrete HTML and CSS prerequisites, without layout solutions',async()=>{
 const d=demoFlexbox().diagnostic;
 assert.equal(d.duration,20);
 for(const mode of ['html','css']){
  const task=d.tasks.find(t=>t.correctionMode===mode);
  assert.ok(task);
  assert.equal(gradeTask(task,task.reference).ratio,1);
  assert.notEqual(gradeTask(task,task.starter).ratio,1);
  assert.equal((await testActivityCode(task,task.reference)).ok,true);
 }
 assert.ok(!JSON.stringify(d).includes('display: flex'));
 const publicSpec=studentSpec(demoFlexbox());
 assert.ok(publicSpec.diagnostic.tasks.every(t=>t.reference===undefined&&t.tests===undefined&&t.expectedAnswer===undefined));
});

test('explicit prerequisites take precedence over topic defaults',()=>{
 const d=diagnosticFrom(null,null,[{n3_code:'BC04-C2-2',prerequisiteCodes:['BC04-C1-1']}],'prerequisites');
 assert.equal(d.tasks.length,4);
 assert.equal(d.tasks[0].type,'FillBlank');
 assert.match(d.tasks[0].observation.code,/<span>/);
 assert.equal(d.tasks.filter(t=>t.correctionMode==='html').length,2);
 assert.ok(d.tasks.every(t=>t.correctionMode!=='css'));
 assert.ok(d.tasks.every(t=>t.skills.length===0));
});

test('programming baseline checks values, boundary cases and debugging',()=>{
 const d=diagnosticFrom(null,null,[{n3_code:'BC05-C1-3'}],'loops');
 assert.equal(d.tasks.length,4);
 for(const task of d.tasks.filter(t=>t.correctionMode==='structured'))assert.equal(gradeTask(task,task.expectedAnswer).ratio,1);
 for(const task of d.tasks.filter(t=>t.correctionMode==='javascript')){assert.equal(gradeTask(task,task.reference).ratio,1);assert.notEqual(gradeTask(task,task.starter).ratio,1);}
 const transfer=d.tasks.find(t=>t.id==='baseline-transfert');
 assert.ok(gradeTask(transfer,'function reserve(age, places) { return age >= 12 || places > 0; }').ratio<0.75);
 assert.equal(correct(d,Object.fromEntries(d.tasks.map(t=>[t.id,t.expectedAnswer||'Une hypothèse à relire.']))).score,null);
});

test('previous session tasks cover distinct worked criteria and become mandatory',()=>{
 const activities=[sourceTask('a1',['A']),sourceTask('a2',['A']),sourceTask('a3',['A']),sourceTask('a4',['A']),sourceTask('b1',['B'],{required:false}),sourceTask('new',['NEW'])];
 const original=structuredClone(activities),d=diagnosticFrom(previous,{activities},[],'next');
 assert.equal(d.tasks.length,4);
 assert.ok(d.tasks.every(t=>t.required));
 assert.deepEqual(d.criteria,['A','B']);
 assert.equal(d.tasks[1].title,'b1');
 assert.equal(d.sourceLessonVersion,previous.lessonVersionId);
 assert.deepEqual(activities,original);
});

test('a partial session includes only covered activities and still has two mini-tasks',()=>{
 const activities=[sourceTask('done',['A']),sourceTask('uncovered',['A']),sourceTask('new',['NEW'])];
 const d=diagnosticFrom({...previous,coveredActivityIds:['done'],coveredSkills:['A']},{activities},[],'next');
 assert.equal(d.tasks.length,2);
 assert.equal(d.tasks[0].title,'done');
 assert.equal(d.tasks[1].id,'diag-verification');
 assert.deepEqual(d.criteria,['A']);
 assert.equal(d.duration,10);
});

test('a reconciled run without source activities still produces a complete diagnostic',()=>{
 const d=diagnosticFrom({...previous,coveredSkills:['A']},null,[],'next');
 validate(diagnosticSchema,d);
 assert.deepEqual(diagnosticChecks(withDiagnostic(d)).filter(c=>!c.ok),[]);
 assert.ok(d.tasks.every(t=>t.instruction.includes(previous.coveredContent)));
});

test('rubric covers every skill of a task and distributes exactly twenty points',()=>{
 const d=diagnosticFrom(previous,{activities:[sourceTask('both',['A','B'],{correctionMode:'exact',expectedAnswer:'oui'}),sourceTask('a',['A'],{correctionMode:'exact',expectedAnswer:'oui'}),sourceTask('b',['B'],{correctionMode:'exact',expectedAnswer:'oui'})]},[],'next');
 assert.equal(d.tasks.length,4);
 const correction=correct(d,Object.fromEntries(d.tasks.map(t=>[t.id,'oui'])));
 assert.equal(correction.score,null);
 assert.equal(correct(d,Object.fromEntries(d.tasks.slice(0,-1).map(t=>[t.id,'oui']))).score,14);
 assert.deepEqual(correction.criteria.map(c=>c.criterion),['A','B']);
 assert.deepEqual(diagnosticChecks(withDiagnostic(d)).filter(c=>!c.ok),[]);
});

test('A2 requires reviewed evidence beyond passing automatic code tests',()=>{
 for(const d of [demoFlexbox().diagnostic,diagnosticFrom(null,null,[{n3_code:'BC05-C1-3'}],'logic')]){
  const answers=Object.fromEntries(d.tasks.filter(t=>t.correctionMode!=='manual').map(t=>[t.id,t.expectedAnswer||t.reference]));
  const automatic=correct(d,answers);assert.equal(automatic.score,14);assert.equal(automatic.level,'A1');
  answers[d.tasks.at(-1).id]='J’ai testé.';
  const pending=correct(d,answers);assert.equal(pending.score,null);assert.equal(pending.status,'review_required');
  assert.equal(pending.items.find(i=>i.taskId===d.tasks.at(-1).id).max,6);
 }
});

test('practical diagnostics preserve authored time and safely display code observations',()=>{
 const spec=demoFlexbox(),total=spec.blocks.reduce((n,b)=>n+b.minutes,0),scaffold=prepareScaffold(spec,{diagnosticMinutes:8});
 assert.equal(scaffold.diagnostic.duration,20);
 assert.deepEqual(scaffold.diagnostic.tasks.map(t=>t.duration),[3,5,6,6]);
 assert.equal(scaffold.blocks.reduce((n,b)=>n+b.minutes,0),total);
 assert.match(DiagnosticIntro(spec),/A2 · Autonomie et vérification/);
 const t=structuredClone(studentSpec(spec).diagnostic.tasks[0]);t.observation={title:'<img src=x onerror=alert(1)>',code:'<script>alert(1)</script>',output:'<svg onload=alert(1)>'};
 const html=renderActivity(t,{diagnostic:true});assert.match(html,/diagnostic-observation/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<svg onload|<img src=x/);
});

test('publication rejects missing, optional, untimed, unreachable or ungraded diagnostics',()=>{
 const cases=[
  ['lesson_diagnostic',s=>delete s.diagnostic],
  ['diagnostic_tasks',s=>s.diagnostic.tasks.pop()],
  ['diagnostic_tasks',s=>s.diagnostic.tasks[0].required=false],
  ['diagnostic_tasks',s=>s.diagnostic.tasks[0].reference=''],
  ['diagnostic_timing',s=>s.diagnostic.tasks[0].duration=12],
  ['diagnostic_timing',s=>s.blocks.find(b=>b.type==='Diagnostic').minutes=1],
  ['diagnostic_coverage',s=>{s.diagnostic.rubric.pop();s.diagnostic.rubric[0].max=20;}],
  ['diagnostic_flow',s=>s.studentFlow=s.studentFlow.filter(id=>id!=='diagnostic')],
  ['source',s=>s.diagnostic.sourceLessonVersion='unrelated:v1'],
  ['identifiers',s=>s.activities[0].id=s.diagnostic.tasks[0].id]
 ];
 for(const [check,change] of cases){const spec=demoLesson();change(spec);const result=quality(spec);assert.equal(result.publishable,false,check);assert.ok(result.checks.some(c=>c.id===check&&!c.ok),check);}
});

test('student diagnostics conceal workshop hints and model boards until submission',()=>{
 const d=diagnosticFrom(previous,{activities:[sourceTask('board',['A'],{workshop:{hints:['Solution privée'],board:'01-parent'}})]},[],'next');
 const spec=withDiagnostic(d),before=studentSpec(spec),after=studentSpec(spec,{submitted:true});
 assert.equal(before.diagnostic.tasks[0].workshop.hints,undefined);
 assert.equal(before.diagnostic.tasks[0].workshop.board,undefined);
 assert.deepEqual(after.diagnostic.tasks[0].workshop.hints,['Solution privée']);
});
