import {recordTeacherEvidence,publishTeacherEvidence} from './teacher-evidence.mjs';
import {teacher,student,loggedIn} from './auth.mjs';
import {scoped,requireValue,now} from './store.mjs';
import {currentActor,competencyView} from './competency-service.mjs';
import {pageRows} from './student-tracking.mjs';
import {frameworkContent,frameworkUsages,createFramework,editFramework,transitionFramework,previewFrameworkImport,applyFrameworkImport} from './framework-admin.mjs';
import {createOccurrence,updateOccurrence,replanRemaining,releaseOccurrence,recordParticipation,occurrenceConflicts} from './occurrence-planning.mjs';
import {askQuestion,answerQuestion,questions,pilotage,trackingCSV,decideAlert,withdrawResult} from './tracking-v3.mjs';

export function trackingV3Routes(app,store){
 const handle=fn=>async(req,res)=>res.json(await store.transaction(async tx=>{await currentActor(tx,req.user);return fn(tx,req.user,req);}));
 app.post('/api/v3/teacher-evidence',teacher,handle((tx,a,r)=>recordTeacherEvidence(tx,a,r.body)));
 app.post('/api/v3/teacher-evidence/:id/publish',teacher,handle((tx,a,r)=>publishTeacherEvidence(tx,a,r.params.id,r.body)));
 app.get('/api/v3/config',teacher,handle(async(tx,a)=>{
  const [frameworks,versions,lessons,runs,learners,enrollments]=await Promise.all(['framework_versions','lesson_versions','lessons','lesson_runs','learners','enrollments'].map(t=>tx.list(t,a.classId)));
  const ids=new Set([...learners.map(l=>l.id),...enrollments.filter(e=>e.status==='active').map(e=>e.learnerId)]),people=[];
  for(const id of ids){const l=learners.find(l=>l.id===id)||await tx.get('learners',id);if(l&&!l.suspended)people.push({id:l.id,displayName:l.displayName});}
  return {frameworks,canPublishShared:a.permissions?.includes('framework:publish')||false,lessons:lessons.map(l=>({id:l.id,title:l.pedagogicalTitle||l.title,status:l.status})),versions:versions.map(v=>({id:v.id,lessonId:v.lessonId,version:v.version,title:v.spec.pedagogicalTitle||v.spec.title,activities:v.spec.activities.map(a=>({id:a.id,title:a.title}))})),runs:runs.map(r=>({id:r.id,date:r.date,title:versions.find(v=>v.id===r.lessonVersionId)?.spec.title||'Séance conservée'})),learners:people};
 }));
 app.post('/api/v3/frameworks',teacher,handle((tx,a,r)=>createFramework(tx,a,r.body)));
 app.put('/api/v3/frameworks/:id',teacher,handle((tx,a,r)=>editFramework(tx,a,r.params.id,r.body)));
 app.post('/api/v3/frameworks/:id/transition',teacher,handle((tx,a,r)=>transitionFramework(tx,a,r.params.id,r.body)));
 app.get('/api/v3/frameworks/:id/usages',teacher,handle((tx,a,r)=>frameworkUsages(tx,a,r.params.id,r.query.nodeId)));
 app.get('/api/v3/frameworks/:id/export',teacher,handle(async(tx,a,r)=>{const f=await scoped(tx,'framework_versions',r.params.id,a);await tx.audit(a,'framework.exported',f.id);return {format:'tweenteach-framework',version:3,content:frameworkContent(f)};}));
 app.post('/api/v3/framework-import/preview',teacher,handle((tx,a,r)=>previewFrameworkImport(tx,a,r.body)));
 app.post('/api/v3/framework-import/apply',teacher,handle((tx,a,r)=>applyFrameworkImport(tx,a,r.body)));
 app.get('/api/v3/occurrences',teacher,handle(async(tx,a,r)=>{
  const versions=new Map((await tx.list('lesson_versions',a.classId)).map(v=>[v.id,v]));
  const rows=(await tx.list('lesson_runs',a.classId)).filter(o=>(!r.query.from||o.date>=r.query.from)&&(!r.query.to||o.date<=r.query.to)&&(!r.query.sequence||o.sequence===r.query.sequence)).sort((x,y)=>x.date.localeCompare(y.date)||x.id.localeCompare(y.id));
  return pageRows(rows.map(o=>({...o,title:versions.get(o.lessonVersionId)?.spec.pedagogicalTitle||versions.get(o.lessonVersionId)?.spec.title||'Séance conservée'})),r.query);
 }));
 app.get('/api/v3/occurrences/:id',teacher,handle(async(tx,a,r)=>{const row=await scoped(tx,'lesson_runs',r.params.id,a);return {occurrence:row,conflicts:await occurrenceConflicts(tx,a,row),history:(await tx.list('plan_changes',a.classId)).filter(c=>c.occurrenceId===row.id),participations:(await tx.list('occurrence_participations',a.classId)).filter(p=>p.runId===row.id)};}));
 app.post('/api/v3/occurrences',teacher,handle((tx,a,r)=>createOccurrence(tx,a,r.body)));
 app.patch('/api/v3/occurrences/:id',teacher,handle((tx,a,r)=>updateOccurrence(tx,a,r.params.id,r.body)));
 app.post('/api/v3/occurrences/:id/remaining',teacher,handle((tx,a,r)=>replanRemaining(tx,a,r.params.id,r.body)));
 app.post('/api/v3/occurrences/:id/release',teacher,handle((tx,a,r)=>releaseOccurrence(tx,a,r.params.id,r.body)));
 app.post('/api/v3/occurrences/:id/participation',teacher,handle((tx,a,r)=>recordParticipation(tx,a,r.params.id,r.body)));
 app.post('/api/v3/publications/:id/withdraw',teacher,handle((tx,a,r)=>withdrawResult(tx,a,r.params.id,r.body)));
 app.post('/api/v3/alerts',teacher,handle((tx,a,r)=>decideAlert(tx,a,r.body)));
 app.get('/api/v3/pilotage',teacher,handle((tx,a,r)=>pilotage(tx,a,r.query)));
 app.get('/api/v3/export',teacher,async(req,res)=>{
  requireValue(['observations','retained'].includes(req.query.mode),'Choisissez explicitement le mode observations ou retained.');
  const csv=await store.transaction(async tx=>{await currentActor(tx,req.user);const view=await pilotage(tx,req.user,{...req.query,limit:100,offset:0});let rows=[...view.distributions.items];for(let offset=100;offset<view.distributions.total;offset+=100){const more=await pilotage(tx,req.user,{...req.query,limit:100,offset});rows.push(...more.distributions.items);}view.distributions.items=rows;await tx.audit(req.user,'tracking.exported',req.user.classId,{mode:req.query.mode,from:req.query.from||null,to:req.query.to||null});return trackingCSV(view);});
  res.type('text/csv').set('Content-Disposition','attachment; filename="suivi-criteres.csv"').send(csv);
 });
 app.get('/api/v3/my-report',student,handle(async(tx,a)=>({format:'tweenteach-student-report',version:3,exportedAt:now(),...await competencyView(tx,a,a.id)})));
 app.get('/api/v3/questions',loggedIn,handle((tx,a,r)=>questions(tx,a,r.query)));
 app.post('/api/v3/questions',student,handle((tx,a,r)=>askQuestion(tx,a,r.body)));
 app.post('/api/v3/questions/:id',teacher,handle((tx,a,r)=>answerQuestion(tx,a,r.params.id,r.body)));
}
