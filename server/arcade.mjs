import {resolve} from 'node:path';
import {fail, requireValue, scoped} from './store.mjs';
import {loggedIn, student, accountLimit, privateAccount, changePassword, cookie} from './auth.mjs';
import {AVATARS, projection, ownProfile, ensureProfile, saveProfile, syncBadges, badgeCollection, saveFeatured} from './arcade-profile.mjs';
import {authorizeGame, startGame} from './game.mjs';

// This is a launcher identity, not a replacement for persisted PédagoLab world IDs.
export const GAME_BINDINGS = Object.freeze({'code-station': 'pedagolab', 'cyber-funk': null});
export const arcadeEnabled = () => process.env.EDEN_WORLD_ARCADE === '1';
function school(req, _res, next) {
  if (!['teacher', 'student'].includes(req.user?.role) || !req.user.classId) fail(403, 'Cet espace n’est pas accessible.');
  next();
}
async function visiblePlayers(store, actor) {
  const learners = await store.list('learners', actor.classId);
  return learners.filter(p => p.arcadeProfile?.handle && (actor.role === 'teacher' || p.id === actor.id || p.arcadeProfile.visibility === 'class')).map(projection)
    .sort((a, b) => a.handle.localeCompare(b.handle, 'fr') || a.publicId.localeCompare(b.publicId));
}
function ownScope(req) {
  if (Object.keys(req.query).some(k => !['q', 'page', 'limit', 'scope'].includes(k))) fail(400, 'Filtre non disponible.');
  if (req.query.scope && req.query.scope !== 'class') fail(403, 'Cette liste n’est pas accessible.');
}

export async function arcadeGames(store, actor) {
  const code = {id: 'code-station', title: 'Code Station', state: 'auth_required', message: 'Connecte-toi pour jouer.', missions: []};
  const cyber = {id: 'cyber-funk', title: 'Cyber Funk 3026', state: 'unavailable', message: 'Ce monde n’est pas disponible pour le moment.', missions: []};
  if (!actor) return [code, cyber];
  if (actor.role !== 'student') return [{...code, state: 'locked', message: actor.role === 'teacher' ? 'Les missions se jouent depuis un compte élève autorisé.' : 'Ce jeu n’est pas accessible à ce compte.'}, cyber];
  for (const lesson of (await store.list('lessons', actor.classId)).filter(l => l.status === 'published').reverse()) {
    const version = await store.get('lesson_versions', lesson.versionId);
    const binding = version?.spec?.codeStation;
    if (!binding?.missionId) continue;
    const mission = await scoped(store, 'game_missions', binding.missionId, actor);
    let state = 'available', message = '';
    try { await authorizeGame(store, {missionId: mission.id, lessonId: lesson.id}, actor); }
    catch (e) { if (![400, 404, 409].includes(e.status)) throw e; state = 'locked'; message = e.message; }
    const progress = await store.get('player_progression', `${actor.id}:${mission.world}`);
    const missionProgress = progress?.progress?.worldProgress?.[mission.world];
    const saved = progress?.classId === actor.classId && progress?.learnerId === actor.id && !!(missionProgress?.drafts?.[mission.localId] || missionProgress?.completed?.[mission.localId]);
    code.missions.push({lessonId: lesson.id, missionId: mission.id, title: mission.title, worldId: mission.world, state, message, hasSave: saved});
  }
  const available = code.missions.find(m => m.state === 'available');
  code.state = available ? 'available' : 'locked';
  code.message = available ? 'Retrouve les missions ouvertes par ton professeur.' : (code.missions[0]?.message || 'Ton professeur n’a pas encore ouvert de mission.');
  return [code, cyber];
}

