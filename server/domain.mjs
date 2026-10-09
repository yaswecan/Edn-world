import {validateEditorContent} from './lesson-editor-validation.mjs';
import {publicationGate} from './pedagogy/quality.mjs';
import {uid,now,requireValue,fail,scoped} from './store.mjs';
import {qualityCheck,previousCompleted} from './generator.mjs';
import {lessonSchema,validate} from './contracts.mjs';
import {freezeContent,canonical} from './content-snapshots.mjs';
import {lessonPlanUnchanged} from './lesson-plan.mjs';
import {publicationCodeChecks} from './publication-code.mjs';
import {compileCorpus} from './corpus.mjs';
import {chooseTodayLessonInTransaction} from './today-lesson.mjs';
import {distributeRun} from './student-tracking.mjs';
export async function lessonQuality(tx,lesson,corpus=true){const version=await tx.get('lesson_versions',lesson.versionId),spec=version.spec,entry=await tx.get('plan_entries',spec.planEntryId)||{id:'',date:spec.date,duration:lesson.transferContext?.entry?.duration||0,durationConfirmed:false,status:'planned'},curriculum=await tx.get('curriculum_versions',spec.sourceVersions.curriculumVersion)||{criteria:lesson.transferContext?.criteria||[]},previous=previousCompleted(await tx.list('lesson_runs',lesson.classId),spec.date),pack=(await tx.list('corpus_packages',lesson.classId)).find(p=>p.lessonVersionId===version.id);const quality=qualityCheck(spec,{entry,criteria:curriculum.criteria,previous,corpusComplete:corpus&&pack?.complete});const plans=await tx.list('plan_versions',lesson.classId);quality.checks.push({id:'plan_version',ok:lessonPlanUnchanged(spec,entry,plans),message:'Objectifs et référentiel inchangés, durée de la séance compatible avec le créneau confirmé'});quality.checks.push(...await publicationGate(tx,lesson,spec));quality.publishable=quality.checks.every(c=>c.ok);return {quality,version,pack};}
export async function publishLesson(store,id,actor,input){
 requireValue(actor.role==='teacher'&&input.confirmed===true,'Validation professeur requise.');
 const validationMode=input.validationMode??'automatic';
 requireValue(['automatic','teacher'].includes(validationMode),'Mode de validation invalide.');
 const teacherValidated=validationMode==='teacher';
 const checkVersion=lesson=>{
  if(input.version!==lesson.version)fail(409,'Version modifiée depuis l’aperçu.');
  if(!['draft','published'].includes(lesson.status))fail(409,'Cette séance est clôturée ou indisponible.');
 };
 const checkIdle=async tx=>{
  if((await tx.list('generation_jobs',actor.classId)).some(j=>j.lessonId===id&&['running','queued','retry_wait'].includes(j.status)))fail(409,'Attendez la fin de la préparation en cours avant de publier.');
 };
 const selectToday=tx=>input.setToday===true?chooseTodayLessonInTransaction(tx,actor,{lessonId:id,date:input.date}):null;
 // Build the supports only after confirmation, without running the optional code tests.
 if(teacherValidated){
  const lesson=await scoped(store,'lessons',id,actor);checkVersion(lesson);await checkIdle(store);
  if(lesson.status==='draft')await compileCorpus(store,id,actor);
 }
 return store.transaction(async tx=>{
 await tx.lockTables();
 const lesson=await scoped(tx,'lessons',id,actor);checkVersion(lesson);
 if(lesson.status==='published'){await selectToday(tx);return lesson;}
 if(teacherValidated)await checkIdle(tx);
 const {quality,version,pack}=await lessonQuality(tx,lesson);
 if(!teacherValidated){quality.checks.push(...await publicationCodeChecks(version.spec));quality.publishable=quality.checks.every(c=>c.ok);if(!quality.publishable)fail(422,'Contrôles bloquants avant publication.',quality);}
 requireValue(pack,'Les supports de cette version sont indisponibles.');
 const collisions=(await tx.list('lessons',actor.classId)).filter(l=>l.id!==id&&l.date===lesson.date&&l.status==='published');if(!teacherValidated&&collisions.length)fail(409,'Une autre séance est publiée à cette date.');
 const publication=await tx.insert('lesson_publications',{id:uid('publication'),classId:actor.classId,lessonId:id,lessonVersionId:lesson.versionId,version:lesson.version,publishedBy:actor.id,publishedAt:now(),corpusId:pack.id,validationMode});
 await freezeContent(tx,{classId:actor.classId,event:'lesson.publication_selected',eventId:publication.id,subject:{kind:'lesson',lessonId:id,lessonVersionId:lesson.versionId},files:[{path:'lesson.json',content:canonical(version.spec),audience:'teacher'}],external:pack.files.map(({path,sha256,bytes})=>({path,sha256,bytes,corpusId:pack.id})),versions:{corpusId:pack.id}});
 const run=await tx.insert('lesson_runs',{id:uid('lessonrun'),classId:actor.classId,lessonId:id,lessonVersionId:lesson.versionId,date:lesson.date,status:'planned',eligibleForDiagnostic:false,coveredSkills:[],coveredActivityIds:[],coveredContent:'',reactivatedPrerequisites:[],closedAt:null});
 await distributeRun(tx,run);
 lesson.status='published';lesson.quality=quality;lesson.publicationId=publication.id;lesson.runId=run.id;await tx.put('lessons',lesson);
 await tx.insert('teacher_approvals',{id:uid('approval'),classId:actor.classId,entityId:id,version:lesson.version,actorId:actor.id,action:'publish',validationMode});await tx.audit(actor,'lesson.published',id,{version:lesson.version,validationMode});
 await selectToday(tx);
 return lesson;});}
