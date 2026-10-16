// Six fictitious DEMO profiles. This fixture never opens a real database.
import assert from 'node:assert/strict';
import {competencyFixture,categories} from './competency-v2.mjs';
import {createSession} from '../../server/auth.mjs';
import {assignRun} from '../../server/student-tracking.mjs';
import {diagnosticSources,upgradeDiagnostic,DIAGNOSTIC_V31} from '../../server/diagnostic-v31.mjs';

export async function diagnosticFixture(t){
 const f=await competencyFixture(t),v=await f.store.get('lesson_versions','lesson:v1');
 for(const [i,id] of ['alice','bob','missing','incident','contradiction','ready'].entries()){
  const old=await f.store.get('learners',id),l={...(old||await f.store.get('learners','alice')),id,username:id,displayName:'DEMO '+(i+1)};
  if(old)await f.store.put('learners',l);else await f.store.insert('learners',l);
  await f.store.transaction(tx=>assignRun(tx,f.run,l));
  await createSession(f.store,l,{setHeader:(_k,value)=>{f.cookies[id]=value.split(';')[0];}});
 }
 const sourceSpec=structuredClone(v.spec);sourceSpec.activities=[
  {...sourceSpec.activities[0],id:'worked-comparison',title:'Prévoir une comparaison',skills:['DEMO-COMP-01']},
  {...sourceSpec.activities[0],id:'worked-combination',title:'Combiner deux conditions',skills:['DEMO-COMP-02']},
  {...sourceSpec.activities[0],id:'future-loop',title:'Une boucle non enseignée',skills:['DEMO-FUTURE']}
 ];
 await f.store.insert('lesson_versions',{id:'source:v1',classId:'A1',lessonId:'source',version:1,spec:sourceSpec});
 await f.store.insert('lesson_runs',{id:'source-run',classId:'A1',lessonId:'source',lessonVersionId:'source:v1',date:'2026-09-01',planStatus:'partial',revision:2,realization:{date:'2026-10-03',activityIds:['worked-comparison','worked-combination'],records:[{date:'2026-10-03',activityIds:['worked-comparison','worked-combination']}]}});
 const source=(await diagnosticSources(f.store,f.teacher,{date:'2026-10-05'})).selected;
 const original=structuredClone(v.spec.diagnostic);original.tasks=original.tasks.slice(0,2);original.tasks.forEach((task,i)=>{task.skills=['DEMO-COMP-0'+(i+1)];task.validationVariants={alternative:'Une production équivalente justifiée.',wrong:'',wrongExplanation:'Confusion entre ET et OU ou borne exclusive.'};});original.rubric=original.rubric.slice(0,2);original.rubric.forEach(r=>{r.max=8;r.a1=4;r.a2=8;});
 const extra={...original.tasks[0],id:'q3',title:'Vérifier une autre limite',instruction:'L’accès est permis à partir de 12 ans. Produis une décision pour 11 et 12 ans, puis justifie le cas limite.',expectedEvidence:'Deux décisions et une justification.',reference:'11 : refusé ; 12 : autorisé. La borne est incluse.'};
 const d=upgradeDiagnostic(original,source,{extraTask:extra,extraRubric:[{id:'r3',taskId:'q3',criterion:'DEMO-COMP-01',label:'Justifier la limite',max:4,a1:2,a2:4}]});d.contract.sourceConfirmed=true;d.contract.reviewed=true;
 d.tasks[1].type='CodeEditor';d.tasks[1].starter='function autorise(a,b) {\n  // Ta décision\n}';d.tasks[1].workshop={language:'javascript'};
 v.spec.diagnostic=d;v.spec.blocks.find(b=>b.type==='Diagnostic').minutes=20;await f.store.put('lesson_versions',v);f.diagnostic=d;f.source=source;f.original=original;
 const condition=(ids,value)=>({itemIds:ids,metric:'points',op:'gte',value,label:'Règle DEMO explicite'}),rules=(ids,a1,ec)=>[{grade:'A1',conditions:[condition(ids,a1)]},{grade:'EC',conditions:[condition(ids,ec)]},{grade:'NA',conditions:[]}];
 const old=f.grid;
 f.grid=await f.ok('/api/competencies/grids',{...old,version:old.version,globalRules:[{grade:'A1',conditions:[condition(['r1','r2','r3'],14),condition(['r1'],4),condition(['r2'],4)]},{grade:'EC',conditions:[condition(['r1','r2','r3'],6)]},{grade:'NA',conditions:[]}],competencies:[{frameworkVersionId:f.framework.id,competencyId:'conditions',maximumGrade:'A1',rules:rules(['r1','r3'],6,1),criteria:[{criterionId:'comparisons',itemIds:['r1','r3'],essential:true,maximumGrade:'A1',expectedGrade:'A1',rules:rules(['r1','r3'],6,1)}]},{frameworkVersionId:f.framework.id,competencyId:'decisions',maximumGrade:'A1',rules:rules(['r2'],4,1),criteria:[{criterionId:'combined',itemIds:['r2'],essential:true,maximumGrade:'A1',expectedGrade:'A1',rules:rules(['r2'],4,1)}]}]});
 f.assignments=await f.store.list('lesson_assignments','A1');
 f.start31=async(as='alice',begin=true)=>f.ok('/api/assessments/lesson/start',{assignmentId:f.assignments.find(a=>a.runId==='run'&&a.learnerId===as).id,begin},as);
 f.submit31=async(as='alice',answers={q1:'12 inclus',q2:'return a && b;',q3:'11 non, 12 oui : inclus'})=>{const a=await f.start31(as);const s=await f.ok('/api/assessments/'+a.id+'/submit',{answers,draftVersion:a.draftVersion},as);return {attempt:a,submission:s};};
 f.correct31=async(s,points=[8,8,4],extra={})=>{const c=await f.store.get('corrections',s.submissionId);return f.ok('/api/teacher/submissions/'+s.submissionId+'/correction',{version:c.version,items:c.items.map((i,j)=>({id:i.id,points:points[j]})),feedback:'DEMO : vérifie le cas limite et explique ta condition.',reason:'Relecture DEMO explicite',...extra});};
 f.publish31=async(s,c)=>{const run=await f.store.get('lesson_runs','run');run.availability='closed';await f.store.put('lesson_runs',run);return f.ok('/api/tracking/submissions/'+s.submissionId+'/publish',{version:c.version});};
 f.rule31=async(extra={})=>f.ok('/api/competencies/adaptation/rules',{runId:'run',activityId:'guided-code',version:0,policyVersion:DIAGNOSTIC_V31,reason:'DEMO — préparer les deux prérequis',continuation:'Produire et justifier une nouvelle condition.',targets:{guided:{runId:'run',activityId:'transfer'},fragile:{runId:'run',activityId:'transfer'},verify:{runId:'run',activityId:'extension'}},prerequisites:[['conditions','comparisons'],['decisions','combined']].map(([competencyId,id])=>({frameworkVersionId:f.framework.id,competencyId,criterionIds:[id],categories,expectedGrade:'A1',guidedGrades:['NA'],consolidationGrades:['EC']})),...extra});
 f.proposal=async(rule,learnerId='alice')=>f.ok('/api/competencies/adaptation/proposals',{ruleId:rule.id,learnerId});
 return f;
}
