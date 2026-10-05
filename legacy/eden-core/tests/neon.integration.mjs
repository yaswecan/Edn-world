/** Opt-in REAL Neon test on an isolated TEST branch. Never silently uses DATABASE_URL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../server/database.mjs';
import {createStore} from '../server/store.mjs';
import {hash} from '../server/config.mjs';
const url=process.env.TEST_DATABASE_URL;
const enabled=!!url&&process.env.TEST_ALLOW_DB_WRITES==='1';
test('Neon réel : migration, persistance entre deux clients, concurrence, isolation et suppression',{
 skip:!enabled?'Renseigne TEST_DATABASE_URL (branche test) et TEST_ALLOW_DB_WRITES=1. Aucun test Neon réel exécuté.':false,timeout:120000
},async t=>{
 const parsed=new URL(url);assert.match(parsed.hostname,/\.neon\.tech$/);assert.match(parsed.protocol,/^postgres(?:ql)?:$/);
 const db=createDatabase(url),db2=createDatabase(url),a=createStore(db),b=createStore(db2);
 const nonce=randomBytes(12).toString('hex'),scope='integration:'+nonce,studentId=nonce;
 const now=Date.now(),auth=hash('token-'+nonce),credential='test-version',teacher=hash('teacher-'+nonce),rate='test:'+nonce;
 const base={id:studentId,scope,credentialVersion:credential,now:now+1,coreCompleted:36};
 const summary=(revision)=>({runId:nonce,revision,solved:[],baseline:false,explanation:'Test synthétique.'});
 try{
  await t.test('Migration idempotente depuis deux clients',async()=>{await Promise.all([a.ready(),b.ready()]);});
  await a.enroll({id:studentId,scope,alias:'TEST-NEON',tokenHash:auth,credentialVersion:credential,expires:now+600000,now});
  await t.test('Authentification persistante et isolation',async()=>{
   assert.equal((await b.learnerAuth(auth,scope,credential,now)).id,studentId);
   assert.equal(await b.learnerAuth(auth,'autre-classe',credential,now),null);
  });
  const e={id:nonce+':1',runId:nonce,seq:1,type:'part-installed',part:'board'};
  await t.test('Transaction, événement unique et enveloppe dédupliquée',async()=>{
   const first=await a.ingest({...base,order:1,summary:summary(1),events:[e]});assert.equal(first.acceptedEvents,1);
   const duplicate=await b.ingest({...base,order:1,summary:summary(1),events:[e]});assert.equal(duplicate.acceptedEvents,0);assert.equal(duplicate.duplicateOrOlder,true);
  });
  await t.test('Envois concurrents : aucun résumé plus ancien ne remplace le récent',async()=>{
   await Promise.all([b.ingest({...base,order:3,summary:summary(3),events:[e]}),a.ingest({...base,order:2,summary:summary(2),events:[e]})]);
   assert.equal((await b.detail(studentId,scope,0)).learner.summary.revision,3);
  });
  await t.test('Validation optimiste et retour professeur',async()=>{
   assert.equal(await a.validate({id:studentId,scope,validation:'valide',note:'Test',now,expectedRevision:2,expectedRunId:nonce}),false);
   assert.equal(await a.validate({id:studentId,scope,validation:'valide',note:'Test',now,expectedRevision:3,expectedRunId:nonce}),true);
   assert.equal((await b.list(scope,0))[0].validation,'valide');
  });
  await t.test('Sessions et limites partagées entre clients',async()=>{
   await a.createTeacher(teacher,scope,credential,now+600000);assert(await b.teacherAuth(teacher,scope,credential,now));
   assert.equal(await a.rate(rate,1,60000,now),true);assert.equal(await b.rate(rate,1,60000,now),false);
   await b.logout(teacher,scope);assert.equal(await a.teacherAuth(teacher,scope,credential,now),false);
  });
  await t.test('Suppression en cascade',async()=>{
   assert.equal(await b.remove(studentId,scope),true);assert.equal(await a.detail(studentId,scope,0),null);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM eden_bios_hub.events WHERE learner_id=$1',[studentId])).rows[0].n,0);
  });
 }finally{
  // Delete only this random test namespace. No DROP or TRUNCATE on real class tables.
  await db.transaction([
   {text:'DELETE FROM eden_bios_hub.learners WHERE class_id=$1',params:[scope]},
   {text:'DELETE FROM eden_bios_hub.teacher_sessions WHERE class_id=$1',params:[scope]},
   {text:'DELETE FROM eden_bios_hub.rate_limits WHERE bucket=$1',params:[rate]}
  ]);
 }
});
