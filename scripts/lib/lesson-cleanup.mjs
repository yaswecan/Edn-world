import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {TABLES} from '../../server/store.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ensure=(condition,message)=>{if(!condition)throw Error(message);};
const active=['queued','running','retry_wait'];
const dependents=['lesson_versions','lesson_runs','lesson_publications','assessment_attempts',
 'submissions','corrections','correction_revisions','evidence','corpus_packages','game_runs',
 'game_events','game_evidence','game_unlocks','agent_runs','teacher_approvals','audit_log',
 'drive_publications','learning_events','teacher_observations','lesson_adaptations',
 'publication_jobs','learning_progress','generation_candidates','generation_calls',
 'generation_revisions','lesson_assets','lab_sessions','content_snapshots','archive_outbox','work_submissions'];
const referenceKeys=['lessonId','lessonVersionId','lessonRunId','attemptId','submissionId',
 'correctionId','jobId','snapshotId','entityId','agentRunId','runId','publicationId','corpusId'];
const owner=row=>row.lessonId||row.manifest?.subject?.lessonId||(row.spec?.lessonId
 ?row.spec.lessonId.startsWith(row.classId+':')?row.spec.lessonId:row.classId+':'+row.spec.lessonId
 :null);
const references=row=>[...referenceKeys.map(k=>row[k]),owner(row),row.manifest?.subject?.lessonVersionId];

export function readCleanupRows(db){
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
 ensure(names.every(t=>TABLES.includes(t)),'Table inconnue : nettoyage interrompu.');
 return Object.fromEntries(names.map(t=>[t,db.prepare(`SELECT id,class_id,version,data,created_at FROM ${t} ORDER BY id`).all()]));
}

// Keep the current lessons and their provenance intact. Imported planning,
// shared reference libraries, accounts and World Arcade are outside this cleanup.
export function planLessonCleanup(rows,{classId,keepVersions}){
 ensure(classId&&Array.isArray(keepVersions)&&keepVersions.length,'Classe et versions à conserver requises.');
 const decoded=Object.fromEntries(Object.entries(rows).map(([t,list])=>[t,list.map(r=>({...JSON.parse(r.data),classId:r.class_id}))]));
 const lessons=(decoded.lessons||[]).filter(r=>r.classId===classId);
 const kept=keepVersions.map(versionId=>{
  const lesson=lessons.find(l=>l.versionId===versionId);
  ensure(lesson,`Version courante introuvable : ${versionId}`);
  ensure(decoded.lesson_versions?.some(v=>v.id===versionId&&v.classId===classId),'Contenu conservé manquant.');
  return lesson;
 });
 ensure(new Set(kept.map(l=>l.id)).size===keepVersions.length,'Versions conservées dupliquées.');
 ensure(!(decoded.generation_jobs||[]).some(j=>j.classId===classId&&active.includes(j.status)),
  'Une génération est active : terminer ou annuler le travail avant le nettoyage.');
 ensure(!(decoded.publication_jobs||[]).some(j=>j.classId===classId&&active.includes(j.status)),
  'Une publication est active : nettoyage interrompu.');
 ensure(!(decoded.archive_outbox||[]).some(j=>j.classId===classId&&j.state==='running'),
  'Un archivage est actif : nettoyage interrompu.');
 ensure(!(decoded.lab_sessions||[]).some(j=>j.classId===classId&&!['closed','expired','failed'].includes(j.status)),
  'Un laboratoire existe encore : fermer le laboratoire avant le nettoyage.');
 const keepIds=new Set(kept.map(l=>l.id)),removed=new Set(),deletions={};
 const mark=(table,row)=>{(deletions[table]??=new Set()).add(row.id);removed.add(row.id);};
 for(const l of lessons)if(!keepIds.has(l.id))mark('lessons',l);
 // Only the generation directly attached to a retained lesson remains usable.
 const keptJobs=new Set(kept.map(l=>l.qualityJobId).filter(Boolean));
 for(const j of decoded.generation_jobs||[])if(j.classId===classId&&!keptJobs.has(j.id))mark('generation_jobs',j);
 let changed=true;
 while(changed){
  const count=removed.size;
  for(const table of dependents)for(const row of decoded[table]||[]){
   if(row.classId!==classId||deletions[table]?.has(row.id))continue;
   if(references(row).some(id=>id&&removed.has(id)))mark(table,row);
  }
  changed=removed.size!==count;
 }
 // Contexts are shared by hash: remove only those exclusively used by removed jobs.
 const contextIds=new Set((decoded.generation_jobs||[]).filter(j=>removed.has(j.id)).map(j=>j.documentContext?.id).filter(Boolean));
 const remainingText=JSON.stringify(Object.fromEntries(Object.entries(rows).filter(([t])=>t!=='document_contexts').map(([t,list])=>[t,list.filter(r=>!deletions[t]?.has(r.id))])));
 for(const c of decoded.document_contexts||[])if(c.classId===classId&&contextIds.has(c.id)&&!remainingText.includes(c.id))mark('document_contexts',c);
 const changes=Object.fromEntries(Object.entries(deletions).map(([t,ids])=>[t,rows[t].filter(r=>ids.has(r.id)).map(r=>({id:r.id,sha256:digest(r)}))]));
 return {format:'eden-lesson-cleanup-v1',classId,createdAt:new Date().toISOString(),
  fingerprint:digest(rows),keep:kept.map(l=>({id:l.id,title:l.title,versionId:l.versionId})),changes,
  counts:Object.fromEntries(Object.entries(changes).map(([t,list])=>[t,list.length]))};
}

