import {inheritGrid} from './competency-transfer.mjs';
import express from 'express';
import {teacher} from './auth.mjs';
import {scoped,fail,requireValue,uid,now} from './store.mjs';
import {validateReferences,encodePackage} from './lesson-package.mjs';
import {validateEditorAssets} from './lesson-editor-validation.mjs';
import {synchronizeSpec} from '../public/lesson-editor-model.js';
import {studentSpec} from './generator.mjs';
import {publishLesson} from './domain.mjs';
import {compileCorpus} from './corpus.mjs';
import {validate,lessonSchema} from './contracts.mjs';
import {freezeContent,canonical,sha256} from './content-snapshots.mjs';
import {assertIdle,captureLesson,ensurePortable} from './lesson-transfer-content.mjs';
import {testActivityCode} from './workshop-testing.mjs';

export const editorToken=l=>`${l.versionId}|${l.editorDraftVersionId||''}`;
export async function readEditor(store,id,actor){
 const lesson=await scoped(store,'lessons',id,actor);requireValue(actor.role==='teacher','Accès professeur requis.');
 const version=await scoped(store,'lesson_versions',lesson.editorDraftVersionId||lesson.versionId,actor),job=lesson.qualityJobId?await store.get('generation_jobs',lesson.qualityJobId):null;
 const canReview=lesson.qualityRequired===true&&lesson.provider!=='fixture'&&(lesson.provider==='transfer'||job&&['completed','cancelled','blocked'].includes(job.status)&&!job.simulation);
 return {id:lesson.id,status:lesson.status,version:version.version,versionId:version.id,token:editorToken(lesson),spec:version.spec,hasPublishedDraft:!!lesson.editorDraftVersionId,requiresReview:!!lesson.qualityRequired,canReview};
}
export async function editorCandidate(store,lesson,input,actor){
 requireValue(['draft','published'].includes(lesson.status),'Cette séance est clôturée.');
 if(input.token!==editorToken(lesson))fail(409,'La séance a changé dans une autre édition, une importation ou une génération. Votre travail est conservé.');
 const old=await scoped(store,'lesson_versions',lesson.editorDraftVersionId||lesson.versionId,actor);
 requireValue(input.spec&&Buffer.byteLength(JSON.stringify(input.spec))<950000,'Séance trop volumineuse. Importez les images séparément.');
 validate(lessonSchema,input.spec);
 const spec=synchronizeSpec(structuredClone(input.spec));
 for(const key of ['lessonId','classId','date','planEntryId','planVersion','sequence','sourceVersions'])requireValue(JSON.stringify(spec[key])===JSON.stringify(old.spec[key]),'Le rattachement et les sources de la séance ne sont pas modifiables ici.');
 for(const key of ['id','kind','sourceLessonRunId','sourceLessonVersion'])requireValue(spec.diagnostic[key]===old.spec.diagnostic[key],'La source du diagnostic doit être conservée.');
 spec.lessonVersion=old.version+1;validateReferences(spec);await validateEditorAssets(store,spec,actor);return {old,spec};
}
export async function saveEditor(store,id,input,actor){return store.transaction(async tx=>{
 await tx.lockTables();requireValue(actor.role==='teacher','Accès professeur requis.');const lesson=await scoped(tx,'lessons',id,actor);await assertIdle(tx,lesson,actor);
 const {old,spec}=await editorCandidate(tx,lesson,input,actor);
 const unchanged={...spec,lessonVersion:old.spec.lessonVersion};if(canonical(unchanged)===canonical(old.spec))return readEditor(tx,id,actor);
 const versionId=lesson.status==='published'?`${id}:edit:${uid('v')}`:`${id}:v${spec.lessonVersion}`;
 await tx.insert('lesson_versions',{...old,id:versionId,version:spec.lessonVersion,spec,previousVersionId:old.id,baseVersionId:lesson.versionId,authorId:actor.id,reason:'Modification dans l’éditeur professeur',createdAt:now()});
 await inheritGrid(tx,actor,old,await tx.get('lesson_versions',versionId));
 if(lesson.status==='published')lesson.editorDraftVersionId=versionId;
 else Object.assign(lesson,{version:spec.lessonVersion,versionId,title:spec.title,pedagogicalValidation:null});
 lesson.editorModifiedAt=now();await tx.put('lessons',lesson);
 await freezeContent(tx,{classId:actor.classId,event:'lesson.edited',eventId:versionId,subject:{kind:'lesson',lessonId:id,lessonVersionId:versionId},versions:{previousVersionId:old.id},files:[{path:'lesson.json',content:canonical(spec),audience:'teacher'}]});
 await tx.audit(actor,'lesson.editor_saved',id,{versionId});return readEditor(tx,id,actor);
});}
export async function publishEditor(store,id,input,actor){
 const view=await readEditor(store,id,actor);if(input.token!==view.token)fail(409,'Le brouillon a changé. Enregistrez avant de publier.');requireValue(input.confirmed===true,'Confirmez la mise à jour.');
 const teacherReviewed=view.requiresReview&&input.reviewed===true;
 if(teacherReviewed)requireValue(view.canReview,'La préparation doit être terminée ou reprise avant publication.');
 await compileCorpus(store,id,actor,{candidateVersionId:view.versionId});
 return store.transaction(async tx=>{
  await tx.lockTables();const lesson=await scoped(tx,'lessons',id,actor);if(editorToken(lesson)!==input.token)fail(409,'Le brouillon a changé pendant la préparation.');await assertIdle(tx,lesson,actor);
  if(teacherReviewed){lesson.qualityRequired=false;lesson.pedagogicalValidation=null;if(lesson.transferPreparation)lesson.transferPreparation={requiresReview:false,incomplete:false,state:'teacher_draft'};lesson.teacherReview={authorId:actor.id,at:now(),versionId:view.versionId,reason:'Relecture et publication explicites depuis l’éditeur',sourceJobId:lesson.qualityJobId||null};await tx.put('lessons',lesson);}
  if(lesson.editorDraftVersionId){const v=await scoped(tx,'lesson_versions',lesson.editorDraftVersionId,actor);Object.assign(lesson,{versionId:v.id,version:v.version,title:v.spec.title});delete lesson.editorDraftVersionId;delete lesson.diagnosticVersionId;
   const oldRun=lesson.runId;lesson.status='draft';await tx.put('lessons',lesson);const result=await publishLesson({...tx,transaction:fn=>fn(tx)},id,actor,{version:lesson.version,confirmed:true,validationMode:input.validationMode});
   const run=await tx.get('lesson_runs',result.runId);run.previousRunId=oldRun;await tx.put('lesson_runs',run);return result;
  }
  return publishLesson({...tx,transaction:fn=>fn(tx)},id,actor,{version:lesson.version,confirmed:true,validationMode:input.validationMode});
 });
}
export async function exportEditor(store,id,input,actor){
 const view=await readEditor(store,id,actor);if(view.token!==input.token)fail(409,'La séance a changé. Enregistrez avant d’exporter.');
 await compileCorpus(store,id,actor,{candidateVersionId:view.versionId});
 const files=new Map();const captured=await store.transaction(async tx=>{await tx.lockTables();const lesson=await scoped(tx,'lessons',id,actor);if(editorToken(lesson)!==input.token)fail(409,'La séance a changé pendant l’export.');await ensurePortable(tx,lesson);return captureLesson(tx,{...lesson,versionId:view.versionId,version:view.version},actor,files,{identity:false});});
 return encodePackage([captured],files);
}
export function lessonEditorRoutes(app,store){
 app.get('/api/lessons/:id/editor',teacher,async(req,res)=>res.json(await readEditor(store,req.params.id,req.user)));
 app.put('/api/lessons/:id/editor',teacher,async(req,res)=>res.json(await saveEditor(store,req.params.id,req.body,req.user)));
 app.post('/api/lessons/:id/editor/preview',teacher,async(req,res)=>{const lesson=await scoped(store,'lessons',req.params.id,req.user),{spec}=await editorCandidate(store,lesson,req.body,req.user);res.json(studentSpec(spec));});
 app.post('/api/lessons/:id/editor/test',teacher,async(req,res)=>{const lesson=await scoped(store,'lessons',req.params.id,req.user),{spec}=await editorCandidate(store,lesson,req.body,req.user),task=[...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===req.body.activityId);requireValue(task,'Exercice inconnu.');res.json(await testActivityCode(task,task.starter));});
 app.post('/api/lessons/:id/editor/publish',teacher,async(req,res)=>res.json(await publishEditor(store,req.params.id,req.body,req.user)));
 app.post('/api/lessons/:id/editor/export',teacher,async(req,res)=>{const {bytes}=await exportEditor(store,req.params.id,req.body,req.user);res.setHeader('Content-Disposition','attachment; filename="brouillon.tweenteach.zip"');res.type('application/zip').send(bytes);});
 app.post('/api/lessons/:id/editor/image',teacher,express.raw({type:['image/png','image/jpeg','image/webp','image/gif'],limit:'2mb'}),async(req,res)=>{
  await scoped(store,'lessons',req.params.id,req.user);const bytes=req.body;requireValue(Buffer.isBuffer(bytes)&&bytes.length>12,'Image attendue.');
  const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes.subarray(0,3).toString()==='GIF'?'image/gif':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':null;requireValue(mime&&mime===req.headers['content-type'],'Image invalide.');
  const hash=sha256(bytes),id=sha256(req.user.classId+':editor:'+hash);await store.transaction(async tx=>{if(!await tx.get('lesson_assets',id))await tx.insert('lesson_assets',{id,classId:req.user.classId,kind:'portable-file',mimeType:mime,sha256:hash,base64:bytes.toString('base64')});});res.json({src:`/api/lesson-transfer-files/${id}`});
 });
}
