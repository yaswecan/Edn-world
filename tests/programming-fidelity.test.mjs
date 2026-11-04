import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {decodePackage,encodePackage,validateReferences} from '../server/lesson-package.mjs';
import {studentSpec} from '../server/generator.mjs';

const bytes=await readFile(new URL('./fixtures/programming/tableaux-source.zip',import.meta.url));
const archive=await JSZip.loadAsync(bytes);
const prefix=Object.keys(archive.files).find(path=>path.endsWith('00_MANIFEST/manifest.json')).slice(0,-'00_MANIFEST/manifest.json'.length);
const source=path=>archive.file(prefix+path).async('string');
const author=JSON.parse(await source('07_SOURCES_EDEN/course-author.json'));
const original=JSON.parse(await source('07_SOURCES_EDEN/lesson.json'));
const script=await source('01_ELEVE/assets/lesson.js');
const pack=await decodePackage(bytes),spec=pack.lessons[0].payload.spec;

test('source workshop explanations, code, predictions, hints and cases survive exactly',()=>{
 for(const item of author.activities){
  const activity=spec.activities.find(a=>a.id===item.id),interactive=activity.interactive;
  for(const key of ['title','starter','reference'])assert.equal(activity[key],item[key],item.id+' '+key);
  for(const key of ['explanation','invoke','args','diagramType','prediction'])assert.deepEqual(interactive[key],item[key],item.id+' '+key);
  assert.equal(interactive.demo,item.block===4?'':item.demo,item.id+' student demonstration visibility');
  for(const key of ['hints','checks'])assert.deepEqual(activity.workshop[key],item[key],item.id+' '+key);
  assert.deepEqual(interactive.testLabels,item.tests.map(t=>t.label));
  assert.equal(interactive.reflection,'Ma trace : j’attendais… / j’ai observé… / j’ai corrigé…');
 }
 assert.deepEqual(spec.blocks,original.blocks,'all block teaching steps and source diagrams are preserved');
});

test('student source projection never exposes autonomous exercise solutions',async()=>{
 const studentData=await source('01_ELEVE/assets/course-data.js');
 const studentAuthor=JSON.parse(studentData.match(/^\s*window\.ARRAY_COURSE\s*=\s*([\s\S]+);\s*$/)[1]);
 for(const item of studentAuthor.activities){
  const activity=studentSpec(spec).activities.find(a=>a.id===item.id);
  assert.equal(activity.interactive.demo,item.demo);
  assert.equal(activity.reference,undefined);
 }
 for(const id of ['a5-reconstruction','a9-bilan-flotte','a10-transfert'])assert.equal(spec.activities.find(a=>a.id===id).interactive.demo,'');
 const tampered=await JSZip.loadAsync(bytes);
 studentAuthor.activities.find(a=>a.id==='a5-reconstruction').demo='function wrong(){return 1;}';
 const changed=Buffer.from('window.ARRAY_COURSE = '+JSON.stringify(studentAuthor)+';\n');
 tampered.file(prefix+'01_ELEVE/assets/course-data.js',changed);
 const manifest=JSON.parse(await source('00_MANIFEST/manifest.json'));
 const entry=manifest.files.find(f=>f.path==='01_ELEVE/assets/course-data.js');
 const {sha256}=await import('../server/content-snapshots.mjs');entry.bytes=changed.length;entry.sha256=sha256(changed);
 tampered.file(prefix+'00_MANIFEST/manifest.json',JSON.stringify(manifest));
 await assert.rejects(decodePackage(await tampered.generateAsync({type:'nodebuffer'})),/Données élèves conformes/);
});

