import {readFile} from 'node:fs/promises';
import {decodePackage,validateReferences,fingerprint} from '../lesson-package.mjs';
import {materialize} from '../lesson-transfer-content.mjs';
import {programmingTemplate} from '../session-types.mjs';
import {uid,now,requireValue,fail,scoped} from '../store.mjs';

let source;
async function sourcePackage(){
 source??=readFile(new URL('../../data/programming/tableaux-source.zip',import.meta.url)).then(decodePackage).catch(error=>{source=null;throw error;});
 return source;
}
export async function programmingTemplateContent(templateId){
 const template=programmingTemplate({programmingTemplate:templateId}),pack=await sourcePackage();
 const payload=structuredClone(pack.lessons[0].payload),s=payload.spec,p=s.programming;
 if(template.sessionIds.length<p.sessions.length){
  p.sessions=p.sessions.filter(session=>template.sessionIds.includes(session.id));
  const blockIds=new Set(p.sessions.flatMap(session=>session.blockIds));
  s.blocks=s.blocks.filter(block=>blockIds.has(block.id));
  s.timeline=s.timeline.filter(item=>blockIds.has(item.blockId));s.studentFlow=s.blocks.map(block=>block.id);
  p.optionalActivityIds=template.sessionIds.includes('s2')?p.optionalActivityIds:[];
  const activityIds=new Set([...s.blocks.flatMap(block=>block.activityIds),...p.optionalActivityIds]);
  s.activities=s.activities.filter(activity=>activityIds.has(activity.id));
  p.comparisons=p.comparisons.filter(comparison=>blockIds.has(comparison.blockId));
  s.diagnostic.activityIds=s.blocks[0].activityIds.slice();
  if(p.presentation){
   if(p.presentation.sessionLabels)p.presentation.sessionLabels=p.presentation.sessionLabels.filter(label=>p.sessions.some(session=>session.id===label.id));
   for(const key of ['headings','openings','summaries'])p.presentation[key]=p.presentation[key].filter(item=>blockIds.has(item.blockId)).map(item=>{
    if(item.nextBlockId&&!blockIds.has(item.nextBlockId)){delete item.nextBlockId;delete item.actionLabel;delete item.nextActivityId;}
    return item;
   });
   p.presentation.comparisons=p.presentation.comparisons.filter(item=>p.comparisons.some(comparison=>comparison.id===item.id));
  }
  s.title=template.id==='tableaux-s1'?'JavaScript : tableaux, parcours for et fonctions':'JavaScript : recherche while, forEach et décomposition';
  s.pedagogicalTitle=s.title;payload.sessionIdentity.pedagogicalTitle=s.title;
  p.provenance.conversions.push('Sélection explicite de '+p.sessions[0].title+' ; contenu et durées des blocs conservés.');
 }
 s.sessionType='programming';
 payload.context.entry.duration=template.minutes;
 validateReferences(s);
 return {template,payload,files:pack.files};
}

// Instantiating a reviewed source course never evaluates its archived scripts.
export async function createProgrammingLesson(store,actor,input,entry){
 requireValue(actor.role==='teacher','Action réservée au professeur.');
 requireValue(!input.requestId||typeof input.requestId==='string'&&input.requestId.length<=200,'Identifiant de création invalide.');
 requireValue(!['cancelled','postponed','replaced'].includes(entry.status),'Ce créneau n’est plus actif.');
 const selected=programmingTemplate(input,entry),{payload,files}=await programmingTemplateContent(selected.id);
 requireValue(entry.durationConfirmed,'Confirmez la durée du créneau avant de créer la séance.');
 requireValue(entry.duration>=selected.minutes,`Ce parcours conserve ses ${selected.minutes} minutes. Augmentez le créneau ou choisissez une séance de 180 minutes.`);
 const localId='programmation-'+fingerprint([entry.id,selected.id]).slice(0,20),id=actor.classId+':'+localId;
 const requestHash=fingerprint({entryId:entry.id,template:selected.id,intent:input.intent});
 return store.transaction(async tx=>{
  await tx.lockTables();
  const currentEntry=await scoped(tx,'plan_entries',entry.id,actor);
  requireValue(fingerprint(currentEntry)===fingerprint(entry),'Le créneau a changé. Rechargez la création.');
  const plan=(await tx.list('plan_versions',actor.classId)).at(-1);requireValue(plan,'Importez une planification.');
  const duplicate=input.requestId&&(await tx.list('lessons',actor.classId)).find(lesson=>lesson.authorId===actor.id&&lesson.creationRequestId===input.requestId);
  if(duplicate){if(duplicate.creationRequestHash!==requestHash)fail(409,'Cette demande a déjà créé un autre parcours. Relancez une nouvelle création.');return {...duplicate,spec:(await tx.get('lesson_versions',duplicate.versionId)).spec};}
  const old=await tx.get('lessons',id);
  if(old&&old.status!=='draft')fail(409,'Ce parcours est déjà publié pour ce créneau. Ouvrez sa version existante.');
  const version=(old?.version||0)+1,versionId=`${id}:v${version}`;
  const content=await materialize(payload,files,{classId:actor.classId,actorId:actor.id,lessonId:localId,version,date:entry.date,entry,plan,previous:null,sourceMatches:false});
  const criteria=await tx.list('competency_n3',actor.classId);
  const identity={pedagogicalTitle:content.spec.title,missionTitle:null,titleSource:'imported',identityNeedsReview:true,identityRevision:(old?.identityRevision||0)+1,competencyRefs:criteria.filter(c=>content.spec.skills.includes(c.n3_code)).map(c=>({competencyId:c.id}))};
  Object.assign(content.spec,identity);
  const lesson={...identity,id,classId:actor.classId,authorId:actor.id,portableId:old?.portableId||uid('portable'),version,versionId,planEntryId:entry.id,date:entry.date,title:content.spec.title,sessionType:'programming',programmingTemplate:selected.id,status:'draft',provider:'programming-template',preparationState:'teacher_draft',qualityRequired:false,creationRequestId:input.requestId||null,creationRequestHash:requestHash,transferContext:payload.context};
  for(const asset of content.assets)if(!await tx.get('lesson_assets',asset.id))await tx.insert('lesson_assets',asset);
  await tx.insert('lesson_versions',{id:versionId,lessonId:id,classId:actor.classId,version,spec:content.spec,previousVersionId:old?.versionId||null,authorId:actor.id,reason:'Création depuis le parcours de programmation choisi'});
  const corpusFiles=payload.corpus.files.map(file=>({...file,base64:files.get(file.sha256).toString('base64')}));
  await tx.insert('corpus_packages',{id:uid('corpus'),classId:actor.classId,lessonId:id,lessonVersionId:versionId,version,complete:true,identityTitle:lesson.title,identityRevision:identity.identityRevision,files:corpusFiles,manifest:{schemaVersion:2,lessonId:localId,lessonVersionId:versionId,lessonVersion:version,classId:actor.classId,generatedAt:now(),completeness:'complete',missing:[],files:payload.corpus.files}});
  if(old)await tx.put('lessons',lesson);else await tx.insert('lessons',lesson);
  await tx.audit(actor,'lesson.created_from_programming_template',id,{version,template:selected.id,entryId:entry.id});
  return {...lesson,spec:content.spec};
 });
}
