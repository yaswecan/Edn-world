import {catalog, authorizeGame, explorationForMission} from './game.mjs';

const titles = {'code-station':'Code Station', bunker:'Bunker Ops', rocket:'Rocket Launch', infiltration:'Infiltration Trace', assault:'Assault Sim'};
export const GAME_BINDINGS = Object.freeze(Object.fromEntries([...Object.keys(catalog).map(id => [id, id]), ['cyber-funk', null]]));

function missionProgress(mission, worldProgress) {
  const saved = worldProgress?.explorations?.[mission.sourceId || mission.id];
  const draft = worldProgress?.drafts?.[mission.localId];
  let completedSteps = 0, hasSave = false;
  if (saved || draft?.signature) {
    const definition = explorationForMission(mission);
    const restored = globalThis.StationModel.restore(definition, {...saved, done:Array.isArray(saved?.done) ? saved.done : []});
    completedSteps = restored.done.length;
    hasSave = saved?.signature === definition.signature || draft?.signature === definition.signature;
  } else {
    // Preserve legacy saves, but never let an obsolete exploration signature
    // count as completion of a revised mission.
    completedSteps = worldProgress?.completed?.[mission.localId] === true ? 3 : 0;
    hasSave = !!draft || completedSteps > 0;
  }
  return {status:completedSteps === 3 ? 'completed' : hasSave ? 'in_progress' : 'not_started', completedSteps, totalSteps:3, percent:Math.round(completedSteps / 3 * 100), hasSave};
}

export async function arcadeGames(store, actor) {
  const isStudent = actor?.role === 'student';
  const played = isStudent ? (await store.list('game_runs', actor.classId)).filter(run => run.learnerId === actor.id) : [];
  const games = Object.entries(catalog).map(([id, world]) => ({
    id, title:titles[id], description:world.tagline, state:actor ? 'locked' : 'auth_required',
    message:!actor ? 'Connecte-toi pour retrouver ta progression.' : isStudent ? 'Ton professeur n’a pas encore ouvert de mission.' : 'Les missions se jouent depuis un compte élève autorisé.',
    missions:[], journey:[], progress:null
  }));
  if (isStudent) {
    const lessons = (await store.list('lessons', actor.classId)).filter(l => l.status === 'published').reverse();
    for (const lesson of lessons) {
      const binding = (await store.get('lesson_versions', lesson.versionId))?.spec?.codeStation;
      if (!binding?.missionId) continue;
      const mission = await store.get('game_missions', binding.missionId);
      const game = games.find(g => g.id === mission?.world);
      if (!game || mission.classId !== actor.classId) continue;
      let state = 'available', message = '';
      try { await authorizeGame(store, {missionId:mission.id, lessonId:lesson.id}, actor); }
      catch (e) { if (![400, 404, 409].includes(e.status)) throw e; state = 'locked'; message = e.message; }
      game.missions.push({lessonId:lesson.id, missionId:mission.id, title:mission.title, worldId:mission.world, state, message});
    }
  }
  for (const game of games) {
    const row = isStudent ? await store.get('player_progression', `${actor.id}:${game.id}`) : null;
    const worldProgress = row?.classId === actor?.classId && row?.learnerId === actor?.id ? row?.progress?.worldProgress?.[game.id] : null;
    const templates = catalog[game.id].missions.map(m => ({...m, localId:m.id, id:`${actor?.classId || 'catalog'}:${game.id}:${m.id}:v1`, world:game.id, version:1}));
    const assignedIds = [...new Set(game.missions.map(m => m.missionId))];
    const ids = [...new Set([...templates.map(m => m.id), ...assignedIds, ...played.filter(run => run.world === game.id).map(run => run.missionId)])];
    for (const id of ids) {
      const mission = (actor ? await store.get('game_missions', id) : null) || templates.find(m => m.id === id);
      if (!mission || mission.world !== game.id || actor && mission.classId && mission.classId !== actor.classId) continue;
      const assignments = game.missions.filter(m => m.missionId === id);
      const assignment = assignments.find(m => m.state === 'available') || assignments[0];
      let progress = null;
      try { if (isStudent) progress = missionProgress(mission, worldProgress); }
      catch (error) { if (error.status !== 409) throw error; progress = {status:'not_started', completedSteps:0, totalSteps:3, percent:0, hasSave:false}; }
      for (const item of assignments) Object.assign(item, {progress, hasSave:progress?.hasSave || false});
      game.journey.push({missionId:id, title:mission.title, skill:mission.skill, brief:mission.brief,
        lessonId:assignment?.lessonId || null, state:assignment?.state || (actor ? 'locked' : 'auth_required'),
        message:assignment?.message || (assignment ? '' : isStudent ? 'Cette mission n’est pas encore ouverte par ton professeur.' : game.message), progress});
    }
    if (isStudent) {
      const completed = game.journey.filter(m => m.progress?.status === 'completed').length;
      const inProgress = game.journey.filter(m => m.progress?.status === 'in_progress').length;
      const steps = game.journey.reduce((sum, m) => sum + (m.progress?.completedSteps || 0), 0);
      game.progress = {completed, inProgress, total:game.journey.length, percent:game.journey.length ? Math.round(steps / (game.journey.length * 3) * 100) : 0};
      game.state = game.missions.some(m => m.state === 'available') ? 'available' : 'locked';
      game.message = game.state === 'available' ? 'Retrouve tes missions et poursuis ton parcours.' : game.message;
    }
  }
  const cyber = {id:'cyber-funk', title:'Cyber Funk 3026', description:'La ville ne dort jamais. Trouve ton propre chemin.', state:'unavailable', message:'Ce monde n’est pas disponible pour le moment.', missions:[], journey:[], progress:null};
  return [games[0], cyber, ...games.slice(1)];
}
