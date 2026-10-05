import {uid,now,scoped,requireValue} from './store.mjs';
import {validDate} from './planning.mjs';
import {parisDate} from './generator.mjs';
export async function reconciliationPreview(store,id,actor){const report=await scoped(store,'imports',id,actor);requireValue(report.status==='applied','Validez d’abord l’import.');const applied=await store.list('import_reconciliations',actor.classId);return {importId:id,history:(report.parsed.history||[]).map((source,index)=>({index,source,reconciled:applied.some(a=>a.importId===id&&a.kind==='assessment'&&a.index===index)})),journal:(report.parsed.journal||[]).map((source,index)=>({index,source,reconciled:applied.some(a=>a.importId===id&&a.kind==='journal'&&a.index===index)}))};}
export async function reconcileImport(store,id,actor,input){return store.transaction(async tx=>{
 const report=await scoped(tx,'imports',id,actor);requireValue(report.status==='applied'&&input.confirmed===true,'Validez l’import et cette réconciliation.');requireValue(input.reason?.trim(),'Justifiez la réconciliation.');requireValue(['assessment','journal'].includes(input.kind)&&Number.isInteger(input.index),'Source invalide.');
 const source=(input.kind==='assessment'?report.parsed.history:report.parsed.journal)?.[input.index];requireValue(source,'Ligne source inconnue.');requireValue(validDate(source.date)&&source.date<=parisDate(),'La réalisation historique ne peut pas être future.');
 const key=`${id}:${input.kind}:${input.index}`,existing=await tx.get('import_reconciliations',key);if(existing)return existing;
 const criteria=await tx.list('competency_n3',actor.classId),known=c=>criteria.some(n=>n.n3_code===c),outputIds=[];
 if(input.kind==='assessment'){
  const learner=await scoped(tx,'learners',input.learnerId,actor);requireValue(Array.isArray(input.criteria)&&input.criteria.length>0,'Relisez les critères et les niveaux.');
  requireValue(new Set(input.criteria.map(c=>c.criterion)).size===input.criteria.length,'Critères dupliqués.');
  for(const c of input.criteria){requireValue(known(c.criterion)&&source.criteria.some(s=>s.criterion===c.criterion)&&['NA','EC','A1','A2','NE'].includes(c.level),'Critère ou niveau incompatible avec la source.');if(c.level==='NE')continue;const proof=await tx.insert('evidence',{id:uid('evidence'),classId:actor.classId,learnerId:learner.id,criterion:c.criterion,level:c.level,date:source.date,sourceId:`excel:${report.sha256}:${source.date}:${source.assessmentId}:${learner.id}`,revision:1,approved:true,autonomous:input.autonomous===true,transfer:input.transfer===true,importId:id,sourceRow:input.index,approvedBy:actor.id,reason:input.reason});outputIds.push(proof.id);}
 }else{
  requireValue(['completed','partially_completed','cancelled','postponed','not_completed','non_evaluable'].includes(input.status),'Statut de réalisation invalide.');const completed=['completed','partially_completed'].includes(input.status),covered=completed?input.coveredSkills||[]:[];
  requireValue(covered.every(c=>known(c)&&source.skills.includes(c)),'Critère non présent dans le cahier source.');if(completed)requireValue(covered.length&&input.coveredContent?.trim(),'Confirmez le contenu et les critères réellement travaillés.');
  const run=await tx.insert('lesson_runs',{id:uid('importedrun'),classId:actor.classId,lessonId:null,lessonVersionId:null,date:source.date,status:input.status,eligibleForDiagnostic:completed&&covered.length>0,coveredSkills:covered,coveredActivityIds:[],coveredContent:completed?input.coveredContent:'',reactivatedPrerequisites:[],closedAt:now(),closedBy:actor.id,source:'excel_reconciled',importId:id,sourceRow:input.index,trace:source.trace,reason:input.reason});outputIds.push(run.id);
 }
 const result=await tx.insert('import_reconciliations',{id:key,classId:actor.classId,importId:id,kind:input.kind,index:input.index,source,decision:input,outputIds,authorId:actor.id});await tx.audit(actor,'import.reconciled',key,{outputIds,reason:input.reason});return result;
});}