export function arcadeRoutes(app, store) {
  // The flag guards HTML, assets and APIs before Express' general static handler.
  app.use((req, _res, next) => {
    // Match the same decoded path that express.static uses, including encoded
    // directory names. A disabled flag must not expose the HTML by another URL.
    let path; try { path = decodeURIComponent(req.path).replace(/\/+/g, '/'); } catch { fail(400, 'Adresse invalide.'); }
    if (/^\/(arcade|world-arcade|api\/arcade)(\/|$)/i.test(path) && !arcadeEnabled()) fail(404, 'Espace indisponible.');
    next();
  });
  app.get('/arcade', (_req, res) => res.sendFile(resolve('public/world-arcade/index.html')));
  app.get('/api/arcade/bootstrap', async (req, res) => {
    res.json({account: req.user ? {role: req.user.role, profile: ownProfile(req.user)} : null,
      capabilities: {registration: false, emailVerification: false, passwordRecovery: false, community: false, leaderboard: false, ranks: false},
      games: await arcadeGames(store, req.user)});
  });
  app.get('/api/arcade/players', loggedIn, school, async (req, res) => {
    ownScope(req);
    const page = Number(req.query.page || 1), limit = Number(req.query.limit || 24);
    requireValue(Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(limit) && limit >= 1 && limit <= 24, 'Pagination invalide.');
    requireValue(typeof (req.query.q || '') === 'string' && String(req.query.q || '').length <= 40, 'Recherche invalide.');
    const q = String(req.query.q || '').normalize('NFKC').toLocaleLowerCase('fr');
    const visible = (await visiblePlayers(store, req.user)).filter(p => p.handle.toLocaleLowerCase('fr').includes(q));
    res.json({scope: 'class', players: visible.slice((page - 1) * limit, page * limit), total: visible.length, page, hasMore: page * limit < visible.length});
  });
  app.get('/api/arcade/players/:id', loggedIn, school, async (req, res) => {
    const player = (await visiblePlayers(store, req.user)).find(p => p.publicId === req.params.id);
    if (!player) fail(404, 'Ce profil n’est pas accessible.');
    res.json(player);
  });
  app.get('/api/arcade/profile', loggedIn, school, (req, res) => res.json(ownProfile(req.user)));
  const profileLimit = accountLimit(60);
  app.post('/api/arcade/profile/ensure', loggedIn, school, profileLimit, async (req, res) => {
    requireValue(!req.body || Object.keys(req.body).length === 0, 'Paramètre non autorisé.');
    res.json(await store.transaction(async tx => ownProfile(await ensureProfile(tx, req.user))));
  });
  app.get('/api/arcade/avatars', loggedIn, school, (_req, res) => res.json({avatars:AVATARS}));
  app.put('/api/arcade/profile', loggedIn, school, profileLimit, async (req, res) => {
    res.json(await store.transaction(tx => saveProfile(tx, req.user, req.body)));
  });
  app.get('/api/arcade/space', loggedIn, school, async (req, res) => {
    requireValue(Object.keys(req.query).length === 0, 'Paramètre non autorisé.');
    const account = await store.transaction(tx => syncBadges(tx, req.user));
    const games = await arcadeGames(store, req.user);
    const accessible = games[0].missions.filter(m => m.state === 'available' && m.hasSave);
    const runs = (await store.list('game_runs', req.user.classId)).filter(r => r.learnerId === req.user.id)
      .sort((a,b) => (b.lastPlayedAt || b.startedAt).localeCompare(a.lastPlayedAt || a.startedAt));
    const resume = runs.map(r => accessible.find(m => m.missionId === r.missionId && m.lessonId === r.lessonId)).find(Boolean) || accessible[0];
    res.json({profile:ownProfile(account), games, badges:badgeCollection(account),
      resume:resume ? {gameId:'code-station', lessonId:resume.lessonId, missionId:resume.missionId} : null,
      progression:{status:'unavailable', message:'Les paliers de progression ne sont pas disponibles. Retrouve les sauvegardes disponibles dans Mes jeux.'}});
  });
  app.get('/api/arcade/badges', loggedIn, school, async (req,res) => {
    res.json(await store.transaction(async tx => badgeCollection(await syncBadges(tx, req.user))));
  });
  app.put('/api/arcade/badges/featured', loggedIn, school, profileLimit, async (req,res) => {
    res.json(await store.transaction(tx => saveFeatured(tx, req.user, req.body)));
  });
  app.get('/api/arcade/account', loggedIn, school, (req,res) => {
    requireValue(Object.keys(req.query).length === 0, 'Paramètre non autorisé.');
    res.json(privateAccount(req.user));
  });
  app.post('/api/arcade/account/password', loggedIn, school, accountLimit(8, 600000), async (req,res) => {
    const result = await store.transaction(tx => changePassword(tx, req.user, req.sessionId, req.body));
    cookie(res, ''); res.json(result);
  });
  app.get('/api/arcade/leaderboard', loggedIn, school, (req, res) => {
    if (Object.keys(req.query).length) fail(400, 'Filtre non disponible.');
    res.json({status: 'unavailable', entries: [], personalPosition: null, periods: [], message: 'Le classement n’est pas disponible pour le moment.'});
  });
  app.get('/api/arcade/ranks', (_req, res) => res.json({status: 'unavailable', ranks: [], message: 'Les grades ne sont pas disponibles pour le moment.'}));
  for (const action of ['register', 'verify-email', 'resend-verification', 'recover-password', 'reset-password']) {
    app.post(`/api/arcade/auth/${action}`, (_req, _res) => fail(503, 'Ce service n’est pas disponible. Les inscriptions ne sont pas ouvertes pour le moment.'));
  }
  app.post('/api/arcade/launch', loggedIn, student, async (req, res) => {
    requireValue(req.body && Object.keys(req.body).every(k => ['gameId', 'lessonId', 'missionId'].includes(k)), 'Paramètre de lancement non autorisé.');
    if (!(Object.hasOwn(GAME_BINDINGS, req.body.gameId))) fail(404, 'Jeu inconnu.');
    if (!GAME_BINDINGS[req.body.gameId]) fail(503, 'Ce monde n’est pas disponible pour le moment.');
    requireValue(typeof req.body.lessonId === 'string' && typeof req.body.missionId === 'string', 'Mission et séance requises.');
    const run = await store.transaction(async tx => {
      const {mission, lesson} = await authorizeGame(tx, req.body, req.user);
      const existing = (await tx.list('game_runs', req.user.classId)).find(r => r.learnerId === req.user.id && r.lessonId === lesson.id && r.lessonRunId === lesson.runId && r.missionId === mission.id && r.missionVersion === mission.version);
      if (existing) {existing.lastPlayedAt = new Date().toISOString(); await tx.put('game_runs', existing); return existing;}
      return startGame(tx, req.body, req.user);
    });
    res.json({runId: run.id, gameId: 'code-station'});
  });
}
