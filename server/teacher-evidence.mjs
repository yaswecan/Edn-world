import {uid,now,requireValue,scoped} from './store.mjs';
import {assignmentAccess} from './student-tracking.mjs';
import {digest,invalidateDerived} from './competency-service.mjs';
import {validateCategories,rank} from './competency-calculations.mjs';
import {revision,publishedFramework} from './framework-admin.mjs';
import {validDate} from './planning.mjs';

export async function recordTeacherEvidence(tx,actor,input){
 const a=await assignmentAccess(tx,input.assignmentId,actor),f=await scoped(tx,'framework_versions',input.frameworkVersionId,actor),node=f.nodes.find(n=>n.id===input.competencyId);
 requireValue(publishedFramework(f)&&node,'Choisissez une compétence publiée.');
 requireValue(input.description?.trim()&&input.description.length<=4000&&input.situationId?.trim()&&input.situationId.length<=300,'Décrivez la production, son contexte et la famille de situation.');
 requireValue(input.workedAt===null||validDate(input.workedAt),'Date réelle du travail invalide.');
 validateCategories(input.categories);requireValue(Array.isArray(input.criteria)&&input.criteria.length&&new Set(input.criteria.map(c=>c.criterionId)).size===input.criteria.length,'Critères distincts requis.');
 const criteria=input.criteria.map(c=>{const source=node.criteria.find(k=>k.id===c.criterionId);requireValue(source&&input.categories.some(k=>k.id===c.grade)&&input.categories.some(k=>k.id===c.maximumGrade)&&rank(input.categories,c.grade)<=rank(input.categories,c.maximumGrade),'Critère ou niveau observable invalide.');return {criterionId:source.id,title:source.title,grade:c.grade,maximumGrade:c.maximumGrade,itemIds:[],reasons:['Observation individualisée du professeur'],meetsExpected:input.expectedGrade?rank(input.categories,c.grade)>=rank(input.categories,input.expectedGrade):null};});
 const prior=input.evidenceId?await scoped(tx,'teacher_observations',input.evidenceId,actor):null;
 if(prior){revision(prior,input.revision);requireValue(prior.learnerId===a.learnerId&&prior.assignmentId===a.id,'Une révision conserve son élève et son occurrence.');}
 const id=prior?.id||uid('teacher-evidence'),version=(prior?.revision||0)+1;
 const evidence={id,classId:actor.classId,assignmentId:a.id,learnerId:a.learnerId,runId:a.runId,revision:version,source:'teacher_observation',criterion:node.code||node.title,level:criteria.length===1?criteria[0].grade:'NE',date:input.workedAt,note:input.description,publishedObservationIds:prior?.publishedObservationIds||[],authorId:actor.id,recordedAt:now()};
 const observation=await tx.insert('competency_observations',{id:uid('observation'),classId:actor.classId,learnerId:a.learnerId,assignmentId:a.id,runId:a.runId,teacherEvidenceId:id,correctionVersion:version,gridId:null,submissionId:null,attemptId:null,frameworkVersionId:f.id,competencyId:node.id,code:node.code,title:node.studentLabel||node.title,grade:null,criteria,categories:input.categories,scaleKey:digest(input.categories),workedAt:input.workedAt,situationId:input.situationId,autonomy:['demonstrated','assisted'].includes(input.autonomy)?input.autonomy:'unknown',allowedHelp:String(input.allowedHelp||'').slice(0,2000),source:'teacher_observation',description:input.description,groupContext:String(input.groupContext||'').slice(0,1000),validated:true,practice:false,afterCorrection:false,correctedAt:now()});
 evidence.observationId=observation.id;if(prior)await tx.put('teacher_observations',evidence);else await tx.insert('teacher_observations',evidence);
 await invalidateDerived(tx,actor.classId);await tx.audit(actor,'teacher_evidence.recorded',id,{revision:version});return {evidence,observation};
}
export async function publishTeacherEvidence(tx,actor,id,input){
 const e=await scoped(tx,'teacher_observations',id,actor);requireValue(e.source==='teacher_observation','Constat V3 attendu.');revision(e,input.revision);
 await assignmentAccess(tx,e.assignmentId,actor);e.publishedObservationIds=[...new Set([...e.publishedObservationIds,e.observationId])];await tx.put('teacher_observations',e);await tx.audit(actor,'teacher_evidence.published',id,{revision:e.revision});return e;
}
