import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore,TABLES} from '../server/store.mjs';
import {passwordHash,passwordMatches} from '../server/auth.mjs';
import {demoLesson} from '../server/demo-lesson.mjs';
import {parisDate} from '../server/generator.mjs';
import {studentPreview} from '../scripts/lib/student-preview.mjs';

test('school preview reuses individual passwords, isolates the class and leaves the source untouched',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'eden-school-preview-'));
 const source=join(directory,'courses.sqlite'),store=await openStore({url:'',path:source});
 const password='existing-school-password',digest=passwordHash(password),date=parisDate();
 let preview,demo;
 try {
  for(const [id,classId,secret] of [['school-student','A1',digest],['inactive','A1',null],['other-class','B1',digest]])await store.insert('learners',{id,classId,username:id,displayName:id,passwordHash:secret,authVersion:3,email:'private@example.invalid',driveFolderId:'private-folder'});
  await store.insert('teachers',{id:'real-teacher',classId:'A1',username:'real-teacher',passwordHash:passwordHash('teacher-private-password')});
  await store.insert('sessions',{id:'old-session',classId:'A1',userId:'school-student',role:'student',expiresAt:'2099-01-01T00:00:00Z'});
  const spec={...demoLesson(),lessonId:'school-lesson',classId:'A1',date,codeStation:null};
  await store.insert('lessons',{id:'school-lesson',classId:'A1',title:spec.title,date,version:1,versionId:'school-lesson:v1',status:'draft'});
  await store.insert('lesson_versions',{id:'school-lesson:v1',classId:'A1',spec});
  const before=await Promise.all(TABLES.map(t=>store.readRows(t)));
  preview=await studentPreview({source,schoolAccounts:true,date});
  assert.equal(preview.accountsWithAccess,1);
  assert.deepEqual((await preview.store.list('learners')).map(l=>l.id).sort(),['inactive','school-student']);
  const copied=await preview.store.get('learners','school-student');
  assert.ok(copied.passwordHash===digest);assert.ok(passwordMatches(password,copied.passwordHash));
  assert.equal(copied.authVersion,3);assert.equal(copied.email,undefined);assert.equal(copied.driveFolderId,undefined);
  assert.equal(await preview.store.get('teachers','real-teacher'),null);assert.equal((await preview.store.list('sessions')).length,0);
  const login=(username,password)=>fetch(preview.base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:'student',classId:'A1',username,password})});
  for(const [username,secret] of [['student-a','synthetic-test-password'],['school-student','synthetic-test-password'],['school-student','wrong-password'],['other-class',password],['inactive',password]])assert.equal((await login(username,secret)).status,401);
  const response=await login('school-student',password);assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const today=await fetch(preview.base+'/api/today',{headers:{cookie}});assert.equal(today.status,200);assert.equal((await today.json()).lesson.id,'school-lesson');
  assert.equal((await preview.store.get('lessons','school-lesson')).status,'published');
  demo=await studentPreview({source,date});
  assert.ok(await demo.store.get('learners','student-a'));assert.equal(await demo.store.get('learners','school-student'),null);
  // The read-only source retains its draft, credentials and original sessions.
  assert.ok(JSON.stringify(await Promise.all(TABLES.map(t=>store.readRows(t))))===JSON.stringify(before));
 } finally {await preview?.close();await demo?.close();await store.close();await rm(directory,{recursive:true,force:true});}
});

test('school account preview requires an explicit source',async()=>{
 await assert.rejects(studentPreview({schoolAccounts:true}),/nécessite --source/);
});
