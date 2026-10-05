import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {individualExport} from '../server/corpus.mjs';
import {parseFragment} from 'parse5';
import {demoLesson} from '../server/demo-lesson.mjs';
import {studentSpec,generateLesson} from '../server/generator.mjs';
import {openStore} from '../server/store.mjs';
import {contentSlots,mergeContent} from '../server/lesson-structure.mjs';
import {renderLessonPage,renderLessonBlock,renderStudentResult} from '../public/lesson-renderer.js';
import {studentCopy,studentError,studentFeedback} from '../public/student-copy.js';
import {proposeAdaptation} from '../server/adaptation.mjs';
const visible=html=>{const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join(' ');return text(parseFragment(html)).replace(/\s+/g,' ').trim();};

test('student shell selects presentation, preserves lesson data and meaningful programming terms',()=>{
 const original=demoLesson(),spec=studentSpec(original),before=structuredClone(spec);
 spec.sequence='S01-INTERNAL';spec.generatedAt='2099-01-01';
 const html=renderLessonPage(spec);
 assert.doesNotMatch(visible(html),/S01-INTERNAL|2099|\b\d+ min|pour explorer|petites étapes|rythme|Teacher Twin/);
 assert.equal(spec.blocks[0].minutes,before.blocks[0].minutes);
 const i=spec.blocks.findIndex(b=>b.phase==='understand');spec.blocks[i].content='Utilise une API JSON. Dessine le schéma du serveur et observe le pipeline.';
 assert.match(visible(renderLessonBlock(spec,i)),/API JSON.*schéma du serveur.*pipeline/);
 const d=spec.blocks.findIndex(b=>b.type==='Diagnostic');assert.match(visible(renderLessonBlock(spec,d)),/Évaluation.*Note sur 20/);
 for(const task of spec.diagnostic.tasks)assert.ok(visible(renderLessonBlock(spec,d)).includes(task.instruction));
 assert.equal(original.diagnostic.rubric.reduce((n,r)=>n+r.max,0),20);
});
test('preview and published lesson share titles, instructions and optional blank introductions',()=>{
 const spec=studentSpec(demoLesson());spec.blocks[0].content='';
 assert.doesNotMatch(renderLessonBlock(spec,0),/lesson-lead|lesson-start-note/);
 for(let i=0;i<spec.blocks.length;i++){
  const preview=visible(renderLessonBlock(spec,i,{preview:true})),published=visible(renderLessonBlock(spec,i));
  for(const text of [spec.blocks[i].type==='Diagnostic'?'Évaluation':spec.blocks[i].title,...spec.blocks[i].activityIds.map(id=>spec.activities.find(a=>a.id===id).instruction)]){
   assert.ok(preview.includes(text.replace(/\s+/g,' ')),text);assert.ok(published.includes(text.replace(/\s+/g,' ')),text);
  }
 }
});
test('old remediation transitions omit group metadata but retain exercises',()=>{
 const spec=demoLesson(),i=spec.blocks.findIndex(b=>b.phase==='guided');
 spec.blocks[i].title='Ateliers différenciés · une preuve par critère';spec.blocks[i].content='G1 · BC05-C1-1 : Pratique guidée. Production, démarche.';
 const html=visible(renderLessonBlock(spec,i));assert.match(html,/Entraînement/);assert.doesNotMatch(html,/G1|BC05|preuve par critère/);
 assert.ok(html.includes(spec.activities.find(a=>a.id===spec.blocks[i].activityIds[0]).instruction));
});
test('results distinguish missing work, pending grading, zero and established assessment levels',()=>{
 assert.equal(visible(renderStudentResult({status:'not_submitted',level:'NE'})),'Aucun travail rendu.');
 assert.match(visible(renderStudentResult({score:null,level:'NE',items:[{label:'Réponse',points:null,max:5}]})),/Non évalué.*Correction en attente.*Non évalué/);
 for(const [score,level] of [[0,'NA'],[8,'EC'],[12,'A1'],[19,'A2']]){
  const result={score,level,items:[],feedback:'Un commentaire du professeur.'},copy=structuredClone(result);
  assert.ok(visible(renderStudentResult(result)).includes(`${score} / 20 · ${level}`));assert.deepEqual(result,copy);
 }
 assert.match(visible(renderStudentResult({score:15,level:'A2',status:'auto_corrected_to_review',feedback:'Teste aussi la limite.'})),/Résultat provisoire.*Teste aussi la limite/);
 const missing=studentFeedback('Production absente dans la copie remise.');assert.equal(missing,'Aucune réponse rendue pour cet exercice.');
 assert.equal(studentFeedback('Explique ton schéma JSON et les tests du serveur.'),'Explique ton schéma JSON et les tests du serveur.');
});
test('errors expose useful actions without provider traces or false send confirmation',()=>{
 assert.match(studentError({message:'Identifiants incorrects.',status:401,path:'/api/login'}),/mot de passe incorrect/);
 for(const path of ['/api/today','/api/assessments/a/save','/api/assessments/a/submit','/api/game/runs']){
  const text=studentError({message:'OpenAI provider failed, payload stack trace',details:{secret:'hidden'},path});
  assert.doesNotMatch(text,/provider|OpenAI|payload|trace|Travail envoyé|Travail enregistré/);
 }
 assert.equal(studentError({message:studentCopy.diagnosticGate}),studentCopy.diagnosticGate);
 assert.match(studentError({message:'Terminez l’activité autonome avant de lancer la mission.'}),/Termine l’activité/);
});
test('authoring guard targets titles and opening transitions, never programming content',()=>{
 const original=demoLesson(),slots=contentSlots(original);
 for(const text of ['Teacher Twin','Reprendre le runtime de séance','DailyBundle v3','Contexte de génération','BC05-C1-1 · Atelier','09:00 – 10:00']){
  assert.throws(()=>mergeContent(original,{...slots,title:text}),/métadonnées internes/);
 }
 const allowed=structuredClone(slots);allowed.title='Comprendre un pipeline JSON';allowed.sections[0].content='';
 allowed.sections.find(s=>s.id===original.blocks.find(b=>b.phase==='understand').id).content='Dans ce cours, un agent logiciel traite un payload JSON avec un fallback.';
 const result=mergeContent(original,allowed);assert.equal(result.blocks[0].content,'');assert.match(result.blocks[2].content,/payload JSON/);
});
test('new generated lesson with simulated provider keeps metadata in teacher guide; remediation uses same presentation',async t=>{
 const store=await openStore({path:':memory:',url:''}),actor={id:'teacher',role:'teacher',classId:'SYNTHETIC'};
 const node={n3_code:'BC04-C2-6',n3_label:'Organiser une page',prerequisiteCodes:[],notions_tools:'Organise les éléments avec Flexbox.',observable_criterion:'Les cartes restent lisibles.',expected_trace:'Une page lisible.',scaffolding_rule:'Observe le parent.'};
 const entry={id:'entry',classId:actor.classId,date:'2026-10-05',skills:[node.n3_code],objective:'Organiser les cartes avec Flexbox',activity:'Construis une page.',sequence:'S01',duration:180,durationConfirmed:true,status:'planned',resourcePack:'SYNTHETIC'};
 await store.insert('curriculum_versions',{id:'curriculum',classId:actor.classId,criteria:[node],sequences:[]});
 await store.insert('plan_versions',{id:'plan',classId:actor.classId,version:1,curriculumVersion:'curriculum'});await store.insert('plan_entries',entry);
 const oldKey=process.env.OPENAI_API_KEY,oldModel=process.env.OPENAI_MODEL;process.env.OPENAI_API_KEY='test-only';process.env.OPENAI_MODEL='simulated';
 let calls=0;t.mock.method(globalThis,'fetch',async(_url,options)=>{
  calls++;const input=JSON.parse(options.body);assert.match(input.input[0].content,/teacherGuide/);assert.match(input.input[0].content,/chaîne vide/);
  const draft=JSON.parse(input.input[1].content).draft;draft.sections[0].content='';draft.teacherGuide+='\nContexte de génération : provider simulé, groupes G1.';
  return new Response(JSON.stringify({status:'completed',id:'simulated-response',output:[{content:[{type:'output_text',text:JSON.stringify(draft)}]}]}));
 });
 try{
  const lesson=await generateLesson(store,{intent:'Prépare cette séance',mode:'prepare'},actor,{entryId:entry.id});assert.equal(calls,1);
  assert.match(lesson.spec.teacherGuide,/provider simulé/);assert.equal(lesson.spec.blocks[0].content,'');
  const shown=studentSpec(lesson.spec);assert.equal(shown.teacherGuide,undefined);assert.doesNotMatch(visible(renderLessonPage(shown)),/provider|génération|G1|\b\d+ min/);
  await store.insert('remediation_snapshots',{id:'groups',classId:actor.classId,version:1,groups:[{id:'G1',activities:[{criterion:node.n3_code,mode:'Pratique guidée',evidence:'Une production.'}]}]});
  const proposal=await proposeAdaptation(store,lesson.id,actor,{version:lesson.version,strategy:'remediation'});
  assert.match(proposal.spec.teacherGuide,/G1 · BC04-C2-6/);
  const changed=proposal.spec.blocks.find(b=>b.title==='Entraînement');assert.equal(changed.content,'');assert.ok(changed.activityIds.length);
  assert.deepEqual(proposal.spec.diagnostic,lesson.spec.diagnostic);
  const regenerated=await generateLesson(store,{intent:'Prépare un entraînement',mode:'remediation'},actor,{entryId:entry.id});
  assert.equal(calls,2);assert.match(regenerated.spec.teacherGuide,/G1 · BC04-C2-6/);assert.equal(regenerated.spec.blocks.find(b=>b.title==='Entraînement').content,'');
 }finally{await store.close();if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=oldModel;}
});

