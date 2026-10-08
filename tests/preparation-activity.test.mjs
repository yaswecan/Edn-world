import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationActivity,renderPreparationActivity} from '../public/preparation-activity.js';

const time=Date.parse('2026-10-07T12:00:00Z'),at=seconds=>new Date(time+seconds*1000).toISOString();
const call={id:'one',revision:1,createdAt:at(0),profile:{model:'chosen-model'},outcome:'running',responseId:'resp',activity:{phase:'reasoning',lastSignalAt:at(5),summary:'Résumé <script>secret</script>',outputCharacters:0}};
const job={revision:1,status:'running',workerState:'active',inflight:{id:'one'},callsTrace:[call]};
test('live activity separates confirmed signals, silence, lost tracking and terminal states',()=>{
 const live=preparationActivity(job,{now:time+10000});assert.equal(live.state,'live');assert.equal(live.label,'Préparation de la réponse');assert.equal(live.duration,'10 s');assert.equal(live.modelLabel,'Modèle demandé');
 assert.equal(preparationActivity(job,{now:time+70000}).label,'En attente de signal');
 const offline=preparationActivity(job,{now:time+70000,offline:true});assert.equal(offline.state,'offline');assert.equal(offline.label,'Suivi déconnecté');
 assert.equal(preparationActivity(job,{now:time+70000,checkedAt:time}).state,'offline');
 assert.equal(preparationActivity({...job,workerState:'lease_expired'},{now:time+10000}).label,'Traitement à vérifier');
 for(const status of ['cancelled','blocked']){
  const stopped={...job,status,finishedAt:at(20)};
  assert.notEqual(preparationActivity(stopped,{now:time+30000}).state,'live');
  assert.equal(preparationActivity(stopped,{now:time+90000}).duration,'20 s');
  assert.equal(preparationActivity({...stopped,callsTrace:[{...call,outcome:'completed',completedAt:at(40)}]},{now:time+90000}).duration,'20 s');
 }
 const terminal={...job,callsTrace:[{...call,outcome:'completed',completedAt:at(25),trace:{effectiveModel:'confirmed-model'}}]};
 const data=preparationActivity(terminal,{now:time+90000});assert.equal(data.duration,'25 s');assert.equal(data.model,'confirmed-model');assert.equal(data.modelLabel,'Modèle confirmé');assert.equal(data.state,'idle');
});
test('old attempts, no signal, missing telemetry and public summary HTML remain safe to display',()=>{
 const newRevision={...job,revision:2};assert.equal(preparationActivity(newRevision).hasCall,false);
 const waiting={...job,callsTrace:[{...call,responseId:null,activity:null}]};assert.equal(preparationActivity(waiting,{now:time+10000}).state,'waiting');
 const html=renderPreparationActivity(job,{now:time+10000});assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 const historical=renderPreparationActivity({...job,status:'blocked',callsTrace:[{...call,activity:undefined}]});assert.match(historical,/Aucun résumé/);assert.doesNotMatch(historical,/NaN|undefined/);
});
