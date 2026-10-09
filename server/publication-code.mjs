import {testActivityCode} from './workshop-testing.mjs';

export async function publicationCodeChecks(spec){
 const checks=[];
 for(const task of [...spec.activities,...spec.diagnostic.tasks]){
  if(!task.tests?.length||!['javascript','html','css','sql'].includes(task.correctionMode)&&!['dom','shell-git'].includes(task.workshop?.profile))continue;
  let ok=false;try{ok=(await testActivityCode(task,task.reference)).ok===true;}catch{}
  checks.push({id:`reference:${task.id}`,ok,message:ok?`Corrigé testé : ${task.title}`:`Le corrigé de « ${task.title} » ne réussit pas ses tests. Corrigez-le avant publication.`});
 }
 return checks;
}
