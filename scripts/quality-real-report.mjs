// Read-only database access; no inference, publication or credentials.
import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile} from 'node:fs/promises';
import {jobSummary} from '../server/pedagogy/jobs.mjs';
const db=new DatabaseSync('.data/quality-v2/courses.sqlite',{readOnly:true});
try{
 const rows=table=>db.prepare(`SELECT data FROM ${table}`).all().map(row=>JSON.parse(row.data));
 const calls=rows('generation_calls'),jobs=rows('generation_jobs').filter(job=>job.requestId?.startsWith('real-v2-'));
 const reports=jobs.map(job=>{
  const attempts=calls.filter(call=>call.jobId===job.id);
  return {...jobSummary(job),budgetExtensions:job.budgetExtensions||[],callsTrace:attempts.map(({output,partialOutput,schema,...call})=>({...call,partialCharacters:partialOutput?.length||0}))};
 });
 const measured=jobs.map(job=>{
  const attempts=calls.filter(call=>call.jobId===job.id),knownUsage=attempts.filter(call=>call.trace?.usage),finishedAt=['queued','running','retry_wait'].includes(job.status)?null:job.finishedAt||null;
  return {jobId:job.id,entryId:job.entryId,status:job.status,stage:job.stage,revision:job.revision,candidates:jobSummary(job).candidateCount,calls:job.calls,
   startedAt:job.startedAt,finishedAt,deadline:new Date(Date.parse(job.startedAt)+job.config.maxDurationMs).toISOString(),
   elapsedMs:Date.parse(finishedAt||new Date().toISOString())-Date.parse(job.startedAt),providerDurationMs:attempts.reduce((sum,call)=>sum+(call.trace?.durationMs||0),0),
   knownTokenUsage:{input:knownUsage.reduce((sum,call)=>sum+(call.trace.usage.input_tokens||0),0),output:knownUsage.reduce((sum,call)=>sum+(call.trace.usage.output_tokens||0),0),reportedCalls:knownUsage.length,totalCalls:attempts.length},
   uncertainCalls:attempts.filter(call=>['unknown','submitting','running'].includes(call.outcome)).length,costUSD:null,costReason:'Forfait ChatGPT : prix par appel et quota restant non fournis.',
   checks:job.checks?.map(({id,status})=>({id,status}))||[],review:job.decision?{state:job.decision.state,score:job.decision.score,blockers:job.decision.blockers}:null,reason:job.reason||null};
 });
 const directory='docs/quality/evidence-v2';await mkdir(directory,{recursive:true});
 await writeFile(`${directory}/real-pilots.json`,JSON.stringify(reports,null,2)+'\n');
 await writeFile(`${directory}/real-metrics.json`,JSON.stringify({at:new Date().toISOString(),sharedCallCeiling:24,totalCalls:jobs.reduce((n,j)=>n+j.calls,0),pilots:measured},null,2)+'\n');
 console.log(JSON.stringify(measured.map(({entryId,status,stage,calls,review,reason})=>({entryId,status,stage,calls,review,reason}))));
}finally{db.close();}
