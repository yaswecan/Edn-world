import {pathCurrent} from './adaptive-paths.mjs';
import {uid,now,fail,requireValue,scoped} from './store.mjs';
import {canonical,sha256} from './content-snapshots.mjs';
import {assignmentAccess,availability,memberKey} from './student-tracking.mjs';
import {unique,validateCategories,validateGradeRules,calculateGrid,consolidate,newest,coverage} from './competency-calculations.mjs';
export const digest=value=>sha256(canonical(value));
const gradeRules=rules=>(rules||[]).map(r=>({grade:r.grade,conditions:r.conditions.map(c=>({itemIds:c.itemIds,metric:c.metric,op:c.op,value:c.value,...(typeof c.label==='string'?{label:c.label.slice(0,500)}:{})}))}));
const string=(s,label,max=2000)=>requireValue(typeof s==='string'&&s.trim()&&s.length<=max,label);
export async function currentActor(tx,actor){
 const account=await tx.get(actor.role==='teacher'?'teachers':'learners',actor.id);
 if(!account||account.suspended||account.classId!==actor.classId||(account.authVersion||0)!==(actor.authVersion||0))fail(401,'Les droits de cette session ont changé. Reconnectez-vous.');
 return account;
}
export async function learnerInScope(tx,id,actor){
 const l=await tx.get('learners',id),member=await tx.get('enrollments',memberKey(actor.classId,id));
 if(!l||(l.classId!==actor.classId&&!member))fail(404,'Élève introuvable.');return l;
}
export function validateFramework(input){
 string(input.frameworkKey,'Identité du référentiel attendue.',200);string(input.sourceVersion,'Version source attendue.',100);string(input.title,'Titre attendu.',500);
 string(input.source?.document,'Document source attendu.',500);string(input.source?.location,'Localisation dans la source attendue.',1000);
 requireValue(Array.isArray(input.nodes)&&input.nodes.length>0&&input.nodes.length<=2000,'Compétences attendues (2 000 maximum).');
 const nodes=input.nodes.map(n=>{
  string(n.id,'Identité interne de compétence attendue.',200);string(n.title,'Intitulé exact attendu.');
  requireValue(n.code===null||typeof n.code==='string'&&n.code.length>0&&n.code.length<=200,'Le code source doit être une chaîne ou null.');
  requireValue(['block','competency'].includes(n.kind),'Type de compétence invalide.');
  const criteria=(n.criteria||[]).map(c=>{string(c.id,'Identité de critère attendue.',200);string(c.title,'Intitulé de critère attendu.');requireValue(['source','local'].includes(c.origin),'Précisez la provenance du critère.');requireValue(c.code==null||typeof c.code==='string','Code de critère invalide.');if(c.origin==='local')string(c.author,'Auteur du critère local attendu.',200);return {id:c.id,code:c.code??null,title:c.title,origin:c.origin,parentSourceId:c.parentSourceId||null,author:c.author||null,location:c.location||null};});
  requireValue(unique(criteria.map(c=>c.id)).length===criteria.length,'Critères dupliqués.');
  let criterionSet=null;if(n.criterionSet){const s=n.criterionSet;string(s.name,'Nom de l’ensemble de critères attendu.',200);string(s.version,'Version de l’ensemble attendue.',100);requireValue(Array.isArray(s.criterionIds)&&s.criterionIds.every(id=>criteria.some(c=>c.id===id&&c.origin==='source')),'L’ensemble officiel ne contient que des critères source.');criterionSet={name:s.name,version:s.version,exhaustive:s.exhaustive===true,criterionIds:unique(s.criterionIds)};}
  const pedagogy={};if(n.pedagogy){for(const key of ['typology','notionsTools','sequence','plannedDates','expectedTrace','status','prerequisites','masteryRule','scaffolding'])if(n.pedagogy[key]!==undefined){requireValue(typeof n.pedagogy[key]==='string'&&n.pedagogy[key].length<=10000,'Indication pédagogique source invalide.');pedagogy[key]=n.pedagogy[key];}}
  return {id:n.id,code:n.code,title:n.title,kind:n.kind,parentId:n.parentId||null,studentLabel:n.studentLabel||null,expectedLevel:n.expectedLevel||null,location:n.location||null,criteria,criterionSet,...(n.pedagogy?{pedagogy}:{})};
 });
 requireValue(unique(nodes.map(n=>n.id)).length===nodes.length,'Identités de compétences dupliquées.');
 requireValue(unique(nodes.filter(n=>n.code!==null).map(n=>n.code)).length===nodes.filter(n=>n.code!==null).length,'Codes source dupliqués dans cette version.');
 for(const n of nodes){const seen=new Set([n.id]);let p=n.parentId;while(p){requireValue(!seen.has(p),'Hiérarchie circulaire.');seen.add(p);const parent=nodes.find(n=>n.id===p);requireValue(parent,'Parent introuvable.');p=parent.parentId;}}
 if(input.source.note!==undefined)string(input.source.note,'Note source invalide.',10000);
 return {frameworkKey:input.frameworkKey,sourceVersion:input.sourceVersion,title:input.title,source:{document:input.source.document,location:input.source.location,sha256:input.source.sha256||null,...(input.source.note!==undefined?{note:input.source.note}:{})},nodes};
}
export async function importFramework(tx,actor,input){
 const content=validateFramework(input),id='framework_'+digest([actor.classId,content.frameworkKey,content.sourceVersion]),old=await tx.get('framework_versions',id);
 if(old){if(old.fingerprint!==digest(content))fail(409,'Cette version existe avec un autre contenu. Utilisez une nouvelle version.');return old;}
 requireValue(input.confirmed===true,'Vérifiez la source avant de valider son import.');
 const f=await tx.insert('framework_versions',{...content,id,classId:actor.classId,fingerprint:digest(content),validatedBy:actor.id,validatedAt:now()});await tx.audit(actor,'framework.imported',id);return f;
}
export async function curriculumFramework(tx,actor,id){
 const cv=await scoped(tx,'curriculum_versions',id,actor),nodes=[],sheet=cv.sheets?.find(s=>s.name.startsWith('02 '))?.name||'02 Référentiel';
 for(const c of cv.criteria){if(c.n2_code&&!nodes.some(n=>n.id===c.n2_code))nodes.push({id:c.n2_code,code:c.n2_code,title:c.n2_label||c.n2_code,kind:'block',criteria:[]});
  nodes.push({id:c.n3_code,code:c.n3_code,title:c.n3_label,kind:'competency',parentId:c.n2_code||null,location:`${sheet}!C${c.sourceRow}:N${c.sourceRow}`,expectedLevel:null,criteria:c.observable_criterion?[{id:'observable',code:null,title:c.observable_criterion,origin:'source',location:`${sheet}!L${c.sourceRow}`}]:[]});
 }
 return validateFramework({frameworkKey:'workbook:'+actor.classId,sourceVersion:String(cv.version),title:sheet,source:{document:'Classeur de planification importé',location:sheet,sha256:cv.sha256},nodes});
}
export async function activeGrid(tx,lessonVersionId){return (await tx.list('competency_grids')).filter(g=>g.lessonVersionId===lessonVersionId&&!g.unresolved).sort((a,b)=>a.version-b.version).at(-1)||null;}
export async function saveGrid(tx,actor,input){
 const lv=await scoped(tx,'lesson_versions',input.lessonVersionId,actor),old=await activeGrid(tx,lv.id);
 if((old?.version||0)!==(input.version||0))fail(409,'La grille a changé. Rechargez-la.');
 if((await tx.list('assessment_attempts',actor.classId)).some(a=>a.lessonVersionId===lv.id))fail(409,'Cette version a déjà été commencée. Créez une nouvelle version de séance pour modifier sa grille.');
 const grid=await validateGrid(tx,actor,input,lv.spec.diagnostic);
 const row=await tx.insert('competency_grids',{...grid,id:uid('grid'),classId:actor.classId,lessonVersionId:lv.id,version:(old?.version||0)+1,authorId:actor.id});
 await invalidateDerived(tx,actor.classId);await tx.audit(actor,'grid.configured',row.id);return row;
}
export async function validateGrid(tx,actor,input,diagnostic){
 validateCategories(input.categories);string(input.situationId,'Origine pédagogique de l’exercice attendue.',300);
 const rubric=diagnostic.rubric,ids=rubric.map(i=>i.id);
 requireValue(Array.isArray(input.items)&&input.items.length===ids.length&&unique(input.items.map(i=>i.id)).length===ids.length,'Chaque item du barème doit être configuré une fois.');
 for(const i of input.items)requireValue(ids.includes(i.id)&&Number.isFinite(i.coefficient)&&i.coefficient>0&&i.coefficient<=100,'Coefficient ou item invalide.');
 const rounding=input.rounding||{digits:2,mode:'nearest'};requireValue(Number.isInteger(rounding.digits)&&rounding.digits>=0&&rounding.digits<=4&&['nearest','up','down'].includes(rounding.mode),'Arrondi invalide.');
 validateGradeRules(input.globalRules||[],ids,input.categories);
 requireValue(Array.isArray(input.competencies)&&input.competencies.length<=100,'Rattachements de compétences attendus.');
 const competencies=[];
 for(const m of input.competencies){
  const f=await scoped(tx,'framework_versions',m.frameworkVersionId,actor),n=f.nodes.find(n=>n.id===m.competencyId&&n.kind==='competency');requireValue(n,'Compétence inconnue dans cette version du référentiel.');
  requireValue(Array.isArray(m.criteria)&&m.criteria.length&&unique(m.criteria.map(c=>c.criterionId)).length===m.criteria.length,'Critères distincts attendus.');
  requireValue(input.categories.some(c=>c.id===m.maximumGrade),'Niveau de demande de la compétence attendu.');
  const criteria=m.criteria.map(c=>{requireValue(n.criteria.some(k=>k.id===c.criterionId)&&Array.isArray(c.itemIds)&&c.itemIds.length&&unique(c.itemIds).length===c.itemIds.length&&c.itemIds.every(id=>ids.includes(id)),'Correspondance de critère invalide.');requireValue(input.categories.some(k=>k.id===c.maximumGrade)&&(!c.expectedGrade||input.categories.some(k=>k.id===c.expectedGrade)),'Niveaux du critère invalides.');validateGradeRules(c.rules||[],c.itemIds,input.categories);return {criterionId:c.criterionId,itemIds:c.itemIds,rules:gradeRules(c.rules),essential:c.essential===true,maximumGrade:c.maximumGrade,expectedGrade:c.expectedGrade||null};});
  validateGradeRules(m.rules||[],unique(criteria.flatMap(c=>c.itemIds)),input.categories);
  competencies.push({frameworkVersionId:f.id,competencyId:n.id,criteria,rules:gradeRules(m.rules),maximumGrade:m.maximumGrade});
 }
 requireValue(unique(competencies.map(m=>m.frameworkVersionId+':'+m.competencyId)).length===competencies.length,'Compétence évaluée en double.');
 const links=[];for(const l of input.links||[]){requireValue(['planned','worked'].includes(l.kind),'Lien pédagogique invalide.');const f=await scoped(tx,'framework_versions',l.frameworkVersionId,actor);requireValue(f.nodes.some(n=>n.id===l.competencyId),'Compétence du lien introuvable.');links.push({kind:l.kind,frameworkVersionId:f.id,competencyId:l.competencyId});}
 requireValue(!input.mode||['numeric','ordinal'].includes(input.mode),'Mode de grille invalide.');
 return {mode:input.mode||'numeric',categories:input.categories.map(c=>({id:c.id,order:c.order,description:c.description})),items:input.items.map(i=>({id:i.id,coefficient:i.coefficient,exemptible:i.exemptible===true})),rounding,roundBeforeGrade:input.roundBeforeGrade===true,globalRules:gradeRules(input.globalRules),competencies,links,situationId:input.situationId,allowedHelp:String(input.allowedHelp||'')};
}
export async function evaluateCorrection(tx,submission,correction,input={}){
 const grid=submission.competencyGrid||null;
 delete correction.manualGrade;correction.level=null;correction.grade=null;correction.gradeStatus='Grade à déterminer';correction.competencyResults=[];
 if(!grid){
  if(input.manualGrade){const manual=input.manualGrade;validateCategories(manual.categories);requireValue(manual.categories.some(c=>c.id===manual.grade)&&manual.reason?.trim(),'Définissez l’échelle, le grade et la justification de la décision manuelle.');requireValue(correction.status==='approved','Une correction professeur est requise.');correction.categories=manual.categories.map(c=>({id:c.id,order:c.order,description:c.description}));correction.grade=correction.level=manual.grade;correction.gradeStatus='observed';correction.gradeReasons=[manual.reason];correction.manualGrade={grade:manual.grade,reason:manual.reason,authorId:correction.approvedBy};}
  return;
 }
 for(const item of correction.items){const configured=grid.items.find(i=>i.id===item.id),edited=input.items?.find(i=>i.id===item.id);item.coefficient=configured?.coefficient??1;item.exemptible=configured?.exemptible===true;if(edited&&Object.hasOwn(edited,'observedGrade')){requireValue(edited.observedGrade===null||grid.categories.some(c=>c.id===edited.observedGrade),'Observation ordinale invalide.');item.observedGrade=edited.observedGrade;} if(edited?.exempt){requireValue(configured?.exemptible&&typeof edited.exemptionReason==='string'&&edited.exemptionReason.trim(),'Exemption non prévue ou non justifiée.');item.exempt=true;item.exemptionReason=edited.exemptionReason;}else{item.exempt=false;delete item.exemptionReason;}}
 const frameworks=await Promise.all(unique(grid.competencies.map(m=>m.frameworkVersionId)).map(id=>tx.get('framework_versions',id)));
 const result=calculateGrid(grid,correction.items,frameworks);
 correction.score=result.score.score;correction.scoreMax=result.score.maximum;correction.partialScore=result.score.partial;correction.level=result.grade;correction.grade=result.grade;correction.gradeStatus=result.status;correction.gradeReasons=result.reasons;correction.gradeRule=result.rule;correction.competencyResults=result.observations;correction.categories=grid.categories;correction.gridId=grid.id;correction.gradingMode=grid.mode||'numeric';
 correction.criteria=result.observations.map(o=>({criterion:o.code||o.competencyId,points:null,max:null,level:o.grade||'NE'}));
 if(input.manualGrade){requireValue(grid.categories.some(c=>c.id===input.manualGrade.grade)&&input.manualGrade.reason?.trim(),'Grade manuel et motif attendus.');requireValue(result.score.complete||grid.mode==='ordinal'&&correction.items.every(i=>i.observedGrade),'Finalisez la correction avant un grade manuel.');correction.grade=correction.level=input.manualGrade.grade;correction.manualGrade={grade:input.manualGrade.grade,reason:input.manualGrade.reason,authorId:correction.approvedBy};correction.gradeReasons=[input.manualGrade.reason];}
 for(const manual of input.manualCompetencies||[]){const o=result.observations.find(o=>o.frameworkVersionId===manual.frameworkVersionId&&o.competencyId===manual.competencyId);requireValue(o&&grid.categories.some(c=>c.id===manual.grade)&&manual.reason?.trim(),'Décision de compétence manuelle invalide.');requireValue(o.criteria.some(c=>c.grade||c.itemIds.some(id=>correction.items.some(i=>i.id===id&&(i.points!==null&&Number.isFinite(i.points)||i.observedGrade)))),'Une observation manuelle exige des critères évalués.');const mapping=grid.competencies.find(m=>m.frameworkVersionId===o.frameworkVersionId&&m.competencyId===o.competencyId);requireValue(grid.categories.find(c=>c.id===manual.grade).order<=grid.categories.find(c=>c.id===mapping.maximumGrade).order,'Ce niveau dépasse la demande de la situation.');o.grade=manual.grade;o.status='observed';o.manual={reason:manual.reason,authorId:correction.approvedBy};o.reasons=[manual.reason];}
 correction.autonomy=input.autonomy||'unknown';
 if(correction.status!=='approved')return;
 const attempt=await tx.get('assessment_attempts',submission.attemptId);
 for(const observation of result.observations){
  const id='observation_'+digest([submission.id,correction.version,observation.frameworkVersionId,observation.competencyId]);
  await tx.insert('competency_observations',{...observation,id,classId:submission.classId,learnerId:submission.learnerId,submissionId:submission.id,assignmentId:attempt.assignmentId,runId:attempt.runId,attemptId:attempt.id,correctionVersion:correction.version,gridId:grid.id,scaleKey:digest(grid.categories),categories:grid.categories,situationId:grid.situationId,workedAt:submission.submittedAt||null,correctedAt:correction.approvedAt,autonomy:input.autonomy==='demonstrated'?'demonstrated':input.autonomy==='assisted'?'assisted':'unknown',allowedHelp:grid.allowedHelp,validated:true,practice:attempt.mode==='practice',afterCorrection:attempt.afterCorrection===true});
 }

}
export async function observationVisible(tx,o,actor){
 if(actor.role==='teacher')return o.classId===actor.classId;
 if(o.learnerId!==actor.id)return false;
 try{await assignmentAccess(tx,o.assignmentId,actor);}catch{return false;}
 const p=await tx.get('result_publications',o.submissionId);return p?.version===o.correctionVersion||p?.publishedVersions?.includes(o.correctionVersion)||false;
}
export async function latestObservations(tx,classId,learnerId){
 const out=[];for(const o of await tx.list('competency_observations',classId)){if(o.learnerId!==learnerId)continue;const c=await tx.get('corrections',o.submissionId);if(c?.version===o.correctionVersion)out.push(o);}return out.sort(newest);
}
export async function saveMasteryRule(tx,actor,input){
 const f=await scoped(tx,'framework_versions',input.frameworkVersionId,actor),node=f.nodes.find(n=>n.id===input.competencyId);requireValue(node?.kind==='competency','Compétence attendue.');validateCategories(input.categories);
 const prior=(await tx.list('mastery_rules',actor.classId)).filter(r=>r.frameworkVersionId===f.id&&r.competencyId===node.id).at(-1);
 if((input.version||0)!==(prior?.version||0))fail(409,'La règle a changé.');
 const min=input.minSituations??2;requireValue(Number.isInteger(min)&&min>=2&&min<=10,'Entre deux et dix situations indépendantes.');
 requireValue(Array.isArray(input.criteria)&&input.criteria.length&&input.criteria.some(c=>c.essential)&&unique(input.criteria.map(c=>c.id)).length===input.criteria.length,'Définissez les critères requis et essentiels.');
 for(const c of input.criteria)requireValue(node.criteria.some(n=>n.id===c.id)&&(c.essential||Number.isInteger(c.minSituations)&&c.minSituations>=1&&c.minSituations<=10),'Critère requis invalide.');
 const row=await tx.insert('mastery_rules',{id:uid('mastery-rule'),classId:actor.classId,frameworkVersionId:f.id,competencyId:node.id,categories:input.categories,scaleKey:digest(input.categories),criteria:input.criteria.map(c=>({id:c.id,essential:c.essential===true,minSituations:c.essential?min:c.minSituations})),minSituations:min,requireAutonomy:input.requireAutonomy!==false,version:(prior?.version||0)+1,authorId:actor.id});
 await invalidateDerived(tx,actor.classId);return row;
}
export async function currentRule(tx,table,row,keys){return (await tx.list(table,row.classId)).filter(r=>keys.every(k=>r[k]===row[k])).sort((a,b)=>a.version-b.version).at(-1);}
export async function evidenceCurrent(tx,proofs){for(const p of proofs){const o=await tx.get('competency_observations',p.id),c=await tx.get('corrections',p.submissionId);if(!o||c?.version!==p.correctionVersion||o.gridId!==p.gridId)return false;}return true;}
export async function decisionCurrent(tx,d){const rule=await tx.get('mastery_rules',d.ruleId);if(!rule)return false;const mappings=(await tx.list('framework_mappings',d.classId)).filter(m=>m.toFrameworkId===d.frameworkVersionId&&m.toCompetencyId===d.competencyId);const observations=(await latestObservations(tx,d.classId,d.learnerId)).filter(o=>o.frameworkVersionId===d.frameworkVersionId&&o.competencyId===d.competencyId||mappings.some(m=>m.fromFrameworkId===o.frameworkVersionId&&m.fromCompetencyId===o.competencyId));if(digest(unique(observations.map(o=>o.id)).sort())!==digest(unique(d.observationIds||[]).sort()))return false;return rule&&(await currentRule(tx,'mastery_rules',rule,['frameworkVersionId','competencyId']))?.id===rule.id&&await evidenceCurrent(tx,d.proofs);}
export async function proposeMastery(tx,actor,input){
 await learnerInScope(tx,input.learnerId,actor);const rule=await scoped(tx,'mastery_rules',input.ruleId,actor);requireValue((await currentRule(tx,'mastery_rules',rule,['frameworkVersionId','competencyId'])).id===rule.id,'Utilisez la règle actuelle.');
 const all=await latestObservations(tx,actor.classId,input.learnerId),observations=all.filter(o=>o.frameworkVersionId===rule.frameworkVersionId&&o.competencyId===rule.competencyId);
 // A validated mapping is required across versions. It preserves the original evidence identity.
 const mappings=(await tx.list('framework_mappings',actor.classId)).filter(m=>m.toFrameworkId===rule.frameworkVersionId&&m.toCompetencyId===rule.competencyId);
 for(const m of mappings)for(const o of all.filter(o=>o.frameworkVersionId===m.fromFrameworkId&&o.competencyId===m.fromCompetencyId))observations.push({...o,criteria:o.criteria.filter(c=>m.criteria[c.criterionId]).map(c=>({...c,criterionId:m.criteria[c.criterionId]})),mappingId:m.id});
 const history=(await tx.list('mastery_decisions',actor.classId)).filter(d=>d.learnerId===input.learnerId&&d.frameworkVersionId===rule.frameworkVersionId&&d.competencyId===rule.competencyId),retained=history.filter(d=>d.publishedAt).at(-1),calculation=consolidate(observations,rule,retained);
 const key=digest([rule.id,observations.map(o=>[o.id,o.mappingId||null]).sort(),retained?.id||null]),existing=history.find(d=>d.inputHash===key);if(existing)return existing;
 return tx.insert('mastery_decisions',{...calculation,id:uid('mastery'),classId:actor.classId,learnerId:input.learnerId,frameworkVersionId:rule.frameworkVersionId,competencyId:rule.competencyId,ruleId:rule.id,rule:structuredClone(rule),inputHash:key,observationIds:observations.map(o=>o.id),mappingIds:unique(observations.map(o=>o.mappingId).filter(Boolean)),state:'proposed',authorId:actor.id});
}
export async function validateDecision(tx,actor,id,input){
 const d=await scoped(tx,'mastery_decisions',id,actor);requireValue(!d.publishedAt,'Créez une nouvelle proposition pour réviser un niveau publié.');
 if(!await decisionCurrent(tx,d))fail(409,'Les preuves ou la règle ont changé. Recalculez la proposition.');
 const grade=input.grade||d.grade;requireValue(d.rule.categories.some(c=>c.id===grade),'Niveau à déterminer.');string(input.reason,'Justifiez la décision.');
 if(grade!==d.grade||d.status!=='À valider')requireValue(input.manual===true,'Cette proposition nécessite une décision manuelle explicite.');
 if(!d.proofs.length&&input.manual===true)for(const id of d.observationIds){const o=await tx.get('competency_observations',id);if(o?.validated&&!o.practice)d.proofs.push({id:o.id,submissionId:o.submissionId,correctionVersion:o.correctionVersion,gridId:o.gridId,workedAt:o.workedAt});}
 requireValue(d.proofs.length>0,'Une décision de niveau exige au moins une preuve évaluée.');
 d.grade=grade;d.reason=input.reason;d.manual=input.manual===true;d.state='validated';d.validatedAt=now();d.validatedBy=actor.id;await tx.put('mastery_decisions',d);await tx.audit(actor,'mastery.validated',id);return d;
}
export async function publishDecision(tx,actor,id){
 const d=await scoped(tx,'mastery_decisions',id,actor);if(d.publishedAt)return d;
 if(d.state==='stale')fail(409,'La proposition est obsolète. Recalculez-la.');
 requireValue(d.state==='validated','Validez cette proposition avant publication.');
 if(!await decisionCurrent(tx,d))fail(409,'La proposition est obsolète. Recalculez-la.');
 for(const proof of d.proofs){const o=await tx.get('competency_observations',proof.id);if(!await observationVisible(tx,o,{id:d.learnerId,role:'student'}))fail(409,'Publiez les révisions exactes des preuves avant cette décision.');}
 d.state='published';d.publishedAt=now();d.publishedBy=actor.id;await tx.put('mastery_decisions',d);await tx.audit(actor,'mastery.published',id);return d;
}
export async function invalidateDerived(tx,classId){
 for(const d of await tx.list('mastery_decisions',classId))if(!d.publishedAt&&!await decisionCurrent(tx,d)){d.state='stale';d.status='À recalculer';await tx.put('mastery_decisions',d);}
 for(const p of await tx.list('adaptation_proposals',classId)){
  const rule=await tx.get('adaptation_rules',p.ruleId),active=rule&&await currentRule(tx,'adaptation_rules',rule,['runId','activityId']);
  if(await pathCurrent(tx,p))continue;
  if(['closed','teacher_required','dismissed'].includes(p.state))continue;
  let started=false;if(p.assignmentId){const a=await tx.get('lesson_assignments',p.assignmentId),progress=await tx.get('learning_progress',a.progressId||a.id);started=!!progress?.answers?.[p.activityId]||progress?.completed?.includes(p.activityId)||(await tx.list('assessment_attempts',classId)).some(t=>t.assignmentId===a.id);}
  if(started)p.contextPreserved=true;else p.state='reconsider';await tx.put('adaptation_proposals',p);
 }
}
export async function competencyView(tx,actor,learnerId){
 if(actor.role==='student'){if(learnerId!==actor.id)fail(404,'Suivi introuvable.');}else await learnerInScope(tx,learnerId,actor);
 const rows=await tx.list('competency_observations',actor.role==='teacher'?actor.classId:undefined),observations=[];
 for(const o of rows.filter(o=>o.learnerId===learnerId))if(await observationVisible(tx,o,actor)&&(actor.role==='student'||(await tx.get('corrections',o.submissionId))?.version===o.correctionVersion))observations.push(o);
 const decisions=[];
 for(const d of (await tx.list('mastery_decisions',actor.role==='teacher'?actor.classId:undefined)).filter(d=>d.learnerId===learnerId)){
  if(actor.role==='teacher'){decisions.push({...d,stale:!d.publishedAt&&!await decisionCurrent(tx,d)});continue;}
  if(!d.publishedAt)continue;
  // A later private correction must not erase an earlier published decision.
  let allowed=true;for(const p of d.proofs){const o=await tx.get('competency_observations',p.id);try{await assignmentAccess(tx,o.assignmentId,actor);}catch{allowed=false;}const pub=await tx.get('result_publications',p.submissionId);if(!pub||(pub.version!==p.correctionVersion&&!pub.publishedVersions?.includes(p.correctionVersion)))allowed=false;}
  if(allowed)decisions.push({id:d.id,frameworkVersionId:d.frameworkVersionId,competencyId:d.competencyId,grade:d.grade,reason:d.reason,publishedAt:d.publishedAt,proofs:d.proofs,rule:d.rule,lastWorkedAt:d.lastWorkedAt});
 }
 const frameworkIds=unique([...observations.map(o=>o.frameworkVersionId),...decisions.map(d=>d.frameworkVersionId)]),frameworks=actor.role==='teacher'?await tx.list('framework_versions',actor.classId):await Promise.all(frameworkIds.map(id=>tx.get('framework_versions',id)));
 const competencies=[];
 for(const f of frameworks)for(const n of f.nodes.filter(n=>n.kind==='competency')){
  const os=observations.filter(o=>o.frameworkVersionId===f.id&&o.competencyId===n.id).sort(newest),ds=decisions.filter(d=>d.frameworkVersionId===f.id&&d.competencyId===n.id);
  if(actor.role==='student'&&!os.length&&!ds.length)continue;
  competencies.push({frameworkVersionId:f.id,frameworkTitle:f.title,sourceVersion:f.sourceVersion,id:n.id,code:n.code,title:n.studentLabel||n.title,expectedLevel:n.expectedLevel,parentId:n.parentId,latest:os[0]||null,retained:ds.filter(d=>d.publishedAt).at(-1)||null,proposal:actor.role==='teacher'?ds.filter(d=>!d.publishedAt).at(-1)||null:null,observations:os.map(o=>actor.role==='teacher'?o:{id:o.id,submissionId:o.submissionId,attemptId:o.attemptId,grade:o.grade,criteria:o.criteria,coverage:o.coverage,rule:o.rule,workedAt:o.workedAt}),decisions:ds,coverage:coverage(n,unique(os.flatMap(o=>o.criteria.map(c=>c.criterionId))).map(id=>os.flatMap(o=>o.criteria).find(c=>c.criterionId===id)))});
 }
 return {competencies};
}
