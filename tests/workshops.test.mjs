import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {demoFlexbox} from '../server/demo-flexbox.mjs';
import {localContent} from '../server/lesson-content.mjs';
import {library,studentSpec} from '../server/generator.mjs';
import {pedagogyChecks,contentSlots,mergeContent} from '../server/lesson-structure.mjs';
import {gradeTask} from '../server/assessment.mjs';
import {testActivityCode} from '../server/workshop-testing.mjs';
import {runSafe} from '../server/safe-js.mjs';
import {lessonSchema,validate} from '../server/contracts.mjs';
import {drawingPaths,previewDocument,workshopInput} from '../public/workshop-ui.js';

const make=resources=>localContent({duration:180,objective:resources[0].title,activity:resources[0].task,skills:resources.map(r=>r.code)},resources.map(r=>({n3_code:r.code,n3_label:r.skillLabel,notions_tools:r.lesson,observable_criterion:r.proof,expected_trace:r.proof,scaffolding_rule:r.questions[0]?.feedback})),library);
test('Flexbox uses the real generator: laboratory, drawing, three coding steps, production and debugging',async()=>{
 const s=demoFlexbox();validate(lessonSchema,s);assert.deepEqual(pedagogyChecks(s).filter(c=>!c.ok),[]);
 assert.equal(s.blocks.reduce((n,b)=>n+b.minutes,0),180);
 assert.equal(s.activities.filter(a=>a.type==='CodeEditor').length,5);
 assert.ok(s.activities.some(a=>a.type==='Simulator'));assert.ok(s.activities.some(a=>a.type==='Blackboard'));
 assert.equal(s.blocks.find(b=>b.phase==='understand').boards.length,3);
 assert.deepEqual(JSON.parse(await readFile('public/demo-flexbox.json','utf8')),studentSpec(s));
 const slots=contentSlots(s);assert.ok(!slots.activities.some(a=>a.id==='transfer'));
 slots.title='Une nouvelle formulation';const merged=mergeContent(s,slots);assert.deepEqual(merged.activities,s.activities);
});
test('all programming resources yield real code starters and autonomous editors; reference JS, HTML and CSS solutions pass',()=>{
 for(const r of library.filter(r=>['html','code'].includes(r.mode))){
  const s=make([r]),tasks=s.activities.filter(a=>a.type==='CodeEditor');assert.ok(tasks.length>=2,r.code);
  assert.ok(tasks.every(a=>a.starter.length>15),r.code);
  for(const a of tasks.filter(a=>['javascript','html','css'].includes(a.correctionMode)&&a.tests.length))assert.equal(gradeTask(a,a.reference).ratio,1,`${r.code} ${a.id}`);
 }
 const s=make(library.filter(r=>['BC05-C1-3','BC04-C2-2'].includes(r.code)));
 for(const skill of ['BC05-C1-3','BC04-C2-2'])assert.ok(s.activities.some(a=>a.id.startsWith('transfer')&&a.skills.includes(skill)&&a.type==='CodeEditor'));
});
test('publication rejects question-only lessons, absent code pathways and placeholder diagrams',()=>{
 const s=demoFlexbox();for(const a of s.activities){a.type='WriteResponse';delete a.workshop;}
 const failed=pedagogyChecks(s).filter(c=>!c.ok).map(c=>c.id);
 assert.ok(failed.includes('lesson_variety'));assert.ok(failed.includes('lesson_code_path'));assert.ok(failed.includes('lesson_manipulation'));
 const noDiagram=demoFlexbox(),concept=noDiagram.blocks.find(b=>b.phase==='understand');delete concept.boards;concept.teaching.diagram=['Observer → Comprendre → Essayer → Vérifier'];
 assert.equal(pedagogyChecks(noDiagram).find(c=>c.id==='lesson_subject_diagram').ok,false);
});
test('code testing checks the authored task and CSS cascade, without disclosing the answer key',async()=>{
 const task=demoFlexbox().activities.find(a=>a.id==='guided-0');
 assert.equal((await testActivityCode(task,'.groupe { display: block; }')).ok,false);
 const good=await testActivityCode(task,'.groupe { display: flex; }');assert.equal(good.ok,true);assert.equal(good.expectedAnswer,undefined);assert.equal(good.reference,undefined);
 for(const code of ['.groupe { display: flex; display: block; }','@media (min-width: 9000px) { .groupe { display: flex; } }'])assert.equal((await testActivityCode(task,code)).ok,false,code);
 assert.equal((await testActivityCode(task,'.groupe { display: flex !important; display: block; }')).ok,true);
});
test('Flexbox correction exports contain executable CSS that passes every authored exercise',async()=>{
 for(const task of demoFlexbox().activities.filter(a=>a.correctionMode==='css')){
  assert.match(task.reference,/display: flex/);
  assert.equal((await testActivityCode(task,task.reference)).ok,true,task.id);
  assert.notEqual((await testActivityCode(task,task.starter)).ok,true,task.id);
 }
});
test('extended interpreter remains bounded and prevents prototype, host and constructor access',()=>{
 for(const code of [
  'function main(input) { for (;;) {} }',
  'function main(input) { return input.constructor; }',
  'function main(input) { return input["con" + "structor"]; }',
  'function main(input) { return process.env; }',
  'function main(input) { return fetch("https://example.com"); }',
  'function main(input) { let x = {}; for(let i=0;i<100;i++) x={a:x,b:x}; return x; }',
  'function main(input) { const x=[]; for(let i=0;i<10000;i++) x.push(i); return x; }'
 ])assert.equal(runSafe(code,{invoke:'main',args:[{}]}).ok,false,code);
 assert.deepEqual(runSafe('function main(input) { const out=[]; for(const n of input.values) out.push(n*2); return out; }',{invoke:'main',args:[{values:[1,2]}]}).value,[2,4]);
});
test('drawing and preview rendering reject injected markup and tolerate malformed stored shapes',()=>{
 assert.equal(drawingPaths({strokes:[{color:'" onload="alert(1)',points:[['<script>',2],[10,20]]}]}).includes('onload'),false);
 const a=demoFlexbox().activities.find(a=>a.type==='Blackboard');assert.ok(!workshopInput(a,'{"caption":"</textarea><script>alert(1)</script>"}').includes('<script>'));
 const code=demoFlexbox().activities.find(a=>a.type==='CodeEditor'),doc=previewDocument(code,'</style><script>parent.document.body.remove()</script>');
 assert.ok(doc.includes("default-src 'none'"));assert.ok(!doc.includes('</style><script>'));
});
