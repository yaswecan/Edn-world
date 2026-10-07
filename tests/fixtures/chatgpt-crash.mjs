import {writeFile} from 'node:fs/promises';
import {openStore} from '../../server/store.mjs';
import {runGenerationStep} from '../../server/pedagogy/jobs.mjs';
const [path,marker]=process.argv.slice(2),store=await openStore({url:'',path});
await runGenerationStep(store,{call:async()=>{await writeFile(marker,'started');await new Promise(()=>{setInterval(()=>{},1000);});}});
