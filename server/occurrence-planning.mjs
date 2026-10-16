import {uid,now,requireValue,fail,scoped} from './store.mjs';
import {validDate} from './planning.mjs';
import {assignRun,memberKey} from './student-tracking.mjs';
import {publishedFramework,revision} from './framework-admin.mjs';
export const linkRoles=['introduction','practice','transfer','consolidation','evaluation'];
const unique=a=>[...new Set(a)];
export async function validateObjectives(tx,actor,objectives,activityIds){
 requireValue(Array.isArray(objectives)&&objectives.length<=200,'Objectifs invalides.');const result=[];
 for(const o of objectives){
  const f=await scoped(tx,'framework_versions',o.frameworkVersionId,actor),n=f.nodes.find(n=>n.id===o.competencyId);
  requireValue(publishedFramework(f)&&n&&!n.archived,'Choisissez une version publiée du référentiel.');
  requireValue(!o.criterionId||n.criteria.some(c=>c.id===o.criterionId&&!c.archived),'Critère inconnu.');
  requireValue(linkRoles.includes(o.role)&&(!o.activityId||activityIds.includes(o.activityId)),'Rôle ou activité invalide.');
  result.push({frameworkVersionId:f.id,competencyId:n.id,criterionId:o.criterionId||null,activityId:o.activityId||null,role:o.role,expectedLevel:String(o.expectedLevel||'').slice(0,100),direct:o.direct!==false});
 }
 return [...new Map(result.map(r=>[JSON.stringify(r),r])).values()];
}
export async function occurrenceConflicts(tx,actor,row){
 const all=await tx.list('lesson_runs',actor.classId),conflicts=[];
 for(const r of all)if(r.id!==row.id&&r.date===row.date&&r.planStatus!=='cancelled')conflicts.push({kind:'same_day',occurrenceId:r.id,message:'Une autre occurrence est prévue ce jour dans cette classe. Horaires à vérifier.'});
 for(const o of row.objectives||[]){const f=await tx.get('framework_versions',o.frameworkVersionId);
  for(const p of f.relations||[])if(p.from===o.competencyId&&p.mandatory&&!all.some(r=>r.id!==row.id&&r.date<row.date&&r.planStatus!=='cancelled'&&r.objectives?.some(k=>k.frameworkVersionId===f.id&&k.competencyId===p.to)))conflicts.push({kind:'prerequisite',competencyId:p.to,message:'Prérequis obligatoire sans préparation planifiée antérieure.'});
 }
 return conflicts;
}
async function planFields(tx,actor,input,version){
 requireValue(validDate(input.date),'Date locale invalide.');requireValue(Number.isInteger(input.duration)&&input.duration>=5&&input.duration<=600,'Durée attendue : 5 à 600 minutes.');
 const activities=version.spec.activities||[],ids=input.activityIds||activities.map(a=>a.id);
 requireValue(Array.isArray(ids)&&unique(ids).length===ids.length&&ids.every(id=>activities.some(a=>a.id===id)),'Activités invalides.');
 return {date:input.date,duration:input.duration,sequence:String(input.sequence||'').slice(0,500),group:String(input.group||'').slice(0,200),activityIds:ids,objectives:await validateObjectives(tx,actor,input.objectives||[],ids)};
}
async function checkConflicts(tx,actor,row,input){const conflicts=await occurrenceConflicts(tx,actor,row);if(conflicts.length&&!(input.confirmConflicts===true&&input.reason?.trim()))fail(409,'Vérifiez les conflits connus et confirmez avec un motif.',{conflicts});return conflicts;}
async function journal(tx,actor,before,after,reason){await tx.insert('plan_changes',{id:uid('occurrence-change'),classId:actor.classId,occurrenceId:after.id,status:'applied',before,after:structuredClone(after),reason,authorId:actor.id,changedAt:now()});await tx.audit(actor,'occurrence.changed',after.id,{revision:after.revision});}
export async function createOccurrence(tx,actor,input){
 const version=await scoped(tx,'lesson_versions',input.lessonVersionId,actor),fields=await planFields(tx,actor,input,version);
 requireValue(typeof input.requestId==='string'&&input.requestId.length>=8&&input.requestId.length<=200,'Clé de création attendue.');
 const signature=JSON.stringify({versionId:version.id,...fields}),prior=(await tx.list('lesson_runs',actor.classId)).find(r=>r.planningRequestId===input.requestId);
 if(prior){if(prior.planningSignature!==signature)fail(409,'Cette création a déjà un autre contenu.');return prior;}
 const row={id:uid('occurrence'),classId:actor.classId,lessonId:version.lessonId,lessonVersionId:version.id,...fields,initialDate:fields.date,planStatus:'planned',availability:'waiting',status:'planned',revision:1,realization:{date:null,activityIds:[]},authorId:actor.id,planningRequestId:input.requestId,planningSignature:signature};
 await checkConflicts(tx,actor,row,input);await tx.insert('lesson_runs',row);await journal(tx,actor,null,row,'Création');return row;
}
export async function updateOccurrence(tx,actor,id,input){
 const row=await scoped(tx,'lesson_runs',id,actor);revision(row,input.revision);requireValue(input.reason?.trim()&&input.reason.length<=2000,'Justifiez la modification.');
 const before=structuredClone(row),version=await scoped(tx,'lesson_versions',row.lessonVersionId,actor);
 requireValue(row.planStatus!=='cancelled','Cette occurrence est annulée.');
 if(['edit','postpone'].includes(input.action)){
  const fields=await planFields(tx,actor,{...row,activityIds:row.activityIds||version.spec.activities.map(a=>a.id),...input},version);
  requireValue((row.realization?.activityIds||[]).every(id=>fields.activityIds.includes(id)),'Conservez les activités déjà réalisées.');
  Object.assign(row,fields);row.initialDate=before.initialDate||before.date;
  if(input.action==='postpone')row.planStatus='postponed';await checkConflicts(tx,actor,row,input);
 }else if(input.action==='cancel'){
  requireValue(!row.realization?.activityIds?.length,'Le réalisé est conservé. Reprogrammez le reste plutôt que d’annuler.');row.planStatus='cancelled';row.availability='closed';row.closedAt=now();
 }else if(input.action==='realize'){
  requireValue(validDate(input.actualDate),'Date réelle requise.');const allowed=row.activityIds||version.spec.activities.map(a=>a.id);
  requireValue(Array.isArray(input.completedActivityIds)&&input.completedActivityIds.length>0&&input.completedActivityIds.every(id=>allowed.includes(id)),'Activités réalisées invalides.');
  const done=unique([...(row.realization?.activityIds||[]),...input.completedActivityIds]);
  row.realization={date:row.realization?.date||input.actualDate,activityIds:done,records:[...(row.realization?.records||[]),{date:input.actualDate,activityIds:unique(input.completedActivityIds),authorId:actor.id,at:now()}]};
  row.planStatus=done.length===allowed.length?'realized':'partial';
 }else fail(400,'Modification inconnue.');
 row.revision=(row.revision||1)+1;await tx.put('lesson_runs',row);await journal(tx,actor,before,row,input.reason);return row;
}
export async function replanRemaining(tx,actor,id,input){
 const source=await scoped(tx,'lesson_runs',id,actor);revision(source,input.revision);
 requireValue(source.planStatus==='partial'&&input.reason?.trim(),'Renseignez le réalisé partiel et le motif.');
 requireValue(!source.remainingOccurrenceId,'Le reste a déjà été reprogrammé.');
 const remaining=source.activityIds.filter(id=>!source.realization.activityIds.includes(id));requireValue(remaining.length,'Aucune activité restante.');
 const row=await createOccurrence(tx,actor,{...source,...input,lessonVersionId:source.lessonVersionId,activityIds:remaining,objectives:(source.objectives||[]).filter(o=>!o.activityId||remaining.includes(o.activityId))});
 row.parentOccurrenceId=source.id;row.situationFamilyId=source.situationFamilyId||source.id;await tx.put('lesson_runs',row);
 const before=structuredClone(source);source.remainingOccurrenceId=row.id;source.revision=(source.revision||1)+1;await tx.put('lesson_runs',source);await journal(tx,actor,before,source,input.reason);return row;
}
export async function releaseOccurrence(tx,actor,id,input){
 const row=await scoped(tx,'lesson_runs',id,actor);revision(row,input.revision);
 const lesson=await scoped(tx,'lessons',row.lessonId,actor);
 requireValue(row.planStatus!=='cancelled'&&!row.closedAt&&['waiting','open'].includes(row.availability),'Cette occurrence ne peut pas être ouverte.');
 const knownPublication=(await tx.list('lesson_publications',actor.classId)).some(p=>p.lessonVersionId===row.lessonVersionId||p.versionId===row.lessonVersionId);
 requireValue(knownPublication||lesson.status!=='draft'&&lesson.versionId===row.lessonVersionId,'Publiez d’abord cette version de séance.');
 requireValue(Array.isArray(input.learnerIds)&&input.learnerIds.length&&input.learnerIds.length<=200,'Sélectionnez les élèves.');
 for(const id of unique(input.learnerIds)){const l=await tx.get('learners',id),m=await tx.get('enrollments',memberKey(actor.classId,id));requireValue(l&&!l.suspended&&(l.classId===actor.classId||m?.status==='active')&&(!m||m.status==='active'),'Élève non habilité dans cette classe.');await assignRun(tx,row,l,{provenance:'planning-release'});}
 const before=structuredClone(row);row.availability='open';row.releasedAt||=now();row.revision=(row.revision||1)+1;await tx.put('lesson_runs',row);await journal(tx,actor,before,row,'Attribution et ouverture explicites');return row;
}
export async function recordParticipation(tx,actor,id,input){
 const run=await scoped(tx,'lesson_runs',id,actor);revision(run,input.revision);
 const a=(await tx.list('lesson_assignments',actor.classId)).find(a=>a.runId===id&&a.learnerId===input.learnerId);requireValue(a,'Élève non attribué à cette occurrence.');
 requireValue(['absent','observed','technical_incident'].includes(input.state)&&input.description?.trim(),'État et constat requis.');
 requireValue(input.actualDate===null||validDate(input.actualDate),'Date réelle invalide.');
 const v=await scoped(tx,'lesson_versions',run.lessonVersionId,actor),activities=input.activityIds||[];
 requireValue(Array.isArray(activities)&&activities.every(id=>v.spec.activities.some(a=>a.id===id))&&(input.state!=='absent'||!activities.length),'Activités constatées invalides.');
 const row=await tx.insert('occurrence_participations',{id:uid('participation'),classId:actor.classId,runId:id,assignmentId:a.id,learnerId:a.learnerId,state:input.state,actualDate:input.actualDate,activityIds:unique(activities),description:input.description.slice(0,2000),authorId:actor.id,source:'teacher'});await tx.audit(actor,'participation.recorded',row.id);return row;
}
