import {teacher,student} from './auth.mjs';
import {defaultFrameworkId,ensureDefaultFramework} from './default-framework.mjs';
import {scoped,requireValue,fail,uid,now} from './store.mjs';
import {assignmentAccess,pageRows} from './student-tracking.mjs';
import {currentActor,learnerInScope,validateFramework,importFramework,curriculumFramework,activeGrid,saveGrid,saveMasteryRule,proposeMastery,validateDecision,publishDecision,competencyView,observationVisible,invalidateDerived,evidenceCurrent} from './competency-service.mjs';
import {saveAdaptationRule,proposePath,applyAutomaticIfEnabled,configureAutomatic,activatePath,beginVerification,verifyPath,classReadiness} from './adaptive-paths.mjs';
export function competencyRoutes(app,store){
 app.use('/api/competencies',async(req,_res,next)=>{if(req.user?.role==='teacher')await ensureDefaultFramework(store,req.user);next();});
 const mutate=fn=>async(req,res)=>res.json(await store.transaction(async tx=>{await currentActor(tx,req.user);return fn(tx,req.user,req);}));
 app.get('/api/competencies/config',teacher,async(req,res)=>{
  const classId=req.user.classId,frameworks=await store.list('framework_versions',classId),rules=await store.list('mastery_rules',classId),runs=[];
  const defaultId=defaultFrameworkId(classId);frameworks.sort((a,b)=>Number(b.id===defaultId)-Number(a.id===defaultId));
  for(const run of await store.list('lesson_runs',classId)){const v=await store.get('lesson_versions',run.lessonVersionId);if(v)runs.push({id:run.id,title:v.spec.title,date:run.date,lessonVersionId:v.id,activities:v.spec.activities.map(a=>({id:a.id,title:a.title})),rubric:v.spec.diagnostic.rubric.map(i=>({id:i.id,label:i.label,max:i.max,taskId:i.taskId,criterion:i.criterion})),grid:await activeGrid(store,v.id)});}
  res.json({frameworks,defaultFrameworkId:defaultId,rules,runs,adaptationRules:await store.list('adaptation_rules',classId),curricula:(await store.list('curriculum_versions',classId)).map(c=>({id:c.id,version:c.version,count:c.criteria.length,sha256:c.sha256})),unresolved:(await store.list('competency_grids',classId)).filter(g=>g.unresolved).map(g=>({id:g.id,lessonVersionId:g.lessonVersionId,reason:g.unresolved}))});
 });
 app.post('/api/competencies/frameworks/preview',teacher,async(req,res)=>res.json({framework:req.body.curriculumId?await curriculumFramework(store,req.user,req.body.curriculumId):validateFramework(req.body),warnings:['Les critères sans ensemble exhaustif ne produisent pas de dénominateur officiel. Les correspondances de correction restent à configurer.']}));
 app.post('/api/competencies/frameworks',teacher,mutate((tx,a,r)=>importFramework(tx,a,r.body)));
 app.post('/api/competencies/grids',teacher,mutate((tx,a,r)=>saveGrid(tx,a,r.body)));
 app.post('/api/competencies/rules',teacher,mutate((tx,a,r)=>saveMasteryRule(tx,a,r.body)));
 app.post('/api/competencies/mappings',teacher,mutate(async(tx,a,r)=>{
  const input=r.body,from=await scoped(tx,'framework_versions',input.fromFrameworkId,a),to=await scoped(tx,'framework_versions',input.toFrameworkId,a),source=from.nodes.find(n=>n.id===input.fromCompetencyId),target=to.nodes.find(n=>n.id===input.toCompetencyId);
  requireValue(source&&target&&input.reason?.trim()&&input.confirmed===true,'Vérifiez et justifiez la correspondance de versions.');requireValue(input.criteria&&Object.entries(input.criteria).length&&Object.entries(input.criteria).every(([s,t])=>source.criteria.some(c=>c.id===s)&&target.criteria.some(c=>c.id===t)),'Correspondance de critères invalide.');
  requireValue(new Set(Object.values(input.criteria)).size===Object.values(input.criteria).length,'Deux critères ne peuvent être fusionnés implicitement.');
  return tx.insert('framework_mappings',{id:uid('mapping'),classId:a.classId,fromFrameworkId:from.id,toFrameworkId:to.id,fromCompetencyId:source.id,toCompetencyId:target.id,criteria:input.criteria,reason:input.reason,validatedBy:a.id,validatedAt:now()});
 }));
 app.get('/api/competencies/students/:id',teacher,async(req,res)=>res.json(await competencyView(store,req.user,req.params.id)));
 app.get('/api/competencies/mine',student,async(req,res)=>res.json(await competencyView(store,req.user,req.user.id)));
 app.get('/api/competencies/observations/:id',async(req,res)=>{
  if(!req.user)fail(401,'Connectez-vous.');const o=await store.get('competency_observations',req.params.id);if(!o||!await observationVisible(store,o,req.user))fail(404,'Preuve introuvable.');
  res.json(req.user.role==='teacher'?o:{id:o.id,grade:o.grade,code:o.code,title:o.title,workedAt:o.workedAt,criteria:o.criteria,coverage:o.coverage,rule:o.rule,attemptId:o.attemptId});
 });
 app.get('/api/competencies/matrix',teacher,async(req,res)=>{
  const frameworks=await store.list('framework_versions',req.user.classId),assignments=await store.list('lesson_assignments',req.user.classId),ids=new Set(assignments.filter(a=>!req.query.runId||a.runId===req.query.runId).map(a=>a.learnerId)),rows=[];
  for(const id of ids){const l=await store.get('learners',id);if(!l||req.query.q&&!l.displayName.toLocaleLowerCase('fr').includes(String(req.query.q).toLocaleLowerCase('fr')))continue;
   const view=await competencyView(store,req.user,id);if(req.query.from||req.query.to)for(const c of view.competencies){c.observations=c.observations.filter(o=>o.workedAt&&(!req.query.from||o.workedAt.slice(0,10)>=req.query.from)&&(!req.query.to||o.workedAt.slice(0,10)<=req.query.to));c.latest=c.observations[0]||null;}rows.push({learnerId:id,displayName:l.displayName,competencies:view.competencies.filter(c=>(!req.query.competencyId||c.id===req.query.competencyId)&&(!req.query.expectedLevel||c.expectedLevel===req.query.expectedLevel))});}
  const grids=await store.list('competency_grids',req.user.classId);res.json({rows:pageRows(rows,req.query),frameworks,coverage:frameworks.flatMap(f=>f.nodes.filter(n=>n.kind==='competency').map(n=>({frameworkVersionId:f.id,competencyId:n.id,planned:grids.some(g=>g.links?.some(l=>l.frameworkVersionId===f.id&&l.competencyId===n.id&&l.kind==='planned')),worked:grids.some(g=>g.links?.some(l=>l.frameworkVersionId===f.id&&l.competencyId===n.id&&l.kind==='worked')),evaluated:grids.some(g=>g.competencies?.some(l=>l.frameworkVersionId===f.id&&l.competencyId===n.id))})))});
 });
 app.post('/api/competencies/proposals',teacher,mutate((tx,a,r)=>proposeMastery(tx,a,r.body)));
 app.post('/api/competencies/decisions/:id/validate',teacher,mutate((tx,a,r)=>validateDecision(tx,a,r.params.id,r.body)));
 app.post('/api/competencies/decisions/:id/publish',teacher,mutate((tx,a,r)=>publishDecision(tx,a,r.params.id)));
 app.post('/api/competencies/decisions/batch',teacher,async(req,res)=>{
  requireValue(Array.isArray(req.body.decisions)&&req.body.decisions.length<=100,'Sélectionnez au plus 100 décisions.');const results=[];
  for(const d of req.body.decisions)try{const value=await store.transaction(async tx=>{await currentActor(tx,req.user);if(req.body.action==='publish')return publishDecision(tx,req.user,d.id);return validateDecision(tx,req.user,d.id,d);});results.push({id:d.id,status:'done',value});}catch(e){results.push({id:d.id,status:'failed',error:e.status?e.message:'Action indisponible.'});}res.json({results});
 });
 app.post('/api/competencies/adaptation/rules',teacher,mutate((tx,a,r)=>saveAdaptationRule(tx,a,r.body)));
 app.post('/api/competencies/adaptation/proposals',teacher,mutate(async(tx,a,r)=>applyAutomaticIfEnabled(tx,a,await proposePath(tx,a,r.body))));
 app.get('/api/competencies/adaptation/runs/:id',teacher,async(req,res)=>{
  await scoped(store,'lesson_runs',req.params.id,req.user);const rules=(await store.list('adaptation_rules',req.user.classId)).filter(r=>r.runId===req.params.id),proposals=(await store.list('adaptation_proposals',req.user.classId)).filter(p=>p.runId===req.params.id);res.json({rules,proposals,authorization:await store.get('adaptation_authorizations','automatic:'+req.params.id),summary:await Promise.all(rules.map(async r=>({ruleId:r.id,...await classReadiness(store,req.user,r.id)})))});
 });
 app.post('/api/competencies/adaptation/runs/:id/automatic',teacher,mutate((tx,a,r)=>configureAutomatic(tx,a,r.params.id,r.body)));
 app.post('/api/competencies/adaptation/:id/activate',teacher,mutate((tx,a,r)=>activatePath(tx,a,r.params.id,r.body)));
 app.post('/api/competencies/adaptation/:id/adjust',teacher,mutate(async(tx,a,r)=>{const p=await scoped(tx,'adaptation_proposals',r.params.id,a),rule=await scoped(tx,'adaptation_rules',p.ruleId,a);requireValue(!p.assignmentId&&p.state==='suggested','Seule une proposition non attribuée peut être modifiée.');requireValue(['ready','fragile','verify','insufficient','extension'].includes(r.body.target)&&rule.targets[r.body.target]&&r.body.reason?.trim(),'Choisissez une activité approuvée et justifiez le changement.');p.target=rule.targets[r.body.target];p.activityId=p.target.activityId;p.missingActivity=false;p.adjustment={target:r.body.target,reason:r.body.reason,authorId:a.id,at:now()};await tx.put('adaptation_proposals',p);await tx.audit(a,'adaptation.adjusted',p.id);return p;}));
 app.post('/api/competencies/adaptation/:id/dismiss',teacher,mutate(async(tx,a,r)=>{const p=await scoped(tx,'adaptation_proposals',r.params.id,a);requireValue(!p.assignmentId,'Un travail attribué conserve son historique.');p.state='dismissed';p.dismissalReason=String(r.body.reason||'Proposition écartée par le professeur.');await tx.put('adaptation_proposals',p);return p;}));
 app.post('/api/competencies/adaptation/:id/verification',teacher,mutate((tx,a,r)=>beginVerification(tx,a,r.params.id)));
 app.post('/api/competencies/adaptation/:id/verify',teacher,mutate((tx,a,r)=>verifyPath(tx,a,r.params.id,r.body)));
 app.get('/api/competencies/next',student,async(req,res)=>{
  const items=[];for(const p of await store.list('adaptation_proposals')){if(p.learnerId!==req.user.id||!p.assignmentId)continue;try{await assignmentAccess(store,p.assignmentId,req.user);await assignmentAccess(store,p.sourceAssignmentId,req.user);}catch{continue;}
   const rule=await store.get('adaptation_rules',p.ruleId),checking=p.state==='verification',continuing=p.state==='closed'&&p.continuationAssignmentId,target=continuing?rule.targets.ready:checking?rule.targets.verify:p.target;const needsReview=p.state==='reconsider'||continuing&&!await evidenceCurrent(store,p.verification.proofs);
   try{await assignmentAccess(store,continuing?p.continuationAssignmentId:checking?p.verificationAssignmentId:p.assignmentId,req.user);}catch{continue;}
   items.push({id:p.id,title:target.title,assignmentId:continuing?p.continuationAssignmentId:checking?p.verificationAssignmentId:p.assignmentId,activityId:target.activityId,continuation:p.continuation,status:needsReview?'À réexaminer avec le professeur':p.state==='teacher_required'?'À revoir avec le professeur':p.state==='closed'?'Prêt à poursuivre':checking?'Vérification':'Activité proposée',canStart:!needsReview&&p.state!=='teacher_required'});
  }res.json({items});
 });
 app.post('/api/competencies/runs/:id/formative',teacher,mutate(async(tx,a,r)=>{
  const run=await scoped(tx,'lesson_runs',r.params.id,a);requireValue(!(await tx.list('assessment_attempts',a.classId)).some(t=>t.runId===run.id),'Le mode formatif doit être fixé avant la première tentative.');
  requireValue(r.body.enabled===false||r.body.confirmed===true,'Confirmez la visibilité immédiate des notes, grades et retours de ce diagnostic.');
  run.formativePolicy={enabled:r.body.enabled===true,grades:true,solutions:false,configuredAt:now(),authorId:a.id};await tx.put('lesson_runs',run);return run.formativePolicy;
 }));
}
