// Real provider, synthetic students and isolated persistence. No publication route.
import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {pedagogyFixture,pilotDefinitions} from '../tests/fixtures/pedagogy.mjs';
import {createChatGPT} from '../server/ai/chatgpt.mjs';
import {enqueueGeneration,runGenerationStep,jobSummary,reconcilePreparation} from '../server/pedagogy/jobs.mjs';
import {planProfiles} from '../server/ai/settings.mjs';
import {callStructured,pipelineLimits} from '../server/pedagogy/provider.mjs';
import {importDocument} from '../server/pedagogy/documents.mjs';
import {inspectCandidate} from '../server/pedagogy/browser-evidence.mjs';
import {inspectLabReferences} from '../server/pedagogy/labs.mjs';
import {studentSpec} from '../server/generator.mjs';
import {createApp} from '../server/app.mjs';

if(process.env.NODE_ENV==='production'||process.env.VERCEL)throw Error('Recette locale uniquement.');
// This harness never inherits cloud artifact publishing or an API-key fallback.
delete process.env.EDEN_S3_BUCKET;delete process.env.OPENAI_API_KEY;
const workers=Math.max(1,Math.min(3,Number(process.argv.find(a=>a.startsWith('--workers='))?.split('=')[1])||1));
const directory=resolve('.data/quality-v2');await mkdir(directory,{recursive:true});
try{const lab=JSON.parse(await readFile(resolve(directory,'lab.json'),'utf8'));for(const key of ['EDEN_LAB_URL','EDEN_LAB_TOKEN','EDEN_LAB_SHELL_IMAGE','EDEN_LAB_DOM_IMAGE'])if(lab[key])process.env[key]=lab[key];}catch{/* A missing lab remains an explicit blocking capability. */}
const {store,actor}=await pedagogyFixture({path:resolve(directory,'courses.sqlite')});
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
const reportPath='docs/quality/evidence-v2';await mkdir(reportPath,{recursive:true});
try{
 if(process.argv.includes('--run')){
  const db=new DatabaseSync('.data/chatgpt-personal/courses.sqlite',{readOnly:true});
  const saved=JSON.parse(db.prepare('SELECT data FROM generation_jobs WHERE id=?').get('prep_56c0948e-9e0b-40d4-8318-112b10a95661').data);db.close();
  if(saved.config.provider!=='chatgpt_plan')throw Error('Ce harness exige le compte ChatGPT de la préparation de référence.');
  const client=createChatGPT({directory:resolve('.data/chatgpt-personal/credentials'),origin:'http://127.0.0.1:4181'});
  const models=await client.models(saved.actor,saved.config.connectionId,{recheck:true});
  if(!models.some(m=>m.slug===saved.config.roles.design.model))throw Error('Modèle initial indisponible.');
  let local={};try{local=parseEnv(await readFile('.env.chatgpt.local','utf8'));}catch{}
  const limits=pipelineLimits(local,{provider:'chatgpt_plan'});
  const config={...saved.config,...limits,version:'siwc-local-2026-10-07',roles:planProfiles(models.find(m=>m.slug===saved.config.roles.design.model)),ownerId:saved.actor.id,classId:saved.actor.classId,sharedBudgetId:'quality-v2',sharedMaxCalls:24,maxConcurrentPerConnection:workers};
  const recover=process.argv.find(a=>a.startsWith('--reconcile='))?.split('=')[1];
  if(recover)await reconcilePreparation(store,recover,actor);
  const only=process.argv.find(a=>a.startsWith('--pilot='))?.split('=')[1];
  for(const pilot of pilotDefinitions.filter(p=>!only||p.id===only)){
   const source=await importDocument(store,actor,{filename:`${pilot.id}.md`,role:'technical',title:`Source pédagogique originale de recette — ${pilot.title}`},Buffer.from(pilot.source));
   await enqueueGeneration(store,actor,{entryId:pilot.id,intent:`Préparer la séance complète : ${pilot.title}. ${pilot.depth.question} ${pilot.depth.transfer} Durée du créneau de recette : 110 minutes, pauses comprises. Les élèves sont débutants ; préparer explicitement tous les prérequis.`,sourceIds:[source.id],requestId:`real-v2-${pilot.id}`},{config,chatgpt:client});
  }
  let progressWrite=Promise.resolve();
  const work=async()=>{while(!stopping){
   const jobs=await store.list('generation_jobs',actor.classId);
   if(!jobs.some(j=>['queued','running','retry_wait'].includes(j.status)))break;
   // Reservations enforce the shared call ceiling atomically; local checks and saved results may still finish.
   const job=await runGenerationStep(store,{call:args=>callStructured({...args,chatgpt:client}),inspect:inspectCandidate,labCheck:inspectLabReferences});
   if(job){console.log(JSON.stringify({id:job.id,stage:job.stage,status:job.status,calls:job.calls,reason:job.reason||null}));progressWrite=progressWrite.then(async()=>writeFile(resolve(reportPath,'real-progress.json'),JSON.stringify((await store.list('generation_jobs',actor.classId)).map(jobSummary),null,2)+'\n'));await progressWrite;}
   else await new Promise(r=>setTimeout(r,1000));
  }};
  const outcomes=await Promise.allSettled(Array.from({length:workers},()=>work()));
  await progressWrite;for(const outcome of outcomes)if(outcome.status==='rejected')throw outcome.reason;
  const report=[];
  for(const job of await store.list('generation_jobs',actor.classId)){
   const version=job.lessonVersionId?await store.get('lesson_versions',job.lessonVersionId):null;
   if(version)await writeFile(resolve(reportPath,`${job.entryId}-real-student.json`),JSON.stringify(studentSpec(version.spec),null,2)+'\n');
   report.push({...jobSummary(job),callsTrace:(await store.list('generation_calls',actor.classId)).filter(c=>c.jobId===job.id).map(({output,partialOutput,schema,...c})=>({...c,partialCharacters:partialOutput?.length||0}))});
  }
  await writeFile(resolve(reportPath,'real-pilots.json'),JSON.stringify(report,null,2)+'\n');
 }
 if(!stopping&&!process.argv.includes('--no-serve')){
  const server=createApp(store).listen(4182,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
  console.log('Recette réelle : http://127.0.0.1:4182/preparation.html — professeur / quality-preview-only (base séparée). Aucun worker ne soumet d’appel dans le mode consultation.');
  while(!stopping)await new Promise(r=>setTimeout(r,1000));
  server.closeAllConnections();await new Promise(r=>server.close(r));
 }
}finally{await store.close();}
