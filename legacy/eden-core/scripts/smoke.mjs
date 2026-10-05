/** Read-only deployment check by default. Optional synthetic learner is deleted in finally. */
import {randomBytes} from 'node:crypto';
import {createSimulator,reduceSim} from '../docs/app/pcsim/model.js';
const address=process.argv[2]||process.env.SMOKE_URL;
if(!address){console.error('Usage : npm run smoke -- https://ton-site.vercel.app');process.exit(1);}
const base=new URL(address);
if(base.pathname!=='/'||base.search||base.hash||base.username||base.password||!['https:','http:'].includes(base.protocol)){
 console.error('Indique uniquement l’origine du site, sans chemin ni identifiant.');process.exit(1);
}
if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname)){console.error('Utilise HTTPS hors du poste local.');process.exit(1);}
async function call(path,{method='GET',data,cookie,token,json=true}={}){
 const r=await fetch(new URL(path,base),{method,headers:{...(data!==undefined?{'Content-Type':'application/json'}:{}),Origin:base.origin,...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(45000),redirect:'error'});
 if(!r.ok)throw new Error(`${path} : HTTP ${r.status}. Consulte les journaux privés Vercel, sans publier tes secrets.`);
 return {data:json?await r.json():await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
let cookie,id;
try {
 for(const path of ['/','/prof.html','/app/app.js','/app/pcsim/model.js']){await call(path,{json:false});console.log(`OK ${path}`);}
 const config=(await call('/api/config')).data;if(!config.enabled)throw Error('Le site répond, mais les variables du suivi ne sont pas configurées.');
 const health=(await call('/api/health')).data;if(!health.ok||health.backend!=='neon')throw Error('Le suivi Neon ne répond pas comme attendu.');
 console.log('OK API/config et health : connexion Neon et schéma prêts.');
 const pwd=process.env.SMOKE_TEACHER_PASSWORD,code=process.env.SMOKE_CLASS_CODE;
 if(pwd&&code){
  cookie=(await call('/api/teacher/login',{method:'POST',data:{password:pwd}})).cookie;
  const enrolled=(await call('/api/enroll',{method:'POST',data:{alias:'TEST-'+randomBytes(5).toString('hex'),classCode:code}})).data;id=enrolled.studentId;
  const sim=reduceSim(createSimulator(8),{type:'INSTALL',id:'board',slot:'plateau'}).state;
  await call('/api/events',{method:'POST',token:enrolled.token,data:{packetId:'smoke-1',order:1,coreCompleted:0,simulator:sim}});
  const detail=(await call('/api/teacher/learner/'+id,{cookie})).data;
  if(!detail.learner.summary||detail.events.length===0)throw Error('Aucune preuve synthétique reçue.');
  console.log('OK écriture, lecture professeur et journal d’un essai synthétique.');
 } else console.log('Contrôle en lecture seule. Ajoute SMOKE_TEACHER_PASSWORD et SMOKE_CLASS_CODE pour tester un envoi puis sa suppression.');
}catch(e){console.error(e.message);process.exitCode=1;}
finally{
 if(id&&cookie)try{await call('/api/teacher/learner/'+id,{method:'DELETE',cookie});console.log('OK session de test supprimée.');}catch{console.error('Suppression de test non confirmée : vérifie /prof.html et supprime les sessions TEST-.');process.exitCode=1;}
 if(cookie)try{await call('/api/teacher/logout',{method:'POST',cookie,data:{}});}catch{console.error('Déconnexion de test non confirmée ; le cookie expire après 8 h.');}
}
