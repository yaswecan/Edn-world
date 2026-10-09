import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from '../server/app.mjs';
import {TABLES,schemaSQL} from '../server/store.mjs';
import {passwordHash} from '../server/auth.mjs';
import {MAX_UPLOAD_BYTES,MAX_SNAPSHOT_BYTES,decodeBackup,inspectBackup,restoreBackup,snapshotDigest} from '../server/database-snapshot.mjs';
import {backupFixture,emptyDestination,populatedDestination,rawTables,destinationTeacher,sourceTeacher} from './fixtures/database-backup.mjs';

test('portable backup embeds verified documents, keeps accounts and excludes sessions',async()=>{
 const fixture=await backupFixture(),snapshot=await decodeBackup(fixture.buffer,'A1');
 assert.equal(snapshot.tables.sessions.length,0);
 assert.deepEqual(snapshot.tables.lessons,fixture.tables.lessons);
 assert.deepEqual(snapshot.tables.teachers,fixture.tables.teachers);
 assert.deepEqual(snapshot.tables.corpus_packages,fixture.tables.corpus_packages);
 assert.equal(snapshot.report.documents,1);
 assert.equal(snapshot.report.learnersWithAccess,1);
 assert.equal(snapshot.report.lessons[0].version,4);
 assert.ok(!JSON.stringify(snapshot.report).includes('passwordHash'));
 await assert.rejects(decodeBackup(fixture.buffer,'OTHER'),/autre classe/);
});

test('corrupt documents, fingerprints, unknown tables and decompression bombs are rejected',async()=>{
 const {buffer}=await backupFixture();
 const modified=mutate=>{const backup=JSON.parse(gunzipSync(buffer));mutate(backup);return gzipSync(JSON.stringify(backup));};
 await assert.rejects(decodeBackup(modified(b=>b.fingerprint='0'.repeat(64)),'A1'),/empreinte/);
 await assert.rejects(decodeBackup(modified(b=>b.tables.future=[]),'A1'),/Tables/);
 await assert.rejects(decodeBackup(modified(b=>{const row=b.tables.corpus_packages[0],pack=JSON.parse(row.data);pack.files[0].base64=Buffer.from('altéré').toString('base64');row.data=JSON.stringify(pack);b.fingerprint=snapshotDigest(b.tables);}),'A1'),/corrompu/);
 await assert.rejects(decodeBackup(Buffer.from('not a database'),'A1'),/illisible/);
 await assert.rejects(decodeBackup(gzipSync('null'),'A1'),/Choisissez le fichier/);
 await assert.rejects(decodeBackup(Buffer.alloc(MAX_UPLOAD_BYTES+1),'A1'),/4 Mio/);
 await assert.rejects(decodeBackup(gzipSync(Buffer.alloc(MAX_SNAPSHOT_BYTES+1)),'A1'),/volumineuse/);
});

test('preview does not write; restore is exact and an identical retry is a no-op',async t=>{
 const store=await emptyDestination();t.after(()=>store.close());
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1'),before=await rawTables(store);
 assert.equal((await inspectBackup(store,snapshot,destinationTeacher)).status,'ready');
 assert.deepEqual(await rawTables(store),before);
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,''),/confirmez/);
 assert.equal((await restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint)).status,'imported');
 assert.deepEqual(await rawTables(store),snapshot.tables);
 assert.equal((await restoreBackup(store,snapshot,sourceTeacher,snapshot.report.fingerprint)).status,'already_imported');
 assert.deepEqual(await rawTables(store),snapshot.tables);
});

test('existing class data, a changed catalog or another class block the initial import',async()=>{
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1');
 for(const change of [
  store=>store.insert('learners',{id:'existing',classId:'A1'}),
  store=>store.insert('teachers',{id:'other-teacher',classId:'A1'}),
  store=>store.insert('plan_entries',{id:'foreign-entry',classId:'B1'}),
  async store=>{const world=(await store.list('game_worlds'))[0];await store.put('game_worlds',{...world,title:'Custom world'});},
 ]){
  const store=await emptyDestination();
  try{
   assert.equal((await inspectBackup(store,snapshot,destinationTeacher)).status,'ready');
   await change(store);
   const before=await rawTables(store);
   assert.equal((await inspectBackup(store,snapshot,destinationTeacher)).status,'conflict');
   await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint),/déjà des données/);
   assert.deepEqual(await rawTables(store),before);
  }finally{await store.close();}
 }
});

