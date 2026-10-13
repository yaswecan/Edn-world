import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore,TABLES} from '../server/store.mjs';
import {proposeTitle,titleQuality,sessionIdentity,saveIdentity,competencyCatalog,identityFields} from '../server/session-identity.mjs';
import {planIdentityMigration,applyIdentityMigration,rollbackIdentityMigration} from '../server/session-identity-migration.mjs';
import {exportSessionIdentity,importSessionIdentity,validateSessionIdentity} from '../server/session-identity-transfer.mjs';
import {SessionIdentity,competencyBadges} from '../public/session-identity.js';
import {diagnosticRevisionFixture} from './fixtures/diagnostic-revision.mjs';
import {generateLesson,studentSpec} from '../server/generator.mjs';
import {readEditor,saveEditor} from '../server/lesson-editor.mjs';
import {publishLesson} from '../server/domain.mjs';
import {createApp} from '../server/app.mjs';
import {assignmentSummary,lessonContext} from '../server/student-tracking.mjs';
import {compileCorpus} from '../server/corpus.mjs';
import {artifactBuffer} from '../server/artifacts.mjs';
import {passwordHash} from '../server/auth.mjs';
import ExcelJS from 'exceljs';
import {previewImport,applyImport} from '../server/importer.mjs';

const actor={id:'teacher',classId:'A1',role:'teacher'};
const baseSpec={title:'Vise la bonne carte',planEntryId:'plan',objectives:['Lier une feuille CSS, utiliser les sélecteurs et comprendre la cascade et le modèle de boîte'],skills:['BC04-C1-1'],blocks:[],sourceVersions:{}};
async function fixture(){
 const store=await openStore({url:null,path:':memory:'});
 await store.insert('competency_n3',{id:'criterion-real-id',classId:'A1',n3_code:'BC04-C1-1',n3_label:'Structurer et mettre en forme une page',n2_code:'BC04-C1',n2_label:'Développer une interface',observable_criterion:'Justifier les propriétés CSS utilisées'});
 const lesson=await store.insert('lessons',{id:'lesson',classId:'A1',title:baseSpec.title,date:'2026-10-12',version:1,versionId:'v1',status:'completed'});
 await store.insert('lesson_versions',{id:'v1',classId:'A1',spec:baseSpec});
 return {store,lesson};
}
test('titles come from pedagogical evidence in priority order, never from a mission lookup',()=>{
 const title=proposeTitle({spec:baseSpec});assert.equal(title.title,'CSS : liaison, sélecteurs, cascade, modèle de boîte');assert.equal(title.needsReview,false);
 assert.equal(proposeTitle({lesson:{pedagogicalTitle:'Titre libre validé',titleSource:'validated'},spec:baseSpec}).title,'Titre libre validé');
 assert.equal(proposeTitle({entry:{objective:'CSS : spécificité, héritage et cascade'},spec:baseSpec}).source,'imported');
 assert.equal(proposeTitle({spec:{title:'Mission cascade'}}).needsReview,true);
 assert.doesNotMatch(proposeTitle({spec:{title:'Mission cascade'}}).title,/mission/i);
 for(const bad of ['Mission 3','CSS : découvrir le CSS','CSS : BC04-C1-1','Découvrir le CSS'])assert.equal(titleQuality(bad),false,bad);
 const linux=proposeTitle({spec:{title:'Débloque le terminal',objectives:['Linux : utiliser pwd, ls, cd, mkdir, touch, cp et mv']}});assert.match(linux.title,/Linux : .*navigation.*fichiers/);
 const js=proposeTitle({spec:{objectives:['JavaScript : comprendre les conditions et les opérateurs logiques']}});assert.match(js.title,/JavaScript : conditions, opérateurs logiques/);
 const fallback=proposeTitle({spec:{},journal:[{morning:'CSS : étudier Flexbox et justify-content'}],sequence:{objectives:'CSS Flexbox'}});assert.match(fallback.title,/CSS : Flexbox/);
});
test('titles distinguish worked notions from examples and use the module to identify the discipline',()=>{
 const css=proposeTitle({spec:{objectives:['Organiser avec Flexbox'],blocks:[{type:'ConceptCard',content:'Flexbox ; Grid sera étudié dans une autre séance.'}]},entry:{objective:'Flexbox : axes, justify-content et gap',module:'HTML / CSS fondamentaux'}});
 assert.match(css.title,/Flexbox/);assert.doesNotMatch(css.title,/Grid/);
 const js=proposeTitle({spec:{objectives:['Écrire des boucles et parcourir un tableau'],blocks:[{type:'ConceptCard',content:'JavaScript : for et while organisent une répétition.'}]},entry:{objective:'Boucles : consolider puis introduire les tableaux',module:'Algorithmique & JavaScript'}});assert.equal(js.title,'JavaScript : boucles for et while, tableaux');
 const html=proposeTitle({spec:{objectives:['Comprendre la sémantique HTML5 et la structure'],blocks:[{type:'ConceptCard',content:'Un formulaire contient par exemple des liens et images.'}]}});assert.equal(html.title,'HTML : structure et balises, sémantique');
});
test('workbook imports keep dated journal evidence and never overwrite a teacher title',async()=>{
 const {store,lesson}=await fixture();try{
  await saveIdentity(store,lesson,{pedagogicalTitle:'CSS : intitulé choisi par le professeur',identityRevision:0,competencyRefs:[]},actor);
  const wb=new ExcelJS.Workbook();for(const n of ['02 Référentiel','03 Planning','05 Évaluations','12 Ressources','10 Élèves','11 Journal','09 Historique'])wb.addWorksheet(n);
  wb.getWorksheet('02 Référentiel').addRow(['BC04-C1','Interface','BC04-C1-1','Styles CSS']);
  wb.getWorksheet('03 Planning').addRow([new Date('2026-10-12T00:00:00Z'),'lundi','Séance','S03','CSS','BC04-C1-1','CSS : cascade et héritage']);
  wb.getWorksheet('11 Journal').addRow([new Date('2026-10-12T00:00:00Z'),'CSS : cascade','CSS : héritage','','BC04-C1-1']);
  const report=await previewImport(store,Buffer.from(await wb.xlsx.writeBuffer()),actor);const applied=await applyImport(store,report.id,actor,{confirmed:true});
  assert.equal((await store.get('curriculum_versions',applied.curriculumVersion)).journal[0].date,'2026-10-12');assert.equal((await store.get('lessons',lesson.id)).title,'CSS : intitulé choisi par le professeur');
 }finally{await store.close();}
});
test('exact database identifiers resolve labels, hierarchy and criteria without invented references',async()=>{
 const {store,lesson}=await fixture();try{
  const identity=await sessionIdentity(store,lesson);assert.deepEqual(identity.competencyRefs,[{competencyId:'criterion-real-id'}]);assert.equal(identity.competencies[0].code,'BC04-C1-1');assert.equal(identity.competencies[0].parent.label,'Développer une interface');assert.equal(identity.competencies[0].criteria.length,1);assert.equal(identity.missionTitle,baseSpec.title);
  assert.equal((await sessionIdentity(store,{...lesson,competencyRefs:[]})).competencies.length,0);
  const invalid=await sessionIdentity(store,{...lesson,competencyRefs:[{competencyId:'unknown'}]});assert.equal(invalid.competencies.length,0);assert.equal(invalid.missingCompetencies,1);
  const other=await store.insert('competency_n3',{id:'foreign',classId:'B1',n3_code:'DO-NOT-SHOW',n3_label:'Other class'});assert.equal((await sessionIdentity(store,{...lesson,competencyRefs:[{competencyId:other.id}]})).competencies.length,0);
 }finally{await store.close();}
});
test('migration is simulated, atomic, idempotent and reversible without touching history',async()=>{
 const {store,lesson}=await fixture();try{
  for(const table of ['lesson_runs','submissions','corrections','learning_progress'])await store.insert(table,{id:table,classId:'A1',lessonId:lesson.id,answer:'preserved'});
  const protectedTables=TABLES.filter(t=>!['lessons','audit_log'].includes(t)),before=await Promise.all(protectedTables.map(t=>store.list(t)));
  const plan=await planIdentityMigration(store);assert.deepEqual(plan.counts,{ready:1,review:0});assert.equal((await store.get('lessons',lesson.id)).title,baseSpec.title);
  const tampered=structuredClone(plan);tampered.rows[0].after.status='deleted';await assert.rejects(()=>applyIdentityMigration(store,tampered),e=>e.status===400);
  assert.equal((await applyIdentityMigration(store,plan)).applied.length,1);assert.equal((await applyIdentityMigration(store,plan)).applied.length,0);assert.equal((await planIdentityMigration(store)).rows.length,0);
  assert.equal((await store.get('lessons',lesson.id)).missionTitle,baseSpec.title);assert.deepEqual(await Promise.all(protectedTables.map(t=>store.list(t))),before);
  assert.equal((await rollbackIdentityMigration(store,plan)).restored.length,1);assert.equal((await store.get('lessons',lesson.id)).title,baseSpec.title);
  assert.equal((await rollbackIdentityMigration(store,plan)).restored.length,0);
  const changed=await store.get('lessons',lesson.id);changed.date='2026-10-13';await store.put('lessons',changed);await assert.rejects(()=>applyIdentityMigration(store,plan),e=>e.status===409);
 }finally{await store.close();}
});
test('ambiguous and manually edited legacy titles are not rewritten',async()=>{
 const {store,lesson}=await fixture();try{
  await store.put('lesson_versions',{id:'v1',classId:'A1',spec:{title:baseSpec.title}});
  let plan=await planIdentityMigration(store);assert.equal(plan.counts.review,1);assert.equal((await applyIdentityMigration(store,plan)).applied.length,0);
  await store.insert('lesson_versions',{id:'v0',classId:'A1',spec:{title:'Autre intitulé'}});
  await store.put('lesson_versions',{id:'v1',classId:'A1',previousVersionId:'v0',authorId:actor.id,reason:'Modification dans l’éditeur professeur',spec:baseSpec});
  plan=await planIdentityMigration(store);assert.equal(plan.rows[0].status,'review');assert.equal(plan.rows[0].after.pedagogicalTitle,lesson.title);
 }finally{await store.close();}
});
test('teacher identity edits enforce role, class, existing competency IDs and revision conflicts',async()=>{
 const {store,lesson}=await fixture();try{
  const input={pedagogicalTitle:'CSS : sélecteurs et cascade',identityRevision:0,competencyRefs:[{competencyId:'criterion-real-id'}]};
  await assert.rejects(()=>saveIdentity(store,lesson,input,{...actor,role:'student'}),e=>e.status===403);
  await assert.rejects(()=>saveIdentity(store,lesson,input,{...actor,classId:'B1'}),e=>e.status===404);
  await assert.rejects(()=>saveIdentity(store,lesson,{...input,competencyRefs:[{competencyId:'BC04-C1-1'}]},actor));
  await store.transaction(tx=>saveIdentity(tx,lesson,input,actor));const saved=await store.get('lessons',lesson.id);assert.equal(saved.titleSource,'validated');assert.equal(saved.title,input.pedagogicalTitle);
  await assert.rejects(()=>saveIdentity(store,saved,input,actor),e=>e.status===409);
  assert.equal(proposeTitle({lesson:saved,spec:baseSpec,entry:{objective:'CSS : un autre titre'}}).title,input.pedagogicalTitle);
  const plan=await planIdentityMigration(store);assert.equal(plan.rows.length,0);
 }finally{await store.close();}
});
test('portable identity remaps exact references across classes and preserves validated destinations',async()=>{
 const {store,lesson}=await fixture(),dest=await openStore({url:null,path:':memory:'});try{
  const portable=await exportSessionIdentity(store,lesson,baseSpec);validateSessionIdentity(portable);assert.equal(portable.associations[0].node.n3_code,'BC04-C1-1');
  const target={id:'target',classId:'B1'},imported=await importSessionIdentity(dest,{...actor,classId:'B1'},portable,target,baseSpec);
  assert.deepEqual(imported.competencyRefs,[{competencyId:'B1:BC04-C1-1'}]);assert.equal((await competencyCatalog(dest,'B1'))[0].code,'BC04-C1-1');
  assert.deepEqual(await exportSessionIdentity(dest,{...target,...imported},baseSpec),portable);
  const validated={...target,...imported,pedagogicalTitle:'Titre professeur',titleSource:'validated',competencyRefs:[]};
  assert.deepEqual(await importSessionIdentity(dest,{...actor,classId:'B1'},portable,target,baseSpec,validated),identityFields(validated));
  const legacy=await importSessionIdentity(dest,{...actor,classId:'B1'},undefined,target,baseSpec);assert.match(legacy.pedagogicalTitle,/^CSS :/);
 }finally{await store.close();await dest.close();}
});
test('shared badges escape data, expose overflow and keep student cards simple',()=>{
 const competencies=Array.from({length:5},(_,i)=>({code:'EXACT-'+i,label:'<script>label</script>',parent:{code:'P',label:'Parent'},criteria:[{label:'Critère officiel'}]}));
 const teacher=SessionIdentity({pedagogicalTitle:'CSS : <img>',competencies},{teacher:true});assert.ok(teacher.includes('+2'));assert.ok(teacher.includes('Critère officiel'));assert.ok(teacher.includes('Parent'));assert.ok(!teacher.includes('<script>'));assert.ok(!teacher.includes('<img>'));
 const student=competencyBadges({competencies});assert.ok(student.includes('EXACT-0'));assert.ok(!student.includes('Critère officiel'));
 assert.ok(competencyBadges({}, {teacher:true}).includes('Compétences à associer'));assert.ok(!competencyBadges({}).includes('Compétences à associer'));
});
test('generation and a later regeneration preserve the teacher validated title and links',async()=>{
 const f=await diagnosticRevisionFixture();try{
  const generated=await generateLesson(f.store,{intent:'Préparer la séance',classId:f.actor.classId},f.actor,{entryId:'box',localOnly:true});assert.ok(titleQuality(generated.pedagogicalTitle));assert.equal(generated.spec.title,generated.pedagogicalTitle);
  await f.store.transaction(tx=>saveIdentity(tx,generated,{pedagogicalTitle:'CSS : dimensions et débordement',competencyRefs:[],identityRevision:generated.identityRevision},f.actor));
  const again=await generateLesson(f.store,{intent:'Préparer la séance',classId:f.actor.classId},f.actor,{entryId:'box',localOnly:true});assert.equal(again.title,'CSS : dimensions et débordement');assert.equal(again.titleSource,'validated');assert.deepEqual(again.competencyRefs,[]);
 }finally{await f.store.close();}
});
test('editor, historical assignments, assessment APIs, search and exports share the canonical title',async()=>{
 const f=await diagnosticRevisionFixture();let server;
 try{
  const student=await f.store.insert('learners',{id:'identity-student',classId:'A1',role:'student',username:'identity-student',displayName:'Élève',passwordHash:passwordHash('identity-test-password')});
  await publishLesson(f.store,f.lesson.id,f.actor,{version:1,confirmed:true,validationMode:'teacher'});
  const assignment=(await f.store.list('lesson_assignments')).find(a=>a.learnerId===student.id),before=(await f.store.get('lesson_versions',f.lesson.versionId)).spec;
  const editor=await readEditor(f.store,f.lesson.id,f.actor);editor.spec.title='CSS : largeur, marge et remplissage';await saveEditor(f.store,f.lesson.id,{token:editor.token,spec:editor.spec},f.actor);
  const lesson=await f.store.get('lessons',f.lesson.id),title=lesson.pedagogicalTitle;
  assert.deepEqual((await f.store.get('lesson_versions',f.lesson.versionId)).spec,before);
  assert.equal((await assignmentSummary(f.store,assignment)).title,title);const context=await lessonContext(f.store,student,assignment);assert.equal(context.lesson.spec.title,title);assert.equal(context.lesson.versionId,f.lesson.versionId);assert.equal(studentSpec(context.lesson.spec).teacherGuide,undefined);
  const corpus=await compileCorpus(f.store,f.lesson.id,f.actor),file=corpus.files.find(f=>f.path==='07_SOURCES_EDEN/lesson.json');assert.equal(JSON.parse((await artifactBuffer(file)).toString()).title,title);
  server=createApp(f.store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'student',username:student.username,password:'identity-test-password'})});const cookie=login.headers.get('set-cookie').split(';')[0];
  const mine=await fetch(base+'/api/tracking/mine?q='+encodeURIComponent('largeur'),{headers:{cookie}});assert.equal(mine.status,200);assert.equal((await mine.json()).items[0].title,title);
  const today=await (await fetch(base+'/api/today?lesson='+encodeURIComponent(lesson.id),{headers:{cookie}})).json();assert.equal(today.lesson.spec.title,title);assert.equal(today.availableLessons[0].title,title);
  const denied=await fetch(base+'/api/lessons/'+encodeURIComponent(lesson.id)+'/identity',{method:'PUT',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({pedagogicalTitle:'Interdit',identityRevision:lesson.identityRevision,competencyRefs:[]})});assert.equal(denied.status,403);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await f.store.close();}
});
