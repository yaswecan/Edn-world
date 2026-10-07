// Run --apply only after explicit approval of the additional test time.
// Default: read-only proposal. Never operates on the personal preparation database.
import {DatabaseSync} from 'node:sqlite';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openStore} from '../server/store.mjs';
const path=resolve('.data/quality-v2/courses.sqlite'),minutes=Number(process.argv.find(a=>a.startsWith('--minutes='))?.slice(10)||30);
if(process.env.NODE_ENV==='production'||!Number.isInteger(minutes)||minutes<1||minutes>30)throw Error('Extension de recette locale : 1 à 30 minutes.');
const db=new DatabaseSync(path,{readOnly:true}),jobs=db.prepare('SELECT data FROM generation_jobs').all().map(r=>JSON.parse(r.data)).filter(j=>j.requestId?.startsWith('real-v2-'));
const proposed=jobs.map(j=>({id:j.id,entryId:j.entryId,status:j.status,oldMinutes:j.config.maxDurationMs/60000,newMinutes:j.config.maxDurationMs/60000+minutes,newDeadline:new Date(Date.parse(j.startedAt)+j.config.maxDurationMs+minutes*60000).toISOString(),calls:j.calls,maxCalls:j.config.maxCalls}));
console.log(JSON.stringify({apply:process.argv.includes('--apply'),sharedCallCeiling:24,personalDatabaseTouched:false,proposed},null,2));
if(!process.argv.includes('--apply'))db.close();
else{
 if(jobs.some(j=>j.status==='running'))throw Error('Arrêter le worker à la fin de son étape avant toute modification des budgets.');
 if(jobs.some(j=>(j.budgetExtensions||[]).length))throw Error('Extension déjà enregistrée : une nouvelle décision distincte est nécessaire.');
 process.umask(0o077);const directory=resolve('.data/quality-v2/backups');await mkdir(directory,{recursive:true,mode:0o700});db.prepare('VACUUM INTO ?').run(resolve(directory,`before-approved-extension-${Date.now()}.sqlite`));db.close();
 const store=await openStore({url:'',path});
 try{await store.transaction(async tx=>{for(const before of jobs){const j=await tx.get('generation_jobs',before.id);if(j.status==='running')throw Error('Worker redevenu actif.');j.budgetExtensions=[{at:new Date().toISOString(),addedMinutes:minutes,previousDurationMs:j.config.maxDurationMs,reason:'Extension de durée des pilotes explicitement autorisée ; appels et réécritures inchangés.'}];j.config.maxDurationMs+=minutes*60000;Object.assign(j.config,{sharedBudgetId:'quality-v2',sharedMaxCalls:24,maxConcurrentPerConnection:3});j.events.push({stage:'approved_budget_extension',at:new Date().toISOString(),addedMinutes:minutes});await tx.put('generation_jobs',j);}});}
 finally{await store.close();}
}
