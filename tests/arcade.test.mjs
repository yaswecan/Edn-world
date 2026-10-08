import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as css from 'css-tree';
import {arcadeFixture} from './fixtures/arcade.mjs';
import {hash} from '../server/importer.mjs';
let fixture, cookies={},runId, protectedBefore;
const protectedTables=['teachers','learners','lessons','lesson_versions','game_missions','game_worlds','game_unlocks','game_teacher_overrides','corrections','submissions'];
async function protectedSnapshot(){return Object.fromEntries(await Promise.all(protectedTables.map(async table=>[table,(await fixture.store.list(table)).map(({arcadeProfile,...row})=>row)])));}
const originalFlag=process.env.EDEN_WORLD_ARCADE;
async function call(path,{method='GET',body,actor='student-a',origin}={}){
  const r=await fetch(fixture.base+path,{method,headers:{'Content-Type':'application/json',...(cookies[actor]?{Cookie:cookies[actor]}:{}),...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,data:await r.json().catch(()=>null),headers:r.headers};
}
before(async()=>{
 process.env.EDEN_WORLD_ARCADE='1';fixture=await arcadeFixture();protectedBefore=await protectedSnapshot();
 for(const id of ['teacher-a','teacher-b','student-a','student-b','student-other']){
  const result=await call('/api/login',{method:'POST',actor:'guest',body:{role:id.startsWith('teacher')?'teacher':'student',username:id,password:fixture.password,classId:['teacher-b','student-other'].includes(id)?'B1':'A1'}});
  assert.equal(result.status,200);cookies[id]=result.headers.get('set-cookie').split(';')[0];
 }
 // Adversarial future external session: even a server-issued session cannot read school APIs.
 await fixture.store.insert('sessions',{id:hash('synthetic-external-token'),classId:'OUTSIDE',userId:'external',role:'external',expiresAt:'2099-01-01T00:00:00.000Z'});
 cookies.external='eden_session=synthetic-external-token';
});
after(async()=>{if(originalFlag===undefined)delete process.env.EDEN_WORLD_ARCADE;else process.env.EDEN_WORLD_ARCADE=originalFlag;await fixture?.close();});
test('arcade flag protects HTML, assets and APIs; rollback keeps legacy login',async()=>{
 process.env.EDEN_WORLD_ARCADE='0';
 for(const path of ['/arcade','/world-arcade/index.html','/%77orld-arcade/index.html','/world-arcade/app.js','/api/arcade/bootstrap'])assert.equal((await call(path,{actor:'guest'})).status,404);
 assert.equal((await call('/api/session')).status,200);process.env.EDEN_WORLD_ARCADE='1';
});
test('catalogue is public, real session is reused, Cyber Funk absent and no fictitious rewards',async()=>{
 const guest=(await call('/api/arcade/bootstrap',{actor:'guest'})).data;assert.equal(guest.account,null);assert.equal(guest.games[0].state,'auth_required');assert.equal(guest.games[1].state,'unavailable');
 const data=(await call('/api/arcade/bootstrap')).data;assert.equal(data.account.role,'student');assert.equal(data.games[0].missions[0].hasSave,true);assert.equal(data.account.profile.grade,null);
 for(const value of Object.values(data.capabilities))assert.equal(value,false);
 assert.doesNotMatch(JSON.stringify(data),/Identité privée|example.invalid|passwordHash|username|classId/);
});
test('visitor and external directory denial covers pagination, search, detail, profile and top',async()=>{
 for(const actor of ['guest','external'])for(const path of ['/api/arcade/players','/api/arcade/players?q=NOM&page=2&limit=24','/api/arcade/players/opaque-01','/api/arcade/profile','/api/arcade/leaderboard'])assert.equal((await call(path,{actor})).status,actor==='guest'?401:403,path);
});
test('scoping precedes count, search and pagination; teachers are confined to own class',async()=>{
 const page1=(await call('/api/arcade/players')).data;assert.equal(page1.total,27);assert.equal(page1.players.length,24);assert.equal(page1.hasMore,true);
 const page2=(await call('/api/arcade/players?page=2')).data;assert.equal(page2.players.length,3);assert.equal(page2.hasMore,false);
 assert.equal((await call('/api/arcade/players?q=29')).data.total,0);
 assert.equal((await call('/api/arcade/players/opaque-29')).status,404);
 assert.equal((await call('/api/arcade/players/opaque-28')).status,404);
 assert.equal((await call('/api/arcade/players',{actor:'teacher-a'})).data.total,28);
 assert.equal((await call('/api/arcade/players',{actor:'teacher-b'})).data.total,1);
 assert.equal((await call('/api/arcade/players/opaque-01',{actor:'teacher-b'})).status,404);
 for(const params of ['scope=community','classId=B1','page=-1','limit=100','q[x]=y'])assert.ok((await call('/api/arcade/players?'+params)).status>=400,params);
 for(const p of page1.players)assert.deepEqual(Object.keys(p),['publicId','handle','avatarId','grade','featuredBadges']);
});
test('profile is persisted on existing account; identity fields and school data are preserved',async()=>{
 const before=await fixture.store.get('learners','student-a');
 const body={handle:'Aster',avatarId:'04',visibility:'private'};
 const saved=await call('/api/arcade/profile',{method:'PUT',body});assert.equal(saved.status,200);assert.ok(saved.data.publicId);
 const after=await fixture.store.get('learners','student-a');const {arcadeProfile,...unchanged}=after;assert.deepEqual(unchanged,before);
 assert.equal((await call('/api/arcade/players/'+saved.data.publicId,{actor:'student-b'})).status,404);
 await call('/api/arcade/profile',{method:'PUT',body:{...body,visibility:'class'}});
 assert.equal((await call('/api/arcade/players/'+saved.data.publicId,{actor:'student-b'})).status,200);
 await call('/api/arcade/profile',{method:'PUT',body});assert.equal((await call('/api/arcade/players/'+saved.data.publicId,{actor:'student-b'})).status,404);
 assert.equal((await call('/api/arcade/players/'+saved.data.publicId,{actor:'teacher-a'})).status,200);
 assert.equal((await call('/api/arcade/profile')).data.publicId,saved.data.publicId);
});
test('profile rejects roles, rewards, public visibility, XSS and origin forgery',async()=>{
 const valid={handle:'Aster',avatarId:'04',visibility:'private'};
 for(const body of [{...valid,role:'teacher'},{...valid,xp:9000},{...valid,classId:'B1'},{...valid,visibility:'community'},{...valid,avatarId:'../../secret'},{...valid,handle:'<script>alert(1)</script>'}])assert.equal((await call('/api/arcade/profile',{method:'PUT',body})).status,400);
 assert.equal((await call('/api/arcade/profile',{method:'PUT',body:valid,origin:'https://evil.invalid'})).status,403);
});
test('public registration and email operations stay closed including malicious role requests',async()=>{
 for(const action of ['register','verify-email','resend-verification','recover-password','reset-password'])assert.equal((await call('/api/arcade/auth/'+action,{method:'POST',actor:'guest',body:{role:'teacher',classId:'A1',token:'expired'}})).status,503);
 assert.equal((await call('/api/login',{method:'POST',actor:'guest',body:{role:'external',username:'external',password:fixture.password}})).status,400);
});
test('launch authorizes real assignment and is idempotent across concurrent fresh requests',async()=>{
 const body={gameId:'code-station',lessonId:'arcade-lesson',missionId:fixture.mission.id};
 const result=await Promise.all(Array.from({length:5},()=>call('/api/arcade/launch',{method:'POST',body})));
 assert.ok(result.every(r=>r.status===200));assert.equal(new Set(result.map(r=>r.data.runId)).size,1);runId=result[0].data.runId;
 assert.equal((await fixture.store.list('game_runs','A1')).length,1);
 const context=(await call(`/api/game/runs/${runId}/context`)).data;assert.deepEqual(context.progress,fixture.save);assert.equal(context.worldId,fixture.mission.world);assert.equal(context.missionId,fixture.mission.localId);
 assert.equal(context.worlds[fixture.mission.world].missions.length,1);
 for(const actor of ['guest','teacher-a','student-other','external'])assert.ok((await call('/api/arcade/launch',{method:'POST',body,actor})).status>=400,actor);
 const second=await call('/api/arcade/launch',{method:'POST',body,actor:'student-b'});assert.equal(second.status,200);assert.notEqual(second.data.runId,runId);
 const secondContext=await call(`/api/game/runs/${second.data.runId}/context`,{actor:'student-b'});assert.equal(secondContext.status,200);assert.equal(secondContext.data.progress,null);
 assert.equal((await fixture.store.list('learning_events','A1')).filter(e=>e.learnerId==='student-b').length,0);
});
test('Code Station opens a prerequisite world for every class student without invented progress',async()=>{
 const original=await fixture.store.get('lesson_versions','arcade-lesson:v1');
 const mission=(await fixture.store.list('game_missions','A1')).find(m=>m.world==='assault');
 const before=Object.fromEntries(await Promise.all(['learning_events','game_evidence','evidence','game_teacher_overrides'].map(async t=>[t,await fixture.store.list(t)])));
 try {
  await fixture.store.put('lesson_versions',{...original,spec:{...original.spec,codeStation:{missionId:mission.id,worldId:mission.world,unlockAfter:'transfer'}}});
  for(const actor of ['student-a','student-b']){
   const games=(await call('/api/arcade/bootstrap',{actor})).data.games;assert.equal(games[0].state,'available');assert.equal(games[0].missions[0].state,'available');
   const launched=await call('/api/arcade/launch',{method:'POST',actor,body:{gameId:'code-station',lessonId:'arcade-lesson',missionId:mission.id}});assert.equal(launched.status,200);
   const context=await call(`/api/game/runs/${launched.data.runId}/context`,{actor});assert.equal(context.status,200);assert.equal(context.data.worldId,mission.world);
  }
  const direct=await call('/api/game/runs',{method:'POST',actor:'student-b',body:{lessonId:'arcade-lesson',missionId:mission.id}});assert.equal(direct.status,200);
  for(const [table,rows] of Object.entries(before))assert.deepEqual(await fixture.store.list(table),rows);
 } finally {await fixture.store.put('lesson_versions',original);}
});
test('forged destinations, unknown bindings and foreign saves are refused',async()=>{
 const body={gameId:'code-station',lessonId:'arcade-lesson',missionId:fixture.mission.id};
 for(const extra of [{gameId:'unknown'},{gameId:'toString'},{gameId:'cyber-funk'},{url:'https://evil.invalid'},{returnTo:'//evil.invalid'},{playerId:'student-b'},{missionId:'B1:code-station:missing:v1'}])assert.ok((await call('/api/arcade/launch',{method:'POST',body:{...body,...extra}})).status>=400);
 for(const actor of ['student-b','student-other'])for(const [method,path,body] of [['GET',`/api/game/runs/${runId}/context`],['POST',`/api/game/runs/${runId}/progress`,{progress:{}}],['POST',`/api/game/runs/${runId}/complete`,{eventId:'fake',payload:{}}]])assert.ok((await call(path,{method,body,actor})).status>=400);
});
test('existing runs stay open without autonomy but enforce assignment and publication',async()=>{
 const e=await fixture.store.get('learning_events','unlocked-a');await fixture.store.remove('learning_events',e.id);
 assert.equal((await call(`/api/game/runs/${runId}/context`)).status,200);
 assert.equal((await call(`/api/game/runs/${runId}/progress`,{method:'POST',body:{progress:fixture.save}})).status,200);
 await fixture.store.insert('learning_events',e);
 const version=await fixture.store.get('lesson_versions','arcade-lesson:v1');await fixture.store.put('lesson_versions',{...version,spec:{...version.spec,codeStation:null}});
 assert.equal((await call(`/api/game/runs/${runId}/context`)).status,400);await fixture.store.put('lesson_versions',version);
 const lesson=await fixture.store.get('lessons','arcade-lesson');await fixture.store.put('lessons',{...lesson,status:'closed'});
 assert.equal((await call(`/api/game/runs/${runId}/context`)).status,409);await fixture.store.put('lessons',lesson);
});
test('save round trip preserves existing format, rejects invalid data, confirms only persistence',async()=>{
 const progress=structuredClone(fixture.save);progress.worldProgress[fixture.mission.world].drafts[fixture.mission.localId].files[Object.keys(fixture.mission.files)[0]]='return 42;';
 const saved=await call(`/api/game/runs/${runId}/progress`,{method:'POST',body:{progress:{...progress,evidence:[{approved:true}]}}});assert.equal(saved.status,200);assert.ok(saved.data.receivedAt);
 assert.deepEqual((await call(`/api/game/runs/${runId}/context`)).data.progress,progress);
 assert.equal((await call(`/api/game/runs/${runId}/progress`,{method:'POST',body:{progress:[]}})).status,400);
 assert.equal((await call(`/api/game/runs/${runId}/progress`,{method:'POST',body:{progress:{text:'x'.repeat(150001)}}})).status,400);
});
test('client completions never award verified points or grades, even with new event IDs',async()=>{
 await Promise.all(Array.from({length:4},(_,i)=>call(`/api/game/runs/${runId}/complete`,{method:'POST',body:{eventId:`fresh-${i}`,payload:{completed:true,xp:999999,grade:'legend',files:{}}}})));
 const proof=await fixture.store.list('game_evidence','A1');assert.equal(proof.length,1);assert.equal(proof[0].approved,false);assert.equal(proof[0].status,'review_required');
 assert.equal((await fixture.store.list('evidence','A1')).length,0);
 assert.equal((await call('/api/arcade/profile')).data.grade,null);
 const top=(await call('/api/arcade/leaderboard')).data;assert.equal(top.status,'unavailable');assert.deepEqual(top.entries,[]);assert.deepEqual(top.periods,[]);assert.equal(top.personalPosition,null);
 assert.equal((await call('/api/arcade/leaderboard?period=week')).status,400);
 assert.deepEqual((await call('/api/arcade/ranks')).data.ranks,[]);
});
test('private responses are not cached and logout invalidates the host session',async()=>{
 assert.equal((await call('/api/arcade/players')).headers.get('cache-control'),'no-store');
 assert.equal((await call('/api/logout',{actor:'student-b',method:'POST'})).status,200);
 assert.equal((await call('/api/arcade/profile',{actor:'student-b'})).status,401);
});
test('production serves no integration documents or prototype; styles and scripts stay confined',async()=>{
 for(const path of ['/TWEEN_TEACH_WORLD_ARCADE/00_LIRE_DABORD.md','/TWEEN_TEACH_WORLD_ARCADE/FRONT_REFERENCE/WORLD_ARCADE_AUTONOME.html','/world-arcade/js/data.js'])assert.equal((await call(path,{actor:'guest'})).status,404);
 const js=await readFile('public/world-arcade/app.js','utf8');assert.doesNotMatch(js,/ArcadeData|ArcadeGames|demo-complete|getDemoState/);
 const ast=css.parse(await readFile('public/world-arcade/style.css','utf8'));
 css.walk(ast,{visit:'Rule',enter(n){if(this.atrule?.name.endsWith('keyframes'))return;for(const selector of css.generate(n.prelude).split(','))assert.ok(selector.trim().startsWith('.world-arcade'),selector);}});
 const html=await readFile('public/world-arcade/index.html','utf8');assert.doesNotMatch(html,/fonts.googleapis|js\/games.js|js\/data.js|canvas/);
});
test('arcade leaves original identities, lesson versions, missions, unlocks and school records intact',async()=>{
 assert.deepEqual(await protectedSnapshot(),protectedBefore);
});
