import {openStore} from '../server/store.mjs';
import {runGenerationStep} from '../server/pedagogy/jobs.mjs';
import {inspectCandidate} from '../server/pedagogy/browser-evidence.mjs';
import {inspectLabReferences} from '../server/pedagogy/labs.mjs';
import {localChatGPTMode} from '../server/ai/chatgpt.mjs';
if(!localChatGPTMode().enabled)throw Error('Worker personnel : utilisez npm run dev:chatgpt.');
const store=await openStore();let stopped=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;});
try{while(!stopped){try{const job=await runGenerationStep(store,{inspect:inspectCandidate,labCheck:inspectLabReferences});if(job)continue;}catch{console.error('Préparation suspendue. Consultez son état dans l’interface professeur.');}await new Promise(r=>setTimeout(r,1000));}}
finally{await store.close();}
