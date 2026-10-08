import {scoped,requireValue,fail,now} from './store.mjs';
import {buildDiagnostic} from './diagnostic.mjs';
import {DIAGNOSTIC_POLICY} from './diagnostic-practice.mjs';
import {library} from './generator.mjs';
import {lessonQuality} from './domain.mjs';
import {orderAndTime} from './lesson-structure.mjs';
import {validate,lessonSchema} from './contracts.mjs';
import {freezeContent,canonical} from './content-snapshots.mjs';

export async function reviseDiagnostic(store,id,input,actor){
 return store.transaction(async tx=>{
  const lesson=await scoped(tx,'lessons',id,actor);
  if(lesson.status!=='draft')fail(409,'Le diagnostic d’une séance publiée reste figé. Préparez une nouvelle séance.');
  requireValue(input.version===lesson.version,'La version du brouillon a changé. Rechargez la séance.');
  const old=(await scoped(tx,'lesson_versions',lesson.versionId,actor)).spec;
  if(old.diagnostic.policyVersion===DIAGNOSTIC_POLICY)return {...lesson,changed:false};
  if((await tx.list('assessment_attempts',actor.classId)).some(a=>a.lessonId===id))fail(409,'Un élève a déjà commencé ce diagnostic. Sa version est conservée.');
  if((await tx.list('generation_jobs',actor.classId)).some(j=>j.lessonId===id&&['running','queued','retry_wait'].includes(j.status)))fail(409,'La préparation est encore en cours. Attendez sa fin avant de modifier le diagnostic.');
  const curriculum=await scoped(tx,'curriculum_versions',old.sourceVersions.curriculumVersion,actor),nodes=old.skills.map(c=>curriculum.criteria.find(n=>n.n3_code===c)).filter(Boolean);
  const previous=old.diagnostic.sourceLessonRunId?await scoped(tx,'lesson_runs',old.diagnostic.sourceLessonRunId,actor):null;
  requireValue(!previous||previous.lessonVersionId===old.diagnostic.sourceLessonVersion,'La source du diagnostic ne correspond plus à la version attendue.');
  const source=previous?(await scoped(tx,'lesson_versions',old.diagnostic.sourceLessonVersion,actor)).spec:null;
  const spec=structuredClone(old);spec.lessonVersion=lesson.version+1;
  spec.diagnostic=buildDiagnostic(previous,source,nodes,old.lessonId,library);
  orderAndTime(spec,old.blocks.reduce((sum,b)=>sum+b.minutes,0),spec.diagnostic.duration);spec.timeline=spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));validate(lessonSchema,spec);
  const previousVersionId=lesson.versionId,reason='Diagnostic pratique : code, observation, transfert et justification pour A2.';
  lesson.version++;lesson.versionId=`${id}:v${lesson.version}`;
  await tx.insert('lesson_versions',{id:lesson.versionId,lessonId:id,classId:actor.classId,version:lesson.version,spec,authorId:actor.id,reason,previousVersionId});
  lesson.diagnosticRevision={policyVersion:DIAGNOSTIC_POLICY,previousVersionId,at:now(),authorId:actor.id};lesson.pedagogicalValidation=null;
  lesson.quality=(await lessonQuality(tx,lesson)).quality;await tx.put('lessons',lesson);
  await freezeContent(tx,{classId:actor.classId,event:'diagnostic.revised',eventId:lesson.versionId,subject:{kind:'lesson',lessonId:id,lessonVersionId:lesson.versionId},versions:{diagnosticPolicy:DIAGNOSTIC_POLICY,previousVersionId},files:[{path:'lesson.json',content:canonical(spec),audience:'teacher'}]});
  await tx.audit(actor,'diagnostic.revised',id,{version:lesson.version,previousVersionId,policyVersion:DIAGNOSTIC_POLICY});
  return {...lesson,changed:true};
 });
}
