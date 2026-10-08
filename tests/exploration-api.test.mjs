import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arcadeFixture} from './fixtures/arcade.mjs';
test('every launcher refuses broken missions and late events from a replaced assignment',async()=>{
 const old=process.env.EDEN_WORLD_ARCADE;process.env.EDEN_WORLD_ARCADE='1';const f=await arcadeFixture();
 try{
  const login=await fetch(f.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'student-a',role:'student',classId:'A1',password:f.password})});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const call=(path,body)=>fetch(f.base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const binding={lessonId:'arcade-lesson',missionId:f.mission.id};const run=await(await call('/api/game/runs',binding)).json();
  const ctx=await(await call(`/api/game/runs/${run.id}/context`)).json();assert.equal(ctx.exploration.challengeId,f.mission.id);assert.equal(ctx.exploration.map.id,'station-deck-01');
  await f.store.put('game_missions',{...f.mission,validator:'missing-validator'});
  assert.equal((await call('/api/game/runs',binding)).status,409);
  assert.equal((await call('/api/arcade/launch',{...binding,gameId:'code-station'})).status,409);
  assert.equal((await call(`/api/game/runs/${run.id}/context`)).status,409);
  const bootstrap=await(await call('/api/arcade/bootstrap')).json();assert.equal(bootstrap.games[0].missions[0].state,'locked');assert.match(bootstrap.games[0].missions[0].message,/carte compatible/);
  await f.store.put('game_missions',f.mission);
  const version=await f.store.get('lesson_versions','arcade-lesson:v1');await f.store.put('lesson_versions',{...version,spec:{...version.spec,codeStation:{missionId:'A1:assault:array:v1',worldId:'assault'}}});
  const late=await call(`/api/game/runs/${run.id}/events`,{eventId:'late-result',type:'mission_completed',payload:{files:{'battery.js':'return 80;'}}});assert.equal(late.status,400);assert.equal((await f.store.list('game_evidence')).length,0);
  assert.equal((await call(`/api/game/runs/${run.id}/progress`,{progress:ctx.progress})).status,400);
 }finally{f.server.closeAllConnections();await f.close();if(old===undefined)delete process.env.EDEN_WORLD_ARCADE;else process.env.EDEN_WORLD_ARCADE=old;}
});
