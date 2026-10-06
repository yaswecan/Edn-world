import {studentFeedback,testSummary} from '../public/student-copy.js';
import {gradeTask} from './assessment.mjs';
import {sqlGrade} from './sql-grading.mjs';
import {runSafe} from './safe-js.mjs';

export async function testActivityCode(task,code){
 if(task.tests?.length&&['javascript','html','css','sql'].includes(task.correctionMode)){
  const result=task.correctionMode==='sql'?await sqlGrade(task,code):gradeTask(task,code);
  const checks=result.observations.map((o,i)=>({label:task.correctionMode==='javascript'?`Cas ${i+1}`:task.tests[i]?.invoke||`Cas ${i+1}`,ok:o.ok===true}));
  const consoleLogs=task.correctionMode==='javascript'?(runSafe(code).logs||[]).slice(0,100):[];
  return {ok:result.ratio===1,pending:result.ratio===null,checks,logs:[...consoleLogs,...checks.map(t=>`${t.ok?'✓':'↻'} ${t.label}`),result.ratio===null?studentFeedback(result.feedback):testSummary(checks.filter(t=>t.ok).length,checks.length),...(task.correctionMode==='css'?['Vérifie aussi le rendu à plusieurs largeurs.']:[])],error:null};
 }
 if(task.correctionMode==='javascript'||(!task.workshop&&task.type==='CodeEditor')){const result=runSafe(code);delete result.ast;return result;}
 return {ok:false,pending:true,logs:['Observe le rendu et compare les critères de réussite. Cette production sera relue par le professeur.'],error:null};
}