test('restore rolls back removed bootstrap accounts and all inserts if a write fails',async t=>{
 const store=await emptyDestination();t.after(()=>store.close());
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1'),before=await rawTables(store);
 const failing={transaction:fn=>store.transaction(tx=>fn({...tx,insertRow:async(table,row)=>{if(table==='lessons')throw Error('injected write failure');return tx.insertRow(table,row);}}))};
 await assert.rejects(restoreBackup(failing,snapshot,destinationTeacher,snapshot.report.fingerprint),/injected/);
 assert.deepEqual(await rawTables(store),before);
});

test('PostgreSQL replaces populated data with original metadata and rolls back a failed replacement',async t=>{
 const pg=await PGlite.create();t.after(()=>pg.close());await pg.exec(schemaSQL);
 const source=await populatedDestination();const initial=await rawTables(source);await source.close();
 const tx={
  readRows:async table=>(await pg.query(`SELECT id,class_id,version,data,created_at FROM ${table} ORDER BY id`)).rows,
  insertRow:async(table,row)=>pg.query(`INSERT INTO ${table} VALUES ($1,$2,$3,$4,$5)`,[row.id,row.class_id,row.version,row.data,row.created_at]),
  get:async(table,id)=>{const row=(await pg.query(`SELECT data FROM ${table} WHERE id=$1`,[id])).rows[0];return row?JSON.parse(row.data):null;},
  remove:async(table,id)=>pg.query(`DELETE FROM ${table} WHERE id=$1`,[id]),
  lockTables:async()=>{await pg.exec("SET LOCAL lock_timeout = '10s'");await pg.exec(`LOCK TABLE ${TABLES.join(',')} IN SHARE ROW EXCLUSIVE MODE`);},
 };
 for(const table of TABLES)for(const row of initial[table])await tx.insertRow(table,row);
 const store={transaction:async fn=>{await pg.exec('BEGIN');try{const result=await fn(tx);await pg.exec('COMMIT');return result;}catch(error){await pg.exec('ROLLBACK');throw error;}}};
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1');
 const preview=await inspectBackup(store,snapshot,destinationTeacher,{mode:'replace'});
 assert.equal(preview.status,'ready');
 assert.deepEqual(await rawTables(tx),initial);
 const options={mode:'replace',targetConfirmation:preview.target.fingerprint};
 await pg.exec("ALTER TABLE lessons ADD CONSTRAINT reject_import CHECK (id <> 'lesson')");
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,options));
 assert.deepEqual(await rawTables(tx),initial);
 await pg.exec('ALTER TABLE lessons DROP CONSTRAINT reject_import');
 await restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,options);
 assert.deepEqual(await rawTables(tx),snapshot.tables);
});

