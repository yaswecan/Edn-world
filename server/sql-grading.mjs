import {fork} from 'node:child_process';
export function sqlGrade(task,answer){return new Promise(resolve=>{
 const review=feedback=>({ratio:null,confidence:0,status:'review_required',feedback,observations:[]});if(!task.tests.length||task.tests.length>20)return resolve(review('Tests SQL absents ou trop nombreux.'));
 // A process boundary is essential: terminating a Worker cannot interrupt a
 // native SQLite query. No learner code is executed by Node; only SQL reaches SQLite.
 const child=fork(new URL('./sql-worker.mjs',import.meta.url),[],{execArgv:['--max-old-space-size=64'],env:{NODE_NO_WARNINGS:'1'},stdio:['ignore','ignore','ignore','ipc']});let finished=false;
 const done=result=>{if(finished)return;finished=true;clearTimeout(timer);child.kill('SIGKILL');resolve(result);};const timer=setTimeout(()=>done(review('Temps maximal dépassé : relecture requise.')),1500);child.once('message',done);child.once('error',()=>done(review('Exécution SQL interrompue : relecture requise.')));child.once('exit',()=>done(review('Exécution SQL interrompue : relecture requise.')));child.send({query:answer,tests:task.tests},error=>{if(error)done(review('Exécution SQL indisponible.'));});
});}
