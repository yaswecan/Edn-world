import {scoped,requireValue,fail,now} from './store.mjs';
import {compileCorpus} from './corpus.mjs';
import {lessonQuality} from './domain.mjs';
import {publicationCodeChecks} from './publication-code.mjs';
import {freezeContent,canonical} from './content-snapshots.mjs';

const canTakeOver=(lesson,job)=>lesson.status==='draft'&&lesson.qualityRequired===true&&(lesson.provider==='transfer'||!!job&&['cancelled','blocked','completed'].includes(job.status)&&!job.simulation&&lesson.provider!=='fixture');

export async function takeOverDraft(store,id,input,actor){
 requireValue(actor.role==='teacher'&&input.confirmed===true,'Confirmez la reprise et votre relecture du brouillon.');
 requireValue(typeof input.reason==='string'&&input.reason.trim()&&input.reason.length<=4000,'Indiquez la raison de la reprise.');
 return store.transaction(async tx=>{
  const lesson=await scoped(tx,'lessons',id,actor),job=lesson.qualityJobId?await scoped(tx,'generation_jobs',lesson.qualityJobId,actor):null;
  if(lesson.version!==input.version)fail(409,'Le brouillon a changé. Rechargez la séance.');
  requireValue(canTakeOver(lesson,job),'Cette préparation ne peut pas être reprise en brouillon professeur.');
  if((await tx.list('generation_jobs',actor.classId)).some(j=>j.lessonId===id&&['running','queued','retry_wait'].includes(j.status)))fail(409,'Attendez la fin de la préparation en cours.');
  const previousVersionId=lesson.versionId,old=await scoped(tx,'lesson_versions',previousVersionId,actor),spec=structuredClone(old.spec);
  lesson.version++;lesson.versionId=`${id}:v${lesson.version}`;spec.lessonVersion=lesson.version;
  const reason=input.reason.trim();
  await tx.insert('lesson_versions',{id:lesson.versionId,lessonId:id,classId:actor.classId,version:lesson.version,spec,previousVersionId,reason,authorId:actor.id});
  lesson.teacherReview={sourceJobId:job?.id||null,previousVersionId,versionId:lesson.versionId,reason,at:now(),authorId:actor.id};
  lesson.qualityRequired=false;lesson.pedagogicalValidation=null;lesson.preparationState='teacher_draft';
  if(lesson.transferPreparation)lesson.transferPreparation={requiresReview:false,incomplete:false,state:'teacher_draft'};
  lesson.quality=(await lessonQuality(tx,lesson)).quality;await tx.put('lessons',lesson);
  await freezeContent(tx,{classId:actor.classId,event:'lesson.teacher_takeover',eventId:lesson.versionId,subject:{kind:'lesson',lessonId:id,lessonVersionId:lesson.versionId},versions:{previousVersionId,sourceJobId:job?.id||null},files:[{path:'lesson.json',content:canonical(spec),audience:'teacher'}]});
  await tx.audit(actor,'lesson.teacher_takeover',id,{previousVersionId,versionId:lesson.versionId,sourceJobId:job?.id||null,reason});return lesson;
 });
}

export async function preparePublication(store,id,input,actor){
 let lesson=await scoped(store,'lessons',id,actor);
 requireValue(input.version===lesson.version,'La séance a changé. Rechargez-la avant de publier.');
 if(!['draft','published'].includes(lesson.status))fail(409,'Cette séance est clôturée ou indisponible.');
 let result=await lessonQuality(store,lesson);
 const codeChecks=await publicationCodeChecks(result.version.spec);
 // An unfinished preparation keeps its partial status; compiling exports cannot approve it.
 if(!result.pack&&codeChecks.every(c=>c.ok)&&result.quality.checks.filter(c=>!c.ok).every(c=>c.id==='corpus')){
  await compileCorpus(store,id,actor);lesson=await scoped(store,'lessons',id,actor);result=await lessonQuality(store,lesson);
 }
 result.quality.checks.push(...codeChecks);result.quality.publishable=result.quality.checks.every(c=>c.ok);
 const job=lesson.qualityJobId?await scoped(store,'generation_jobs',lesson.qualityJobId,actor):null;
 const blockers=result.quality.checks.filter(c=>!c.ok).map(c=>({
  ...c,
  action:c.id==='independent_review'||c.id==='corpus'&&lesson.qualityRequired?'preparation':c.id==='plan_version'||c.id==='plan_identity'||c.id==='source'?'regenerate':'edit',
  detail:c.id==='independent_review'?(job?.status==='cancelled'?'Cette préparation a été annulée avant validation. Vous pouvez reprendre le brouillon sous votre responsabilité pédagogique ou lancer une nouvelle préparation.':job?.status==='blocked'?`La préparation est interrompue : ${job.reason||'relecture non terminée'}.`:'La relecture automatique de cette version n’est pas terminée. Vous pouvez publier après votre propre relecture.'):c.id==='plan_version'?'Le créneau ou le référentiel de cette séance a changé. Vérifiez que son contenu vous convient toujours.':c.id==='corpus'?'Les supports de cette version ne sont pas encore complets.':c.message
 }));
 return {lessonId:id,version:lesson.version,title:lesson.title,date:lesson.date,quality:result.quality,blockers,canTakeOver:canTakeOver(lesson,job),preparationId:job?.id||null,planEntryId:result.version.spec.planEntryId,studentPath:`/today?lesson=${encodeURIComponent(id)}`};
}
