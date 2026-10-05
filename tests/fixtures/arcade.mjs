import {openStore} from '../../server/store.mjs';
import {passwordHash} from '../../server/auth.mjs';
import {seedCatalog, catalog} from '../../server/game.mjs';
import {createApp} from '../../server/app.mjs';
export async function arcadeFixture({port=0}={}) {
  const store = await openStore({url:'',path:':memory:'});
  const password = 'synthetic-test-password';
  const passwordDigest = passwordHash(password);
  for (const [id,role,classId] of [['teacher-a','teacher','A1'],['teacher-b','teacher','B1'],['student-a','student','A1'],['student-b','student','A1'],['student-other','student','B1'],['external','external','OUTSIDE']]) {
    await store.insert(role==='teacher'?'teachers':'learners',{id,role,classId,username:id,displayName:`Identité privée ${id}`,email:`${id}@example.invalid`,passwordHash:passwordDigest});
  }
  await seedCatalog(store,'A1'); await seedCatalog(store,'B1');
  const missionId=`A1:code-station:${catalog['code-station'].missions[0].id}:v1`;
  const mission=await store.get('game_missions',missionId);
  await store.insert('lesson_versions',{id:'arcade-lesson:v1',classId:'A1',spec:{codeStation:{missionId,worldId:mission.world,unlockAfter:'autonomy'},activities:[]}});
  await store.insert('lessons',{id:'arcade-lesson',classId:'A1',versionId:'arcade-lesson:v1',status:'published',runId:'lesson-run'});
  await store.insert('learning_events',{id:'unlocked-a',classId:'A1',learnerId:'student-a',lessonRunId:'lesson-run',type:'step_completed',activityId:'autonomy'});
  const save={version:7,callsign:'Ancien pseudo',completedUnits:{},worldProgress:{[mission.world]:{completed:{},xp:0,drafts:{[mission.localId]:{files:{...mission.files},activeFile:Object.keys(mission.files)[0],scenario:0,lastResult:'',lastTest:null}}}},lastWorld:mission.world};
  await store.insert('player_progression',{id:`student-a:${mission.world}`,classId:'A1',learnerId:'student-a',world:mission.world,progress:save});
  for(let i=1;i<=29;i++) await store.insert('learners',{id:`player-${i}`,classId:i===29?'B1':'A1',displayName:`NOM PRIVE ${i}`,email:`private-${i}@example.invalid`,arcadeProfile:{publicId:`opaque-${String(i).padStart(2,'0')}`,handle:`Pilote ${String(i).padStart(2,'0')}`,avatarId:String((i%15)+1).padStart(2,'0'),visibility:i===28?'private':'class'}});
  const app=createApp(store),server=app.listen(port,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}`;
  return {store,server,base,password,mission,save,close:async()=>{await new Promise(r=>server.close(r));await store.close();}};
}
