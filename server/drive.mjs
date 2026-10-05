import {artifactBuffer} from './artifacts.mjs';
import {individualExport} from './corpus.mjs';
import {hash} from './importer.mjs';
import {getDrive,listStudents,listChildFolders,resolvePath,fileExists,uploadBuffer} from './integrations/google-drive.ts';
import {uid,now,scoped,requireValue,fail} from './store.mjs';
export {listStudents,listChildFolders,getDrive};
export const driveConfigured=()=>!!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&process.env.GOOGLE_PRIVATE_KEY&&process.env.GOOGLE_DRIVE_ELEVES_FOLDER_ID);
export async function uploadResumable(drive,parentId,file,buffer) {
 // Reuse the legacy authenticated client and folder primitives; the corpus never
 // transits through the browser. Small files reuse the original upload helper.
 if(buffer.length<5*1024*1024)return uploadBuffer(drive,parentId,file.name,file.mimeType,buffer,true);
 if(await fileExists(drive,parentId,file.name))return {status:'skipped'};
 const auth=drive.context._options.auth;
 const init=await auth.request({url:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name',method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':file.mimeType,'X-Upload-Content-Length':String(buffer.length)},data:{name:file.name,parents:[parentId]}});
 const location=typeof init.headers.get==='function'?init.headers.get('location'):init.headers.location;
 requireValue(location&&new URL(location).hostname.endsWith('.googleapis.com'),'Session Drive résumable invalide.');
 const chunk=8*1024*1024;let offset=0,retries=0;
 const rangeEnd=response=>{const range=typeof response.headers.get==='function'?response.headers.get('range'):response.headers.range;return range?Number(range.split('-').at(-1))+1:0;};
 while(offset<buffer.length){const end=Math.min(offset+chunk,buffer.length)-1;
  try{
   const result=await auth.request({url:location,method:'PUT',headers:{'Content-Type':file.mimeType,'Content-Length':String(end-offset+1),'Content-Range':`bytes ${offset}-${end}/${buffer.length}`},data:buffer.subarray(offset,end+1),validateStatus:s=>(s>=200&&s<300)||s===308});
   if(result.status!==308)return {status:'created',fileId:result.data.id};
   const received=rangeEnd(result);if(received<=offset)throw Error('Drive upload made no progress');offset=received;retries=0;
  }catch(e){
   if(++retries>3)throw e;
   const status=await auth.request({url:location,method:'PUT',headers:{'Content-Length':'0','Content-Range':`bytes */${buffer.length}`},validateStatus:s=>(s>=200&&s<300)||s===308});
   if(status.status!==308)return {status:'created',fileId:status.data.id};offset=rangeEnd(status);
  }
 }
 fail(502,'Drive n’a pas confirmé le fichier.');
}
export async function publishDrive(store,lessonId,input,actor,{retryId,publicationId}={}) {
 if(!driveConfigured())fail(503,'Configurez les identifiants Google Drive côté serveur.');requireValue(input.confirmed,'Validez les destinataires avant publication Drive.');
 const lesson=await scoped(store,'lessons',lessonId,actor);requireValue(['published','completed'].includes(lesson.status),'Publiez la séance avant de la distribuer.');
 const corpus=(await store.list('corpus_packages',actor.classId)).find(c=>c.lessonVersionId===lesson.versionId);requireValue(corpus,'Compilez le corpus.');
 const drive=getDrive(),folders=await listStudents(drive),learners=await store.list('learners',actor.classId);
 const audience=input.audience||'student';requireValue(['student','teacher','individual'].includes(audience),'Destination invalide.');
 const requested=audience==='teacher'?[{id:actor.id,displayName:'Professeur',driveFolderId:process.env.GOOGLE_DRIVE_TEACHER_FOLDER_ID}]:input.students?.includes('all')?learners:learners.filter(l=>input.students?.includes(l.id));requireValue(requested.length,'Sélectionnez des destinataires.');
 const files=corpus.files.filter(f=>audience==='teacher'||f.audience==='student');
 const report=retryId?await scoped(store,'drive_publications',retryId,actor):await store.insert('drive_publications',{id:publicationId||uid('drivepub'),classId:actor.classId,lessonId,lessonVersionId:lesson.versionId,status:'running',students:[],total:requested.length,spec:{audience,students:requested.map(l=>l.id),subject:input.subject||'01 - Tech',path:input.path||['01 - Cours',corpus.manifest.lessonId]},version:1});
 if(report.lessonVersionId!==lesson.versionId)fail(409,'La séance a changé depuis la publication initiale.');
 for(const student of requested){if(retryId&&report.students.some(s=>s.studentId===student.id&&s.status==='success'))continue;const row={studentId:student.id,status:'success',filesCreated:0,filesSkipped:0,files:[]};
  try{const root=audience==='teacher'&&student.driveFolderId?{id:student.driveFolderId}:folders.find(f=>f.id===student.driveFolderId);requireValue(root,`${student.displayName} : associez le dossier Drive au compte élève.`);
   const base=await resolvePath(drive,root.id,[report.spec.subject,...report.spec.path],true);
   let recipientFiles=files;if(audience==='individual'){const submissions=(await store.list('submissions',actor.classId)).filter(s=>s.learnerId===student.id&&s.lessonVersionId===lesson.versionId).sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt)),submission=submissions.at(-1);requireValue(submission,'Aucune copie remise pour cette version.');const correction=await store.get('corrections',submission.id);requireValue(correction?.status==='approved','Validez la correction avant sa distribution individuelle.');const buffer=await individualExport(store,submission.id,actor);recipientFiles=[{path:`evaluation/${submission.id}-v${correction.version}.zip`,mimeType:'application/zip',base64:buffer.toString('base64'),sha256:hash(buffer)}];}
   for(const file of recipientFiles){const parts=file.path.split('/'),name=parts.pop(),parent=await resolvePath(drive,base,parts,true),buffer=await artifactBuffer(file);const result=await uploadResumable(drive,parent,{name,mimeType:file.mimeType},buffer);row[result.status==='skipped'?'filesSkipped':'filesCreated']++;row.files.push({artifactId:file.path,artifactVersion:corpus.version,sha256:file.sha256||corpus.manifest.files.find(f=>f.path===file.path)?.sha256,driveFolderId:parent,driveFileId:result.fileId||result.id||null,publishedAt:now(),publicationStatus:result.status});}
  }catch(e){row.status='failed';row.error=e.message;}
  report.students=report.students.filter(s=>s.studentId!==student.id);report.students.push(row);await store.put('drive_publications',report);
 }
 report.success=report.students.filter(s=>s.status==='success').length;report.failed=report.students.filter(s=>s.status==='failed').length;report.status=report.failed?(report.success?'partial_success':'failed'):'success';await store.put('drive_publications',report);await store.audit(actor,'drive.published',report.id,{success:report.success,failed:report.failed});return report;
}