export function inspectCleanup(source,options){
 const db=new DatabaseSync(source,{readOnly:true});
 try{db.exec('BEGIN');return planLessonCleanup(readCleanupRows(db),options);}finally{db.close();}
}

export function applyCleanup(source,plan,{backupPath}={}){
 ensure(plan.format==='eden-lesson-cleanup-v1','Plan de nettoyage invalide.');
 ensure(backupPath,'Une sauvegarde SQLite est requise.');
 const db=new DatabaseSync(source);db.exec('PRAGMA busy_timeout=5000;');
 try{
  const before=readCleanupRows(db);
  // Replaying a plan cannot select or delete lessons created after its review.
  if(Object.entries(plan.changes).every(([t,list])=>list.every(r=>!before[t]?.some(x=>x.id===r.id))))return {status:'already_applied',counts:plan.counts};
  ensure(digest(before)===plan.fingerprint,'La base a changé depuis le plan : relancer la prévisualisation.');
  db.prepare('VACUUM INTO ?').run(backupPath);
  db.exec('BEGIN IMMEDIATE');
  try{
   const locked=readCleanupRows(db);
   ensure(digest(locked)===plan.fingerprint,'La base a changé pendant la sauvegarde.');
   // Recompute rather than trust deletion lists in an edited manifest.
   const verified=planLessonCleanup(locked,{classId:plan.classId,keepVersions:plan.keep.map(l=>l.versionId)});
   ensure(JSON.stringify(verified.changes)===JSON.stringify(plan.changes),'Le périmètre du plan a changé.');
   for(const [table,list] of Object.entries(plan.changes)){
    const remove=db.prepare(`DELETE FROM ${table} WHERE id=? AND class_id=?`);
    for(const row of list)ensure(remove.run(row.id,plan.classId).changes===1,'Suppression incomplète.');
   }
   const expected=Object.fromEntries(Object.entries(locked).map(([t,list])=>[t,list.filter(r=>!plan.changes[t]?.some(x=>x.id===r.id))]));
   ensure(digest(readCleanupRows(db))===digest(expected),'Vérification après nettoyage échouée.');
   db.exec('COMMIT');
   return {status:'applied',counts:plan.counts,keep:plan.keep,backupPath};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }finally{db.close();}
}
