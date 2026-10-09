import {availability} from './student-tracking.mjs';
import express from 'express';
import {teacher,loggedIn,accountLimit} from './auth.mjs';
import {LIMITS} from './lesson-package.mjs';
import {exportLessons,beginUpload,writeChunk,previewTransfer,applyTransfer,ownedTransfer,removeTransfer} from './lesson-transfer.mjs';
import {fail,scoped,requireValue} from './store.mjs';
import {sha256} from './content-snapshots.mjs';
import {studentSpec} from './generator.mjs';
export function lessonTransferRoutes(app,store){
 const limited=accountLimit(100);
 app.post('/api/lesson-transfers/export',teacher,accountLimit(10),async(req,res)=>res.json(await exportLessons(store,req.body.lessonIds,req.user)));
 app.post('/api/lesson-transfers',teacher,limited,async(req,res)=>res.json(await beginUpload(store,req.body,req.user)));
 app.get('/api/lesson-transfers/:id',teacher,async(req,res)=>{const t=await ownedTransfer(store,req.params.id,req.user);const received=(await store.list('lesson_transfer_chunks',req.user.classId)).filter(c=>c.transferId===t.id).map(c=>c.index);res.json({id:t.id,kind:t.kind,sealed:!!t.sealed,received,bytes:t.bytes,sha256:t.sha256,chunks:t.chunks,chunkBytes:LIMITS.chunk});});
 app.put('/api/lesson-transfers/:id/chunks/:index',teacher,express.raw({type:'application/octet-stream',limit:LIMITS.chunk,inflate:false}),async(req,res)=>res.json(await writeChunk(store,req.params.id,Number(req.params.index),req.body,req.user)));
 app.get('/api/lesson-transfers/:id/chunks/:index',teacher,async(req,res)=>{const t=await ownedTransfer(store,req.params.id,req.user),index=Number(req.params.index);requireValue(t.kind==='export'&&Number.isInteger(index)&&index>=0&&index<t.chunks,'Fragment inaccessible.');const c=await scoped(store,'lesson_transfer_chunks',`${t.id}:${index}`,req.user),bytes=Buffer.from(c.base64,'base64');requireValue(sha256(bytes)===c.sha256,'Fragment altéré.');res.type('application/octet-stream').send(bytes);});
 app.post('/api/lesson-transfers/:id/preview',teacher,limited,async(req,res)=>res.json(await previewTransfer(store,req.params.id,req.body,req.user)));
 app.post('/api/lesson-transfers/:id/apply',teacher,limited,async(req,res)=>res.json(await applyTransfer(store,req.params.id,req.body,req.user)));
 app.delete('/api/lesson-transfers/:id',teacher,async(req,res)=>res.json(await removeTransfer(store,req.params.id,req.user)));
 app.get('/api/lesson-transfer-files/:id',loggedIn,async(req,res)=>{
  const asset=await store.get('lesson_assets',req.params.id);if(!asset||asset.kind!=='portable-file'||req.user.role==='teacher'&&asset.classId!==req.user.classId)fail(404,'Support introuvable.');
  const needle=`/api/lesson-transfer-files/${asset.id}`;let allowed=req.user.role==='teacher';
  if(!allowed)for(const a of (await store.list('lesson_assignments')).filter(a=>a.learnerId===req.user.id&&a.access==='allowed')){if(await availability(store,a)==='revoked')continue;const v=await store.get('lesson_versions',a.lessonVersionId);if(v&&JSON.stringify(studentSpec(v.spec)).includes(needle)){allowed=true;break;}}
  if(!allowed)fail(404,'Support inaccessible.');
  const bytes=Buffer.from(asset.base64,'base64');requireValue(sha256(bytes)===asset.sha256,'Support altéré.');
  res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; style-src 'unsafe-inline'");
  if(!['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','application/pdf','text/plain'].includes(asset.mimeType))res.attachment('support');
  res.type(asset.mimeType).send(bytes);
 });
 // Cheap version polling never replaces an editor or the learner's local draft.
 app.get('/api/lessons/:id/current-version',loggedIn,async(req,res)=>{const l=await scoped(store,'lessons',req.params.id,req.user);if(req.user.role!=='teacher'&&l.status!=='published')fail(404,'Séance indisponible.');res.json({versionId:l.versionId});});
}
