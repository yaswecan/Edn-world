import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {demoLesson} from '../server/demo-lesson.mjs';
import {contentSlots,mergeContent,pedagogyChecks,orderAndTime} from '../server/lesson-structure.mjs';
import {localContent,activity} from '../server/lesson-content.mjs';
import {library,studentSpec,qualityCheck} from '../server/generator.mjs';
import {validate,lessonSchema,contentSchema} from '../server/contracts.mjs';
import * as renderer from '../public/lesson-renderer.js';

test('demo is a complete strict lesson with pedagogical minima and exact timing',()=>{
 const spec=demoLesson();validate(lessonSchema,spec);
 assert.deepEqual(pedagogyChecks(spec).filter(c=>!c.ok),[]);
 assert.equal(spec.blocks.reduce((n,b)=>n+b.minutes,0),90);
 assert.deepEqual(spec.blocks.map(b=>b.phase),['opening','diagnostic','understand','observe','guided','autonomy','extend','summary']);
});
test('LLM contract cannot select presentation, timing, assessment or game; merging preserves them',()=>{
 const original=demoLesson(),slots=contentSlots(original);validate(contentSchema,slots);
 assert.equal(slots.sections.some(b=>b.id==='diagnostic'),false);
 assert.equal(slots.activities.some(a=>a.id==='guided-code'),false);
 for(const forbidden of ['blocks','html','css','codeStation','diagnostic','studentFlow'])assert.throws(()=>mergeContent(original,{...slots,[forbidden]:[]}));
 const typed=structuredClone(slots);typed.sections[0].type='Activity';assert.throws(()=>mergeContent(original,typed));
 const reorder=structuredClone(slots);reorder.sections.reverse();assert.throws(()=>mergeContent(original,reorder));
 const missing=structuredClone(slots);missing.sections.pop();assert.throws(()=>mergeContent(original,missing));
 const badId=structuredClone(slots);badId.activities[0].id='made-up';assert.throws(()=>mergeContent(original,badId));
 const markup=structuredClone(slots);markup.title='<img src=x onerror=alert(1)>';assert.throws(()=>mergeContent(original,markup));
 const result=structuredClone(slots);result.sections[0].content='Un nouveau départ, expliqué simplement.';result.activities[0].instruction='Précise la règle, puis vérifie un cas.';
 const merged=mergeContent(original,result);
 assert.deepEqual(merged.blocks.map(b=>[b.id,b.type,b.phase,b.minutes,b.activityIds]),original.blocks.map(b=>[b.id,b.type,b.phase,b.minutes,b.activityIds]));
 assert.deepEqual(merged.diagnostic,original.diagnostic);
 assert.deepEqual(merged.activities.find(a=>a.id==='guided-code'),original.activities.find(a=>a.id==='guided-code'));
 assert.notEqual(merged.blocks[0].content,original.blocks[0].content);
});
test('publication checks reject removed, shuffled or hollow pedagogical sections',()=>{
 const failed=spec=>pedagogyChecks(spec).filter(c=>!c.ok).map(c=>c.id);
 for(const phase of ['opening','diagnostic','understand','observe','guided','autonomy','extend','summary']){
  const s=demoLesson();s.blocks=s.blocks.filter(b=>b.phase!==phase);assert.ok(failed(s).includes('lesson_sections'),phase);
 }
 const reversed=demoLesson();reversed.blocks.reverse();assert.ok(failed(reversed).includes('lesson_order'));
 const empty=demoLesson();empty.blocks.find(b=>b.phase==='understand').content='Un mot.';assert.ok(failed(empty).includes('lesson_concept'));
 const hintless=demoLesson();hintless.blocks.find(b=>b.phase==='guided').teaching.hint='';assert.ok(failed(hintless).includes('lesson_guidance'));
 const noSummary=demoLesson();noSummary.blocks.at(-1).teaching.takeaways=[];assert.ok(failed(noSummary).includes('lesson_summary'));
 const s=demoLesson();s.blocks=s.blocks.filter(b=>b.phase!=='observe');
 const quality=qualityCheck(s,{entry:{id:s.planEntryId,date:s.date,duration:90,durationConfirmed:true,status:'planned'},criteria:s.skills.map(n3_code=>({n3_code})),previous:null,corpusComplete:true});
 assert.equal(quality.publishable,false);assert.ok(quality.checks.some(c=>c.id==='lesson_example'&&!c.ok));
});
test('every NEXUS unit gets notion, observation, scaffolding and transfer in fixed slots',()=>{
 for(const r of library){
  const entry={duration:90,objective:r.title,activity:r.task,skills:[r.code]},node={n3_code:r.code,n3_label:r.skillLabel,observable_criterion:r.proof,expected_trace:r.proof,notions_tools:r.lesson,scaffolding_rule:r.questions[0]?.feedback||'Reprends l’exemple.'};
  const draft=localContent(entry,[node],library);orderAndTime(draft,90,10);
  const spec={...demoLesson(),...draft,skills:entry.skills};assert.deepEqual(pedagogyChecks(spec).filter(c=>!c.ok),[],r.code);
  assert.equal(draft.blocks.reduce((n,b)=>n+b.minutes,0),90,r.code);
 }
});
test('timing refuses invalid numbers and does not inflate a short slot silently',()=>{
 const s=demoLesson();s.blocks[0].minutes=NaN;assert.throws(()=>orderAndTime(s,90,10));
 const short=demoLesson();orderAndTime(short,12,10);assert.ok(short.blocks.reduce((n,b)=>n+b.minutes,0)>12);
});
test('public demo is reproducible and contains no corrections or private teacher fields',async()=>{
 const expected=studentSpec(demoLesson()),stored=JSON.parse(await readFile('public/demo-lesson.json','utf8'));assert.deepEqual(stored,expected);
 for(const a of [...stored.activities,...stored.diagnostic.tasks])for(const key of ['reference','expectedAnswer','tests'])assert.equal(a[key],undefined);
 assert.equal(stored.teacherGuide,undefined);
});
test('renderer escapes untrusted prose, code, labels and diagrams and reads legacy blocks',()=>{
 const s=studentSpec(demoLesson()),attack='<img src=x onerror="alert(1)">';
 s.title=attack;s.blocks[0].content=attack;s.objectives=[attack];
 let html=renderer.renderLessonPage(s);assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
 assert.ok(!renderer.BlackboardSchema([attack+' → safe']).includes('<img'));
 const a={...s.activities[0],title:attack,instruction:attack,starter:'</textarea>'+attack};html=renderer.CodeExerciseBlock(a);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;/textarea&gt;'));
 delete s.blocks[2].phase;delete s.blocks[2].teaching;assert.ok(!renderer.renderLessonBlock(s,2).includes('BlackboardSchema'));assert.ok(renderer.renderLessonBlock(s,2).includes(renderer.escape(s.blocks[2].content.split('\n')[0])));
});
test('component snapshots cover key learning states and the requested component registry',async()=>{
 const s=studentSpec(demoLesson());const components={
  LessonHero:renderer.LessonHero(s,s.blocks[0]),
  SessionTimeline:renderer.SessionTimeline(s,2),
  ObjectiveCard:renderer.ObjectiveCard(s.objectives),
  BlackboardSchema:renderer.BlackboardSchema(s.blocks[2].teaching.diagram),
  DiagnosticIntro:renderer.DiagnosticIntro(s),
  FillBlankBlock:renderer.FillBlankBlock(s.activities.find(a=>a.type==='FillBlank')),
  QuizBlock:renderer.QuizBlock(s.activities.find(a=>a.type==='Quiz'),{answers:{'guided-quiz':s.activities[1].options[1]}}),
  ObservationBlock:renderer.ObservationBlock(s.blocks[3]),
  LiveCodeBlock:renderer.LiveCodeBlock(s.blocks[3].content),
  CodeExerciseBlock:renderer.CodeExerciseBlock(s.activities[0]),
  TerminalExerciseBlock:renderer.TerminalExerciseBlock(activity('terminal','Explore le projet.','Affiche le dossier courant.',[],{type:'Terminal',starter:'pwd\nls'})),
  ReflectionBlock:renderer.ReflectionBlock(s.activities.at(-1)),
  CorrectionFlashBlock:renderer.CorrectionFlashBlock('Un seul false suffit à refuser une règle ET.'),
  CodeStationLaunchBlock:renderer.CodeStationLaunchBlock(s,{content:'Répare les portes logiques de la station.'},{preview:true}),
  ExitTicketBlock:renderer.ExitTicketBlock(s.activities.at(-1)),
  SummaryBlock:renderer.SummaryBlock(s.blocks.at(-1))
 };
 for(const [name,html] of Object.entries(components)){
  const file=`tests/snapshots/lesson/${name}.html`,formatted=html.replace(/></g,'>\n<')+'\n';
  if(process.env.UPDATE_LESSON_SNAPSHOTS==='1'){await mkdir('tests/snapshots/lesson',{recursive:true});await writeFile(file,formatted);}
  assert.equal(formatted,await readFile(file,'utf8'),name);
 }
});