test('individual student documents use exercise titles and assessment status, preserving raw archives',async()=>{
 const store=await openStore({path:':memory:',url:''}),actor={id:'t',classId:'DEMO'},spec=demoLesson();
 const submission={id:'submission',classId:'DEMO',learnerId:'learner',attemptId:'attempt',diagnostic:spec.diagnostic,submittedAt:'2026-10-05T08:00:00Z',answers:{'demo-diag':'Mon raisonnement'},history:[{timestamp:'2026-10-05T07:59:00Z',type:'code_run',payload:{taskId:'private-task-id',code:'console.log("API JSON");',result:{logs:['API JSON'],error:null}}}]};
 const correction={id:'submission',classId:'DEMO',score:null,level:'NE',status:'review_required',version:1,feedback:'Une relecture est nécessaire avant de déterminer la note.',items:[{label:'Exercice',points:null,max:20,feedback:'Production ouverte : appliquer la rubrique et relire les preuves.'}]};
 try{
  await store.insert('learners',{id:'learner',classId:'DEMO',displayName:'Camille'});await store.insert('assessment_attempts',{id:'attempt',classId:'DEMO',executions:1});await store.insert('submissions',submission);await store.insert('corrections',correction);
  const zip=await JSZip.loadAsync(await individualExport(store,'submission',actor));
  const feedback=await zip.file('learner/evaluation/correction.html').async('string');assert.match(feedback,/Non évalué/);assert.doesNotMatch(feedback,/review_required|appliquer la rubrique|NE \/20/);
  const attempts=await zip.file('learner/evaluation/progression.html').async('string');assert.match(attempts,/API JSON/);assert.doesNotMatch(attempts,/private-task-id|code_run|payload/);
  assert.deepEqual(JSON.parse(await zip.file('learner/evaluation/rendu_original.json').async('string')).answers,submission.answers);
 }finally{await store.close();}
});
