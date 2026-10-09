import {studentFeedback,testSummary} from '../public/student-copy.js';
import {gradeTask} from './assessment.mjs';
import {sqlGrade} from './sql-grading.mjs';
import {runSafe} from './safe-js.mjs';
import {isDeepStrictEqual} from 'node:util';

export async function testActivityCode(task,code){
 if(['dom','shell-git'].includes(task.workshop?.profile)){
  const {labService}=await import('./pedagogy/labs.mjs');let result;
  if(task.workshop.profile==='dom'){const {domFiles,validateDOMFiles}=await import('./pedagogy/dom.mjs');result=await labService('/dom',{files:validateDOMFiles(domFiles({...task,starter:code})),actions:[],...(task.tests.length?{tests:task.tests}:{})});}
  else result=await labService('/reference',{files:task.workshop.files||[],code,tests:task.tests});
  return {ok:result.ok===true,pending:result.ok==null,checks:result.checks||[],logs:result.logs||[],runtime:result.runtime,error:null};
 }
 if(task.tests?.length&&['javascript','html','css','sql'].includes(task.correctionMode)){
  const result=task.correctionMode==='sql'?await sqlGrade(task,code):gradeTask(task,code);
  const checks=result.observations.map((o,i)=>({label:task.correctionMode==='javascript'?`Cas ${i+1}`:task.tests[i]?.invoke||`Cas ${i+1}`,ok:o.ok===true}));
  const consoleLogs=task.correctionMode==='javascript'?(runSafe(code).logs||[]).slice(0,100):[];
  const examples=task.correctionMode==='javascript'?(task.publicTests||[]).slice(0,20).map(t=>{try{const actual=runSafe(code,{invoke:t.invoke,args:JSON.parse(t.argsJSON)}),expected=JSON.parse(t.expectedJSON);return {call:`${t.invoke}(${t.argsJSON.slice(1,-1)})`,expected,actual:actual.value??null,error:actual.error||null,ok:actual.ok&&isDeepStrictEqual(actual.value,expected)};}catch{return {call:t.invoke,ok:false,error:'Exemple non interprétable.'};}}):[];
  return {ok:result.ratio===1&&examples.every(t=>t.ok),pending:result.ratio===null,checks,examples,logs:[...consoleLogs,...examples.map(t=>`${t.ok?'✓':'↻'} ${t.call} · attendu ${JSON.stringify(t.expected)} · obtenu ${t.error||JSON.stringify(t.actual)}`),...checks.map(t=>`${t.ok?'✓':'↻'} ${t.label}`),result.ratio===null?studentFeedback(result.feedback):testSummary(checks.filter(t=>t.ok).length,checks.length),...(task.correctionMode==='css'?['Vérifie aussi le rendu à plusieurs largeurs.']:[])],error:null};
 }
 if(task.correctionMode==='javascript'||(!task.workshop&&task.type==='CodeEditor')){const result=runSafe(code);delete result.ast;return result;}
 return {ok:false,pending:true,logs:['Observe le rendu et compare les critères de réussite. Cette production sera relue par le professeur.'],error:null};
}
