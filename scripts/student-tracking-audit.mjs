import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
export function auditTrackingDatabase(path){
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  const rows=table=>tables.has(table)?db.prepare(`SELECT data FROM ${table}`).all().map(r=>JSON.parse(r.data)):[];
  const names=['learners','enrollments','lessons','lesson_versions','lesson_runs','assessment_attempts','learning_progress','submissions','work_submissions','corrections','evidence','lesson_assignments','result_publications'];
  const data=Object.fromEntries(names.map(n=>[n,rows(n)])),ids=Object.fromEntries(names.map(n=>[n,new Set(data[n].map(r=>r.id))])),issues=[];
  for(const table of ['assessment_attempts','submissions','work_submissions','learning_progress'])for(const row of data[table]){
   if(!ids.learners.has(row.learnerId))issues.push({table,id:row.id,issue:'Identité élève absente ou ambiguë'});
   if(!ids.lesson_versions.has(row.lessonVersionId))issues.push({table,id:row.id,issue:'Version pédagogique absente'});
   const matching=data.lesson_runs.filter(r=>r.lessonVersionId===row.lessonVersionId&&(!row.lessonId||r.lessonId===row.lessonId));
   if(!row.assignmentId&&matching.length!==1)issues.push({table,id:row.id,issue:matching.length?'Plusieurs occurrences pour cette version':'Occurrence historique non déterminée'});
  }
  for(const c of data.corrections)if(!ids.submissions.has(c.submissionId||c.id))issues.push({table:'corrections',id:c.id,issue:'Correction sans copie liée'});
  return {mode:'lecture seule — aucune migration exécutée',counts:Object.fromEntries(names.map(n=>[n,data[n].length])),issues};
 }finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(!process.argv[2])throw Error('Usage : node scripts/student-tracking-audit.mjs CHEMIN_SQLITE');console.log(JSON.stringify(auditTrackingDatabase(process.argv[2]),null,2));}
