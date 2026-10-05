// OPT-IN: use a dedicated TEST branch only. Never point this at the live class.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createDatabase} from '../server/database.mjs';
import {createStore} from '../server/store.mjs';
import {createAssessmentStore} from '../server/assessment-store.mjs';
import {fresh,sanitizeState} from '../docs/app/model.js';
import {gradeDiagnostic,correctionExample} from '../server/grade.mjs';
const allowed=process.env.TEST_ALLOW_DB_WRITES==='1'&&!!process.env.TEST_DATABASE_URL;
test('Neon TEST : migration additive, copie, correction atomique, réouverture et isolation', {skip:!allowed,timeout:120000}, async()=>{
  const db=createDatabase(process.env.TEST_DATABASE_URL),store=createStore(db),assessment=createAssessmentStore(db);
  const now=Date.now(),id=randomUUID(),scope='test-integration:'+id;
  await db.migrate();
  const versions=(await db.query('SELECT version FROM eden_logic_261001.schema_version')).rows;
  assert(versions.some(r=>Number(r.version)===2));
  const s=fresh('DEMO NEON');
  s.responses={};
  for(const [step,file] of [['diag-demarrer','depart.js'],['diag-saluer','saluer.js'],['diag-doubler','doubler.js'],['diag-retour','additionner.js']])s.responses[step]={input:{code:correctionExample[file]},done:true};
  const state=sanitizeState(s),grade=gradeDiagnostic(state);
  const digest=createHash('sha256').update(JSON.stringify(state)).digest('hex');
  try {
    await store.enroll({id,scope,alias:'DEMO NEON',tokenHash:randomUUID(),credentialVersion:'test-only',expires:now+600000,now});
    await assessment.start(id,now);
    const args={id:randomUUID(),learnerId:id,scope,requestId:randomUUID(),kind:'diagnostic',now:now+1000,digest,state,grade};
    const saved=await assessment.save(args);assert.equal(saved.grade.total,20);
    assert.equal((await assessment.session(id)).final_id,args.id);
    assert.equal((await assessment.save(args)).id,args.id); // idempotent
    assert.equal(await assessment.get(args.id,'different-scope'),null);
    assert.equal((await assessment.history(id,scope)).length,1);
    assert.equal((await assessment.list(scope))[0].grade.total,20);
    const review={...grade,status:'valide',teacherNote:'Validation de test'};
    assert.equal(await assessment.review({submissionId:args.id,scope,expectedVersion:0,review,now:now+2000,actor:'test-only'}),true);
    assert.equal(await assessment.review({submissionId:args.id,scope,expectedVersion:0,review,now:now+3000,actor:'test-only'}),false);
    assert.equal((await assessment.reviewHistory(args.id,scope)).length,1);
    assert.equal(await assessment.reopen(id,scope,'Test de seconde tentative',now+4000,'test-only'),true);
    assert.equal(Number((await assessment.session(id)).attempt),2);
    assert.equal((await assessment.get(args.id,scope)).grade.total,20); // original retained
    const second=await assessment.save({...args,id:randomUUID(),requestId:randomUUID(),now:now+5000});
    assert.equal(second.attempt,2);
    assert.equal((await assessment.history(id,scope)).length,2);
  } finally { await store.remove(id,scope); }
});
