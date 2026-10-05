import {LESSON,STEPS,BLOCKS} from './content.js';
import {testFunction} from './exercises.js';
import {testDiagnostic,DIAGNOSTIC_VERSION} from './diagnostic.js';
import {LEGACY_STEP_IDS,LEGACY_DIAGNOSTIC} from './legacy-steps.js';
import {truthCases,expected,testProgram} from './logic.js';
export const REQUIRED=STEPS.filter(s=>!s.optional);
export const STORE_KEY='eden:261001:progress:v2';
export const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const integer=(n,max=100000)=>Number.isInteger(n)&&n>=0?Math.min(n,max):0;
export function fresh(alias=''){return {schema:3,lessonId:LESSON.id,diagnosticVersion:DIAGNOSTIC_VERSION,alias,runId:uid(),revision:0,step:0,stepId:STEPS[0].id,responses:{},created:new Date().toISOString()};}
function cleanPractice(raw){
 if(!raw||typeof raw!=='object')return undefined;
 const event=e=>{if(!e||typeof e!=='object'||!['run','test','case','skip'].includes(e.action))return null;return {action:e.action,at:String(e.at||'').slice(0,35),hints:integer(e.hints,1000),ok:e.ok===true,passed:integer(e.passed,100),total:integer(e.total,100),error:String(e.error||'').slice(0,400),fingerprint:String(e.fingerprint||'').slice(0,16)};};
 const history=Array.isArray(raw.history)?raw.history.slice(-20).map(event).filter(Boolean):[];
 const first=raw.firstAttempt&&typeof raw.firstAttempt.code==='string'?{code:raw.firstAttempt.code.slice(0,10000),at:String(raw.firstAttempt.at||'').slice(0,35),action:['run','test','case'].includes(raw.firstAttempt.action)?raw.firstAttempt.action:'run',hints:integer(raw.firstAttempt.hints,1000)}:null;
 return {executions:integer(raw.executions),validations:integer(raw.validations),history,...(first?{firstAttempt:first}:{}),...(event(raw.lastAttempt)?{lastAttempt:event(raw.lastAttempt)}:{})};
}
export function sanitizeState(raw){
 if(!raw||![1,2,3].includes(raw.schema)||raw.lessonId!==LESSON.id||typeof raw.runId!=='string'||!/^[-\w]{5,90}$/.test(raw.runId))throw Error('Ce fichier n’est pas une progression de la séance du 1er octobre.');
 const s=fresh(String(raw.alias||'').slice(0,48));s.runId=raw.runId;s.revision=integer(raw.revision,1e9);
 s.diagnosticVersion=raw.schema<3?'fonctions-261001-v1':raw.diagnosticVersion===DIAGNOSTIC_VERSION?DIAGNOSTIC_VERSION:'fonctions-261001-v1';
 const activeId=raw.schema<3?LEGACY_STEP_IDS[integer(raw.step)]:raw.stepId||STEPS[integer(raw.step)]?.id;
 s.step=Math.max(0,STEPS.findIndex(x=>x.id===activeId));s.stepId=STEPS[s.step].id;
 s.diagnosticStartedAt=typeof raw.diagnosticStartedAt==='string'?raw.diagnosticStartedAt.slice(0,35):null;
 s.created=typeof raw.created==='string'?raw.created.slice(0,40):s.created;
 const all=[...STEPS,...LEGACY_DIAGNOSTIC.filter(x=>!STEPS.some(y=>y.id===x.id))];
 for(const step of all){const r=raw.responses?.[step.id];if(!r||typeof r!=='object')continue;
  const input={};let count=0;for(const [k,v] of Object.entries(r.input||{})){if(count++>=30)break;if(['__proto__','constructor','prototype'].includes(k)||!/^[-\w]{1,40}$/.test(k)||typeof v!=='string')continue;input[k]=v.slice(0,k==='code'?10000:2000);}
  s.responses[step.id]={input,tries:integer(r.tries),hints:integer(r.hints),done:r.done===true};
  if(step.kind==='function-code'){const practice=cleanPractice(r.practice);if(practice)s.responses[step.id].practice=practice;}
 }
 return s;
}
export function diagnosticCompleted(s){const r=s.responses?.['diag-remettre'];return r?.done&&(r.input?.submitted==='yes'||r.input?.localDraft==='yes');}
export function checkStep(step,input={}){
 if(step.kind==='function-code'){if(step.diagnostic){const r=testDiagnostic(input.code??step.starter??'',step.id);const {run,...result}=r;return {...result,mastery:r.ok,ok:r.ok||input.skip==='yes',skipped:input.skip==='yes'};}return testFunction(input.code??step.starter,step.exercise);}
 if(step.kind==='submit-diagnostic')return {ok:input.submitted==='yes'||input.localDraft==='yes',score:null,total:null,rows:[],manual:true};
 if(step.kind==='quiz'){
  const rows=step.questions.map(q=>({id:q.id,ok:input[q.id]===q.answer,answered:!!input[q.id],why:q.why,expected:q.answer}));
  return {ok:step.diagnostic?rows.every(r=>r.answered):rows.every(r=>r.ok),score:step.block==='diagnostic'?null:rows.filter(r=>r.ok).length,total:step.block==='diagnostic'?null:rows.length,rows,manual:false};
 }
 if(step.kind==='truth'){
  const rows=truthCases(step.inputs).map((c,i)=>{const val=String(expected(step.mode,Object.values(c)));return {id:'r'+i,ok:input['r'+i]===val,expected:val,vars:c};});return {ok:rows.every(r=>r.ok),score:rows.filter(r=>r.ok).length,total:rows.length,rows};
 }
 if(step.kind==='circuit'){
  const keys=new Set((input.seen||'').split(',').filter(k=>new RegExp(`^[01]{${step.inputs.length}}$`).test(k)));return {ok:keys.size>=step.minCases,score:Math.min(keys.size,step.minCases),total:step.minCases,rows:[]};
 }
 if(step.kind==='code'){const r=testProgram(input.code||step.starter,step.exercise);return {...r,score:r.rows.filter(x=>x.ok).length,total:r.rows.length||({and:4,combined:8,threshold:6}[step.exercise])};}
 if(['write','debrief'].includes(step.kind))return {ok:(input.trace||'').trim().length>=(step.minimum||8),score:null,total:null,manual:true,rows:[]};
 if(step.kind==='bonus')return {ok:input.round1==='ok'&&input.round2==='ok'&&(input.trace||'').trim().length>=15,score:null,total:null,manual:true,rows:[]};
 return {ok:true,score:null,total:null,manual:true,rows:[]};
}
export function summary(raw){const s=sanitizeState(raw);const results=REQUIRED.map(step=>{const r=s.responses[step.id]||{input:{}};return {id:step.id,title:step.title,block:step.block,done:r.done===true||(step.block==='diagnostic'&&diagnosticCompleted(s)),...(step.block==='diagnostic'&&diagnosticCompleted(s)?{ok:true,score:null,total:null}:checkStep(step,r.input))};});return {runId:s.runId,revision:s.revision,lessonId:LESSON.id,alias:s.alias,state:s,completed:results.filter(r=>r.done&&r.ok).length,total:REQUIRED.length,diagnostic:null,pm09:results.find(r=>r.id==='pm09')?.score||0,results:results.map(({rows,...r})=>r)};}
export function timetable(start=null){let m=0;const fmt=t=>`${Math.floor(t/60)%24}`.padStart(2,'0')+'h'+`${t%60}`.padStart(2,'0');const valid=typeof start==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(start);const offset=valid?Number(start.slice(0,2))*60+Number(start.slice(3)):0;return BLOCKS.map(b=>{const from=m;m+=b.minutes;return {...b,from,to:m,label:valid?`${fmt(offset+from)}–${fmt(offset+m)}`:`T+${from}–${m} min`};});}
export function bonusUnlocked(s){return REQUIRED.every(step=>{const r=s.responses?.[step.id];return (step.block==='diagnostic'&&diagnosticCompleted(s))||(r?.done&&checkStep(step,r.input).ok);});}
