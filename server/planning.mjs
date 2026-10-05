import {uid,now,requireValue,fail,scoped} from './store.mjs';

const editable=['date','objective','activity','skills','sequence','module','duration','durationConfirmed','status'];
const active=e=>!['cancelled','postponed','replaced'].includes(e.status);
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function validateEntry(entry,criteria){
 requireValue(validDate(entry.date),'Date invalide.');
 requireValue(typeof entry.objective==='string'&&entry.objective.trim(),'Objectif requis.');
 requireValue(Number.isInteger(entry.duration)&&entry.duration>=30&&entry.duration<=600,'Durée : 30 à 600 minutes.');
 requireValue(typeof entry.durationConfirmed==='boolean','Confirmation de durée invalide.');
 requireValue(Array.isArray(entry.skills)&&entry.skills.every(c=>criteria.some(n=>n.n3_code===c)),'Compétence inconnue.');
 requireValue(['planned','postponed','cancelled','replaced'].includes(entry.status),'État du créneau invalide.');
 for(const key of ['sequence','activity','module'])requireValue(typeof entry[key]==='string',`${key} doit être un texte.`);
 entry.day=new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(new Date(entry.date+'T12:00:00Z'));return entry;
}
export async function proposePlanOperations(store,actor,input){
 requireValue(typeof input.reason==='string'&&input.reason.trim(),'Justifiez la modification du plan.');
 requireValue(Array.isArray(input.operations)&&input.operations.length>0&&input.operations.length<=50,'Une à cinquante opérations attendues.');
 return store.transaction(async tx=>{
 const plan=(await tx.list('plan_versions',actor.classId)).at(-1);requireValue(plan,'Importez le référentiel avant de modifier le plan.');
 const original=await tx.list('plan_entries',actor.classId),criteria=await tx.list('competency_n3',actor.classId),working=new Map(original.map(e=>[e.id,structuredClone(e)])),touched=new Set();
 const get=id=>{const e=working.get(id);if(!e)fail(404,'Créneau inconnu.');return e;};
 const update=(id,patch)=>{const e=get(id);const clean=Object.fromEntries(Object.entries(patch||{}).filter(([k])=>editable.includes(k)));requireValue(Object.keys(clean).length,'Aucune modification.');working.set(id,validateEntry({...e,...clean},criteria));touched.add(id);};
 const insert=(input,source=null)=>{const id=uid(`${actor.classId}:PE`);const e=validateEntry({...source,id,classId:actor.classId,date:input.date,day:'',category:'Séance',sequence:input.sequence??source?.sequence??'',module:input.module??source?.module??'',skills:input.skills??source?.skills??[],objective:input.objective,activity:input.activity??source?.activity??'',notes:'',assessmentId:'',assessmentDuration:0,assessmentCriteria:[],resourcePack:uid('R'),duration:input.duration??source?.duration??175,durationConfirmed:input.durationConfirmed??false,status:'planned',sourceRow:null,parentEntryIds:source?[source.id]:[]},criteria);working.set(id,e);touched.add(id);return e;};
 for(const op of input.operations){
  if(['update','move','postpone'].includes(op.type)){const patch=op.type==='update'?op.patch:op.type==='move'?{date:op.date}:{status:'postponed'};update(op.entryId,patch);}
  else if(op.type==='insert')insert(op.entry);
  else if(op.type==='swap'){const a=get(op.entryId),b=get(op.otherEntryId);requireValue(a.id!==b.id,'Choisissez deux créneaux différents.');const date=a.date;update(a.id,{date:b.date});update(b.id,{date});}
  else if(op.type==='split'){const source=get(op.entryId);requireValue(active(source),'Ce créneau a déjà été remplacé.');requireValue(Array.isArray(op.parts)&&op.parts.length>=2&&op.parts.length<=10,'Deux à dix parties attendues.');const parts=op.parts.map(p=>insert(p,source));requireValue(source.skills.every(c=>parts.some(p=>p.skills.includes(c))),'La division doit conserver tous les critères du créneau source.');update(source.id,{status:'replaced'});}
  else if(op.type==='merge'){requireValue(Array.isArray(op.entryIds)&&new Set(op.entryIds).size>=2&&new Set(op.entryIds).size===op.entryIds.length,'Choisissez au moins deux créneaux distincts.');const sources=op.entryIds.map(get);requireValue(sources.every(active),'Un créneau a déjà été remplacé.');const merged=insert({...op.entry,skills:op.entry?.skills??[...new Set(sources.flatMap(e=>e.skills))]},sources[0]);requireValue(sources.flatMap(e=>e.skills).every(c=>merged.skills.includes(c)),'La fusion doit conserver tous les critères sources.');merged.parentEntryIds=sources.map(e=>e.id);for(const e of sources)update(e.id,{status:'replaced'});}
  else fail(422,'Opération de planification inconnue.');
 }
 const entries=[...working.values()],changes=[...touched].map(id=>({entryId:id,oldValue:original.find(e=>e.id===id)||null,newValue:working.get(id)}));
 const warnings=[],skills=[...new Set(changes.flatMap(c=>c.newValue.skills))];
 for(const {newValue:e} of changes.filter(c=>active(c.newValue))){
  for(const node of criteria.filter(c=>e.skills.includes(c.n3_code)))for(const prerequisite of node.prerequisiteCodes||[])if(!entries.some(p=>p.id!==e.id&&active(p)&&p.date<e.date&&p.skills.includes(prerequisite)))warnings.push(`Prérequis ${prerequisite} non planifié avant ${e.date}.`);
  if(entries.some(p=>p.id!==e.id&&active(p)&&p.date===e.date&&p.skills.length))warnings.push(`Plusieurs créneaux actifs le ${e.date} : vérifier les horaires.`);
 }
 const assessments=(await tx.list('assessment_specs',actor.classId)).filter(a=>(a.skills||[]).some(c=>skills.includes(c)));
 for(const a of assessments)for(const c of a.skills||[])if(skills.includes(c)&&!entries.some(e=>active(e)&&e.date<=a.date&&e.skills.includes(c)))warnings.push(`${a.id} : ${c} n’est pas planifié avant l’évaluation.`);
 const lessons=(await tx.list('lessons',actor.classId)).filter(l=>changes.some(c=>c.entryId===l.planEntryId||c.oldValue?.date===l.date));
 const first=changes[0];return tx.insert('plan_changes',{id:uid('change'),classId:actor.classId,baseVersion:plan.version,entryId:first.entryId,oldValue:first.oldValue,newValue:first.newValue,changes,operations:input.operations,reason:input.reason,authorId:actor.id,status:'proposed',impact:{skills,warnings:[...new Set(warnings)],assessments:assessments.map(a=>a.id),lessons:lessons.map(l=>({id:l.id,status:l.status,version:l.version}))}});
 });
}
export async function applyPlanOperations(store,id,actor,input){return store.transaction(async tx=>{
 const change=await scoped(tx,'plan_changes',id,actor);requireValue(input.confirmed===true,'Validez la proposition et son impact.');if(change.status==='applied')return change;
 const plan=(await tx.list('plan_versions',actor.classId)).at(-1);if(plan.version!==change.baseVersion)fail(409,'Plan modifié : créez une nouvelle proposition.');
 const version=plan.version+1;for(const c of change.changes||[change]){const entry={...c.newValue,version,editedBy:actor.id};if(c.oldValue)await tx.put('plan_entries',entry);else await tx.insert('plan_entries',entry);}
 const entries=await tx.list('plan_entries',actor.classId);await tx.insert('plan_versions',{...plan,id:uid('plan'),createdAt:now(),version,entries,reason:change.reason,authorId:actor.id});change.status='applied';change.appliedVersion=version;await tx.put('plan_changes',change);await tx.insert('teacher_approvals',{id:uid('approval'),classId:actor.classId,entityId:id,version,actorId:actor.id,action:'plan_change'});await tx.audit(actor,'plan.changed',id,{version,reason:change.reason,entryIds:(change.changes||[change]).map(c=>c.entryId)});return change;
});}