test('every source quiz, recall, cloze and written reflection remains available',()=>{
 for(const item of author.quizzes){
  const activity=spec.activities.find(a=>a.id===item.id);
  assert.equal(activity.interactive.question.question,item.question);
  assert.deepEqual(activity.interactive.question.options,item.options);
  assert.equal(activity.interactive.question.correct,item.correct);
  assert.equal(activity.interactive.question.code,item.code);
 }
 for(const id of ['q2-for','q5-arguments'])assert.deepEqual(spec.activities.find(a=>a.id===id+'-rappel-s2').interactive.question,spec.activities.find(a=>a.id===id).interactive.question);
 for(const item of author.cloze){
  const activity=spec.activities.find(a=>a.id==='bilan-s'+item.session);
  for(const key of ['segments','bank','explanation'])assert.deepEqual(activity.interactive[key],item[key]);
 }
 for(const activity of original.activities.filter(a=>a.type==='Reflection'))assert.deepEqual(spec.activities.find(a=>a.id===activity.id),activity);
});

test('reviewed original mission, memo, comparison and summary text is portable student content',async()=>{
 const p=spec.programming.presentation;
 assert.equal(p.theme,'array-lab');assert.equal(p.headings.length,10);assert.equal(p.openings.length,2);assert.equal(p.memo.length,6);assert.equal(p.summaries.length,2);
 assert.deepEqual(p.sessionLabels,[{id:'s1',title:'Parcourir et compter'},{id:'s2',title:'Rechercher et décomposer'}]);
 const html=await source('01_ELEVE/cours-integre.html');
 for(const label of p.sessionLabels)assert.ok(html.includes(label.title),label.title);
 for(const heading of p.headings){assert.ok(script.includes(heading.title),heading.title);assert.ok(script.includes(heading.lead),heading.lead);}
 for(const opening of p.openings){
  for(const text of [opening.title,...opening.paragraphs,opening.actionLabel,opening.caption,opening.note])assert.ok(script.includes(text),text);
  assert.deepEqual(opening.values,[35,80,20,65]);
 }
 const memo=script.slice(script.indexOf("$('#memo-body').innerHTML="),script.indexOf("$('#open-memo').onclick="))
  .replace(/<\/?(?:h3|p|pre|code|table|tr|th|td|a)(?:\s[^>]*)?>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\\n/g,'\n');
 for(const section of p.memo){
  assert.ok(memo.includes(section.title),section.title);
  for(const text of section.paragraphs)assert.ok(memo.includes(text),text);
  if(section.code)assert.ok(memo.includes(section.code),section.code);
  for(const row of section.table?.rows||[])for(const cell of row)assert.ok(memo.includes(cell),cell);
 }
 for(const item of p.summaries)assert.ok(script.includes(item.note),item.note);
 for(const item of p.comparisons){
  assert.ok(script.includes(item.description));
  for(const row of item.rows)for(const cell of row)assert.ok(script.includes(cell),cell);
  for(const rule of item.rules)assert.ok(script.includes(rule.text),rule.text);
 }
 for(const text of Object.values(p.workshop))assert.ok(script.includes(text),text);
 assert.ok(script.includes(p.assessmentNote));
 assert.deepEqual(studentSpec(spec).programming.presentation,p);
 const encoded=await encodePackage(pack.lessons,pack.files),again=await decodePackage(encoded.bytes);
 assert.deepEqual(again.lessons[0].payload.spec.programming.presentation,p);
});

test('presentation rejects missing destinations and allows a standalone summary without continuation',()=>{
 const incompatible=structuredClone(spec);incompatible.sessionType='web-design';assert.throws(()=>validateReferences(incompatible));
 const missing=structuredClone(spec);missing.sessionType='programming';delete missing.programming;assert.throws(()=>validateReferences(missing));
 for(const mutate of [
  p=>p.headings[0].blockId='absent',p=>p.openings[0].nextBlockId='absent',
  p=>p.summaries[0].nextActivityId='absent',p=>p.comparisons[0].rules[0].id='absent',
  p=>delete p.summaries[0].actionLabel,p=>p.headings.push(p.headings[0]),p=>p.sessionLabels[0].id='absent',p=>p.sessionLabels.push(p.sessionLabels[0])
 ]){const changed=structuredClone(spec);mutate(changed.programming.presentation);assert.throws(()=>validateReferences(changed));}
 const standalone=structuredClone(spec);delete standalone.programming.presentation.summaries[0].actionLabel;delete standalone.programming.presentation.summaries[0].nextBlockId;
 assert.doesNotThrow(()=>validateReferences(standalone));
});
