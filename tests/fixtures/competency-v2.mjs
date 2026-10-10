// Fictitious section-20 data; never imported into the user's database.
import assert from 'node:assert/strict';
import {trackingFixture} from './student-tracking.mjs';
import {assignRun} from '../../server/student-tracking.mjs';
export const categories=[{id:'NA',order:0,description:'Critère non acquis dans la situation'},{id:'EC',order:1,description:'Critère en cours de consolidation'},{id:'A1',order:2,description:'Critère démontré dans la situation'}];
export const frameworkInput={frameworkKey:'fixture-only',sourceVersion:'1',title:'Référentiel fictif de recette',source:{document:'Spécifications V2 — section 20, données fictives',location:'Section 20'},nodes:[{id:'conditions',code:'DEMO-COMP-01',title:'Interpréter une condition',kind:'competency',expectedLevel:'N2',criteria:[{id:'comparisons',code:'001.01',title:'Prévoir des comparaisons',origin:'source'}],criterionSet:{name:'Comparaisons de démonstration',version:'1',exhaustive:true,criterionIds:['comparisons']}},{id:'decisions',code:'DEMO-COMP-02',title:'Construire une décision dans un programme',kind:'competency',criteria:[{id:'combined',code:'001.02',title:'Écrire une condition combinée',origin:'source'},{id:'alternative',code:'001.03',title:'Écrire une alternative',origin:'source'}],criterionSet:{name:'Décisions de démonstration',version:'1',exhaustive:true,criterionIds:['combined','alternative']}}],confirmed:true};
const condition=(ids,value,label)=>({itemIds:ids,metric:'points',op:'gte',value,label});
const rules=(id,ec,a1)=>[{grade:'A1',conditions:[condition([id],a1,'Critère '+id)]},{grade:'EC',conditions:[condition([id],ec,'Critère '+id)]},{grade:'NA',conditions:[]}];
export function gridInput(frameworkId,lessonVersionId='lesson:v1',situationId='original-conditions'){
 return {lessonVersionId,version:0,situationId,allowedHelp:'Consigne reformulée et aménagement autorisé',categories,items:[1,2,3].map(i=>({id:'r'+i,coefficient:1})),rounding:{digits:2,mode:'nearest'},globalRules:[{grade:'A1',conditions:[condition(['r1','r2','r3'],14,'Total'),condition(['r2'],3,'Q2 essentielle'),condition(['r3'],5,'Q3 essentielle')]},{grade:'EC',conditions:[condition(['r1','r2','r3'],6,'Total')]},{grade:'NA',conditions:[]}],links:[],competencies:[{frameworkVersionId:frameworkId,competencyId:'conditions',maximumGrade:'A1',rules:rules('r1',3,6),criteria:[{criterionId:'comparisons',itemIds:['r1'],rules:rules('r1',3,6),essential:true,maximumGrade:'A1',expectedGrade:'A1'}]},{frameworkVersionId:frameworkId,competencyId:'decisions',maximumGrade:'A1',rules:[{grade:'A1',conditions:[condition(['r2'],3,'Combinaison essentielle'),condition(['r3'],5,'Alternative')]},{grade:'EC',conditions:[condition(['r2','r3'],3,'Sur les deux critères')]},{grade:'NA',conditions:[]}],criteria:[{criterionId:'combined',itemIds:['r2'],rules:rules('r2',1,3),essential:true,maximumGrade:'A1',expectedGrade:'A1'},{criterionId:'alternative',itemIds:['r3'],rules:rules('r3',2,5),essential:true,maximumGrade:'A1',expectedGrade:'A1'}]}]};
}
export async function competencyFixture(t){
 const f=await trackingFixture();t?.after(()=>f.close());
 f.post=(path,body={},as='teacher')=>f.call(path,{method:'POST',body,as});
 f.ok=async(path,body,as)=>{const r=await f.post(path,body,as);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const v=await f.store.get('lesson_versions','lesson:v1'),task=v.spec.diagnostic.tasks[0];
 v.spec.diagnostic.tasks=[1,2,3].map(i=>({...task,id:'q'+i,title:'Question '+i,correctionMode:'manual',reference:'PRIVATE_Q'+i}));
 v.spec.diagnostic.rubric=[8,4,8].map((max,i)=>({id:'r'+(i+1),taskId:'q'+(i+1),label:'Question '+(i+1),max,criterion:i===0?'DEMO-COMP-01':'DEMO-COMP-02',a1:max,a2:max}));await f.store.put('lesson_versions',v);
 f.framework=await f.ok('/api/competencies/frameworks',frameworkInput);f.grid=await f.ok('/api/competencies/grids',gridInput(f.framework.id));
 f.copy=async({assignmentId=f.assignment.id,points=[8,1,5],autonomy='demonstrated',as='alice',publish=false}={})=>{
  const a=await f.ok('/api/assessments/lesson/start',{assignmentId},as),s=await f.ok('/api/assessments/'+a.id+'/submit',{draftVersion:a.draftVersion,answers:{q1:'8',q2:'a || b',q3:'if (...) ... else ...'}},as),c=await f.store.get('corrections',s.submissionId);
  const correction=await f.ok('/api/teacher/submissions/'+s.submissionId+'/correction',{version:c.version,reason:'Relecture de la copie fictive',autonomy,items:c.items.map((i,j)=>({id:i.id,points:points[j]}))});
  if(publish){const run=await f.store.get('lesson_runs',(await f.store.get('lesson_assignments',assignmentId)).runId);run.availability='closed';await f.store.put('lesson_runs',run);await f.ok('/api/tracking/submissions/'+s.submissionId+'/publish',{version:correction.version});}
  return {attempt:a,submission:s,correction};
 };
 f.scenario=async(suffix,{situationId='independent-'+suffix}={})=>{
  const original=await f.store.get('lesson_versions','lesson:v1'),version=await f.store.insert('lesson_versions',{...original,id:'lesson:'+suffix,version:2,spec:structuredClone(original.spec)}),run=await f.store.insert('lesson_runs',{id:'run-'+suffix,classId:'A1',lessonId:'lesson',lessonVersionId:version.id,date:'2026-10-06',availability:'open'}),grid=await f.ok('/api/competencies/grids',gridInput(f.framework.id,version.id,situationId)),assignment=await f.store.transaction(tx=>assignRun(tx,run,{id:'alice',classId:'A1'}));return {version,run,grid,assignment};
 };
 f.masteryRule=async(competencyId='conditions')=>f.ok('/api/competencies/rules',{frameworkVersionId:f.framework.id,competencyId,categories,criteria:competencyId==='conditions'?[{id:'comparisons',essential:true}]:[{id:'combined',essential:true},{id:'alternative',essential:true}]});
 f.pathRule=async(targetRun='run')=>f.ok('/api/competencies/adaptation/rules',{runId:'run',activityId:'guided-code',reason:'Préparer une activité sur les boucles',continuation:'Réussir une nouvelle combinaison puis poursuivre la séance.',targets:{fragile:{runId:targetRun,activityId:'transfer'},verify:{runId:targetRun,activityId:'extension'}},prerequisites:[{frameworkVersionId:f.framework.id,competencyId:'decisions',criterionIds:['combined'],categories,expectedGrade:'A1'}]});
 return f;
}
