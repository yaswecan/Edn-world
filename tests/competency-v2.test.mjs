import test from 'node:test';
import assert from 'node:assert/strict';
import {competencyFixture,frameworkInput,gridInput,categories} from './fixtures/competency-v2.mjs';
import {calculateGrid,selectGrade,scoreItems,coverage,consolidate} from '../server/competency-calculations.mjs';
import {digest,validateFramework} from '../server/competency-service.mjs';
import {configureAutomatic,activatePath} from '../server/adaptive-paths.mjs';
import {exportPedagogy,importPedagogy} from '../server/competency-transfer.mjs';
const values=points=>points.map((p,i)=>({id:'r'+(i+1),points:p,max:[8,4,8][i]}));
const framework={...validateFramework(frameworkInput),id:'fixture'};
const grid=gridInput('fixture');

test('AC21 exact codes, internal identity, hierarchy, provenance and version collisions',async t=>{
 const f=await competencyFixture(t),copy=structuredClone(frameworkInput);copy.frameworkKey='second-source';copy.nodes[0].code='001.01';
 const second=await f.ok('/api/competencies/frameworks',copy);assert.equal(second.nodes[0].code,'001.01');assert.equal(f.framework.nodes[0].expectedLevel,'N2');assert.notEqual(second.id,f.framework.id);
 assert.equal((await f.ok('/api/competencies/frameworks',copy)).id,second.id);copy.nodes[0].title='Autre sens';assert.equal((await f.post('/api/competencies/frameworks',copy)).status,409);
 copy.sourceVersion='2';assert.notEqual((await f.ok('/api/competencies/frameworks',copy)).id,second.id);
 assert.equal((await f.post('/api/competencies/frameworks',copy,'alice')).status,403);
});
test('AC22 AC23 AC24 14/20 remains EC, criteria yield A1 and EC without global propagation',()=>{
 const result=calculateGrid(grid,values([8,1,5]),[framework]);assert.equal(result.score.score,14);assert.equal(result.grade,'EC');assert.match(result.reasons.join(' '),/Q2 essentielle/);assert.deepEqual(result.observations.map(o=>o.grade),['A1','EC']);
 const multiple=structuredClone(grid);multiple.competencies[1].criteria.push({...multiple.competencies[0].criteria[0],criterionId:'alternative'});
 assert.equal(calculateGrid(multiple,values([8,1,5]),[framework]).score.score,14);
 const planned={...grid,competencies:[],links:[{kind:'planned',frameworkVersionId:'fixture',competencyId:'conditions'}]};assert.deepEqual(calculateGrid(planned,values([8,1,5]),[framework]).observations,[]);
});
test('AC25 exact thresholds, inclusive/exclusive edges, coefficients, rounding and incomplete denominators',()=>{
 assert.equal(calculateGrid(grid,values([6,3,5]),[framework]).grade,'A1');const partial=calculateGrid(grid,values([8,null,5]),[framework]);assert.equal(partial.score.score,null);assert.equal(partial.score.maximum,20);assert.equal(partial.grade,null);
 const rules=[{grade:'A1',conditions:[{itemIds:['x'],metric:'points',op:'gt',value:3}]}];assert.equal(selectGrade(rules,[{id:'x',points:3,max:4}],categories).grade,null);assert.equal(selectGrade(rules,[{id:'x',points:3.001,max:4}],categories).grade,'A1');
 assert.equal(scoreItems([{id:'x',points:1.235,max:2,coefficient:2}],{digits:1,mode:'nearest'}).score,2.5);
 const near=[{grade:'A1',conditions:[{itemIds:['x'],metric:'points',op:'gte',value:3}]}];assert.equal(selectGrade(near,[{id:'x',points:2.999,max:4}],categories,{rounding:{digits:2,mode:'nearest'}}).grade,null);
 assert.equal(selectGrade([],[{points:20,max:20}],categories).status,'Grade à déterminer');
});
test('AC26 coverage is partial and deduplicated; local subdivisions never increase official totals',()=>{
 const node={criteria:Array.from({length:7},(_,i)=>({id:'c'+i,origin:'source'})).concat({id:'local',origin:'local'}),criterionSet:{name:'Source exhaustive',version:'1',exhaustive:true,criterionIds:['c0','c1','c2','c3','c4','c5','c6','c0','local']}};
 const result=coverage(node,[0,1,2,2].map(i=>({criterionId:'c'+i,grade:'A1',meetsExpected:true})));assert.equal(result.observed,3);assert.equal(result.total,7);assert.equal(result.partial,true);assert.equal(coverage({...node,criterionSet:null},[]).total,null);
});
const rule={categories,scaleKey:digest(categories),criteria:[{id:'comparisons',essential:true,minSituations:2}],minSituations:2,requireAutonomy:true};
const observation=(id,date,situationId=id,grade='A1',autonomy='demonstrated')=>({id,workedAt:date,situationId,validated:true,scaleKey:rule.scaleKey,autonomy,grade,criteria:[{criterionId:'comparisons',grade,maximumGrade:'A1'}],submissionId:id,correctionVersion:2,gridId:'grid'});
test('AC27 clones, ten executions and attempts are one pedagogical situation; two independent situations confirm',()=>{
 const copies=Array.from({length:10},(_,i)=>observation('copy'+i,`2026-10-${String(i+1).padStart(2,'0')}`,'same-origin'));assert.equal(consolidate(copies,rule).grade,null);
 const result=consolidate([...copies,observation('independent','2026-10-11')],rule);assert.equal(result.grade,'A1');assert.equal(result.proofs.length,2);assert.equal(result.excluded.length,9);
});
test('AC28 allowed help is compatible with autonomy; unknown autonomy and limited tasks do not demonstrate more',()=>{
 const os=[observation('a','2026-10-01','a','A1','unknown'),observation('b','2026-10-02','b','A1','unknown')];assert.equal(consolidate(os,rule).grade,null);os[0].autonomy='demonstrated';os[0].allowedHelp='Reformulation autorisée';assert.equal(consolidate(os,rule).grade,'A1');os[0].criteria[0].maximumGrade='EC';assert.equal(consolidate(os,rule).grade,'EC');
});
test('AC29 AC30 work chronology, stable ties, unknown dates and contradictions preserve retained level',()=>{
 const os=[observation('a','2026-10-02'),observation('z','2026-10-02'),observation('old','2026-09-01')];os[2].correctedAt='2099-01-01';assert.deepEqual(consolidate(os,rule).selection.comparisons,['z','a']);assert.deepEqual(consolidate([...os].reverse(),rule).selection.comparisons,['z','a']);
 assert.equal(consolidate([...os,observation('unknown',null)],rule).grade,null);
 const retained={grade:'A1',lastWorkedAt:'2026-10-02'},r=consolidate([...os,observation('new','2026-10-03','new','EC')],rule,retained);assert.equal(r.status,'À examiner');assert.equal(retained.grade,'A1');assert.equal(r.grade,'EC');
});
test('AC31 proof access, unpublished grade secrecy, exact revisions and separate mastery publication',async t=>{
 const f=await competencyFixture(t),one=await f.copy({publish:true}),two=await f.scenario('second'),copy2=await f.copy({assignmentId:two.assignment.id,publish:false}),rule=await f.masteryRule();
 const p=await f.ok('/api/competencies/proposals',{learnerId:'alice',ruleId:rule.id});assert.equal(p.grade,'A1');assert.equal(p.proofs.length,2);
 const student=(await f.call('/api/competencies/mine',{as:'alice'})).data;assert.equal(student.competencies.find(c=>c.id==='conditions').retained,null);assert.equal(JSON.stringify(student).includes(copy2.submission.submissionId),false);
 assert.equal((await f.call('/api/competencies/students/alice',{as:'outsider'})).status,404);
 assert.equal((await f.call('/api/competencies/observations/'+p.proofs[0].id,{as:'bob'})).status,404);
 await f.ok('/api/competencies/decisions/'+p.id+'/validate',{reason:'Deux situations relues'});assert.equal((await f.post('/api/competencies/decisions/'+p.id+'/publish')).status,409);
 const run=await f.store.get('lesson_runs',two.run.id);run.availability='closed';await f.store.put('lesson_runs',run);await f.ok('/api/tracking/submissions/'+copy2.submission.submissionId+'/publish',{version:copy2.correction.version});await f.ok('/api/competencies/decisions/'+p.id+'/publish');
 const result=(await f.call('/api/competencies/mine',{as:'alice'})).data;assert.equal(result.competencies.find(c=>c.id==='conditions').retained.grade,'A1');
 const revise=await f.ok('/api/teacher/submissions/'+one.submission.submissionId+'/correction',{version:one.correction.version,items:one.correction.items.map(i=>({id:i.id,points:0})),reason:'Nouvelle révision privée'});assert.equal(revise.version,3);
 assert.equal((await f.call('/api/competencies/mine',{as:'alice'})).data.competencies.find(c=>c.id==='conditions').retained.grade,'A1');
 await f.call('/api/tracking/assignments/'+f.assignment.id,{method:'PATCH',body:{access:'revoked'}});assert.equal((await f.call('/api/competencies/mine',{as:'alice'})).data.competencies.find(c=>c.id==='conditions').retained,null);
});
test('AC32 source versions require explicit validated criterion correspondence before reuse',async t=>{
 const f=await competencyFixture(t);await f.copy({publish:true});const second=await f.scenario('independent');await f.copy({assignmentId:second.assignment.id,publish:true});
 const next=await f.ok('/api/competencies/frameworks',{...frameworkInput,sourceVersion:'2'}),r=await f.ok('/api/competencies/rules',{frameworkVersionId:next.id,competencyId:'conditions',categories,criteria:[{id:'comparisons',essential:true}]});
 assert.equal((await f.ok('/api/competencies/proposals',{learnerId:'alice',ruleId:r.id})).grade,null);
 await f.ok('/api/competencies/mappings',{fromFrameworkId:f.framework.id,toFrameworkId:next.id,fromCompetencyId:'conditions',toCompetencyId:'conditions',criteria:{comparisons:'comparisons'},confirmed:true,reason:'Critère relu dans les deux versions'});
 assert.equal((await f.ok('/api/competencies/proposals',{learnerId:'alice',ruleId:r.id})).grade,'A1');
});
test('AC33 concurrent correction prevents validation and publication of stale proposals',async t=>{
 const f=await competencyFixture(t),copy=await f.copy({publish:true}),second=await f.scenario('second');await f.copy({assignmentId:second.assignment.id,publish:true});const rule=await f.masteryRule(),p=await f.ok('/api/competencies/proposals',{learnerId:'alice',ruleId:rule.id});await f.ok('/api/competencies/decisions/'+p.id+'/validate',{reason:'Deux preuves relues'});
 await f.ok('/api/teacher/submissions/'+copy.submission.submissionId+'/correction',{version:copy.correction.version,items:copy.correction.items.map(i=>({id:i.id,points:0})),reason:'Correction concurrente'});
 assert.equal((await f.post('/api/competencies/decisions/'+p.id+'/publish')).status,409);assert.equal((await f.store.get('mastery_decisions',p.id)).state,'stale');
 const next=await f.ok('/api/competencies/proposals',{learnerId:'alice',ruleId:rule.id});assert.notEqual(next.id,p.id);assert.equal(p.proofs[0].correctionVersion,2);
});
test('AC34 AC35 AC36 missing work stays insufficient, required prerequisite directs suggestion, no implicit assignment',async t=>{
 const f=await competencyFixture(t),rule=await f.pathRule();let p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'});assert.equal(p.readiness,'insufficient');assert.equal(p.assignmentId,undefined);assert.equal(p.target,null);
 await f.copy({publish:true});p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'});assert.equal(p.readiness,'fragile');assert.equal(p.target.activityId,'transfer');assert.equal(p.assignmentId,undefined);assert.equal(p.prerequisites.length,1);
 assert.equal((await f.post('/api/competencies/adaptation/'+p.id+'/activate')).status,400);const active=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true});assert.ok(active.assignmentId);
 const own=await f.call('/api/tracking/assignments/'+active.assignmentId,{as:'alice'});assert.equal(own.status,200);assert.equal(own.data.readOnly,false);const next=await f.call('/api/competencies/next',{as:'alice'});assert.equal(JSON.stringify(next).includes('fragile'),false);assert.equal(next.data.items.length,1);
});
test('AC37 standard publication and pre-start formative mode protect private revisions and other diagnostics',async t=>{
 const f=await competencyFixture(t);await f.ok('/api/competencies/runs/run/formative',{enabled:true,confirmed:true});const copy=await f.copy(),rule=await f.pathRule(),p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'});
 const result=await f.call('/api/assessments/'+copy.attempt.id+'/result',{as:'alice'});assert.equal(result.data.status,'formative');assert.equal(result.data.grade,'EC');assert.equal(JSON.stringify((await f.call('/api/tracking/attempts/'+copy.attempt.id,{as:'alice'})).data).includes('PRIVATE_Q'),false);
 assert.equal((await f.post('/api/competencies/runs/run/formative',{enabled:true,confirmed:true})).status,400);assert.ok((await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true})).assignmentId);
 const second=await f.scenario('private');const other=await f.copy({assignmentId:second.assignment.id});assert.equal((await f.call('/api/assessments/'+other.attempt.id+'/result',{as:'alice'})).data.status,'results_pending');
});
test('AC37 newer private correction cannot activate a suggestion using an older published result',async t=>{
 const f=await competencyFixture(t),copy=await f.copy({publish:true}),rule=await f.pathRule();
 await f.ok('/api/teacher/submissions/'+copy.submission.submissionId+'/correction',{version:copy.correction.version,items:copy.correction.items.map(i=>({id:i.id,points:i.points})),reason:'Retours privés actualisés'});const p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'});
 assert.equal((await f.post('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true})).status,400);
});
test('AC38 automatic approval has versions, bounds, idempotence, revocation and stale start checks',async t=>{
 const f=await competencyFixture(t),copy=await f.copy({publish:true}),rule=await f.pathRule(),p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'});
 assert.equal((await f.post('/api/competencies/adaptation/'+p.id+'/activate',{automatic:true})).status,400);
 const authorization=await f.ok('/api/competencies/adaptation/runs/run/automatic',{version:0,enabled:true,ruleIds:[rule.id],learnerIds:['alice'],expiresAt:new Date(Date.now()+600000).toISOString(),budget:1});
 const active=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{automatic:true}),duplicate=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{automatic:true});assert.equal(active.assignmentId,duplicate.assignmentId);assert.equal((await f.store.get('adaptation_authorizations',authorization.id)).used,1);
 await f.ok('/api/teacher/submissions/'+copy.submission.submissionId+'/correction',{version:copy.correction.version,items:copy.correction.items.map(i=>({id:i.id,points:i.points})),reason:'Preuve changée avant démarrage'});assert.equal((await f.store.get('adaptation_proposals',p.id)).state,'reconsider');
 assert.equal((await f.post('/api/assessments/lesson/start',{assignmentId:active.assignmentId},'alice')).status,409);
 await f.ok('/api/competencies/adaptation/runs/run/automatic',{version:authorization.version,enabled:false});assert.equal((await f.store.get('adaptation_authorizations',authorization.id)).enabled,false);
});
test('AC38 queued assignment observes a concurrent revocation inside the same store transaction',async t=>{
 const f=await competencyFixture(t);await f.copy({publish:true});const rule=await f.pathRule(),p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'});const a=await f.ok('/api/competencies/adaptation/runs/run/automatic',{version:0,enabled:true,ruleIds:[rule.id],learnerIds:['alice'],expiresAt:new Date(Date.now()+600000).toISOString(),budget:1});
 const revoke=f.store.transaction(tx=>configureAutomatic(tx,f.teacher,'run',{version:a.version,enabled:false})),activate=f.store.transaction(tx=>activatePath(tx,f.teacher,p.id,{automatic:true}));await revoke;await assert.rejects(activate,/révoquée/);assert.equal((await f.store.get('adaptation_proposals',p.id)).assignmentId,undefined);
});
test('AC39 verification uses new work and exits the remediation loop without changing initial diagnosis',async t=>{
 const f=await competencyFixture(t),original=await f.copy({publish:true}),verification=await f.scenario('verification'),rule=await f.pathRule(verification.run.id),p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'}),active=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true});
 assert.equal((await f.post('/api/competencies/adaptation/'+p.id+'/verification')).status,400);
 await f.ok('/api/events',{lessonId:'lesson',lessonVersionId:verification.version.id,assignmentId:active.assignmentId,eventId:'v2-remediation-answer',type:'answer_saved',activityId:'transfer',payload:{answer:'Travail de consolidation'},progressVersion:0},'alice');
 await f.ok('/api/events',{eventId:'v2-remediation-completed',lessonId:'lesson',lessonVersionId:verification.version.id,assignmentId:active.assignmentId,type:'step_completed',activityId:'transfer',payload:{}},'alice');
 const checking=await f.ok('/api/competencies/adaptation/'+p.id+'/verification');const result=await f.copy({assignmentId:checking.verificationAssignmentId,points:[8,4,8],publish:true});
 const done=await f.ok('/api/competencies/adaptation/'+p.id+'/verify',{submissionId:result.submission.submissionId,reason:'Nouvelle situation réussie sur les critères annoncés'});assert.equal(done.state,'closed');assert.equal(done.verification.passed,true);assert.ok(done.continuationAssignmentId);const next=(await f.call('/api/competencies/next',{as:'alice'})).data.items[0];assert.equal(next.assignmentId,done.continuationAssignmentId);assert.equal(next.activityId,'guided-code');assert.equal((await f.post('/api/assessments/lesson/start',{assignmentId:next.assignmentId},'alice')).status,200);assert.equal((await f.store.get('corrections',original.submission.submissionId)).grade,'EC');assert.equal((await f.store.list('mastery_decisions')).length,0);
});
test('AC40 class summary exposes each denominator, no automatic collective calendar mutation',async t=>{
 const f=await competencyFixture(t);await f.copy({publish:true});const rule=await f.pathRule();await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'});await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'bob'});
 const summary=(await f.call('/api/competencies/adaptation/runs/run')).data.summary[0];assert.deepEqual([summary.assigned,summary.submitted,summary.interpretable,summary.fragile,summary.insufficient],[2,1,1,1,1]);assert.equal(summary.calendarChanged,false);assert.match(summary.proposal,/1 observé.*2 attribué/);
});
test('AC16 AC32 AC38 portable content preserves rules/origin, excludes students and automatic authorizations',async t=>{
 const f=await competencyFixture(t);await f.copy({publish:true});await f.pathRule();const v=await f.store.get('lesson_versions','lesson:v1'),payload=await exportPedagogy(f.store,f.teacher,v),json=JSON.stringify(payload);assert.equal(json.includes('learnerId'),false);assert.equal(json.includes('authorization'),false);assert.equal(json.includes('a || b'),false);
 const target=await f.store.insert('lesson_versions',{...v,id:'lesson:imported',version:2});await f.store.transaction(tx=>importPedagogy(tx,f.teacher,target,payload));const imported=(await f.store.list('competency_grids')).find(g=>g.lessonVersionId===target.id);assert.equal(imported.situationId,f.grid.situationId);assert.equal((await f.store.list('adaptation_authorizations')).length,0);assert.equal((await f.store.get('lesson_versions',target.id)).pendingAdaptationTemplates.length,1);
});

test('AC25 ordinal criteria select a demonstrated grade without numeric averaging or inventing a score',async t=>{
 const f=await competencyFixture(t),v=await f.scenario('ordinal'),g=gridInput(f.framework.id,v.version.id,'ordinal-origin');g.version=v.grid.version;g.mode='ordinal';
 const rules=ids=>categories.map(c=>({grade:c.id,conditions:[{itemIds:ids,metric:'grade',op:'gte',value:c.id}]}));g.globalRules=rules(['r1','r2','r3']);for(const m of g.competencies){m.rules=rules([...new Set(m.criteria.flatMap(c=>c.itemIds))]);for(const c of m.criteria)c.rules=rules(c.itemIds);}
 await f.ok('/api/competencies/grids',g);const a=await f.ok('/api/assessments/lesson/start',{assignmentId:v.assignment.id},'alice'),s=await f.ok('/api/assessments/'+a.id+'/submit',{draftVersion:0,answers:{q1:'Comparaison expliquée',q2:'Combinaison partielle',q3:'Alternative justifiée'}},'alice');
 const c=await f.store.get('corrections',s.submissionId),corrected=await f.ok('/api/teacher/submissions/'+s.submissionId+'/correction',{version:c.version,reason:'Appréciation ordinale de chaque critère',items:c.items.map((i,j)=>({id:i.id,points:null,observedGrade:['A1','EC','A1'][j]}))});
 assert.equal(corrected.grade,'EC');assert.equal(corrected.score,null);assert.equal(corrected.scoreMax,null);assert.deepEqual(corrected.competencyResults.map(o=>o.grade),['A1','EC']);
 const incomplete=await f.ok('/api/teacher/submissions/'+s.submissionId+'/correction',{version:corrected.version,reason:'Un critère à observer',items:c.items.map((i,j)=>({id:i.id,points:null,observedGrade:j===1?null:'A1'}))});assert.equal(incomplete.grade,null);
});
test('AC25 legacy manual global decision requires an explicit scale and never creates competency evidence',async t=>{
 const f=await competencyFixture(t),legacy=await f.scenario('legacy');for(const g of await f.store.list('competency_grids'))if(g.lessonVersionId===legacy.version.id)await f.store.remove('competency_grids',g.id);
 const copy=await f.copy({assignmentId:legacy.assignment.id});assert.equal(copy.correction.grade,null);
 const input={version:copy.correction.version,reason:'Décision justifiée sur l’échelle de cette évaluation',items:copy.correction.items.map(i=>({id:i.id,points:i.points})),manualGrade:{grade:'EC',categories,reason:'Critère essentiel incomplet'}};
 const c=await f.ok('/api/teacher/submissions/'+copy.submission.submissionId+'/correction',input);assert.equal(c.grade,'EC');assert.equal(c.score,14);assert.deepEqual(c.competencyResults,[]);
});
test('AC33 a new independent observation invalidates an unpublished mastery proposal',async t=>{
 const f=await competencyFixture(t);await f.copy({publish:true});const second=await f.scenario('second');await f.copy({assignmentId:second.assignment.id,publish:true});const rule=await f.masteryRule(),p=await f.ok('/api/competencies/proposals',{learnerId:'alice',ruleId:rule.id});await f.ok('/api/competencies/decisions/'+p.id+'/validate',{reason:'Deux situations'});
 const third=await f.scenario('contradiction');await f.copy({assignmentId:third.assignment.id,points:[0,0,0]});assert.equal((await f.post('/api/competencies/decisions/'+p.id+'/publish')).status,409);
});
test('AC38 explicit automatic authorization assigns on publication and cloned rules never inherit it',async t=>{
 const f=await competencyFixture(t),rule=await f.pathRule();await f.ok('/api/competencies/adaptation/runs/run/automatic',{version:0,enabled:true,ruleIds:[rule.id],learnerIds:['alice'],budget:1,expiresAt:new Date(Date.now()+600000).toISOString()});
 await f.copy({publish:true});const proposals=await f.store.list('adaptation_proposals');assert.equal(proposals.length,1);assert.equal(proposals[0].automatic,true);assert.ok(proposals[0].assignmentId);assert.equal((await f.store.get('adaptation_authorizations','automatic:run')).used,1);
 const newRun=await f.scenario('new-occurrence');assert.equal(await f.store.get('adaptation_authorizations','automatic:'+newRun.run.id),null);
});
test('AC38 started work persists but source and target revocations still remove all student access',async t=>{
 const f=await competencyFixture(t),copy=await f.copy({publish:true}),rule=await f.pathRule(),p=await f.ok('/api/competencies/adaptation/proposals',{learnerId:'alice',ruleId:rule.id}),a=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true});
 await f.ok('/api/events',{eventId:'started-adaptation',lessonId:'lesson',assignmentId:a.assignmentId,type:'answer_saved',activityId:'transfer',payload:{answer:'Travail à conserver'},progressVersion:0},'alice');
 await f.ok('/api/teacher/submissions/'+copy.submission.submissionId+'/correction',{version:copy.correction.version,items:copy.correction.items.map(i=>({id:i.id,points:i.points})),reason:'Révision après début du travail'});assert.equal((await f.store.get('adaptation_proposals',p.id)).contextPreserved,true);assert.equal((await f.call('/api/tracking/assignments/'+a.assignmentId,{as:'alice'})).status,200);
 await f.call('/api/tracking/assignments/'+f.assignment.id,{method:'PATCH',body:{access:'revoked'}});assert.equal((await f.call('/api/tracking/assignments/'+a.assignmentId,{as:'alice'})).status,404);assert.equal((await f.call('/api/competencies/next',{as:'alice'})).data.items.length,0);assert.ok((await f.store.list('learning_progress')).some(p=>p.answers.transfer==='Travail à conserver'));
});
test('AC39 missing resource and circular prerequisite configuration cannot fabricate an attribution',async t=>{
 const f=await competencyFixture(t);await f.copy({publish:true});const rule=await f.pathRule();const revised={...rule,version:rule.version,targets:{}};const empty=await f.ok('/api/competencies/adaptation/rules',revised),p=await f.ok('/api/competencies/adaptation/proposals',{learnerId:'alice',ruleId:empty.id});assert.equal(p.target,null);assert.equal((await f.post('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true})).status,400);
 assert.equal((await f.post('/api/competencies/adaptation/rules',{...revised,version:empty.version,targets:{fragile:{runId:'run',activityId:'guided-code'}}})).status,400);
});

test('AC39 persistent difficulty exits to teacher after one independent verification',async t=>{
 const f=await competencyFixture(t);await f.copy({publish:true});const v=await f.scenario('verification-failure'),rule=await f.pathRule(v.run.id),p=await f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId:'alice'}),a=await f.ok('/api/competencies/adaptation/'+p.id+'/activate',{confirmed:true});
 await f.ok('/api/events',{eventId:'failed-cycle-answer',lessonId:'lesson',assignmentId:a.assignmentId,type:'answer_saved',activityId:'transfer',payload:{answer:'Travail réalisé'},progressVersion:0},'alice');await f.ok('/api/events',{eventId:'failed-cycle-done',lessonId:'lesson',assignmentId:a.assignmentId,type:'step_completed',activityId:'transfer',payload:{}},'alice');
 const verification=await f.ok('/api/competencies/adaptation/'+p.id+'/verification'),copy=await f.copy({assignmentId:verification.verificationAssignmentId,points:[8,0,5],publish:true});const result=await f.ok('/api/competencies/adaptation/'+p.id+'/verify',{submissionId:copy.submission.submissionId,reason:'Le prérequis reste à reprendre avec le professeur.'});assert.equal(result.state,'teacher_required');assert.equal(result.verification.passed,false);assert.equal(result.continuationAssignmentId,undefined);assert.equal((await f.call('/api/competencies/next',{as:'alice'})).data.items[0].canStart,false);
});
test('AC31 publication history displays latest published observation, never a newer private revision',async t=>{
 const f=await competencyFixture(t),copy=await f.copy({publish:true});const changed=await f.ok('/api/teacher/submissions/'+copy.submission.submissionId+'/correction',{version:copy.correction.version,items:copy.correction.items.map(i=>({id:i.id,points:0})),reason:'Correction révisée'});
 assert.equal((await f.call('/api/competencies/mine',{as:'alice'})).data.competencies.find(c=>c.id==='conditions').latest.grade,'A1');await f.ok('/api/tracking/submissions/'+copy.submission.submissionId+'/publish',{version:changed.version});
 const current=(await f.call('/api/competencies/mine',{as:'alice'})).data.competencies.find(c=>c.id==='conditions');assert.equal(current.latest.grade,'NA');assert.equal(current.observations.length,2);assert.equal(current.observations[0].workedAt,current.observations[1].workedAt);
});
