import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openStore} from '../server/store.mjs';
import {reviseGeneration,jobSummary} from '../server/pedagogy/jobs.mjs';

const jobId=process.argv.find(a=>a.startsWith('--job='))?.slice(6);
const reportDirectory=process.argv.find(a=>a.startsWith('--report-directory='))?.slice('--report-directory='.length)||'docs/quality/evidence-v2';
if(!jobId)throw Error('Usage : node --import tsx scripts/revise-preparation.mjs --job=ID [--apply]');
if(process.env.NODE_ENV==='production')throw Error('Utilitaire local de reprise uniquement.');
const path=resolve(process.env.EDEN_DB_PATH||'.data/chatgpt-personal/courses.sqlite');
const db=new DatabaseSync(path,{readOnly:true});
const found=db.prepare('SELECT data FROM generation_jobs WHERE id=?').get(jobId);if(!found)throw Error('Préparation introuvable dans cette base.');
const before=JSON.parse(found.data),calls=db.prepare('SELECT data FROM generation_calls').all().map(r=>JSON.parse(r.data)).filter(c=>c.jobId===jobId);
const version=db.prepare('SELECT data FROM lesson_versions WHERE id=?').get(before.lessonVersionId)?.data;
if(!process.argv.includes('--apply')){console.log(JSON.stringify({action:'révision ciblée de la conception, sans publication',jobId,status:before.status,stage:before.stage,calls:before.calls,budgetExpired:Date.now()-Date.parse(before.startedAt)>=before.config.maxDurationMs},null,2));db.close();}
else{
 process.umask(0o077);const directory=resolve('.data/backups');await mkdir(directory,{recursive:true,mode:0o700});
 const backup=resolve(directory,`before-policy-v2-${Date.now()}.sqlite`);db.prepare('VACUUM INTO ?').run(backup);db.close();
 const store=await openStore({url:'',path});
 try{
  const after=await reviseGeneration(store,jobId,before.actor,{expectedRevision:before.revision||1});
  if(JSON.stringify(await store.get('lesson_versions',before.lessonVersionId))!==version)throw Error('La version historique a changé.');
  if(after.calls!==before.calls||after.reservedUSD!==before.reservedUSD||after.config.maxCalls!==before.config.maxCalls)throw Error('Le budget original a changé.');
  const report={jobId,corpusId:before.lessonId,session:{entryId:before.entryId,date:before.brief.entry.date,sequence:before.brief.entry.sequence,category:before.brief.entry.category,duration:before.brief.entry.duration},
   before:{status:before.status,stage:before.stage,policy:before.policyVersion||'legacy',sourceCount:before.sources.length,candidates:(await store.list('generation_candidates',before.classId)).filter(c=>c.jobId===jobId).length},
   originalCalls:calls.map(c=>({outcome:c.outcome,provider:c.trace?.provider,requestedModel:c.trace?.requestedModel,effectiveModel:c.trace?.effectiveModel||null,parameters:c.trace?.parameters,durationMs:c.trace?.durationMs,partialCharacters:c.partialOutput?.length||0,hasValidatedOutput:!!c.output,recovery:c.trace?.providerError?.kind})),
   after:{revision:after.revision,status:after.status,stage:after.stage,policyVersion:after.policyVersion,reason:after.reason,calls:after.calls,reservedUSD:after.reservedUSD},
   controls:{historicalVersion:'PASS',sharedBudget:'PASS',noPublication:'PASS',newProviderCalls:0},backup,productionDeployed:false};
  await mkdir(reportDirectory,{recursive:true});await writeFile(resolve(reportDirectory,'original-preparation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
 }finally{await store.close();}
}
