import {pedagogyFixture,pilotDefinitions,buildPilot} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {runGenerationStep} from '../server/pedagogy/jobs.mjs';
import {inspectCandidate} from '../server/pedagogy/browser-evidence.mjs';
import {inspectLabReferences} from '../server/pedagogy/labs.mjs';
if(process.env.NODE_ENV==='production')throw Error('Aperçu réservé au développement.');
// Never load .env.local or use DATABASE_URL. Synthetic account and separate SQLite file.
const {store,actor}=await pedagogyFixture({path:'.data/quality-preview.sqlite'});
for(const pilot of pilotDefinitions){const job=await buildPilot(store,actor,pilot,{inspect:inspectCandidate});console.log(`${pilot.id}: ${job.status} — ${job.reason||'fixture enregistrée'}`);}
const port=Number(process.env.EDEN_QUALITY_PREVIEW_PORT||4180),server=createApp(store).listen(port,'127.0.0.1');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
let busy=false;const worker=setInterval(async()=>{if(busy)return;busy=true;try{await runGenerationStep(store,{inspect:inspectCandidate,labCheck:inspectLabReferences});}catch(e){console.error(e.message);}finally{busy=false;}},3000);worker.unref();
console.log(`Recette : http://quality.localhost:${port}/preparation.html`);
console.log('Connexion sur / : professeur / quality-preview-only (compte synthétique, classe A1).');
console.log('Les trois pilotes sont des fixtures ; les appels IA et laboratoires non configurés restent NOT RUN.');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(worker);server.close(async()=>{await store.close();process.exit(0);});});
