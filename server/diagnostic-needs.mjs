import {digest,latestObservations} from './competency-service.mjs';
import {rank,newest} from './competency-calculations.mjs';
import {DIAGNOSTIC_V31} from './diagnostic-v31.mjs';

// A local policy explicitly names which observations call for each support.
// No note, speed, number of runs or free-text sentiment is an input.
export async function diagnosticNeeds(tx,rule,learnerId){
 const all=(await latestObservations(tx,rule.classId,learnerId)).filter(o=>o.validated&&!o.practice&&!o.afterCorrection&&o.workedAt),proofs=new Map(),needs=[];
 const copies=(await tx.list('assessment_attempts',rule.classId)).filter(a=>a.runId===rule.runId&&a.learnerId===learnerId&&a.mode!=='practice');
 const exposure=copies.at(-1)?.exposure||'unknown';
 let provisional=false;
 for(const a of copies)if(a.submissionId&&(await tx.get('corrections',a.submissionId))?.status!=='approved')provisional=true;
 const remember=o=>proofs.set(o.id,{id:o.id,submissionId:o.submissionId,correctionVersion:o.correctionVersion,gridId:o.gridId,workedAt:o.workedAt,attemptId:o.attemptId});
 for(const [priority,p] of rule.prerequisites.entries())for(const criterionId of p.criterionIds){
  const match=all.filter(o=>o.frameworkVersionId===p.frameworkVersionId&&o.competencyId===p.competencyId&&o.scaleKey===digest(p.categories)&&o.criteria.some(c=>c.criterionId===criterionId&&c.grade)).sort(newest);
  const o=match.find(o=>o.runId===rule.runId),c=o?.criteria.find(c=>c.criterionId===criterionId),f=await tx.get('framework_versions',p.frameworkVersionId),criterion=f?.nodes.find(n=>n.id===p.competencyId)?.criteria.find(c=>c.id===criterionId);
  const n={...p,criterionIds:[criterionId],criterionId,title:criterion?.title||p.title,priority:p.priority??priority,state:'insufficient',family:'observe',reason:'À observer / à vérifier : preuve recevable manquante.',itemIds:c?.itemIds||[],proofIds:[]};
  if(p.newConcept){n.state='ready';n.family='teach';n.reason='Notion nouvelle à enseigner.';}
  else if(o&&rank(p.categories,c.maximumGrade)>=rank(p.categories,p.expectedGrade)){
   remember(o);n.proofIds.push(o.id);
   const meets=rank(p.categories,c.grade)>=rank(p.categories,p.expectedGrade),prior=match.find(other=>other.situationId!==o.situationId),pc=prior?.criteria.find(k=>k.criterionId===criterionId);
   if(pc&&rank(p.categories,pc.maximumGrade)>=rank(p.categories,p.expectedGrade)&&(rank(p.categories,pc.grade)>=rank(p.categories,p.expectedGrade))!==meets){remember(prior);n.proofIds.push(prior.id);n.state='verify';n.reason='À vérifier : observations comparables contradictoires.';}
   else if(!meets&&exposure==='not_exposed'){n.state='insufficient';n.reason='Non-exposition à la source : enseignement ou vérification à prévoir.';}
   else if(meets){n.state='ready';n.family=p.extensionGrade&&rank(p.categories,c.grade)>=rank(p.categories,p.extensionGrade)&&rank(p.categories,c.maximumGrade)>=rank(p.categories,p.extensionGrade)?'extension':'ready';n.reason='Attendu démontré sur ce critère.';}
   else if(p.guidedGrades?.includes(c.grade)){n.state='fragile';n.family='guided';n.reason='Prérequis déficient observé : reprise guidée selon la politique.';}
   else if(p.consolidationGrades?.includes(c.grade)){n.state='fragile';n.family='consolidation';n.reason='Application partielle observée : consolidation selon la politique.';}
   else n.reason='Observation sous l’attendu ; famille de soutien à configurer.';
  }
  needs.push(n);
 }
 const ordered=[...needs].sort((a,b)=>a.priority-b.priority||a.criterionId.localeCompare(b.criterionId));
 const priority=ordered.find(n=>n.state==='fragile')||ordered.find(n=>['verify','insufficient'].includes(n.state))||ordered[0];
 const state=priority?.state||'insufficient',family=state==='fragile'?priority.family:state!=='ready'?'observe':needs.filter(n=>!n.newConcept).length&&needs.filter(n=>!n.newConcept).every(n=>n.family==='extension')?'extension':'ready';
 const target=rule.targets[family]||rule.targets[state]||null;
 return {needs,prerequisites:needs,proofs:[...proofs.values()],readiness:state,family,priority:priority?{criterionId:priority.criterionId,title:priority.title,order:priority.priority}:null,target,evidenceStatus:provisional?'draft':proofs.size?'supported':'incomplete',exposure,reason:needs.map(n=>`${n.title} : ${n.reason}`).join(' '),policyVersion:DIAGNOSTIC_V31};
}
