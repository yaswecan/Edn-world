import {readFileSync} from 'node:fs';
import {uid,now,fail,requireValue,scoped} from './store.mjs';
import '../public/game/mission-model.js';
export function explorationForMission(mission){
 try{return globalThis.StationModel.compile(mission);}
 catch(error){fail(409,`Mission explorable indisponible : ${error.message}`);}
}
export const catalog=JSON.parse(readFileSync(new URL('../data/game-catalog.json',import.meta.url)));
export function initialCatalog(classId='A1'){
 const rows={game_worlds:[],game_missions:[]};
 for(const [world,w]of Object.entries(catalog)){
  rows.game_worlds.push({id:`${classId}:${world}`,classId,world,title:w.title,requires:w.requires||null,...Object.fromEntries(Object.entries(w).filter(([k])=>k!=='missions'))});
  for(const m of w.missions)rows.game_missions.push({...m,id:`${classId}:${world}:${m.id}:v1`,localId:m.id,classId,world,version:1,competencies:m.resources,prerequisites:[],completionRule:'all_scenarios_pass',starterFiles:m.files});
 }
 return rows;
}
export async function seedCatalog(store,classId='A1'){return store.transaction(async tx=>{for(const [table,rows]of Object.entries(initialCatalog(classId)))for(const row of rows)if(!await tx.get(table,row.id))await tx.insert(table,row);});}
export async function authorizeGame(store,input,actor){const mission=await scoped(store,'game_missions',input.missionId,actor),lesson=await scoped(store,'lessons',input.lessonId,actor);if(lesson.status!=='published')fail(409,'Séance non ouverte.');const spec=(await store.get('lesson_versions',lesson.versionId)).spec;requireValue(spec.codeStation?.missionId===mission.id,'Mission non affectée à cette séance.');
 explorationForMission(mission);
 // Assigned Code Station missions are open to every student in the class.
 // World progression and legacy unlockAfter fields do not gate play or create
 // completion evidence. Publication, assignment and per-student saves still apply.
 return {mission,lesson};}
export async function authorizeRun(store,id,actor){const run=await scoped(store,'game_runs',id,actor);if(run.learnerId!==actor.id)fail(403,'Mission d’un autre élève.');const {mission,lesson}=await authorizeGame(store,run,actor);if(run.missionVersion!==mission.version||run.lessonRunId!==lesson.runId)fail(409,'La mission a changé. Revenez à la salle.');return run;}
export async function startGame(store,input,actor){const {mission,lesson}=await authorizeGame(store,input,actor);
 return store.insert('game_runs',{id:uid('game'),classId:actor.classId,learnerId:actor.id,lessonId:lesson.id,lessonRunId:lesson.runId,missionId:mission.id,missionVersion:mission.version,world:mission.world,status:'started',events:0,startedAt:now()});}
export async function recordGameEvent(store,id,input,actor){return store.transaction(async tx=>{const run=await authorizeRun(tx,id,actor);const types=['game_started','mission_started','room_entered','terminal_opened','file_opened','code_run','code_attempted','test_run','test_failed','test_passed','hint_used','task_completed','mission_completed','game_closed'];requireValue(types.includes(input.type)&&typeof input.eventId==='string'&&input.eventId.length<150,'Événement invalide.');const eventId=`${run.id}:${input.eventId}`;const existing=await tx.get('game_events',eventId);if(existing)return existing;if(JSON.stringify(input.payload||{}).length>150000)fail(413,'Événement trop volumineux.');
 const event=await tx.insert('game_events',{id:eventId,classId:actor.classId,learnerId:actor.id,studentId:actor.id,lessonRunId:run.lessonRunId,missionRunId:run.id,type:input.type,timestamp:now(),payload:input.payload||{}});run.events++;if(input.type==='mission_completed'){run.status='completed_unverified';if(!(await tx.list('game_evidence',actor.classId)).some(e=>e.missionRunId===run.id))await tx.insert('game_evidence',{id:uid('gameproof'),classId:actor.classId,learnerId:actor.id,missionRunId:run.id,missionId:run.missionId,status:'review_required',approved:false,production:input.payload?.files||{},note:'Résultat du runtime déclaratif. Validation professeur requise pour preuve pédagogique.'});}await tx.put('game_runs',run);return event;});}

export async function worldAccess(store,actor,worldId){const world=catalog[worldId];requireValue(world,'Monde inconnu.');const overrides=(await store.list('game_teacher_overrides',actor.classId)).filter(o=>o.learnerId===actor.id&&o.worldId===worldId),override=overrides.at(-1);if(override?.enabled)return {worldId,unlocked:true,source:'teacher_override',overrideId:override.id};if(world.defaultUnlocked||!world.requires)return {worldId,unlocked:true,source:'default'};const missions=(await store.list('game_missions',actor.classId)).filter(m=>m.world===world.requires&&!m.templateId),proofs=(await store.list('game_evidence',actor.classId)).filter(e=>e.learnerId===actor.id&&e.approved),missing=missions.filter(m=>!proofs.some(p=>p.missionId===m.id));return {worldId,unlocked:missions.length>0&&!missing.length,source:'verified_progress',requires:world.requires,missingMissions:missing.map(m=>m.id)};}
