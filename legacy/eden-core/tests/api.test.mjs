/** HTTP/API contracts with a memory repository test double. Not a live Neon test. */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHandler,readJSON,requestOrigin,validatePacket} from '../server/handler.mjs';
import {readConfig} from '../server/config.mjs';
import {createDevServer} from '../scripts/dev.mjs';
import {createMemoryStore} from './helpers/memory-store.mjs';
import {createSimulator,reduceSim} from '../docs/app/pcsim/model.js';
let server,base,student,other,cookie,now=Date.now(),sim,packet;
const store=createMemoryStore(),pwd=randomBytes(24).toString('hex'),code=randomBytes(8).toString('hex');
const env={DATABASE_URL:'postgresql://test:never-used@ep-test.neon.tech/db',TEACHER_PASSWORD:pwd,CLASS_CODE:code,CRON_SECRET:randomBytes(32).toString('hex')};
const handler=createHandler({env,store,clock:()=>now,log:()=>{}});
before(async()=>{server=createDevServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
async function req(path,{method='GET',data,token,cookie:ck,headers={}}={}){
 const r=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(ck?{Cookie:ck}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie'),cache:r.headers.get('cache-control')};
}
test('API/config : backend prêt sans secrets',async()=>{const r=await req('config');assert.equal(r.status,200);assert.equal(r.data.backend,'neon');assert.equal(r.data.enabled,true);assert(!JSON.stringify(r).includes(code));assert(!JSON.stringify(r).includes(pwd));assert.equal(r.cache,'no-store');});
test('API/health : sonde sans secret',async()=>{assert.deepEqual((await req('health')).data,{ok:true,backend:'neon',schema:1});});
test('API : tableau professeur protégé',async()=>assert.equal((await req('teacher/learners')).status,401));
test('API : mauvais code de classe',async()=>assert.equal((await req('enroll',{method:'POST',data:{alias:'A17',classCode:'non'}})).status,403));
test('API : alias contrôlé',async()=>assert.equal((await req('enroll',{method:'POST',data:{alias:'<script>',classCode:code}})).status,400));
test('API : inscriptions séparées même alias',async()=>{student=(await req('enroll',{method:'POST',data:{alias:'A17',classCode:code}})).data;other=(await req('enroll',{method:'POST',data:{alias:'A17',classCode:code}})).data;assert(student.token);assert.notEqual(student.studentId,other.studentId);});
test('API : essais sans session refusés',async()=>assert.equal((await req('events',{method:'POST',data:{}})).status,401));
test('API : token élève inutilisable comme professeur',async()=>assert.equal((await req('teacher/learners',{token:student.token})).status,401));
test('API : stockage d’un essai puis reçu',async()=>{sim=reduceSim(createSimulator(8),{type:'INSTALL',id:'cpu',slot:'socket'}).state;packet={packetId:'packet-1',order:1,coreCompleted:36,simulator:sim};const r=await req('events',{method:'POST',token:student.token,data:packet});assert.equal(r.status,200);assert.equal(r.data.acceptedEvents,1);assert(r.data.receivedAt);});
test('API : renvoi idempotent',async()=>{const r=await req('events',{method:'POST',token:student.token,data:packet});assert.equal(r.data.acceptedEvents,0);assert.equal(r.data.duplicateOrOlder,true);});
test('API : login professeur et cookie HttpOnly',async()=>{const r=await req('teacher/login',{method:'POST',data:{password:pwd}});assert.equal(r.status,200);assert(r.cookie.includes('HttpOnly'));assert(r.cookie.includes('SameSite=Strict'));cookie=r.cookie.split(';')[0];});
test('API : tableau sans jetons',async()=>{const r=await req('teacher/learners',{cookie});assert.equal(r.status,200);assert.equal(r.data.learners.length,2);assert.equal(r.data.learners.find(l=>l.id===student.studentId).summary.errors,1);assert(!JSON.stringify(r.data).includes(student.token));assert(!JSON.stringify(r.data).includes('tokenHash'));});
test('API : événement reçu visible dans le détail',async()=>{const r=await req('teacher/learner/'+student.studentId,{cookie});assert.equal(r.data.events.length,1);assert.equal(r.data.events[0].type,'action-refused');});
test('API : validation par élève refusée',async()=>{assert.equal((await req('teacher/learner/'+student.studentId,{method:'POST',token:student.token,data:{validation:'valide'}})).status,401);});
test('API : validation humaine sur la bonne révision',async()=>{const s=(await req('teacher/learner/'+student.studentId,{cookie})).data.learner.summary;const r=await req('teacher/learner/'+student.studentId,{method:'POST',cookie,data:{validation:'a-revoir',note:'Explique le point d’arrêt.',expectedRevision:s.revision,expectedRunId:s.runId}});assert.equal(r.status,200);});
test('API : nouvelle preuve remet à valider',async()=>{sim=reduceSim(sim,{type:'EXPLAIN',text:'La carte mère doit être installée avant le CPU.'}).state;const r=await req('events',{method:'POST',token:student.token,data:{...packet,packetId:'packet-2',order:2,simulator:sim}});assert.equal(r.status,200);const l=(await req('teacher/learner/'+student.studentId,{cookie})).data.learner;assert.equal(l.validation,'a-valider');assert.equal(l.summary.explanation,sim.explanation);});
test('API : validation périmée retourne 409',async()=>{const r=await req('teacher/learner/'+student.studentId,{method:'POST',cookie,data:{validation:'valide',expectedRevision:-1,expectedRunId:'old'}});assert.equal(r.status,409);});
test('API : ancien paquet ne remplace pas le récent',async()=>{await req('events',{method:'POST',token:student.token,data:packet});assert.equal((await req('teacher/learner/'+student.studentId,{cookie})).data.learner.summary.explanation,sim.explanation);});
test('API : origine étrangère refusée',async()=>{assert.equal((await req('events',{method:'POST',token:student.token,data:packet,headers:{Origin:'https://foreign.example'}})).status,403);});
test('API : requête cross-site refusée',async()=>{assert.equal((await req('teacher/learners',{cookie,headers:{'sec-fetch-site':'cross-site'}})).status,403);});
test('API : evenement hors contrat sans écritures partielles',async()=>{const raw=structuredClone(sim);raw.seq++;raw.events.push({id:'bad',runId:raw.runId,seq:raw.seq,type:'inject-script'});const r=await req('events',{method:'POST',token:student.token,data:{...packet,order:3,simulator:raw}});assert.equal(r.status,400);assert.equal((await req('teacher/learner/'+student.studentId,{cookie})).data.events.length,1);});
test('API : progression falsifiée hors bornes refusée',async()=>{assert.equal((await req('events',{method:'POST',token:student.token,data:{...packet,coreCompleted:999}})).status,400);});
test('API : mauvais Content-Type refusé',async()=>{assert.equal((await req('teacher/login',{method:'POST',data:{password:pwd},headers:{'Content-Type':'text/plain'}})).status,415);});
test('API : méthodes non prévues refusées',async()=>{assert.equal((await req('config',{method:'POST',data:{}})).status,405);});
test('API : POST volumineux refusé',async()=>{assert.equal((await req('events',{method:'POST',token:student.token,data:{x:'x'.repeat(300001)}})).status,413);});
test('API : JSON cassé retourne 400',async()=>{const r=await fetch(base+'/api/enroll',{method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid'});assert.equal(r.status,400);});
test('API : cron protégé',async()=>{assert.equal((await req('cron')).status,401);assert.equal((await req('cron',{headers:{Authorization:'Bearer '+env.CRON_SECRET}})).status,200);});
test('API : site public, aucun fichier serveur',async()=>{assert.equal((await fetch(base+'/app/pcsim/model.js')).status,200);assert.equal((await fetch(base+'/.env.local')).status,404);assert.equal((await fetch(base+'/server/handler.mjs')).status,404);});
test('API : suppression et révocation jeton',async()=>{assert.equal((await req('teacher/learner/'+student.studentId,{method:'DELETE',cookie})).status,200);assert.equal((await req('events',{method:'POST',token:student.token,data:packet})).status,401);assert.equal((await req('teacher/learner/'+student.studentId,{cookie})).status,404);});
test('API : session professeur expirée',async()=>{now+=9*3600000;assert.equal((await req('teacher/learners',{cookie})).status,401);now-=9*3600000;});
test('API : logout et révocation',async()=>{assert.equal((await req('teacher/logout',{method:'POST',cookie,data:{}})).status,200);assert.equal((await req('teacher/learners',{cookie})).status,401);});
test('API : rate limit partagé par deux instances de handler',async()=>{
 const a=createHandler({env,store,clock:()=>now}),b=createHandler({env,store,clock:()=>now});
 const servers=[createDevServer(a),createDevServer(b)];await Promise.all(servers.map(s=>new Promise(r=>s.listen(0,'127.0.0.1',r))));
 const statuses=[];for(let i=0;i<14;i++){const url=`http://127.0.0.1:${servers[i%2].address().port}/api/teacher/login`;statuses.push((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})})).status);}
 assert(statuses.includes(429));await Promise.all(servers.map(s=>{s.closeAllConnections();return new Promise(r=>s.close(r));}));
});
test('Vercel : parsed body object, string, buffer and getter errors',async()=>{
 const headers={'content-type':'application/json'};
 assert.deepEqual(await readJSON({headers,body:{ok:1}}),{ok:1});
 assert.deepEqual(await readJSON({headers,body:'{"ok":2}'}),{ok:2});
 assert.deepEqual(await readJSON({headers,body:Buffer.from('{"ok":3}')}),{ok:3});
 await assert.rejects(readJSON({headers,get body(){throw Error('parse');}}),e=>e.status===400);
 await assert.rejects(readJSON({headers,body:[]}),e=>e.status===400);
});
test('Vercel : origine HTTPS et configuration vide explicites',async()=>{
 const cfg=readConfig({...env,VERCEL:'1'});assert.equal(requestOrigin({headers:{host:'classe.vercel.app',origin:'https://classe.vercel.app'}},cfg),'https://classe.vercel.app');
 assert.equal(readConfig({RETENTION_DAYS:''}).retentionDays,30);assert.equal(readConfig({}).configured,false);
 const local=createDevServer(createHandler({env:{},store}));await new Promise(r=>local.listen(0,'127.0.0.1',r));
 const r=await fetch(`http://127.0.0.1:${local.address().port}/api/config`);assert.equal((await r.json()).enabled,false);
 local.closeAllConnections();await new Promise(r=>local.close(r));
});
test('Vercel : échec DB sans URL ni stack dans la réponse',async()=>{
 const bad=createDevServer(createHandler({env,store:{ready(){throw Error('postgresql://secret:password@private');}},log:()=>{}}));await new Promise(r=>bad.listen(0,'127.0.0.1',r));
 const r=await fetch(`http://127.0.0.1:${bad.address().port}/api/health`);assert.equal(r.status,503);assert(!(await r.text()).includes('password'));
 bad.closeAllConnections();await new Promise(r=>bad.close(r));
});
test('PostgreSQL contrat : isolation de classe et rétention du repository',async()=>{
 const m=createMemoryStore();await m.enroll({id:'x',scope:'production:a',alias:'A1',tokenHash:'a',credentialVersion:'v',expires:1000,now:10});
 assert.equal(await m.learnerAuth('a','preview:a','v',20),undefined);
 assert.equal((await m.list('preview:a',0)).length,0);
 assert.equal((await m.cleanup('production:a',11,20)).deletedLearners,1);
});