export async function closeLesson(store,id,input,actor){return store.transaction(async tx=>{const lesson=await scoped(tx,'lessons',id,actor);requireValue(lesson.runId,'Publiez la séance avant de la clôturer.');const run=await scoped(tx,'lesson_runs',lesson.runId,actor);if(run.closedAt)fail(409,'Le cahier de texte est déjà clôturé.');requireValue(['completed','partially_completed','cancelled','postponed','replaced','not_completed','non_evaluable'].includes(input.status),'État de réalisation invalide.');const spec=(await tx.get('lesson_versions',run.lessonVersionId)).spec;
 const completed=['completed','partially_completed'].includes(input.status);const covered=completed?(input.coveredSkills||[]):[];requireValue(covered.every(c=>spec.skills.includes(c)),'Critère non prévu dans cette version.');if(completed)requireValue(covered.length&&input.coveredContent?.trim(),'Indiquez le contenu et les critères réellement travaillés.');
 Object.assign(run,{status:input.status,coveredSkills:covered,coveredContent:completed?input.coveredContent:'',coveredActivityIds:(input.coveredActivityIds||[]).filter(id=>spec.activities.some(a=>a.id===id)),notCoveredSkills:spec.skills.filter(c=>!covered.includes(c)),reactivatedPrerequisites:(input.reactivatedPrerequisites||[]).filter(c=>spec.prerequisites.includes(c)),difficulties:String(input.difficulties||''),adjustments:String(input.adjustments||''),comment:String(input.comment||''),nextAction:String(input.nextAction||''),traces:input.traces||[],closedAt:now(),closedBy:actor.id,eligibleForDiagnostic:completed&&covered.length>0});
 await tx.put('lesson_runs',run);lesson.status=completed?'completed':input.status;await tx.put('lessons',lesson);await tx.audit(actor,'lesson.closed',id,{status:run.status,coveredSkills:covered});return run;});}
export async function editLesson(store,id,input,actor){return store.transaction(async tx=>{const lesson=await scoped(tx,'lessons',id,actor);if(lesson.status!=='draft')fail(409,'Seuls les brouillons peuvent être modifiés.');requireValue(input.version===lesson.version,'Version obsolète.');requireValue(input.reason?.trim(),'Justifiez la modification.');const old=(await tx.get('lesson_versions',lesson.versionId)).spec;const spec=validate(lessonSchema,{...input.spec,lessonId:old.lessonId,classId:old.classId,lessonVersion:lesson.version+1});
 if((await tx.list('generation_jobs',actor.classId)).some(j=>j.lessonId===id&&['running','queued','retry_wait'].includes(j.status)))fail(409,'Une préparation est en cours. Attendez sa fin avant de modifier le brouillon.');
 // Source identity cannot be edited into a different history.
 requireValue(spec.date===old.date&&spec.planVersion===old.planVersion&&spec.planEntryId===old.planEntryId&&JSON.stringify(spec.sourceVersions)===JSON.stringify(old.sourceVersions)&&JSON.stringify(spec.diagnostic)===JSON.stringify(old.diagnostic),'Régénérez pour changer le plan ou le diagnostic source.');
 validateEditorContent(spec);
 const previousVersionId=lesson.versionId;
 lesson.version++;lesson.versionId=`${id}:v${lesson.version}`;lesson.title=spec.title;lesson.pedagogicalValidation=null;
 await tx.insert('lesson_versions',{id:lesson.versionId,lessonId:id,classId:actor.classId,version:lesson.version,spec,previousVersionId,reason:input.reason,authorId:actor.id});lesson.quality=(await lessonQuality(tx,lesson)).quality;await tx.put('lessons',lesson);
 await freezeContent(tx,{classId:actor.classId,event:'lesson.edited',eventId:lesson.versionId,subject:{kind:'lesson',lessonId:id,lessonVersionId:lesson.versionId},versions:{previousVersionId},files:[{path:'lesson.json',content:canonical(spec),audience:'teacher'}]});
 await tx.audit(actor,'lesson.edited',id,{version:lesson.version,reason:input.reason});return lesson;});}
export {applyPlanOperations as applyPlanChange} from './planning.mjs';
import {proposePlanOperations} from './planning.mjs';
export async function proposePlanChange(store,actor,input){return proposePlanOperations(store,actor,input.operations?input:{reason:input.reason,operations:[{type:'update',entryId:input.entryId,patch:input.patch}]});}