test('HTTP upload requires teacher auth, same origin and confirmation; restored login works',async t=>{
 const store=await emptyDestination();t.after(()=>store.close());
 await store.insert('learners',{id:'temp-student',classId:'A1',username:'temp-student',passwordHash:passwordHash('student-password-test')});
 const server=createApp(store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`,fixture=await backupFixture();
 async function login(role,username,password){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,username,password})});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
 const remoteCookie=await login('teacher','remote-prof','remote-test-password'),studentCookie=await login('student','temp-student','student-password-test');
 const upload=async(path,cookie,headers={},buffer=fixture.buffer)=>fetch(base+'/api/database/import/'+path,{method:'POST',headers:{'Content-Type':'application/octet-stream',...(cookie?{Cookie:cookie}:{}),...headers},body:buffer});
 assert.equal((await upload('preview','')).status,401);
 assert.equal((await upload('preview',studentCookie)).status,403);
 assert.equal((await upload('apply',studentCookie,{'X-Database-Mode':'replace'})).status,403);
 assert.equal((await upload('apply',remoteCookie,{Origin:'https://foreign.invalid'})).status,403);
 assert.equal((await upload('preview',remoteCookie,{},Buffer.alloc(MAX_UPLOAD_BYTES+1))).status,413);
 await store.remove('learners','temp-student');
 for(const session of await store.list('sessions'))if(session.role==='student')await store.remove('sessions',session.id);
 const before=await rawTables(store),preview=await upload('preview',remoteCookie);
 assert.equal(preview.status,200);const report=await preview.json();assert.equal(report.status,'ready');
 assert.deepEqual(await rawTables(store),before);
 assert.equal((await upload('apply',remoteCookie)).status,400);
 const applied=await upload('apply',remoteCookie,{'X-Database-Confirmation':report.fingerprint});
 assert.equal(applied.status,200,await applied.clone().text());
 assert.match(applied.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await fetch(base+'/api/dashboard',{headers:{Cookie:remoteCookie}})).status,401);
 assert.equal((await store.list('sessions')).length,0);
 const localCookie=await login('teacher','local-prof','local-test-password');
 const dashboard=await fetch(base+'/api/dashboard',{headers:{Cookie:localCookie}});
 assert.equal(dashboard.status,200);const data=await dashboard.json();
 assert.equal(data.learners.length,1);assert.equal(data.lessons[0].version,4);assert.equal(data.lessons[0].status,'draft');
 assert.equal((await (await upload('preview',localCookie)).json()).status,'identical');
});

test('replacement previews both databases and requires the unchanged target before deleting anything',async t=>{
 const store=await populatedDestination();t.after(()=>store.close());
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1'),before=await rawTables(store);
 const preview=await inspectBackup(store,snapshot,destinationTeacher,{mode:'replace'});
 assert.equal(preview.status,'ready');
 assert.equal(preview.mode,'replace');
 assert.equal(preview.target.learners,1);
 assert.equal(preview.target.lessons,1);
 assert.equal(preview.target.submissions,2);
 assert.equal(preview.learnersWithAccess,1);
 assert.equal(preview.target.fingerprint,snapshotDigest({...before,sessions:[]}));
 assert.ok(!JSON.stringify(preview).includes('passwordHash'));
 assert.deepEqual(await rawTables(store),before);
 await assert.rejects(inspectBackup(store,snapshot,destinationTeacher,{mode:'wipe'}),/Mode/);
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint),/déjà des données/);
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,{mode:'replace'}),/confirmez son remplacement/);
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,{mode:'replace',targetConfirmation:'0'.repeat(64)}),/a changé/);
 assert.deepEqual(await rawTables(store),before);
 await store.put('lessons',{...await store.get('lessons','old-lesson'),title:'Changement après analyse'});
 const changed=await rawTables(store);
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,{mode:'replace',targetConfirmation:preview.target.fingerprint}),/a changé/);
 assert.deepEqual(await rawTables(store),changed);
 const refreshed=await inspectBackup(store,snapshot,destinationTeacher,{mode:'replace'});
 // Login/logout does not invalidate the content preview; every session is revoked.
 await store.insert('sessions',{id:'new-session',classId:'A1',userId:'old-student',role:'student'});
 const result=await restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,{mode:'replace',targetConfirmation:refreshed.target.fingerprint});
 assert.equal(result.status,'imported');assert.equal(result.mode,'replace');
 assert.deepEqual(await rawTables(store),snapshot.tables);
 assert.equal((await restoreBackup(store,snapshot,sourceTeacher,snapshot.report.fingerprint,{mode:'replace',targetConfirmation:refreshed.target.fingerprint})).status,'already_imported');
});

test('replacement preserves other classes and blocks external work, including changes after preview',async t=>{
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1');
 for(const [table,data,reason] of [
  ['plan_entries',{classId:'B1'},/autre classe/],
  ['sessions',{classId:'B1',role:'student'},/autre classe/],
  ['publication_jobs',{status:'running'},/encore en cours/],
  ['generation_jobs',{status:'queued'},/encore en cours/],
  ['generation_jobs',{status:'cancelled',leaseUntil:new Date(Date.now()+60000).toISOString()},/encore en cours/],
  ['archive_outbox',{state:'running'},/archivage/],
  ['lab_sessions',{},/laboratoire/],
 ]){
  await t.test(table+' '+JSON.stringify(data),async t=>{
   const store=await populatedDestination();t.after(()=>store.close());
   const preview=await inspectBackup(store,snapshot,destinationTeacher,{mode:'replace'});
   await store.insert(table,{id:'blocker',classId:'A1',...data});
   const before=await rawTables(store),blocked=await inspectBackup(store,snapshot,destinationTeacher,{mode:'replace'});
   assert.equal(blocked.status,'blocked');assert.equal(blocked.canReplace,false);assert.equal(blocked.target,null);
   assert.match(blocked.blockedReason,reason);
   await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,{mode:'replace',targetConfirmation:preview.target.fingerprint}),reason);
   assert.deepEqual(await rawTables(store),before);
  });
 }
});

test('SQLite replacement rolls back all deleted data and sessions on insertion or read-back failure',async t=>{
 const store=await populatedDestination();t.after(()=>store.close());
 await store.insert('sessions',{id:'old-session',classId:'A1',userId:destinationTeacher.id,role:'teacher'});
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1'),before=await rawTables(store);
 const preview=await inspectBackup(store,snapshot,destinationTeacher,{mode:'replace'});
 for(const corrupt of [false,true]){
  const failing={transaction:fn=>store.transaction(tx=>fn({...tx,insertRow:async(table,row)=>{
   if(table==='lessons'){if(!corrupt)throw Error('injected write failure');return tx.insertRow(table,{...row,version:99});}
   return tx.insertRow(table,row);
  }}))};
  await assert.rejects(restoreBackup(failing,snapshot,destinationTeacher,snapshot.report.fingerprint,{mode:'replace',targetConfirmation:preview.target.fingerprint}),corrupt?/vérification après copie/:/injected/);
  assert.deepEqual(await rawTables(store),before);
 }
});

test('replacement rechecks teacher credentials and session within the transaction',async t=>{
 const store=await populatedDestination();t.after(()=>store.close());
 const snapshot=await decodeBackup((await backupFixture()).buffer,'A1');
 const preview=await inspectBackup(store,snapshot,destinationTeacher,{mode:'replace'});
 const options={mode:'replace',targetConfirmation:preview.target.fingerprint},before=await rawTables(store);
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,{...options,sessionId:'revoked-session'}),/Reconnectez-vous/);
 assert.deepEqual(await rawTables(store),before);
 await store.put('teachers',{...await store.get('teachers',destinationTeacher.id),authVersion:1});
 const changed=await rawTables(store);
 await assert.rejects(restoreBackup(store,snapshot,destinationTeacher,snapshot.report.fingerprint,options),/Reconnectez-vous/);
 assert.deepEqual(await rawTables(store),changed);
});

test('HTTP replacement wipes old records, revokes all sessions and preserves imported student access',async t=>{
 const store=await populatedDestination();t.after(()=>store.close());
 const server=createApp(store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`,fixture=await backupFixture();
 const login=async(role,username,password)=>fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,username,password})});
 const teacherCookie=(await login('teacher','remote-prof','remote-test-password')).headers.get('set-cookie').split(';')[0];
 const studentCookie=(await login('student','old-student','old-student-password')).headers.get('set-cookie').split(';')[0];
 const upload=(path,headers={})=>fetch(base+'/api/database/import/'+path,{method:'POST',headers:{'Content-Type':'application/octet-stream',Cookie:teacherCookie,'X-Database-Mode':'replace',...headers},body:fixture.buffer});
 const before=await rawTables(store),preview=await upload('preview');assert.equal(preview.status,200);
 const report=await preview.json();assert.equal(report.status,'ready');assert.equal(report.target.learners,1);
 assert.deepEqual(await rawTables(store),before);
 const headers={'X-Database-Confirmation':report.fingerprint,'X-Database-Target-Confirmation':report.target.fingerprint};
 assert.equal((await upload('apply',{'X-Database-Confirmation':report.fingerprint})).status,400);
 assert.equal((await upload('apply',{...headers,Origin:'https://foreign.invalid'})).status,403);
 const applied=await upload('apply',headers);assert.equal(applied.status,200,await applied.clone().text());
 assert.match(applied.headers.get('set-cookie'),/Max-Age=0/);
 assert.deepEqual(await rawTables(store),(await decodeBackup(fixture.buffer,'A1')).tables);
 for(const cookie of [teacherCookie,studentCookie])assert.equal((await (await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json()).user,null);
 assert.equal((await login('teacher','remote-prof','remote-test-password')).status,401);
 assert.equal((await login('student','old-student','old-student-password')).status,401);
 assert.equal((await login('teacher','local-prof','local-test-password')).status,200);
 const student=await login('student','student','local-student-password');assert.equal(student.status,200);
 assert.equal((await student.json()).user.id,'learner');
});

test('v1 backups made before lesson-transfer tables remain importable without trusting a new digest',async()=>{
 const backup=JSON.parse(gunzipSync((await backupFixture()).buffer));
 const oldTables=TABLES.filter(t=>!t.startsWith('lesson_transfer'));
 for(const t of TABLES.filter(t=>!oldTables.includes(t)))delete backup.tables[t];
 backup.fingerprint=snapshotDigest(backup.tables,oldTables);
 const restored=await decodeBackup(gzipSync(JSON.stringify(backup)),'A1');
 assert.deepEqual(restored.tables.lesson_transfers,[]);assert.deepEqual(restored.tables.lessons,backup.tables.lessons);
 assert.equal(restored.report.fingerprint,snapshotDigest(restored.tables));
 backup.tables.lessons[0].data=backup.tables.lessons[0].data.replace('Quatre','Deux');
 await assert.rejects(decodeBackup(gzipSync(JSON.stringify(backup)),'A1'),/empreinte/);
});
