import {openStore} from '../server/store.mjs';
import {archiveConfig,runArchiveJob} from '../server/git-archive.mjs';
if(process.env.VERCEL)throw Error('Archivage : utiliser un worker avec disque durable.');
if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL)throw Error('DATABASE_URL requis en production.');
if(!archiveConfig())throw Error('Configurer EDEN_ARCHIVE_REPOSITORY et EDEN_ARCHIVE_ID.');
const store=await openStore();let stopped=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;});
try{while(!stopped){const job=await runArchiveJob(store);if(!job)await new Promise(r=>setTimeout(r,1000));}}
finally{await store.close();}
