import {fail, now, requireValue, scoped, uid} from './store.mjs';

export const accountTable = actor => actor.role === 'teacher' ? 'teachers' : 'learners';
export const AVATARS = Object.freeze(Array.from({length:15}, (_, i) => ({id:String(i + 1).padStart(2, '0'), label:`Avatar ${i + 1}`, available:true})));
// Only this condition has an existing, authoritative host validation path.
export const BADGES = Object.freeze([{id:'premier-signal', name:'Premier signal', gameId:'code-station', condition:'Faire valider une mission Code Station par ton professeur.'}]);
export const handleKey = handle => handle.normalize('NFKC').trim().toLocaleLowerCase('fr');
const reserved = new Set(['admin','administrateur','administrator','professeur','teacher','moderateur','modérateur','moderator','support','tweenteach','tween teach','world arcade','system','système']);

export function featuredBadges(account) {
  return (account.arcadeProfile?.featuredBadgeIds || []).slice(0, 3).flatMap(id => {
    const badge = BADGES.find(b => b.id === id);
    return badge && account.arcadeAwards?.[id] ? [{id, name:badge.name}] : [];
  });
}
export function projection(account) {
  const p = account.arcadeProfile;
  return p?.handle ? {publicId:p.publicId, handle:p.handle, avatarId:p.avatarId, grade:null, featuredBadges:featuredBadges(account)} : null;
}
export function ownProfile(account) {
  const p = account.arcadeProfile;
  return {...(projection(account) || {publicId:p?.publicId || null, handle:'', avatarId:p?.avatarId || '01', grade:null, featuredBadges:[]}),
    visibility:p?.visibility || 'private', publicVisibilityAvailable:false, needsPersonalization:!p?.handle,
    featuredBadgeIds:featuredBadges(account).map(b => b.id)};
}
export async function ensureProfile(tx, actor) {
  const account = await scoped(tx, accountTable(actor), actor.id, actor);
  if (!account.arcadeProfile) {
    account.arcadeProfile = {publicId:uid('player'), handle:'', avatarId:'01', visibility:'private', featuredBadgeIds:[]};
    await tx.put(accountTable(actor), account);
  }
  return account;
}
export async function saveProfile(tx, actor, input) {
  requireValue(input && !Array.isArray(input) && Object.keys(input).every(k => ['handle','avatarId','visibility'].includes(k)), 'Champ de profil non autorisé.');
  const handle = typeof input.handle === 'string' ? input.handle.normalize('NFKC').trim() : '';
  // Preserve the established host rule, including existing accented/spaced AKA.
  requireValue(/^[\p{L}\p{N}_ -]{2,24}$/u.test(handle), 'AKA : 2 à 24 lettres, chiffres, espaces, tirets ou underscores.');
  const key = handleKey(handle);
  if (reserved.has(key.replace(/[_-]/g, ' ')) || reserved.has(key.replace(/[ _-]/g, ''))) fail(409, 'Cet AKA n’est pas disponible.');
  requireValue(typeof input.avatarId === 'string' && AVATARS.some(a => a.id === input.avatarId && a.available), 'Avatar indisponible.');
  requireValue(['private','class'].includes(input.visibility), 'Visibilité indisponible.');
  // The host transaction serializes both tables (SQLite / PG advisory lock).
  for (const table of ['learners','teachers']) {
    const duplicate = (await tx.list(table, actor.classId)).some(a => !(table === accountTable(actor) && a.id === actor.id)
      && a.arcadeProfile?.handle && handleKey(a.arcadeProfile.handle) === key);
    if (duplicate) fail(409, 'Cet AKA n’est pas disponible.');
  }
  const account = await ensureProfile(tx, actor);
  account.arcadeProfile = {...account.arcadeProfile, handle, handleKey:key, avatarId:input.avatarId, visibility:input.visibility};
  await tx.put(accountTable(actor), account);
  return ownProfile(account);
}
export async function syncBadges(tx, actor) {
  const account = await ensureProfile(tx, actor);
  if (actor.role !== 'student' || account.arcadeAwards?.['premier-signal']) return account;
  for (const proof of await tx.list('game_evidence', actor.classId)) {
    if (proof.learnerId !== actor.id || proof.approved !== true || proof.status !== 'approved' || !proof.approvedBy) continue;
    const mission = await tx.get('game_missions', proof.missionId);
    const run = await tx.get('game_runs', proof.missionRunId);
    const reviewer = await tx.get('teachers', proof.approvedBy);
    if (mission?.classId !== actor.classId || mission.world !== 'code-station' || !reviewer || reviewer.classId !== actor.classId
      || run?.classId !== actor.classId || run.learnerId !== actor.id || run.missionId !== mission.id) continue;
    account.arcadeAwards = {...account.arcadeAwards, 'premier-signal':{sourceId:proof.id, awardedAt:now()}};
    await tx.put(accountTable(actor), account);
    break;
  }
  return account;
}
export function badgeCollection(account) {
  return {status:'ready', maxFeatured:3, badges:BADGES.map(b => ({...b, earned:!!account.arcadeAwards?.[b.id],
    awardedAt:account.arcadeAwards?.[b.id]?.awardedAt || null, featured:featuredBadges(account).some(f => f.id === b.id)}))};
}
export function validateFeatured(ids, earnedIds) {
  requireValue(Array.isArray(ids) && ids.length <= 3 && ids.every(id => typeof id === 'string') && new Set(ids).size === ids.length, 'Choisis jusqu’à trois badges différents.');
  requireValue(ids.every(id => earnedIds.includes(id)), 'Ce badge n’a pas été obtenu.');
  return [...ids];
}
export async function saveFeatured(tx, actor, input) {
  requireValue(input && Object.keys(input).length === 1 && Object.hasOwn(input, 'badgeIds'), 'Champ de badge non autorisé.');
  const account = await syncBadges(tx, actor);
  account.arcadeProfile.featuredBadgeIds = validateFeatured(input.badgeIds, badgeCollection(account).badges.filter(b => b.earned).map(b => b.id));
  await tx.put(accountTable(actor), account);
  return ownProfile(account);
}
