import {runGenerationStep} from './pedagogy/jobs.mjs';
import {inspectCandidate} from './pedagogy/browser-evidence.mjs';
import {inspectLabReferences} from './pedagogy/labs.mjs';
import {runPublicationJob} from './jobs.mjs';
import {openStore} from './store.mjs';
import {seedTeacher} from './auth.mjs';
import {seedCatalog} from './game.mjs';
import {createApp} from './app.mjs';
import {runArchiveJob} from './git-archive.mjs';
import {createServer} from 'node:http';
import {lanAddress} from './local-network.mjs';
if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL)throw Error('DATABASE_URL est requis en production.');
const lanHost=process.env.EDEN_LAN_HOST?lanAddress({address:process.env.EDEN_LAN_HOST}):null;
const store=await openStore();await seedTeacher(store);await seedCatalog(store);
let archiveBusy=false;const archiveWorker=setInterval(async()=>{if(archiveBusy)return;archiveBusy=true;try{await runArchiveJob(store);}catch{console.error('Archivage en attente ; instantanés conservés.');}finally{archiveBusy=false;}},3000);archiveWorker.unref();
let workerBusy=false;const worker=setInterval(async()=>{if(workerBusy)return;workerBusy=true;try{await runPublicationJob(store);if(process.env.EDEN_AI_WORKER_EXTERNAL!=='1')await runGenerationStep(store,{inspect:inspectCandidate,labCheck:inspectLabReferences});}catch{console.error('Préparation/publication interrompue : consultez le job concerné.');}finally{workerBusy=false;}},5000);worker.unref();
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
let stopping=false;
const app=createApp(store),servers=[];
async function shutdown(code=0){
 if(stopping)return;stopping=true;clearInterval(worker);clearInterval(archiveWorker);
 await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));
 await store.close();process.exit(code);
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>shutdown());
try{
 // Both addresses serve the same app/store. Remote sockets retain their real IP,
 // so local-only setup and personal connection routes keep their access checks.
 for(const address of [...new Set([host,...(lanHost?[lanHost]:[])])]){
  const server=createServer(app);servers.push(server);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,address,resolve);});
 }
 console.log(`EDEN Teacher Twin → http://${host}:${port} (${store.kind})`);
 if(lanHost)console.log(`Accès élèves sur le même Wi-Fi → http://${lanHost}:${port}/today\nGardez cet ordinateur allumé et le serveur ouvert. Les réponses sont enregistrées dans votre base habituelle.`);
 process.send?.({type:'ready'});
}catch(err){
 if(err.code==='EADDRINUSE')console.error(`Le port ${port} est déjà utilisé (${err.address||host}). Arrêtez le serveur qui l’occupe avant de relancer.`);
 else console.error(err);
 // EX_CONFIG tells the local supervisor not to retry a permanent bind error.
 await shutdown(['EADDRINUSE','EACCES','EADDRNOTAVAIL'].includes(err.code)?78:1);
}
