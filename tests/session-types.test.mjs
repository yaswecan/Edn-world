import test from 'node:test';
import assert from 'node:assert/strict';
import {pedagogyFixture} from './fixtures/pedagogy.mjs';
import {proposePlanOperations,applyPlanOperations} from '../server/planning.mjs';
import {programmingTemplateContent} from '../server/programming/templates.mjs';
import {generateLesson,studentSpec} from '../server/generator.mjs';
import {validateReferences,decodePackage} from '../server/lesson-package.mjs';
import {exportLessons,readTransfer} from '../server/lesson-transfer.mjs';
import {lessonQuality} from '../server/domain.mjs';
import {createApp} from '../server/app.mjs';

async function fixture(){
 const f=await pedagogyFixture(),{payload}=await programmingTemplateContent('tableaux-complet');
 const criteria=await f.store.list('competency_n3',f.actor.classId);
 for(const code of payload.spec.skills)if(!criteria.some(c=>c.n3_code===code))await f.store.insert('competency_n3',{id:code,classId:f.actor.classId,n3_code:code,n3_label:code,prerequisiteCodes:[]});
 const plan=(await f.store.list('plan_versions',f.actor.classId)).at(-1),curriculum=await f.store.get('curriculum_versions',plan.curriculumVersion);
 curriculum.criteria=await f.store.list('competency_n3',f.actor.classId);await f.store.put('curriculum_versions',curriculum);
 const entry={id:'arrays',classId:f.actor.classId,date:'2026-11-05',objective:'JavaScript : tableaux, parcours et fonctions',activity:'Prédire, exécuter et expliquer',skills:payload.spec.skills,sequence:'S04',module:'JavaScript',duration:360,durationConfirmed:true,status:'planned',resourcePack:'arrays',sessionType:'programming'};
 await f.store.insert('plan_entries',entry);plan.entries=await f.store.list('plan_entries',f.actor.classId);await f.store.put('plan_versions',plan);
 return {...f,entry};
}
test('planning type is validated, versioned, and retained by splitting a session',async()=>{
 const f=await fixture();try{
  const proposal=await proposePlanOperations(f.store,f.actor,{reason:'Deux séances de programmation',operations:[{type:'split',entryId:f.entry.id,parts:[{date:'2026-11-05',objective:'Parcourir',duration:180,programmingTemplate:'tableaux-s1'},{date:'2026-11-12',objective:'Rechercher',duration:180,programmingTemplate:'tableaux-s2'}]}]});
  assert.equal((await f.store.list('plan_entries')).filter(e=>e.parentEntryIds?.includes(f.entry.id)).length,0);
  await applyPlanOperations(f.store,proposal.id,f.actor,{confirmed:true});
  const parts=(await f.store.list('plan_entries')).filter(e=>e.parentEntryIds?.includes(f.entry.id)).sort((a,b)=>a.date.localeCompare(b.date));
  assert.deepEqual(parts.map(p=>p.sessionType),['programming','programming']);
  assert.deepEqual(parts.map(p=>p.programmingTemplate),['tableaux-s1','tableaux-s2']);
  await assert.rejects(proposePlanOperations(f.store,f.actor,{reason:'Invalid',operations:[{type:'update',entryId:parts[0].id,patch:{sessionType:'unknown'}}]}),/Type de séance invalide/);
 }finally{await f.store.close();}
});
test('source templates preserve every chosen workshop and valid navigation without shortening activities',async()=>{
 const all=(await programmingTemplateContent('tableaux-complet')).payload.spec;
 for(const [id,count,session] of [['tableaux-s1',13,'s1'],['tableaux-s2',15,'s2']]){
  const {payload}=await programmingTemplateContent(id),s=payload.spec;validateReferences(s);
  assert.equal(s.sessionType,'programming');assert.equal(s.activities.length,count);assert.equal(s.blocks.reduce((n,b)=>n+b.minutes,0),180);
  assert.equal(s.programming.sessions[0].id,session);
  for(const a of s.activities)assert.deepEqual(a,all.activities.find(original=>original.id===a.id));
  assert.ok(s.programming.presentation.headings.every(h=>s.blocks.some(b=>b.id===h.blockId)));
  assert.ok(s.diagnostic.activityIds.every(id=>s.activities.some(a=>a.id===id)));
 }
 assert.equal(all.activities.length,28);assert.equal(all.programming.presentation.summaries[0].nextBlockId,'s2-bloc-1');
});
test('programming creation uses the chosen native course, keeps resources and retries safely',async()=>{
 const f=await fixture();try{
  const input={intent:'Créer le parcours fourni',requestId:'template-request-1',programmingTemplate:'tableaux-complet'};
  const lesson=await generateLesson(f.store,input,f.actor,{entryId:f.entry.id});
  assert.equal(lesson.spec.sessionType,'programming');assert.equal(lesson.spec.programming.format,'programming-1');assert.equal(lesson.spec.activities.length,28);assert.equal(lesson.status,'draft');
  assert.equal((await f.store.list('generation_jobs')).length,0);
  assert.equal((await generateLesson(f.store,input,f.actor,{entryId:f.entry.id})).version,1);
  await assert.rejects(generateLesson(f.store,{...input,programmingTemplate:'tableaux-s1'},f.actor,{entryId:f.entry.id}),error=>error.status===409);
  const corpus=(await f.store.list('corpus_packages')).find(p=>p.lessonVersionId===lesson.versionId);assert.equal(corpus.files.length,63);
  const visible=studentSpec(lesson.spec);assert.ok(visible.resources.every(r=>r.startsWith('/api/lesson-transfer-files/')));assert.ok(visible.activities.every(a=>!a.reference&&!a.tests));
  assert.equal((await lessonQuality(f.store,lesson)).quality.publishable,true);
  const exported=await exportLessons(f.store,[lesson.id],f.actor),archive=await readTransfer(f.store,exported.id,f.actor),decoded=await decodePackage(archive.bytes);
  assert.equal(decoded.lessons[0].payload.spec.sessionType,'programming');assert.equal(decoded.lessons[0].payload.spec.activities.length,28);
  const changed=await f.store.get('plan_entries',f.entry.id);changed.duration=175;await f.store.put('plan_entries',changed);
  await assert.rejects(generateLesson(f.store,{...input,requestId:'short',programmingTemplate:'tableaux-s1'},f.actor,{entryId:f.entry.id}),/180 minutes/);
  assert.equal((await f.store.get('lessons',lesson.id)).version,1);
 }finally{await f.store.close();}
});
test('web creation and unclassified historical creation retain their existing reader',async()=>{
 const f=await pedagogyFixture();try{
  const entry=(await f.store.list('plan_entries')).find(e=>e.id==='box');
  const legacy=await generateLesson(f.store,{intent:'Préparer'},f.actor,{entryId:entry.id,localOnly:true});assert.equal(legacy.spec.programming,undefined);assert.equal(legacy.spec.sessionType,undefined);
  const web=await generateLesson(f.store,{intent:'Préparer',sessionType:'web-design'},f.actor,{entryId:entry.id,localOnly:true});assert.equal(web.spec.sessionType,'web-design');assert.equal(web.spec.programming,undefined);assert.ok(web.spec.activities.some(a=>a.workshop?.language==='css'));assert.ok(web.spec.activities.filter(a=>a.type==='CodeEditor').every(a=>a.workshop.profile==='html-css'));
  await assert.rejects(generateLesson(f.store,{intent:'Préparer',sessionType:'web-design'},f.actor,{entryId:'logic',localOnly:true}),/conception web HTML/);
 }finally{await f.store.close();}
});
test('authenticated creation route chooses programming before the AI preparation pipeline',async()=>{
 const f=await fixture();let server;try{
  server=createApp(f.store).listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base='http://127.0.0.1:'+server.address().port,login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'professeur',password:'quality-preview-only',role:'teacher'})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const response=await fetch(base+'/api/lessons/generate',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify({entryId:f.entry.id,intent:'Préparer le parcours fourni',sessionType:'programming',programmingTemplate:'tableaux-s2',requestId:'api-source'})});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.spec.programming.sessions[0].id,'s2');assert.equal(result.spec.activities.length,15);assert.equal(result.corpusManifest.files.length,63);
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await f.store.close();}
});
