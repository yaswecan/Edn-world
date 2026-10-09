import {validateEditorContent} from './lesson-editor-validation.mjs';
import {isDeepStrictEqual} from 'node:util';
import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {validate,lessonSchema} from './contracts.mjs';
import {object,array,digest} from './pedagogy/contracts.mjs';
import {freezeProvider} from './ai/settings.mjs';
import {callStructured,estimateCall} from './pedagogy/provider.mjs';
import {editLesson} from './domain.mjs';
import {qualityCheck,previousCompleted} from './generator.mjs';
import {publicationCodeChecks} from './publication-code.mjs';

const editable=new Set(['title','objectives','reactivation','blocks','activities','teacherGuide','studentFlow']);
const active=['queued','running','retry_wait'];
const summary={type:'string',minLength:1,maxLength:4000},path={type:'string',minLength:1};
// Patch values are native JSON. The old string-within-JSON contract could pass
// structured-output validation while containing an unparseable valueJSON.
// Reuse the lesson's value types; optional object fields are nullable on the
// wire so every object also satisfies the provider's strict output contract.
const definitions={},valueTypes=new Map();
function valueType(schema){
 const key=JSON.stringify(schema);if(valueTypes.has(key))return valueTypes.get(key);
 const name=`value${valueTypes.size}`,ref={$ref:`#/$defs/${name}`};valueTypes.set(key,ref);
 const type=schema.type||typeof (schema.enum?.[0]??schema.const),wire={...schema,type};
 if(type==='object'){
  wire.properties=Object.fromEntries(Object.entries(schema.properties).map(([key,child])=>[key,['editor','richText'].includes(key)?{type:'null'}:(schema.required||[]).includes(key)?valueType(child):{anyOf:[valueType(child),{type:'null'}]}]));
  wire.required=Object.keys(wire.properties);wire.additionalProperties=false;
 }else if(type==='array')wire.items=valueType(schema.items);
 definitions[name]=wire;return ref;
}
for(const field of editable)valueType(lessonSchema.properties[field]);
const nativeChange={anyOf:[
 object({op:{type:'string',enum:['add','replace']},path,value:{anyOf:[...valueTypes.values()]}}),
 object({op:{type:'string',enum:['remove']},path,value:{type:'null'}})
]};
export const revisionSchema={...object({summary,changes:{...array(nativeChange),minItems:1,maxItems:200}}),$defs:definitions};
// Keep already generated and in-flight proposals readable, without asking the
// model to produce the legacy encoding in new requests.
const legacyChange=object({op:{type:'string',enum:['add','replace','remove']},path,valueJSON:{type:'string'}});
const acceptedRevisionSchema={...revisionSchema,properties:{...revisionSchema.properties,changes:{...revisionSchema.properties.changes,items:{anyOf:[...nativeChange.anyOf,legacyChange]}}}};

function lessonValueSchema(keys){
 let schema=lessonSchema;
 for(const key of keys)schema=schema?.type==='array'?schema.items:schema?.properties?.[key];
 return schema;
}
function lessonValue(value,schema){
 if(Array.isArray(value))return value.map(item=>lessonValue(item,schema?.items));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value)
  .filter(([key,item])=>!(item===null&&schema?.properties?.[key]&&!(schema.required||[]).includes(key)))
  .map(([key,item])=>[key,lessonValue(item,schema?.properties?.[key])]));
 return value;
}

export async function editableDraft(store,id,version,actor){
 requireValue(actor.role==='teacher','Action réservée au professeur.');
 const lesson=await scoped(store,'lessons',id,actor);
 if(lesson.status!=='draft')fail(409,'Seuls les brouillons peuvent être modifiés.');
 if(lesson.version!==version)fail(409,'Le brouillon a changé. Rechargez la séance avant de continuer.');
 if((await store.list('generation_jobs',actor.classId)).some(j=>j.lessonId===id&&active.includes(j.status)))fail(409,'Une préparation est en cours. Attendez sa fin ou annulez-la avant de modifier ce brouillon.');
 return lesson;
}

