import {resolve} from 'node:path';
import {pedagogyFixture,pilotDefinitions,buildPilot} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {inspectCandidate} from '../server/pedagogy/browser-evidence.mjs';
import {runArchiveJob} from '../server/git-archive.mjs';
if(process.env.NODE_ENV==='production')throw Error('Recette locale uniquement.');
delete process.env.DATABASE_URL;delete process.env.EDEN_S3_BUCKET;
const {store,actor}=await pedagogyFixture({path:'.data/documentary-preview/courses.sqlite'});
process.env.EDEN_ARCHIVE_REPOSITORY=resolve('.data/documentary-preview/archive.git');process.env.EDEN_ARCHIVE_ID='documentary-preview-private';delete process.env.EDEN_ARCHIVE_REMOTE;
for(const pilot of pilotDefinitions){const job=await buildPilot(store,actor,pilot,{inspect:inspectCandidate});console.log(`${pilot.id}: ${job.status} (fixture)`);}
const server=createApp(store).listen(4184,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
let busy=false;const worker=setInterval(async()=>{if(busy)return;busy=true;try{await runArchiveJob(store);}catch(e){console.error(e.message);}finally{busy=false;}},1000);
console.log('http://127.0.0.1:4184/preparation.html — professeur / quality-preview-only. Fixtures, aucune inférence réelle ni publication élève.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(worker);server.close(async()=>{await store.close();process.exit(0);});});
