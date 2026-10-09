import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arcadeFixture} from './fixtures/arcade.mjs';
import {explorationForMission} from '../server/game.mjs';

test('journeys project saved objectives per game and learner, including closed missions and revised saves', async () => {
  const oldFlag = process.env.EDEN_WORLD_ARCADE;
  process.env.EDEN_WORLD_ARCADE = '1';
  const f = await arcadeFixture();
  try {
    const cookies = {};
    for (const id of ['student-a','student-b','teacher-a']) {
      const response = await fetch(f.base+'/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:id, role:id.startsWith('teacher')?'teacher':'student', classId:'A1', password:f.password})});
      cookies[id] = response.headers.get('set-cookie').split(';')[0];
    }
    const call = async (path, body, actor='student-a') => {
      const response = await fetch(f.base+path, {method:body?'POST':'GET', headers:{Cookie:cookies[actor], 'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined});
      assert.equal(response.status, 200);
      return response.json();
    };
    const bunker = await f.store.get('game_missions', 'A1:bunker:shell:v1');
    await f.store.insert('lesson_versions', {id:'bunker-lesson:v1', classId:'A1', spec:{codeStation:{missionId:bunker.id}}});
    await f.store.insert('lessons', {id:'bunker-lesson', classId:'A1', versionId:'bunker-lesson:v1', status:'published', runId:'bunker-run'});
    const stationRun = await call('/api/arcade/launch', {gameId:'code-station', lessonId:'arcade-lesson', missionId:f.mission.id});
    const bunkerRun = await call('/api/arcade/launch', {gameId:'bunker', lessonId:'bunker-lesson', missionId:bunker.id});
    assert.equal(bunkerRun.gameId, 'bunker');
    for (const [mission, run, done] of [[f.mission,stationRun,['relay','repair','finish']], [bunker,bunkerRun,['relay']]]) {
      const def = explorationForMission(mission);
      const progress = {worldProgress:{[mission.world]:{explorations:{[def.id]:{signature:def.signature, done}}, completed:{}, drafts:{}}}};
      await call(`/api/game/runs/${run.runId}/progress`, {progress});
    }
    const games = (await call('/api/arcade/bootstrap')).games;
    const station = games.find(g=>g.id==='code-station'), underground = games.find(g=>g.id==='bunker');
    assert.deepEqual(station.progress, {completed:1, inProgress:0, total:4, percent:25});
    assert.deepEqual(underground.progress, {completed:0, inProgress:1, total:4, percent:8});
    assert.equal(underground.journey[0].progress.completedSteps, 1);
    assert.equal(underground.journey[1].state, 'locked');
    assert.equal(underground.journey[1].lessonId, null);
    assert.equal(station.missions.length, 1);
    assert.equal(underground.missions.length, 1);
    assert.equal(games.find(g=>g.id==='assault').journey.length, 4);
    assert.equal((await call('/api/arcade/space')).resume.gameId, 'bunker');
    const other = (await call('/api/arcade/bootstrap', null, 'student-b')).games;
    assert.ok(other.filter(g=>g.progress).every(g=>g.progress.percent === 0 && g.progress.inProgress === 0));
    const teacher = (await call('/api/arcade/bootstrap', null, 'teacher-a')).games;
    assert.ok(teacher.every(g=>g.progress === null));

    const lesson = await f.store.get('lessons','arcade-lesson');
    await f.store.put('lessons', {...lesson, status:'closed'});
    const closed = (await call('/api/arcade/bootstrap')).games[0];
    assert.equal(closed.journey[0].progress.status, 'completed');
    assert.equal(closed.journey[0].state, 'locked');
    assert.equal(closed.missions.length, 0);

    const save = await f.store.get('player_progression', 'student-a:code-station');
    save.progress.worldProgress['code-station'].explorations[f.mission.id].signature = 'obsolete';
    save.progress.worldProgress['code-station'].completed.battery = true;
    await f.store.put('player_progression', save);
    assert.equal((await call('/api/arcade/bootstrap')).games[0].progress.completed, 0);
    await f.store.put('player_progression', {...save, learnerId:'student-b'});
    assert.equal((await call('/api/arcade/bootstrap')).games[0].progress.inProgress, 0);

    const adapted = {...bunker, id:'A1:bunker:adapted:v1', localId:'adapted', title:'Mission adaptée'};
    await f.store.insert('game_missions', adapted);
    await f.store.put('lesson_versions', {id:'bunker-lesson:v1', classId:'A1', spec:{codeStation:{missionId:adapted.id}}});
    const adaptedRun = await call('/api/arcade/launch', {gameId:'bunker', lessonId:'bunker-lesson', missionId:adapted.id});
    const def = explorationForMission(adapted);
    await call(`/api/game/runs/${adaptedRun.runId}/progress`, {progress:{worldProgress:{bunker:{explorations:{[def.id]:{signature:def.signature, done:['relay']}}}}}});
    const adaptedLesson = await f.store.get('lessons','bunker-lesson');
    await f.store.put('lessons', {...adaptedLesson, status:'closed'});
    const history = (await call('/api/arcade/bootstrap')).games.find(g=>g.id==='bunker').journey.find(m=>m.missionId===adapted.id);
    assert.equal(history.progress.status, 'in_progress');
    assert.equal(history.state, 'locked');
    assert.equal((await f.store.list('evidence')).length, 0);
    assert.equal((await f.store.list('game_evidence')).length, 0);
  } finally {
    f.server.closeAllConnections(); await f.close();
    if (oldFlag === undefined) delete process.env.EDEN_WORLD_ARCADE; else process.env.EDEN_WORLD_ARCADE=oldFlag;
  }
});
