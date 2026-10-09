import {openStore} from '../../server/store.mjs';
import {createApp} from '../../server/app.mjs';
import {passwordHash,createSession} from '../../server/auth.mjs';
import {demoLesson} from '../../server/demo-lesson.mjs';
import {distributeRun} from '../../server/student-tracking.mjs';
export async function trackingFixture(){
 const store=await openStore({path:':memory:',url:''}),password='synthetic-tracking-only';
 const teacher={id:'teacher',role:'teacher',classId:'A1',username:'teacher',displayName:'Professeur de recette',passwordHash:passwordHash(password)};
 await store.insert('teachers',teacher);await store.insert('teachers',{...teacher,id:'outsider',classId:'A2',username:'outsider'});
 for(const id of ['alice','bob'])await store.insert('learners',{id,classId:'A1',role:'student',username:id,displayName:id==='alice'?'Camille Martin':'Camille Martin',passwordHash:passwordHash(password)});
 const spec=demoLesson();Object.assign(spec,{lessonId:'lesson',classId:'A1',date:'2026-10-05'});
 spec.diagnostic.tasks[0].reference='PRIVATE_SOLUTION';spec.teacherGuide='PRIVATE_GUIDE';
 await store.insert('lesson_versions',{id:'lesson:v1',classId:'A1',lessonId:'lesson',version:1,spec});
 const lesson=await store.insert('lessons',{id:'lesson',classId:'A1',title:spec.title,date:spec.date,status:'published',version:1,versionId:'lesson:v1',runId:'run'});
 const run=await store.insert('lesson_runs',{id:'run',classId:'A1',lessonId:'lesson',lessonVersionId:'lesson:v1',date:spec.date,status:'planned',closedAt:null});
 await store.transaction(tx=>distributeRun(tx,run));
 const server=createApp(store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`,cookies={};
 async function call(path,{as='teacher',method='GET',body,headers={}}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookies[as]?{Cookie:cookies[as]}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data,headers:r.headers};}
 for(const id of ['teacher','outsider','alice','bob']){const role=['teacher','outsider'].includes(id)?'teacher':'student',account=await store.get(role==='teacher'?'teachers':'learners',id);await createSession(store,{...account,role},{setHeader:(_k,value)=>{cookies[id]=value.split(';')[0];}});}

 const assignments=await store.list('lesson_assignments');
 const assignment=assignments.find(a=>a.learnerId==='alice');
 async function start(as='alice'){return (await call('/api/assessments/lesson/start',{as,method:'POST',body:{assignmentId:assignments.find(a=>a.learnerId===as).id}})).data;}
 async function submit(as='alice'){const a=await start(as),r=await call(`/api/assessments/${a.id}/submit`,{as,method:'POST',body:{draftVersion:a.draftVersion,answers:{'demo-diag':'La carte ET la réservation sont nécessaires.','demo-diag-2':'return renvoie une valeur.'}}});if(r.status!==200)throw Error(JSON.stringify(r));return {a,s:r.data};}
 const close=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();};
 return {store,server,base,cookies,password,teacher,spec,lesson,run,assignment,call,start,submit,close};
}
