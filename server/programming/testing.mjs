import {Worker} from 'node:worker_threads';
export function testProgramming(task,code){return new Promise(resolve=>{
 const w=new Worker(new URL('./test-worker.mjs',import.meta.url),{workerData:{task,code},resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
 const done=result=>{clearTimeout(timer);void w.terminate();resolve(result);};
 const timer=setTimeout(()=>done({ok:false,pending:true,error:'Durée maximale des tests atteinte.',errorCode:'LIMIT',logs:[],checks:[]}),5000);
 w.once('message',done);w.once('error',e=>done({ok:false,pending:true,error:e.message,errorCode:'RUNTIME',logs:[],checks:[]}));w.once('exit',code=>{if(code)done({ok:false,pending:true,error:'Tests interrompus.',logs:[],checks:[]});});
});}
