import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {arcadeFixture} from './fixtures/arcade.mjs';
import {hash} from '../server/importer.mjs';
import {validateFeatured} from '../server/arcade-profile.mjs';
import {nextFeatured,badgeDialog} from '../public/world-arcade/account-views.js';
let fixture,cookies={},profileId,runId;
const oldFlag=process.env.EDEN_WORLD_ARCADE;
async function call(path,{method='GET',body,actor='student-a',cookie,origin}={}) {
 const r=await fetch(fixture.base+path,{method,headers:{'Content-Type':'application/json',...(cookie||cookies[actor]?{Cookie:cookie||cookies[actor]}:{}),...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json().catch(()=>null),headers:r.headers};
}
async function login(actor='student-a',password=fixture.password) {
 const r=await call('/api/login',{method:'POST',actor:'guest',body:{role:actor.startsWith('teacher')?'teacher':'student',username:actor,password,classId:['student-other','teacher-b'].includes(actor)?'B1':'A1'}});
 if(r.status===200)cookies[actor]=r.headers.get('set-cookie').split(';')[0];return r;
}
const valid=(handle='Nova')=>({handle,avatarId:'05',visibility:'private'});
before(async()=>{
 process.env.EDEN_WORLD_ARCADE='1';fixture=await arcadeFixture();
 for(const a of ['student-a','student-b','student-other','teacher-a','teacher-b'])assert.equal((await login(a)).status,200);
 await fixture.store.insert('sessions',{id:hash('synthetic-external-account'),classId:'OUTSIDE',userId:'external',role:'external',expiresAt:'2099-01-01T00:00:00Z'});
 cookies.external='eden_session=synthetic-external-account';
});
after(async()=>{await fixture?.close();if(oldFlag===undefined)delete process.env.EDEN_WORLD_ARCADE;else process.env.EDEN_WORLD_ARCADE=oldFlag;});
test('idempotent initial profile has no civil AKA, is private, and does not duplicate host account',async()=>{
 const count=(await fixture.store.list('learners')).length;
 const responses=await Promise.all(Array.from({length:6},()=>call('/api/arcade/profile/ensure',{method:'POST',body:{}})));
 assert.ok(responses.every(r=>r.status===200));assert.equal(new Set(responses.map(r=>r.data.publicId)).size,1);profileId=responses[0].data.publicId;
 assert.equal(responses[0].data.needsPersonalization,true);assert.equal(responses[0].data.handle,'');assert.equal(responses[0].data.visibility,'private');
 assert.equal((await fixture.store.list('learners')).length,count);assert.equal((await call('/api/arcade/players')).data.total,27);
});
test('concurrent AKA reservation is canonical and class scoped, with no owner information',async()=>{
 const responses=await Promise.all([call('/api/arcade/profile',{method:'PUT',body:valid('Nova')}),call('/api/arcade/profile',{method:'PUT',body:valid('NOVA'),actor:'student-b'})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal(responses.find(r=>r.status===409).data.error,'Cet AKA n’est pas disponible.');
 // Release either winner and choose distinct, predictable identities for following checks.
 await call('/api/arcade/profile',{method:'PUT',body:valid('Comete'),actor:'student-b'});
 assert.equal((await call('/api/arcade/profile',{method:'PUT',body:valid()})).status,200);
 assert.equal((await call('/api/arcade/profile',{method:'PUT',body:valid('Ｎｏｖａ'),actor:'teacher-a'})).status,409);
 assert.equal((await call('/api/arcade/profile',{method:'PUT',body:valid('NOVA'),actor:'student-other'})).status,200);
 assert.equal((await call('/api/arcade/profile')).data.publicId,profileId);
});
test('format, reserved identities, avatar catalogue, mass assignment and origin are enforced',async()=>{
 for(const handle of ['<img src=x onerror=alert(1)>','x','a'.repeat(25),'Admin','Professeur','World_Arcade'])assert.ok((await call('/api/arcade/profile',{method:'PUT',body:valid(handle)})).status>=400);
 for(const extra of [{userId:'student-b'},{grade:'legend'},{xp:1234},{email:'x@example.invalid'},{arcadeAwards:{'premier-signal':{}}},{featuredBadgeIds:['fake']},{avatarId:'99'},{avatarId:4},{visibility:'community'}])assert.equal((await call('/api/arcade/profile',{method:'PUT',body:{...valid(),...extra}})).status,400);
 assert.equal((await call('/api/arcade/profile',{method:'PUT',body:valid(),origin:'https://outside.invalid'})).status,403);
 assert.equal((await call('/api/arcade/avatars')).data.avatars.length,15);
 assert.equal((await call('/api/arcade/profile')).data.handle,'Nova');
});
test('AKA and avatar survive a fresh session without changing identity, saves or rewards',async()=>{
 const before=await fixture.store.get('learners','student-a'),saves=await fixture.store.list('player_progression');
 const result=await call('/api/arcade/profile',{method:'PUT',body:{...valid('Étoile bleue'),visibility:'class',avatarId:'12'}});assert.equal(result.status,200);
 const {arcadeProfile:_,...after}=await fixture.store.get('learners','student-a');const {arcadeProfile:__,...original}=before;assert.deepEqual(after,original);
 assert.deepEqual(await fixture.store.list('player_progression'),saves);
 assert.equal((await call(`/api/arcade/players/${profileId}`,{actor:'student-b'})).data.handle,'Étoile bleue');
 assert.equal((await login()).status,200);assert.equal((await call('/api/arcade/profile')).data.avatarId,'12');
});
test('space distinguishes no badges and saved game progression, resumes only an authorized saved mission',async()=>{
 const space=(await call('/api/arcade/space')).data;assert.equal(space.profile.handle,'Étoile bleue');assert.equal(space.progression.status,'ready');assert.equal(space.badges.status,'ready');assert.equal(space.badges.badges.filter(b=>b.earned).length,0);
 assert.equal(space.resume.missionId,fixture.mission.id);assert.equal((await call('/api/arcade/space',{actor:'student-b'})).data.resume,null);
 const result=await call('/api/arcade/launch',{method:'POST',body:space.resume});assert.equal(result.status,200);runId=result.data.runId;
 const lesson=await fixture.store.get('lessons','arcade-lesson');await fixture.store.put('lessons',{...lesson,status:'closed'});
 assert.equal((await call('/api/arcade/space')).data.resume,null);assert.equal((await call('/api/arcade/launch',{method:'POST',body:space.resume})).status,409);
 await fixture.store.put('lessons',lesson);
});
test('only teacher-approved host evidence grants one stable badge across concurrent requests',async()=>{
 const saves=await fixture.store.list('player_progression');
 await Promise.all([1,2].map(i=>call(`/api/game/runs/${runId}/complete`,{method:'POST',body:{eventId:`forged-${i}`,payload:{xp:90000,grade:'Legend',completed:true}}})));
 assert.equal((await call('/api/arcade/badges')).data.badges[0].earned,false);
 assert.equal((await call('/api/arcade/badges/featured',{method:'PUT',body:{badgeIds:['premier-signal']}})).status,400);
 const proof=(await fixture.store.list('game_evidence','A1'))[0];
 const approval={reason:'Validation synthétique de recette',criteria:fixture.mission.competencies.map(criterion=>({criterion,level:'A1'}))};
 assert.equal((await call(`/api/teacher/game-evidence/${proof.id}/approve`,{method:'POST',body:approval,actor:'student-a'})).status,403);
 assert.equal((await call(`/api/teacher/game-evidence/${proof.id}/approve`,{method:'POST',body:approval,actor:'teacher-b'})).status,404);
 assert.equal((await call(`/api/teacher/game-evidence/${proof.id}/approve`,{method:'POST',body:approval,actor:'teacher-a'})).status,200);
 const results=await Promise.all(Array.from({length:6},()=>call('/api/arcade/badges')));
 assert.ok(results.every(r=>r.data.badges[0].earned));assert.equal(new Set(results.map(r=>r.data.badges[0].awardedAt)).size,1);
 assert.equal(Object.keys((await fixture.store.get('learners','student-a')).arcadeAwards).length,1);
 assert.deepEqual(await fixture.store.list('player_progression'),saves);
 assert.equal((await call('/api/arcade/profile')).data.grade,null);
});
test('featured badge is owned, persistent, removable and projected without its private proof',async()=>{
 assert.equal((await call('/api/arcade/badges/featured',{method:'PUT',body:{badgeIds:['premier-signal']}})).status,200);
 let profile=(await call('/api/arcade/profile')).data;assert.deepEqual(profile.featuredBadgeIds,['premier-signal']);
 const card=await call(`/api/arcade/players/${profileId}`,{actor:'student-b'});assert.deepEqual(card.data.featuredBadges,[{id:'premier-signal',name:'Premier signal'}]);
 assert.doesNotMatch(JSON.stringify(card.data),/approvedBy|sourceId|awardedAt|classId|email|username|password/);
 assert.equal((await call('/api/arcade/badges/featured',{method:'PUT',body:{badgeIds:['premier-signal']},actor:'student-b'})).status,400);
 assert.equal((await call('/api/arcade/badges/featured',{method:'PUT',body:{badgeIds:['premier-signal'],userId:'student-b'}})).status,400);
 assert.equal((await call('/api/arcade/badges/featured',{method:'PUT',body:{badgeIds:['premier-signal','premier-signal']}})).status,400);
 assert.equal((await login()).status,200);assert.deepEqual((await call('/api/arcade/profile')).data.featuredBadgeIds,['premier-signal']);
 assert.equal((await call('/api/arcade/badges/featured',{method:'PUT',body:{badgeIds:[]}})).status,200);
 assert.deepEqual((await call('/api/arcade/profile')).data.featuredBadgeIds,[]);
});
test('three-slot ordering and fourth replacement use synthetic unit inputs, never production awards',()=>{
 const earned=['a','b','c','d'];assert.deepEqual(validateFeatured(['c','a','b'],earned),['c','a','b']);
 assert.throws(()=>validateFeatured(earned,earned));assert.throws(()=>validateFeatured(['e'],earned));
 assert.deepEqual(nextFeatured(['a','b','c'],'d','badge-replace','b'),['a','d','c']);
 assert.deepEqual(nextFeatured(['a','b','c'],'c','badge-up'),['a','c','b']);
 assert.deepEqual(nextFeatured(['a','b','c'],'a','badge-down'),['b','a','c']);
 assert.deepEqual(nextFeatured(['a','b','c'],'b','badge-remove'),['a','c']);
 assert.deepEqual(nextFeatured(['a','b','c'],'d','badge-add'),['a','b','c']);
 assert.match(badgeDialog({id:'d',name:'D',condition:'Test isolé',earned:true},{featuredBadgeIds:['a','b','c'],featuredBadges:['a','b','c'].map(id=>({id,name:id}))}),/Remplacer b/);
});
test('all personal routes deny guests/external accounts, resource forgery and private caching',async()=>{
 for(const actor of ['guest','external'])for(const path of ['/api/arcade/space','/api/arcade/account','/api/arcade/avatars','/api/arcade/badges'])assert.equal((await call(path,{actor})).status,actor==='guest'?401:403);
 for(const path of ['/api/arcade/space?userId=student-b','/api/arcade/account?userId=student-b'])assert.equal((await call(path)).status,400);
 for(const path of ['/api/arcade/profile/student-b','/api/arcade/account/student-b'])assert.equal((await call(path)).status,404);
 assert.equal((await call('/api/arcade/account')).headers.get('cache-control'),'no-store');
 const account=(await call('/api/arcade/account')).data;assert.equal(account.username,'student-a');assert.equal(account.passwordChange,true);assert.equal(account.emailVerification,'not_supported');assert.doesNotMatch(JSON.stringify(account),/passwordHash|authVersion/);
});
test('password change rejects missing session, mismatch, forged fields, wrong secret and CSRF',async()=>{
 const body={currentPassword:fixture.password,newPassword:'synthetic-new-password',confirmation:'synthetic-new-password'};
 assert.equal((await call('/api/arcade/account/password',{method:'POST',body,actor:'guest'})).status,401);
 for(const extra of [{confirmation:'different'},{currentPassword:'wrong'},{newPassword:'short',confirmation:'short'},{userId:'student-b'}])assert.equal((await call('/api/arcade/account/password',{method:'POST',body:{...body,...extra}})).status,400);
 assert.equal((await call('/api/arcade/account/password',{method:'POST',body,origin:'https://evil.invalid'})).status,403);
 assert.equal((await call('/api/arcade/account')).status,200);
});
test('successful password change revokes all sessions and old secret, and retains profile and saves',async()=>{
 const firstCookie=cookies['student-a'];await login();const secondCookie=cookies['student-a'];
 const before=await fixture.store.get('learners','student-a'),saves=await fixture.store.list('player_progression');
 const newPassword='  Synthetic secret with spaces  ';
 const result=await call('/api/arcade/account/password',{method:'POST',body:{currentPassword:fixture.password,newPassword,confirmation:newPassword}});assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 for(const cookie of [firstCookie,secondCookie])assert.equal((await call('/api/arcade/account',{cookie})).status,401);
 assert.equal((await login('student-a',fixture.password)).status,401);assert.equal((await login('student-a',newPassword.trim())).status,401);assert.equal((await login('student-a',newPassword)).status,200);
 const account=await fixture.store.get('learners','student-a');assert.deepEqual(account.arcadeProfile,before.arcadeProfile);assert.deepEqual(await fixture.store.list('player_progression'),saves);assert.notEqual(account.passwordHash,before.passwordHash);
 assert.doesNotMatch(JSON.stringify(await fixture.store.list('audit_log')),/Synthetic secret|synthetic-test-password|synthetic-new-password|passwordHash/);
});
test('existing teacher assistance is scoped and now actually revokes student sessions',async()=>{
 const body={};assert.equal((await call('/api/teacher/learners/student-other/access',{method:'POST',actor:'teacher-a',body})).status,404);
 const oldCookie=cookies['student-b'];const result=await call('/api/teacher/learners/student-b/access',{method:'POST',actor:'teacher-a',body});assert.equal(result.status,200);
 assert.equal((await call('/api/arcade/account',{cookie:oldCookie})).status,401);assert.equal((await login('student-b',result.data.password)).status,200);
});
test('accounts without local credentials cannot acquire a local secret through this flow',async()=>{
 const a=await fixture.store.get('learners','student-other');delete a.passwordHash;await fixture.store.put('learners',a);
 assert.equal((await call('/api/arcade/account',{actor:'student-other'})).data.passwordChange,false);
 assert.equal((await call('/api/arcade/account/password',{actor:'student-other',method:'POST',body:{currentPassword:'anything',newPassword:'synthetic-password',confirmation:'synthetic-password'}})).status,409);
});
test('unavailable public lifecycle is uniform, never mutates accounts or claims mail delivery',async()=>{
 const before=(await fixture.store.list('learners')).length;
 for(const action of ['register','verify-email','resend-verification','recover-password','reset-password']) {
  const a=await call('/api/arcade/auth/'+action,{method:'POST',actor:'guest',body:{email:'student-a@example.invalid',token:'expired'}});
  const b=await call('/api/arcade/auth/'+action,{method:'POST',actor:'guest',body:{email:'absent@example.invalid',token:'forged'}});
  assert.equal(a.status,503);assert.deepEqual(a.data,b.data);
 }
 assert.equal((await fixture.store.list('learners')).length,before);
});

test('simultaneous password changes cannot reuse a revoked session or the old credential',async()=>{
 const body={currentPassword:'  Synthetic secret with spaces  ',newPassword:'concurrent-synthetic-secret',confirmation:'concurrent-synthetic-secret'};
 const result=await Promise.all([call('/api/arcade/account/password',{method:'POST',body}),call('/api/arcade/account/password',{method:'POST',body})]);
 assert.deepEqual(result.map(r=>r.status).sort(),[200,401]);
 assert.equal((await call('/api/arcade/account')).status,401);
});
test('password abuse limit applies before repeated credential verification',async()=>{
 const body={currentPassword:'wrong',newPassword:'synthetic-blocked-secret',confirmation:'synthetic-blocked-secret'};
 for(let i=0;i<8;i++)assert.equal((await call('/api/arcade/account/password',{actor:'student-b',method:'POST',body})).status,400);
 assert.equal((await call('/api/arcade/account/password',{actor:'student-b',method:'POST',body})).status,429);
});