// Only course content is editable. Identity, source history, assessment and
// publication permissions never come from the model. All patches are atomic.
export function applyRevisionPatch(original,result){
 validate(acceptedRevisionSchema,result);
 const spec=structuredClone(original);
 for(const change of result.changes){
  const keys=change.path.split('/').slice(1).map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~'));
  requireValue(change.path.startsWith('/')&&editable.has(keys[0])&&keys.every(k=>k&&!['__proto__','prototype','constructor'].includes(k)),'La proposition vise un champ non modifiable.');
  let parent=spec;
  for(const key of keys.slice(0,-1)){
   requireValue(parent&&typeof parent==='object'&&Object.hasOwn(parent,key),'Emplacement de modification introuvable.');parent=parent[key];
  }
  requireValue(parent&&typeof parent==='object','Emplacement de modification invalide.');
  const key=keys.at(-1);let value;
  if(change.op!=='remove'){
   if(Object.hasOwn(change,'value'))value=lessonValue(change.value,lessonValueSchema(keys));
   else try{value=JSON.parse(change.valueJSON);}catch{fail(422,'La proposition contient une valeur JSON invalide.');}
  }
  if(Array.isArray(parent)){
   const index=key==='-'&&change.op==='add'?parent.length:/^(0|[1-9]\d*)$/.test(key)?Number(key):-1;
   requireValue(index>=0&&index<parent.length+(change.op==='add'?1:0),'Indice de modification invalide.');
   if(change.op==='add')parent.splice(index,0,value);else if(change.op==='remove')parent.splice(index,1);else parent[index]=value;
  }else{
   requireValue(change.op==='add'||Object.hasOwn(parent,key),'Champ de modification introuvable.');
   if(change.op==='remove')delete parent[key];else parent[key]=value;
  }
 }
 validate(lessonSchema,spec);
 for(const previous of original.blocks.filter(b=>b.editor)){const next=spec.blocks.find(b=>b.id===previous.id);requireValue(!next||next.editor,'Cette proposition retirerait la mise en forme riche. Modifiez ce contenu dans l’éditeur.');}
 for(const previous of original.activities.filter(a=>a.richText)){const next=spec.activities.find(a=>a.id===previous.id);requireValue(!next||next.richText,'Cette proposition retirerait la mise en forme d’une activité. Utilisez l’éditeur.');}
 requireValue(isDeepStrictEqual(spec.blocks.filter(b=>b.type==='Diagnostic'),original.blocks.filter(b=>b.type==='Diagnostic')),'Le bloc diagnostic reste lié à sa version source.');
 const activities=new Set(spec.activities.map(a=>a.id)),blocks=new Set(spec.blocks.map(b=>b.id));
 requireValue(activities.size===spec.activities.length&&blocks.size===spec.blocks.length&&!spec.activities.some(a=>spec.diagnostic.tasks.some(t=>t.id===a.id)),'Identifiants dupliqués dans la proposition.');
 requireValue(spec.blocks.every(b=>b.activityIds.every(id=>activities.has(id)))&&spec.studentFlow.every(id=>blocks.has(id)),'Reliez les exercices et les étapes restants après les suppressions.');
 // Derived exports follow the actual lesson instead of retaining removed prose.
 spec.timeline=spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));
 spec.slides=spec.blocks.filter(b=>!['Diagnostic','Pause'].includes(b.type)).map(b=>({title:b.title,body:b.content}));
 if(spec.sourceNotes)spec.sourceNotes=spec.sourceNotes.filter(n=>blocks.has(n.blockId));
 validate(lessonSchema,spec);validateEditorContent(spec);return spec;
}

