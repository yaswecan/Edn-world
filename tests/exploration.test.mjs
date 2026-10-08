import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalog,explorationForMission} from '../server/game.mjs';
const M=globalThis.StationModel;
const fixtures=Object.entries(catalog).flatMap(([world,w])=>w.missions.map(m=>({...m,world,id:`A1:${world}:${m.id}:v1`,localId:m.id,version:1})));
test('all twenty catalogue missions have reachable staged maps and explicit victory',()=>{
 assert.equal(fixtures.length,20);assert.equal(new Set(fixtures.map(m=>explorationForMission(m).map.id)).size,5);
 for(const m of fixtures){const def=explorationForMission(m);assert.deepEqual(M.validate(def,m),[],m.id);assert.equal(def.steps.filter(s=>s.kind==='challenge').length,1);assert.equal(def.steps.find(s=>s.kind==='challenge').challengeId,m.id);assert.ok(def.map.rooms.length>=4);assert.ok(def.map.scenery.length>=4);}
});
test('unreachable objects, missing challenges, circular dependencies and unsupported effects fail closed',()=>{
 const m=fixtures[0],def=explorationForMission(m);
 for(const mutate of [d=>d.map.id='missing',d=>d.map.objects=d.map.objects.filter(o=>o.id!=='workstation'),d=>d.steps[1].challengeId='another-challenge',d=>d.steps[0].requires=['finish'],d=>d.steps[1].effects.push({type:'executeCode',target:'exit'}),d=>d.map.objects.find(o=>o.id==='relay').nav={x:1,y:1},d=>d.map.spawn={x:Infinity,y:0}]){const invalid=structuredClone(def);mutate(invalid);assert.ok(M.validate(invalid,m).length);}
 assert.throws(()=>explorationForMission({...m,world:'absent'}),/indisponible/);
 assert.throws(()=>explorationForMission({...m,validator:'untrusted-validator'}),/indisponible/);
 assert.throws(()=>explorationForMission({...m,files:{},scenarios:[]}),/indisponible/);
});
test('closed doors actually separate the next required area; opening the relay cannot finish the mission',()=>{
 for(const m of fixtures){const def=explorationForMission(m),state=M.restore(def),relay=def.map.objects.find(o=>o.id==='relay'),terminal=def.map.objects.find(o=>o.id==='workstation'),exit=def.map.objects.find(o=>o.id==='exit');
  assert.equal(M.path(def.map,def.map.spawn,terminal.nav).length,0,m.id+' console locked');
  assert.equal(M.path(def.map,def.map.spawn,exit.nav).length,0,m.id+' exit locked');
  assert.equal(M.applyEffects(def,state,'finish'),false);
  assert.equal(M.applyEffects(def,state,'repair'),false);
  assert.ok(M.applyEffects(def,state,'relay'));assert.ok(M.path(def.map,relay.nav,terminal.nav,state.opened).length);
  assert.equal(M.path(def.map,terminal.nav,exit.nav,state.opened).length,0);
  assert.ok(M.applyEffects(def,state,'repair'));assert.ok(M.path(def.map,terminal.nav,exit.nav,state.opened).length);
  const before=structuredClone(state);assert.equal(M.applyEffects(def,state,'repair'),false);assert.deepEqual(state,before);
 }
});
test('saved state replays allowed effects, rejects cross-mission results and repairs invalid positions',()=>{
 const a=explorationForMission(fixtures[0]),b=explorationForMission(fixtures[1]);const state=M.restore(a);
 M.applyEffects(a,state,'relay');M.applyEffects(a,state,'repair');state.position={x:-999,y:0};state.opened.push('invented');state.done.push('invented');
 const resumed=M.restore(a,state);assert.deepEqual(resumed.done,['relay','repair']);assert.ok(!resumed.opened.includes('invented'));assert.deepEqual(resumed.position,a.map.spawn);assert.equal(resumed.won,false);
 assert.deepEqual(M.restore(b,state).done,[]);
 const invalid={...state,done:['repair','finish']};assert.deepEqual(M.restore(a,invalid).done,[]);
 const adapted=explorationForMission({...fixtures[0],version:2,scenarios:[{name:'Adapted',input:{},expected:90}]});assert.notEqual(adapted.signature,a.signature);assert.deepEqual(M.restore(adapted,state).done,[]);
});
test('movement substeps cannot cross walls, doors or obstacles during a stalled frame',()=>{
 const def=explorationForMission(fixtures.find(m=>m.world==='assault')),map=def.map;
 const p={x:1230,y:490};assert.ok(M.walkable(map,p.x,p.y));const stopped=M.move(map,p,0,-900,[]);assert.ok(stopped.y>map.doors[0].y+map.doors[0].h);
 const open=M.move(map,p,0,-130,['access']);assert.ok(open.y<map.doors[0].y);
 const wall=M.move(map,map.spawn,-500,0,[]);assert.ok(M.walkable(map,wall.x,wall.y));assert.ok(wall.x>=112);
 const crate={x:490,y:580};const blocked=M.move(map,crate,200,0,[]);assert.ok(blocked.x<map.scenery[1].x);
 assert.equal(M.sight(map,p,{x:1230,y:400},[]),false);
});
