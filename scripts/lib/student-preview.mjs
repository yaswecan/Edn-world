import {DatabaseSync} from 'node:sqlite';
import {arcadeFixture} from '../../tests/fixtures/arcade.mjs';
import {demoLesson} from '../../server/demo-lesson.mjs';
import {parisDate} from '../../server/generator.mjs';

// Source stays read-only. School accounts are an explicit local preview option;
// only learner login fields/profiles are copied, never sessions or teacher accounts.
function readLesson(source,lessonId,date,schoolAccounts) {
 const db=new DatabaseSync(source,{readOnly:true});
 try {
  db.exec('BEGIN');
  const lessons=db.prepare('SELECT data FROM lessons').all().map(row=>JSON.parse(row.data));
  const lesson=lessonId?lessons.find(l=>l.id===lessonId):lessons.filter(l=>l.date===date).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''))[0];
  if(!lesson)throw Error('Aucune séance à cette date. Choisissez --date AAAA-MM-JJ ou --lesson IDENTIFIANT.');
  if(lesson.classId!=='A1')throw Error('Cet aperçu utilise la classe de test A1.');
  const get=(table,id)=>{const row=db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);return row?JSON.parse(row.data):null;};
  const version=get('lesson_versions',lesson.versionId);
  if(!version?.spec)throw Error('Version de séance introuvable.');
  const missionId=version.spec.codeStation?.missionId;
  const mission=missionId?get('game_missions',missionId):null;
  if(missionId&&!mission)throw Error('Mission associée introuvable.');
  const learners=schoolAccounts?db.prepare('SELECT data FROM learners WHERE class_id=?').all(lesson.classId).map(row=>{
   const {id,classId,username,displayName,passwordHash,authVersion,arcadeProfile}=JSON.parse(row.data);
   return {id,classId,username,displayName,passwordHash,authVersion,arcadeProfile,role:'student'};
  }):[];
  db.exec('COMMIT');
  return {lesson,version,mission,learners};
 } finally {db.close();}
}

export async function studentPreview({port=0,source,lessonId,date=parisDate(),schoolAccounts=false}={}) {
 if(process.env.NODE_ENV==='production'||process.env.VERCEL)throw Error('Cet aperçu est réservé aux tests locaux.');
 if(lessonId&&!source)throw Error('--lesson nécessite --source.');
 if(schoolAccounts&&!source)throw Error('--school-accounts nécessite --source.');
 const selected=source?readLesson(source,lessonId,date,schoolAccounts):null;
 process.env.EDEN_WORLD_ARCADE='1';
 const fixture=await arcadeFixture({port});
 try {
  const {store}=fixture;
  const previous=await store.get('lessons','arcade-lesson');
  const original=await store.get('lesson_versions',previous.versionId);
  const spec=selected?structuredClone(selected.version.spec):demoLesson();
  if(!selected)Object.assign(spec,{lessonId:previous.id,classId:'A1',date,codeStation:original.spec.codeStation});
  const id=selected?.lesson.id||previous.id;
  const versionId=selected?.version.id||previous.versionId;
  const lesson={id,classId:'A1',title:spec.title,date:spec.date,version:selected?.lesson.version||1,versionId,diagnosticVersionId:versionId,runId:'student-preview-run',status:'published'};
  await store.remove('lessons',previous.id);
  await store.remove('lesson_versions',previous.versionId);
  if(selected){
   // Do not fabricate progress: the demo fixture's unlock and save are unrelated.
   await store.remove('learning_events','unlocked-a');
   await store.remove('player_progression',`student-a:${fixture.mission.world}`);
   if(selected.mission){
    if(await store.get('game_missions',selected.mission.id))await store.put('game_missions',selected.mission);
    else await store.insert('game_missions',selected.mission);
   }
  } else {
   const unlock=await store.get('learning_events','unlocked-a');
   await store.put('learning_events',{...unlock,lessonRunId:lesson.runId});
  }
  await store.insert('lesson_versions',{id:versionId,classId:'A1',lessonId:id,version:lesson.version,spec});
  await store.insert('lessons',lesson);
  await store.insert('lesson_runs',{id:lesson.runId,classId:'A1',lessonId:id,lessonVersionId:versionId,date:lesson.date,status:'planned',eligibleForDiagnostic:false,coveredSkills:[],coveredActivityIds:[],coveredContent:''});
  if(schoolAccounts){
   // Replace the demo directory completely: no shared test password on real accounts.
   for(const table of ['learners','learning_events','player_progression'])for(const row of await store.list(table))await store.remove(table,row.id);
   for(const learner of selected.learners)await store.insert('learners',learner);
  } else {
   const learner=await store.get('learners','student-a');
   await store.put('learners',{...learner,displayName:'Élève test',arcadeProfile:{publicId:'preview-student',handle:'Élève test',avatarId:'04',visibility:'private'}});
  }
  return {...fixture,lesson,schoolAccounts,accountsWithAccess:schoolAccounts?selected.learners.filter(l=>l.username&&l.passwordHash).length:null,sourceStatus:selected?.lesson.status||null};
 } catch(error) {await fixture.close();throw error;}
}
