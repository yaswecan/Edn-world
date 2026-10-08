import {runGenerationStep} from './pedagogy/jobs.mjs';
import {inspectCandidate} from './pedagogy/browser-evidence.mjs';
import {inspectLabReferences} from './pedagogy/labs.mjs';
import {runPublicationJob} from './jobs.mjs';
import {openStore} from './store.mjs';
import {seedTeacher} from './auth.mjs';
import {seedCatalog} from './game.mjs';
import {createApp} from './app.mjs';
import {runArchiveJob} from './git-archive.mjs';
if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL)throw Error('DATABASE_URL est requis en production.');
const store=await openStore();await seedTeacher(store);await seedCatalog(store);
let archiveBusy=false;const archiveWorker=setInterval(async()=>{if(archiveBusy)return;archiveBusy=true;try{await runArchiveJob(store);}catch{console.error('Archivage en attente ; instantanés conservés.');}finally{archiveBusy=false;}},3000);archiveWorker.unref();
let workerBusy=false;const worker=setInterval(async()=>{if(workerBusy)return;workerBusy=true;try{await runPublicationJob(store);if(process.env.EDEN_AI_WORKER_EXTERNAL!=='1')await runGenerationStep(store,{inspect:inspectCandidate,labCheck:inspectLabReferences});}catch{console.error('Préparation/publication interrompue : consultez le job concerné.');}finally{workerBusy=false;}},5000);worker.unref();
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
let stopping=false;
const server=createApp(store).listen(port,host,err=>{
 if(err){
  if(err.code==='EADDRINUSE')console.error(`Le port ${port} est déjà utilisé (${host}). Arrêtez le serveur qui l’occupe avant de relancer npm run dev:chatgpt.`);
  else console.error(err);
  // EX_CONFIG tells the local supervisor not to retry a permanent bind error.
  shutdown(['EADDRINUSE','EACCES'].includes(err.code)?78:1);return;
 }
 console.log(`EDEN Teacher Twin → http://${host}:${port} (${store.kind})`);process.send?.({type:'ready'});
});
function shutdown(code=0){if(stopping)return;stopping=true;clearInterval(worker);clearInterval(archiveWorker);server.close(async()=>{await store.close();process.exit(code);});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>shutdown());
