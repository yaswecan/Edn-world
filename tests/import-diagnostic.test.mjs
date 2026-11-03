import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transferFixture} from './fixtures/lesson-transfer.mjs';
import {beginUpload,writeChunk,previewTransfer,applyTransfer,exportLessons,readTransfer} from '../server/lesson-transfer.mjs';
import {decodePackage} from '../server/lesson-package.mjs';
import {sha256} from '../server/content-snapshots.mjs';
import {publicationGate} from '../server/pedagogy/quality.mjs';
async function importBytes(f,bytes){
 const t=await beginUpload(f.store,{bytes:bytes.length,sha256:sha256(bytes)},f.actor);
 for(let i=0;i<t.chunks;i++)await writeChunk(f.store,t.id,i,bytes.subarray(i*t.chunkBytes,(i+1)*t.chunkBytes),f.actor);
 const p=await previewTransfer(f.store,t.id,{},f.actor);
 assert.equal(p.canApply,true,JSON.stringify(p.rows));
 return applyTransfer(f.store,t.id,{token:p.token,confirmed:true},f.actor);
}
for(const name of ['modele-valide','html-semantique-complet'])test(name+' imports and round trips without losing corpus bytes or permissions',async()=>{
 const f=await transferFixture(),destination=await transferFixture();
 try{
  const bytes=await readFile(new URL('./fixtures/import-diagnostic/'+name+'.tweenteach.zip',import.meta.url)),pack=await decodePackage(bytes);
  const result=await importBytes(f,bytes),lesson=await f.store.get('lessons',result.lessons[0].id),v=await f.store.get('lesson_versions',lesson.versionId);
  assert.equal(v.spec.activities.length,pack.lessons[0].payload.spec.activities.length);
  const stored=(await f.store.list('corpus_packages')).find(c=>c.lessonVersionId===lesson.versionId);
  for(const file of pack.lessons[0].payload.corpus.files){
   const actual=stored.files.find(c=>c.path===file.path);
   assert.equal(actual.audience,file.audience);
   assert.deepEqual(Buffer.from(actual.base64,'base64'),pack.files.get(file.sha256));
  }
  const e=await exportLessons(f.store,[lesson.id],f.actor),roundtrip=await readTransfer(f.store,e.id,f.actor),decoded=await decodePackage(roundtrip.bytes);
  for(const file of pack.lessons[0].payload.corpus.files){
   if(file.path==='00_MANIFEST/manifest.json')continue; // Native export regenerates its manifest.
   const actual=decoded.lessons[0].payload.corpus.files.find(c=>c.path===file.path);
   assert.ok(actual,file.path);
   assert.deepEqual(decoded.files.get(actual.sha256),pack.files.get(file.sha256),file.path);
   assert.equal(actual.audience,file.audience);
  }
  await importBytes(destination,roundtrip.bytes);
 }finally{await f.store.close();await destination.store.close();}
});

test('missing static asset has bounded source diagnostic and no partial import',async()=>{
 const f=await transferFixture();
 try{
  const v=await f.store.get('lesson_versions',f.lesson.versionId);
  v.spec.teacherGuide+=' <img src="/assets/diagnostic-does-not-exist.svg">';
  await f.store.put('lesson_versions',v);
  await assert.rejects(exportLessons(f.store,[f.lesson.id],f.actor),e=>{
   assert.equal(e.status,422);assert.equal(e.details.pointer,'/spec/teacherGuide');
   assert.equal(e.details.value,'/assets/diagnostic-does-not-exist.svg');
   assert.equal(e.details.reason,'missing-static-asset');assert.ok(e.details.incidentId);
   return true;
  });
  assert.equal((await f.store.list('lesson_transfers')).length,0);
 }finally{await f.store.close();}
});

test('imported preparation without a generation job remains blocked from independent publication',async()=>{
 const checks=await publicationGate({get:()=>{throw Error('must not query undefined');}},{qualityRequired:true},{});
 assert.equal(checks[0].ok,false);
});
