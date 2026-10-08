import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {inspectCleanup,applyCleanup} from '../scripts/lib/lesson-cleanup.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'eden-cleanup-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'courses.sqlite'),store=await openStore({path:source,url:''});
 await store.insert('lessons',{id:'keep',classId:'A1',title:'Keep',versionId:'keep:v2',qualityJobId:'job-keep'});
 await store.insert('lessons',{id:'old',classId:'A1',versionId:'old:v1'});
 await store.insert('lessons',{id:'other-class',classId:'A2',versionId:'other:v1'});
 for(const id of ['keep:v1','keep:v2','old:v1'])await store.insert('lesson_versions',{id,classId:'A1',lessonId:id.split(':')[0],spec:{lessonId:id.split(':')[0]}});
 await store.insert('lessons',{id:'A1:legacy',classId:'A1',versionId:'A1:legacy:v1'});
 await store.insert('lesson_versions',{id:'A1:legacy:v1',classId:'A1',spec:{lessonId:'legacy'}});
 await store.insert('generation_jobs',{id:'job-keep',classId:'A1',status:'cancelled',lessonId:'keep',documentContext:{id:'shared-context'}});
 await store.insert('generation_jobs',{id:'job-old',classId:'A1',status:'blocked',lessonId:'old',documentContext:{id:'shared-context'}});
 await store.insert('generation_jobs',{id:'job-orphan',classId:'A1',status:'cancelled',documentContext:{id:'old-context'}});
 await store.insert('document_contexts',{id:'shared-context',classId:'A1'});
 await store.insert('document_contexts',{id:'old-context',classId:'A1'});
 await store.insert('generation_calls',{id:'call',classId:'A1',jobId:'job-old'});
 await store.insert('content_snapshots',{id:'snapshot',classId:'A1',manifest:{subject:{lessonId:'old'}}});
 await store.insert('archive_outbox',{id:'outbox',classId:'A1',snapshotId:'snapshot',state:'pending'});
 for(const table of ['teachers','learners','plan_entries','resources','assessment_specs','game_missions'])await store.insert(table,{id:table,classId:'A1'});
 await store.close();
 return {source,backupPath:join(root,'backup.sqlite'),options:{classId:'A1',keepVersions:['keep:v2']}};
}

test('cleanup preserves the selected lessons, provenance, shared context and unrelated data; replay is inert',async t=>{
 const {source,backupPath,options}=await fixture(t),plan=inspectCleanup(source,options);
 assert.deepEqual(plan.changes.lessons.map(r=>r.id),['A1:legacy','old']);
 assert.deepEqual(plan.changes.lesson_versions.map(r=>r.id),['A1:legacy:v1','old:v1']);
 assert.deepEqual(plan.changes.document_contexts.map(r=>r.id),['old-context']);
 assert.equal(plan.counts.generation_jobs,2);assert.equal(plan.counts.archive_outbox,1);
 assert.equal(applyCleanup(source,plan,{backupPath}).status,'applied');
 assert.equal(applyCleanup(source,plan,{backupPath}).status,'already_applied');
 const store=await openStore({path:source,url:''});
 try{
  assert.deepEqual((await store.list('lessons')).map(l=>l.id).sort(),['keep','other-class']);
  assert.ok(await store.get('lesson_versions','keep:v1'));
  assert.ok(await store.get('generation_jobs','job-keep'));
  assert.ok(await store.get('document_contexts','shared-context'));
  for(const table of ['teachers','learners','plan_entries','resources','assessment_specs','game_missions'])assert.equal((await store.list(table)).length,1);
  await store.insert('lessons',{id:'new',classId:'A1',versionId:'new:v1'});
 }finally{await store.close();}
 assert.equal(applyCleanup(source,plan,{backupPath}).status,'already_applied');
 assert.equal(inspectCleanup(backupPath,options).counts.lessons,2);
});

test('missing/current version mismatch and active generation refuse the cleanup',async t=>{
 const {source,options}=await fixture(t);
 assert.throws(()=>inspectCleanup(source,{...options,keepVersions:['keep:v1']}),/courante introuvable/);
 const store=await openStore({path:source,url:''});
 await store.insert('generation_jobs',{id:'active',classId:'A1',status:'queued'});await store.close();
 assert.throws(()=>inspectCleanup(source,options),/génération est active/);
});

test('stale or tampered plans cannot delete data',async t=>{
 const {source,backupPath,options}=await fixture(t),plan=inspectCleanup(source,options);
 const altered=structuredClone(plan);altered.changes.lessons.push({id:'keep',sha256:'wrong'});
 assert.throws(()=>applyCleanup(source,altered,{backupPath}),/périmètre/);
 const store=await openStore({path:source,url:''});
 assert.ok(await store.get('lessons','old'));assert.ok(await store.get('lessons','keep'));
 await store.insert('lessons',{id:'new',classId:'A1',versionId:'new:v1'});await store.close();
 assert.throws(()=>applyCleanup(source,plan,{backupPath:backupPath+'.new'}),/base a changé/);
});
