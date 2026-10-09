import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';
import {parisDate} from '../server/generator.mjs';
import {demoFlexbox} from '../server/demo-flexbox.mjs';
import {chooseTodayLesson,publishedLessons,todayLesson} from '../server/today-lesson.mjs';

const actor={id:'teacher',classId:'A1',role:'teacher',username:'teacher',displayName:'Professeur'};
const date=parisDate();
async function seed(store){
 const original=demoFlexbox();
 for(const [id,day,status,classId] of [['flexbox','2026-10-05','published','A1'],['scheduled',date,'published','A1'],['draft',date,'draft','A1'],['closed',date,'completed','A1'],['foreign',date,'published','OTHER']]){
  const spec={...structuredClone(original),lessonId:id,date:day,classId};
  await store.insert('lessons',{id,classId,date:day,status,title:id,version:1,versionId:id+':v1',runId:id+':run'});
  await store.insert('lesson_versions',{id:id+':v1',classId,lessonId:id,spec});
 }
}

test('the day choice survives restart, expires by Paris date and preserves the lesson and class settings',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'eden-today-')),path=join(directory,'test.sqlite');
 let store=await openStore({url:'',path});
 try{
  await seed(store);
  await store.insert('classes',{id:'A1',classId:'A1',name:'Classe conservée'});
  const original=await store.get('lessons','flexbox'),version=await store.get('lesson_versions','flexbox:v1');
  assert.deepEqual(await chooseTodayLesson(store,actor,{date,lessonId:'flexbox'}),{date,lessonId:'flexbox',selected:true});
  await store.close();store=await openStore({url:'',path});
  const lessons=publishedLessons(await store.list('lessons','A1'));
  assert.equal((await todayLesson(store,'A1',lessons)).lessonId,'flexbox');
  assert.equal((await store.get('classes','A1')).name,'Classe conservée');
  assert.deepEqual(await store.get('lessons','flexbox'),original);
  assert.deepEqual(await store.get('lesson_versions','flexbox:v1'),version);
  const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
  assert.deepEqual(await todayLesson(store,'A1',lessons,parisDate(next)),{date:parisDate(next),lessonId:null,selected:false});
  assert.equal((await chooseTodayLesson(store,actor,{date,lessonId:null})).lessonId,'scheduled');
  assert.equal((await todayLesson(store,'A1',lessons)).selected,false);
  assert.equal((await store.list('audit_log','A1')).length,2);
 }finally{await store.close();await rm(directory,{recursive:true,force:true});}
});

test('teacher choice controls the class landing page, keeps saved work and direct links, and rejects unauthorized or unpublished lessons',async()=>{
 const store=await openStore({url:'',path:':memory:'});await seed(store);
 const password='synthetic-today-password',passwordDigest=passwordHash(password);
 await store.insert('teachers',{...actor,passwordHash:passwordDigest});
 for(const [id,classId] of [['student','A1'],['other','OTHER']])await store.insert('learners',{id,classId,username:id,displayName:id,passwordHash:passwordDigest});
 const server=createApp(store).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,cookie='',method='GET',body)=>{const response=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const teacher=(await call('/api/login','','POST',{role:'teacher',username:'teacher',password})).cookie;
  const student=(await call('/api/login','','POST',{role:'student',username:'student',password})).cookie;
  const other=(await call('/api/login','','POST',{role:'student',username:'other',classId:'OTHER',password})).cookie;
  assert.equal((await call('/api/today',student)).body.lesson.id,'scheduled');
  const pick={date,lessonId:'flexbox'};
  assert.equal((await call('/api/today','','PUT',pick)).status,401);
  assert.equal((await call('/api/today',student,'PUT',pick)).status,403);
  for(const id of ['draft','closed'])assert.equal((await call('/api/today',teacher,'PUT',{date,lessonId:id})).status,409);
  for(const id of ['foreign','missing'])assert.equal((await call('/api/today',teacher,'PUT',{date,lessonId:id})).status,404);
  assert.equal((await call('/api/today',teacher,'PUT',{date:'2000-01-01',lessonId:'flexbox'})).status,409);
  assert.equal((await call('/api/today',teacher,'PUT',{date})).status,400);
  const attempt=(await call('/api/assessments/flexbox/start',student,'POST',{})).body;
  const answers={[demoFlexbox().diagnostic.tasks[0].id]:'Mon travail conservé'};
  assert.equal((await call(`/api/assessments/${attempt.id}/save`,student,'POST',{answers})).status,200);
  await store.insert('learning_progress',{id:'student:flexbox:v1',classId:'A1',learnerId:'student',stepId:'opening',completed:['opening'],answers:{activity:'Brouillon conservé'}});
  const originalProgress=await store.get('learning_progress','student:flexbox:v1');
  assert.equal((await call('/api/today',teacher,'PUT',pick)).status,200);
  const current=(await call('/api/today',student)).body;
  assert.equal(current.lesson.id,'flexbox');assert.equal(current.lesson.date,'2026-10-05');assert.equal(current.lesson.spec.date,'2026-10-05');assert.equal(current.displayDate,date);
  assert.equal(current.attempt.id,attempt.id);assert.deepEqual(current.attempt.answers,answers);assert.deepEqual(current.progress,originalProgress);
  assert.ok(current.lesson.spec.diagnostic.tasks.every(t=>t.reference===undefined&&t.expectedAnswer===undefined&&t.tests===undefined));
  assert.equal((await call('/api/assessments/flexbox/start',student,'POST',{})).body.id,attempt.id);
  assert.deepEqual((await call('/api/dashboard',teacher)).body.todayLesson,{date,lessonId:'flexbox',selected:true});
  assert.equal((await call('/api/today',other)).body.lesson.id,'foreign');
  assert.equal((await call('/api/today?lesson=flexbox',other)).status,404);
  assert.equal((await call('/api/today?lesson=scheduled',student)).body.lesson.id,'scheduled');
  assert.equal((await call('/api/today?date=2099-01-01',student)).body.lesson,null);
  assert.equal((await call('/api/today?date=bad',student)).status,400);
  const chosen=await store.get('lessons','flexbox');await store.put('lessons',{...chosen,status:'completed'});
  assert.equal((await call('/api/today',student)).body.lesson.id,'scheduled');
  assert.equal((await call('/api/dashboard',teacher)).body.todayLesson.selected,false);
  await store.put('lessons',chosen);
  assert.equal((await call('/api/today',teacher,'PUT',{date,lessonId:null})).body.lessonId,'scheduled');
  assert.equal((await call('/api/today',student)).body.lesson.id,'scheduled');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();}
});