export async function proposeLessonRevision(store,id,input,actor,{chatgpt,call=callStructured,configure=freezeProvider}={}){
 const lesson=await editableDraft(store,id,input.version,actor);
 requireValue(typeof input.prompt==='string'&&input.prompt.trim()&&input.prompt.length<=4000,'Décrivez la modification souhaitée (4 000 caractères maximum).');
 requireValue(typeof input.requestId==='string'&&/^[\w-]{1,100}$/.test(input.requestId),'Identifiant de demande requis.');
 const requestHash=digest({id,version:input.version,prompt:input.prompt}),proposalId=`revision:${actor.id}:${input.requestId}`;
 const existing=await store.get('lesson_adaptations',proposalId);
 if(existing){requireValue(existing.requestHash===requestHash,'Cette demande a déjà été utilisée pour un autre contenu.');if(existing.status==='ready')return existing;fail(409,existing.status==='running'?'Cette modification est déjà en cours.':'Cette demande est terminée. Lancez une nouvelle demande pour réessayer.');}
 const original=(await scoped(store,'lesson_versions',lesson.versionId,actor)).spec;
 const settings=await configure(store,actor,{chatgpt}),config={...settings,background:false,roles:{...settings.roles,revision:settings.roles.write}};
 const entry=await scoped(store,'plan_entries',original.planEntryId,actor);
 const content={instruction:input.prompt.trim(),draft:original,duration:entry.duration,editableFields:[...editable],activityContract:lessonSchema.properties.activities,blockContract:lessonSchema.properties.blocks};
 const estimate=estimateCall(config.roles.revision,content,{role:'revision',schema:revisionSchema});
 if(config.provider!=='chatgpt_plan'&&estimate.usd>Math.min(config.maxCallUSD,config.maxUSD))fail(409,'Cette modification dépasse le budget IA configuré. Réduisez le périmètre de la demande.');
 await store.transaction(async tx=>{await editableDraft(tx,id,input.version,actor);if(await tx.get('lesson_adaptations',proposalId))fail(409,'Cette modification est déjà enregistrée.');await tx.insert('lesson_adaptations',{id:proposalId,classId:actor.classId,actorId:actor.id,kind:'prompt_revision',lessonId:id,version:lesson.version,baseVersionId:lesson.versionId,requestHash,prompt:input.prompt.trim(),status:'running',startedAt:now()});});
 let trace;
 try{
  const result=await call({role:'revision',input:content,schema:revisionSchema,config,chatgpt});trace=result.trace;
  requireValue(!result.pending&&result.value,'La modification est incomplète. Le brouillon est conservé.');
  const spec=applyRevisionPatch(original,result.value);
  const curriculum=await scoped(store,'curriculum_versions',original.sourceVersions.curriculumVersion,actor);
  const quality=qualityCheck(spec,{entry,criteria:curriculum.criteria,previous:previousCompleted(await store.list('lesson_runs',actor.classId),spec.date)});
  const checks=[...quality.checks.filter(c=>c.id!=='corpus'),...await publicationCodeChecks(spec)];
  return await store.transaction(async tx=>{
   await editableDraft(tx,id,input.version,actor);
   const proposal=await tx.get('lesson_adaptations',proposalId);
   Object.assign(proposal,{status:'ready',summary:result.value.summary,changes:result.value.changes,spec,checks,trace,finishedAt:now()});
   await tx.put('lesson_adaptations',proposal);await tx.audit(actor,'lesson.revision_proposed',id,{proposalId,version:lesson.version});return proposal;
  });
 }catch(error){
  await store.transaction(async tx=>{const proposal=await tx.get('lesson_adaptations',proposalId);Object.assign(proposal,{status:'failed',error:error.message,trace:error.trace||trace,finishedAt:now()});await tx.put('lesson_adaptations',proposal);});throw error;
 }
}

export async function applyLessonRevision(store,id,input,actor){
 requireValue(input.confirmed===true,'Relisez puis confirmez la proposition.');
 return store.transaction(async tx=>{
  const proposal=await scoped(tx,'lesson_adaptations',input.proposalId,actor);
  requireValue(proposal.kind==='prompt_revision'&&proposal.actorId===actor.id&&proposal.lessonId===id,'Proposition inaccessible pour cette séance.');
  const lesson=await scoped(tx,'lessons',id,actor);
  if(proposal.status==='applied'&&lesson.versionId===proposal.appliedVersionId)return lesson;
  requireValue(proposal.status==='ready'&&proposal.version===input.version,'Proposition indisponible ou obsolète.');
  await editableDraft(tx,id,input.version,actor);
  const edited=await editLesson({transaction:fn=>fn(tx)},id,{version:input.version,spec:proposal.spec,reason:proposal.prompt},actor);
  proposal.status='applied';proposal.appliedVersionId=edited.versionId;proposal.appliedAt=now();await tx.put('lesson_adaptations',proposal);
  return edited;
 });
}
