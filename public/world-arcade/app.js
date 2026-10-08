import {pixelText} from './identity.js';
import {profileForm, personalSpace, playerIdentity, accountView, passwordField, collectionView, badgeDialog, nextFeatured} from './account-views.js';
const root = document.body;
const $ = (selector, parent = root) => parent.querySelector(selector);
const $$ = selector => [...root.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const button = (label, action, extra = '') => `<button class="button" data-action="${action}" ${extra}>${label}</button>`;
const avatar = p => `<img class="avatar" src="/world-arcade/assets/avatars/${/^(0[1-9]|1[0-5])$/.test(p.avatarId) ? p.avatarId : '01'}.webp" alt="" width="50" height="55">`;
const labels = {arcade:'World Arcade', joueurs:'Joueurs', classement:'Classement', profil:'Mon espace', personnaliser:'Personnaliser', compte:'Mon compte', collection:'Mes badges', badges:'Grades', reglages:'Réglages'};
const state = {account:null, bootstrap:null, route:'', revision:0, pending:false, selection:'', search:'', page:1, pendingGame:null, game:null, space:null, collection:null, savedProfile:null, avatars:[], authEpoch:0, authBusy:false};
const prefKey = 'eden.world-arcade.preferences.v1';
let stored = {};
try { stored = JSON.parse(localStorage.getItem(prefKey) || '{}') || {}; } catch { /* Local preferences are optional. */ }
const preferences = {sound:false, reducedMotion:stored.reducedMotion === true, crt:stored.crt !== false};
let audioContext, modalFocus, modalRevision = 0;
let privateRequests = new AbortController();
const sessionChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('tween-teach-session') : null;
function clearPrivate() {
  privateRequests.abort(); privateRequests = new AbortController(); state.authEpoch++; state.revision++;
  Object.assign(state, {account:null, bootstrap:null, space:null, collection:null, savedProfile:null, avatars:[], selection:'', search:'', page:1, pendingGame:null, pending:false});
  state.game?.port?.close(); state.game?.frame.remove(); state.game=null;
  $('#game-modal').close(); $('#game-host').replaceChildren(); $('#modal').close();
  $('#main-content').replaceChildren(); $('#toasts').replaceChildren(); modalFocus=null; accountSlots();
}
function announceSession() {sessionChannel?.postMessage('changed');}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function applyPreferences() {
  root.classList.toggle('no-crt', !preferences.crt);
  root.classList.toggle('reduce-motion', reducedMotion.matches || preferences.reducedMotion);
  $$('.sound-toggle').forEach(el => { el.setAttribute('aria-label', preferences.sound ? 'Couper le son' : 'Activer le son'); el.setAttribute('aria-pressed', String(preferences.sound)); el.innerHTML = icon(preferences.sound ? 'sound' : 'mute'); });
  try { localStorage.setItem(prefKey, JSON.stringify({reducedMotion:preferences.reducedMotion, crt:preferences.crt})); } catch { /* No private data is cached. */ }
}
function beep() {
  if (!preferences.sound || document.hidden) return;
  try {
    audioContext ??= new AudioContext(); audioContext.resume().catch(() => {});
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.frequency.value = 440; gain.gain.value = .018; osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .08);
    osc.onended = () => {osc.disconnect(); gain.disconnect();};
  } catch { /* Optional sound; no autoplay or loop. */ }
}
function notify(message) {
  if(!message)return;
  const node = document.createElement('div'); node.className = 'toast'; node.textContent = message;
  $('#toasts').replaceChildren(node);
  setTimeout(() => node.remove(), 6000);
}
async function request(path, {method = 'GET', body} = {}) {
  let response; const epoch=state.authEpoch;
  try { response = await fetch(path, {method, credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.any([AbortSignal.timeout(15000), privateRequests.signal])}); }
  catch { if(epoch!==state.authEpoch)throw Object.assign(new Error(''),{stale:true}); throw Object.assign(new Error('Connexion interrompue. Réessaie quand le réseau est disponible.'),{status:0}); }
  const data = await response.json().catch(() => ({}));
  if(epoch!==state.authEpoch)throw Object.assign(new Error(''),{stale:true});
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') {clearPrivate();$('#main-content').innerHTML=notice('Ta session a expiré. Reconnecte-toi pour continuer.')+button('Se connecter','auth');}
    throw Object.assign(new Error(response.status >= 500 ? 'Ce service n’est pas disponible pour le moment.' : data.error || 'Cet espace n’est pas accessible.'), {status:response.status});
  }
  return data;
}
async function bootstrap() {
  state.bootstrap = null;
  const data = await request('/api/arcade/bootstrap'); state.bootstrap = data; state.account = data.account; accountSlots();
}
function hostReturnPath() {
  if (state.account?.role === 'teacher') return '/teacher';
  const lessonId = new URLSearchParams(location.search).get('lesson');
  return lessonId && lessonId.length <= 500 ? '/today?lesson=' + encodeURIComponent(lessonId) : '/today';
}
function accountSlots() {
  const link = state.account ? `<details class="account-menu"><summary class="account-button" aria-label="Menu du compte">${avatar(state.account.profile)}<span class="account-name">${escape(state.account.profile.handle || 'Mon espace')}</span></summary><nav aria-label="Mon compte"><a href="#profil">Mon espace</a><a href="#personnaliser">Personnaliser</a><a href="#compte">Mon compte</a><button data-action="logout">Se déconnecter</button></nav></details>` : button('Se connecter', 'auth',state.authBusy?'disabled':'');
  $('#account-slot').innerHTML = link;
  $('#splash-account').innerHTML = `<button class="icon-button sound-toggle" data-action="sound" aria-label="Activer le son"></button>${link}`;
  $$('.host-return').forEach(a => {
    a.href = hostReturnPath();
    a.textContent = state.account?.role === 'teacher' ? 'Retour à mon espace' : 'Retour à ma séance';
  });
  applyPreferences();
}
function notice(text, retry = false) { return `<div class="notice">${icon('info')}<p>${escape(text)}</p>${retry ? button('Réessayer', 'retry') : ''}</div>`; }
function hero(title, text = '') {return `<header class="page-hero"><p class="eyebrow">WORLD ARCADE</p><h1 class="display">${title}</h1>${text ? `<p>${escape(text)}</p>` : ''}</header>`;}
function cabinet(game) {
  const selected = game.missions.find(m => m.lessonId === state.selection) || game.missions.find(m => m.state === 'available') || game.missions[0];
  if (selected) state.selection = selected.lessonId;
  const status = selected?.state || game.state;
  const label = status === 'auth_required' ? 'Se connecter' : status === 'available' ? (selected?.hasSave ? 'Reprendre' : 'Jouer') : status === 'locked' ? 'Verrouillé' : 'Indisponible';
  const code = game.id === 'code-station';
  return `<article class="cabinet ${code ? '' : 'pink'}" aria-labelledby="title-${game.id}"><div class="cabinet-housing"><div class="cabinet-marquee"><span class="marquee-name">${escape(game.title.toUpperCase())}</span></div><div class="speaker-strip" aria-hidden="true"></div><div class="screen-frame"><img class="game-art" src="/world-arcade/assets/${game.id}.webp" alt="${code ? 'Un équipage pixel art dans la station spatiale' : 'La ville futuriste éclairée de néons'}"><div class="screen-info"><p class="eyebrow">${code ? '01 / CODE STATION' : '02 / NEO EDEN'}</p><h2 class="screen-game-title" id="title-${game.id}">${escape(game.title.toUpperCase())}</h2></div></div>${game.missions.length > 1 ? `<label class="mission-choice">Mission ouverte<select id="mission-choice">${game.missions.map(m => `<option value="${escape(m.lessonId)}" ${m.lessonId === selected?.lessonId ? 'selected' : ''}>${escape(m.title)}${m.state === 'locked' ? ' · Verrouillé' : ''}</option>`).join('')}</select></label>` : ''}<div class="cabinet-console"><div class="console-decoration" aria-hidden="true"><span class="mini-buttons"><i></i><i></i><i></i></span></div><button class="arcade-play" data-action="play" data-game="${game.id}" ${['locked','unavailable'].includes(status) || state.pending ? 'disabled' : ''}>${state.pending && code ? 'Ouverture…' : label} ${icon('chevron')}</button></div><div class="cabinet-base"><p class="cabinet-description">${code ? 'Le signal est perdu. À toi de rallumer la station.' : 'La ville ne dort jamais. Trouve ton propre chemin.'}</p><p class="cabinet-keys">${escape(selected?.message || (selected ? selected.title : game.message))}</p><div class="coin-slot" aria-hidden="true"></div></div></div><div class="cabinet-foot" aria-hidden="true"></div><div class="cabinet-reflection" aria-hidden="true"></div></article>`;
}
function lobby() {
  return `<div class="arcade-grid"><div class="arcade-main"><div class="city-banner" role="img" aria-label="Ville futuriste éclairée de néons"><span class="banner-tag">WORLD ARCADE / 3026</span></div><div class="arcade-heading"><div><h1 class="display">Choisis ton monde</h1><p>Code Station · Cyber Funk 3026</p></div><div class="heading-mark" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="cabinets">${state.bootstrap.games.map(cabinet).join('')}</div><div class="arcade-bottomline"><a class="text-button host-return" href="${hostReturnPath()}">${state.account?.role === 'teacher' ? 'Retour à mon espace' : 'Retour à ma séance'} ${icon('arrow')}</a></div></div><aside class="side-panels"><section class="panel leaderboard-panel"><h2>TOP 5</h2><div id="top-slot" aria-live="polite">${notice(state.account ? 'Chargement du classement…' : 'Connecte-toi pour consulter ton espace.')}</div></section><section class="panel players-panel"><div class="section-head"><h2>JOUEURS</h2><a class="text-button" href="#joueurs">Voir les joueurs ${icon('arrow')}</a></div><div id="players-slot" aria-live="polite">${notice(state.account ? 'Chargement des joueurs…' : 'Cette liste n’est pas accessible aux visiteurs.')}</div></section><a class="side-promo" href="#badges">${icon('badge')}<span>Grades</span>${icon('chevron')}</a></aside></div>`;
}
function playerCard(p, mini = false) { return `<button class="${mini ? 'avatar-tile' : 'player-card'}" data-action="player" data-id="${escape(p.publicId)}">${avatar(p)}${mini ? `<span>${escape(p.handle)}</span>` : `<h2>${escape(p.handle)}</h2><p>${escape(p.grade?.label || 'Grade non disponible')}</p><span class="featured-badges">${(p.featuredBadges||[]).map(b=>`<span class="featured-badge">${escape(b.name)}</span>`).join('')}</span>`}</button>`; }
function topContent(result) {
  if (result.status !== 'ready') return notice(result.message || 'Le classement n’est pas disponible pour le moment.');
  return `<ol class="leaderboard-list">${result.entries.slice(0,5).map((p,i) => `<li>${i+1}. ${escape(p.handle)} · ${escape(p.score)}</li>`).join('')}</ol>`;
}
async function sidePanels(revision) {
  if (!state.account) return;
  await Promise.all([
    request('/api/arcade/leaderboard').then(data => {if (revision === state.revision && $('#top-slot')) $('#top-slot').innerHTML = topContent(data);}).catch(e => {if (revision === state.revision && $('#top-slot')) $('#top-slot').innerHTML = notice(e.message, true);}),
    request('/api/arcade/players?limit=10').then(data => {if (revision === state.revision && $('#players-slot')) $('#players-slot').innerHTML = data.players.length ? `<div class="avatar-grid">${data.players.map(p=>playerCard(p,true)).join('')}</div>` : notice('Aucun profil à afficher. Choisis un AKA et un avatar dans Mon espace.');}).catch(e => {if (revision === state.revision && $('#players-slot')) $('#players-slot').innerHTML = notice(e.message, true);})
  ]);
}
function settings() {
  return hero('Réglages')+`<section class="panel settings-panel">${[['sound','Son de l’arcade','Un son bref accompagne tes actions.'],['reducedMotion','Réduire les animations', reducedMotion.matches ? 'La réduction des animations du système est active.' : 'Limiter les mouvements décoratifs.'],['crt','Effet écran rétro','Afficher la trame sur les décors.']].map(([key,title,text])=>`<label class="setting-row"><span class="setting-copy"><strong>${title}</strong><p>${text}</p></span><input type="checkbox" data-pref="${key}" ${preferences[key] || (key === 'reducedMotion' && reducedMotion.matches) ? 'checked' : ''} ${key==='reducedMotion'&&reducedMotion.matches?'disabled':''}></label>`).join('')}${state.account ? button('Se déconnecter','logout') : button('Se connecter','auth')}</section>`;
}
async function renderRoute({refresh = false} = {}) {
  const revision = ++state.revision;
  state.pending = false;
  const hash = location.hash.slice(1);
  const gameId = hash.startsWith('jeu/') ? hash.slice(4) : null;
  state.route = gameId ? 'arcade' : (labels[hash] ? hash : '');
  if ($('#modal').open) $('#modal').close();
  $$('.account-menu').forEach(menu=>menu.open=false);
  if (!gameId && state.game) await closeGame(false);
  if (revision !== state.revision) return;
  $('#splash').hidden = !!state.route; $('#app').hidden = !state.route;
  if (!state.route) {if (refresh) await bootstrap().catch(e => notify(e.message)); $('#start-button').focus({preventScroll:true}); return;}
  $$('.main-nav a').forEach(a=>{const active = a.dataset.route === state.route; a.classList.toggle('active', active); if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#route-label').textContent = labels[state.route]; document.title = `${labels[state.route]} — World Arcade`;
  const main = $('#main-content'); main.innerHTML = notice('Chargement…'); main.focus({preventScroll:true});
  try {
    const privateRoute = ['profil','personnaliser','compte','collection','joueurs','classement'].includes(state.route);
    if (!state.bootstrap || refresh || privateRoute) await bootstrap();
    if (revision !== state.revision) return;
    if (privateRoute && !state.account) throw Object.assign(new Error('Connecte-toi pour accéder à ton espace.'), {status:401});
    switch(state.route) {
      case 'arcade': main.innerHTML = lobby(); sidePanels(revision); if(gameId) await openGame(gameId, revision); break;
      case 'reglages': main.innerHTML = settings(); break;
      case 'badges': {const data = await request('/api/arcade/ranks'); if(revision===state.revision)main.innerHTML = hero('Grades', 'Le grade et la place au classement sont différents.')+`<section class="panel">${notice(data.message)}</section>`; break;}
      case 'classement': {const data = await request('/api/arcade/leaderboard'); if(revision===state.revision)main.innerHTML = hero('Top 5')+`<section class="panel">${topContent(data)}</section>`; break;}
      case 'profil': {
        const data=await request('/api/arcade/space');if(revision!==state.revision)return;
        state.space=data;state.account.profile=data.profile;state.collection=data.badges;accountSlots();
        if(data.profile.needsPersonalization){history.replaceState(null,'','#personnaliser');await renderRoute();return;}
        main.innerHTML=personalSpace(data);break;
      }
      case 'personnaliser': {
        const [profile, catalogue]=await Promise.all([request('/api/arcade/profile/ensure',{method:'POST',body:{}}),request('/api/arcade/avatars')]);
        if(revision!==state.revision)return;
        state.savedProfile=profile;state.avatars=catalogue.avatars;state.account.profile=profile;accountSlots();main.innerHTML=profileForm(profile,catalogue.avatars);break;
      }
      case 'compte': {const data=await request('/api/arcade/account');if(revision===state.revision)main.innerHTML=accountView(data);break;}
      case 'collection': {
        const [data,profile]=await Promise.all([request('/api/arcade/badges'),request('/api/arcade/profile')]);if(revision!==state.revision)return;
        state.collection=data;state.account.profile=profile;main.innerHTML=collectionView(data,profile);break;
      }
      case 'joueurs': {
        const data = await request(`/api/arcade/players?q=${encodeURIComponent(state.search)}&page=${state.page}`);
        if(revision!==state.revision)return;
        main.innerHTML = hero('Joueurs', `Ma classe · ${data.total} profil${data.total===1?'':'s'} accessible${data.total===1?'':'s'}`)+`<form class="wa-form search-form" data-form="search"><label>Rechercher un joueur<input name="q" value="${escape(state.search)}" maxlength="40" placeholder="Rechercher un pseudo"></label><button class="button" type="submit">Rechercher</button></form><div class="players-roster">${data.players.map(p=>playerCard(p)).join('')}</div>${!data.players.length?notice(state.search?'Aucun joueur ne correspond à ta recherche.':'Aucun joueur à afficher.') : ''}<div class="pagination">${button('Précédent','previous',state.page<=1?'disabled':'')}<span>Page ${data.page}</span>${button('Suivant','next',data.hasMore?'':'disabled')}</div>`;
        break;
      }
    }
  } catch(e) {
    if(revision!==state.revision)return;
    main.innerHTML = hero(labels[state.route] || 'World Arcade')+notice(e.status===undefined ? 'Cet écran n’a pas pu être chargé. Réessaie.' : e.message, true)+(e.status===401?button('Se connecter','auth'):'');
  }
}
function modal(title, content) {
  if (!$('#modal').open) modalFocus = document.activeElement;
  modalRevision++;
  $('#modal-body').innerHTML = `<div class="modal-heading"><h2 id="modal-title">${escape(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>${content}`;
  if(!$('#modal').open)$('#modal').showModal();
}
function auth() {
  if(state.authBusy)return;
  modal('Connexion', `<form class="wa-form" data-form="login"><label>Compte<select name="role"><option value="student">Élève</option><option value="teacher">Professeur</option></select></label><label>Classe<input name="classId" value="A1" required autocomplete="off"></label><label>Identifiant<input name="username" required autocomplete="username"></label>${passwordField('password','Mot de passe','current-password')}<button class="button primary" type="submit">Se connecter</button><p class="form-status" role="status"></p></form><div class="pagination">${button('Créer un compte', 'register')}${button('Mot de passe oublié ?', 'recovery')}</div>`);
}
async function launch(gameId) {
  if(state.pending)return;
  if(!state.account){state.pendingGame=gameId;auth();return;}
  if(state.account.profile.needsPersonalization){state.pendingGame=gameId;location.hash='personnaliser';return;}
  const game = state.bootstrap?.games.find(g=>g.id===gameId);
  const mission = game?.missions.find(m=>m.lessonId===state.selection) || game?.missions.find(m=>m.state==='available');
  if(!mission || mission.state!=='available')return;
  const revision = state.revision; state.pending = true;
  $$('[data-action=play]').forEach(b=>{b.disabled=true;if(b.dataset.game===gameId)b.textContent='Ouverture…';});
  try {
    const result = await request('/api/arcade/launch', {method:'POST', body:{gameId, lessonId:mission.lessonId, missionId:mission.missionId}});
    if(revision!==state.revision)return;
    beep(); location.hash = `jeu/${encodeURIComponent(result.runId)}`;
  } catch(e) {if(revision===state.revision){notify(e.message); await renderRoute({refresh:true});}}
  finally {if(revision===state.revision)state.pending=false;}
}
async function openGame(encodedId, revision) {
  if(state.game?.id===encodedId)return;
  const context = await request(`/api/game/runs/${encodeURIComponent(decodeURIComponent(encodedId))}/context`);
  if(revision!==state.revision)return;
  if(state.game)await closeGame(false);
  const frame = document.createElement('iframe'); frame.className='game-frame'; frame.title='Mission Code Station — PédagoLab'; frame.setAttribute('sandbox','allow-scripts');
  // The existing code execution sandbox has an opaque origin. Only the handshake
  // uses '*'; private context travels on a transferred MessagePort to this frame.
  const minimalContext = {...context, user:{displayName:state.account?.profile.handle || 'Joueur'}};
  state.game = {id:encodedId, frame, context:minimalContext, port:null, queue:Promise.resolve(), failedProgress:null, closing:false};
  $('#game-save').textContent = 'Les modifications sont enregistrées après confirmation du serveur.';
  $('#game-host').replaceChildren(frame); $('#game-modal').showModal(); frame.src='/game/index.html';
}
async function gameMessage(game, message) {
  if(state.game!==game || !message || typeof message!=='object' || game.closing)return;
  if(message.type==='eden:close'){await closeGame();return;}
  if(!['eden:event','eden:progress'].includes(message.type))return;
  const body = message.type==='eden:progress' ? {progress:message.progress} : {eventId:crypto.randomUUID(), type:message.eventType, payload:message.payload};
  if(message.type==='eden:progress')$('#game-save').textContent='Enregistrement…';
  game.queue = game.queue.then(async()=>{
    try {
      const result = await request(`/api/game/runs/${encodeURIComponent(decodeURIComponent(game.id))}/${message.type==='eden:progress'?'progress':'events'}`, {method:'POST',body});
      if(message.type==='eden:progress') {
        game.failedProgress=null;
        if(state.game===game)$('#game-save').textContent=result.receivedAt ? 'Partie enregistrée.' : 'Ta progression n’a pas encore été enregistrée.';
      }
    } catch(e) {
      if(message.type==='eden:progress')game.failedProgress=body.progress;
      if(state.game===game) {
        $('#game-save').textContent = `${message.type==='eden:progress'?'Ta progression n’a pas encore été enregistrée. ':''}${e.message}`;
        if(message.type==='eden:progress')$('#game-save').insertAdjacentHTML('beforeend',button('Réessayer','retry-save'));
      }
    }
  });
}
async function closeGame(navigate = true) {
  const game = state.game;
  if(game) {game.closing=true;await game.queue;game.port?.close();game.frame.remove();state.game=null;}
  if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
  $('#game-modal').close(); $('#game-host').replaceChildren();
  if(game?.failedProgress)notify('La dernière modification n’a pas été enregistrée.');
  if(navigate){history.replaceState(null,'','#arcade');await renderRoute({refresh:true});$('[data-game="code-station"]')?.focus();}
}
root.addEventListener('click', async event=>{
  const target = event.target.closest('[data-action],.sound-toggle'); if(!target || target.disabled)return;
  const action = target.dataset.action || 'sound';
  try {
    switch(action) {
      case 'home': location.hash=''; break;
      case 'auth': auth(); break;
      case 'toggle-password': {
        const field=document.getElementById(target.dataset.field),visible=field.type==='password';field.type=visible?'text':'password';
        target.textContent=visible?'Masquer':'Afficher';target.setAttribute('aria-pressed',String(visible));target.setAttribute('aria-label',(visible?'Masquer ':'Afficher ')+target.getAttribute('aria-label').slice(target.getAttribute('aria-label').indexOf(':')));break;
      }
      case 'cancel-profile': $('#main-content').innerHTML=profileForm(state.savedProfile,state.avatars);$('#aka').focus();break;
      case 'preview-card': modal('Ma carte',`<div class="identity-card">${playerIdentity(state.account.profile)}<p>Cet aperçu ne publie pas ton profil.</p></div>`);break;
      case 'resume': if(state.space?.resume){state.selection=state.space.resume.lessonId;await launch(state.space.resume.gameId);}break;
      case 'space-play': state.selection=target.dataset.lesson;await launch(target.dataset.game);break;
      case 'badge': {const b=state.collection?.badges.find(b=>b.id===target.dataset.id);if(b)modal(b.name,badgeDialog(b,state.account.profile));break;}
      case 'badge-add': case 'badge-remove': case 'badge-replace': case 'badge-up': case 'badge-down': {
        const revision=state.revision, badgeIds=nextFeatured(state.account.profile.featuredBadgeIds,target.dataset.id,action,target.dataset.replace);
        $$('#modal [data-action^="badge-"]').forEach(b=>b.disabled=true);
        try{const profile=await request('/api/arcade/badges/featured',{method:'PUT',body:{badgeIds}});if(revision!==state.revision)return;
          state.account.profile=profile;await renderRoute({refresh:true});notify('Modifications enregistrées.');}
        catch(e){if(!e.stale){$('#modal .form-status').textContent=e.message;$$('#modal [data-action^="badge-"]').forEach(b=>b.disabled=false);}}break;
      }
      case 'close-modal': $('#modal').close(); break;
      case 'retry': await renderRoute({refresh:true}); break;
      case 'play': await launch(target.dataset.game); break;
      case 'next': state.page++; await renderRoute(); break;
      case 'previous': state.page=Math.max(1,state.page-1); await renderRoute(); break;
      case 'player': {
        modal('Joueur',notice('Chargement…')); const revision=modalRevision;
        try{const data=await request(`/api/arcade/players/${encodeURIComponent(target.dataset.id)}`);if(revision===modalRevision&&$('#modal').open)$('#modal-body').insertAdjacentHTML('beforeend',`<div class="profile-hero">${avatar(data)}<div><h3>${escape(data.handle)}</h3><p>${escape(data.grade?.label || 'Grade non disponible')}</p><div class="featured-badges">${(data.featuredBadges||[]).map(b=>`<span class="featured-badge">${escape(b.name)}</span>`).join('')}</div></div></div>`);}
        finally{if(revision===modalRevision)$('#modal-body .notice')?.remove();}break;
      }
      case 'register': modal('Créer un compte',`${notice('Les inscriptions ne sont pas ouvertes pour le moment.')}<form class="wa-form"><fieldset disabled><legend>Compte externe</legend><label>Adresse e-mail<input name="email" type="email" autocomplete="email"></label>${passwordField('registerPassword','Mot de passe')}${passwordField('registerConfirmation','Confirmer le mot de passe')}<button class="button" disabled>Créer un compte</button></fieldset></form><p>Après vérification de ton adresse, tu pourras choisir ton AKA et ton avatar. Ce parcours n’est pas encore disponible.</p>${button('J’ai déjà un compte','auth')}${button('Connexion scolaire','auth')}`); break;
      case 'recovery': modal('Mot de passe oublié ?',notice('La récupération par e-mail n’est pas disponible. Pour ton compte scolaire, contacte ton professeur.')+button('Retour à la connexion','auth'));break;
      case 'logout': {
        state.authBusy=true;clearPrivate();history.replaceState(null,'','#arcade');
        try{await request('/api/logout',{method:'POST'});}catch(e){if(e.status!==401){state.authBusy=false;await renderRoute({refresh:true});throw e;}}
        state.authBusy=false;announceSession();await renderRoute({refresh:true});break;
      }
      case 'sound': preferences.sound=!preferences.sound;applyPreferences();beep();if(state.route==='reglages')await renderRoute();break;
      case 'shortcuts': modal('Les commandes',notice('Entrée ouvre la salle depuis l’accueil. Tab permet de parcourir les commandes. Échap ferme les fenêtres. Le clavier est recommandé pour les ateliers de code.'));break;
      case 'close-game': await closeGame();break;
      case 'retry-save': if(state.game?.failedProgress)await gameMessage(state.game,{type:'eden:progress',progress:state.game.failedProgress});break;
      case 'fullscreen-game': try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#game-modal').requestFullscreen();}catch{notify('Le plein écran n’est pas disponible dans ce navigateur.');}break;
    }
  } catch(e){notify(e.message);target.disabled=false;}
});
root.addEventListener('submit', async event=>{
  const form=event.target;if(!form.matches('[data-form]'))return;event.preventDefault();
  const submit=form.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;
  const data=Object.fromEntries(new FormData(form));const status=$('.form-status',form);const revision=state.revision;
  try {
    switch(form.dataset.form){
      case 'login': {
        await request('/api/login',{method:'POST',body:data});const pending=state.pendingGame;form.reset();clearPrivate();announceSession();await bootstrap();
        state.pendingGame=pending;
        if(state.account.profile.needsPersonalization){location.hash='personnaliser';if(state.route==='personnaliser')await renderRoute();}
        else{history.replaceState(null,'','#arcade');await renderRoute();if(pending){state.pendingGame=null;await launch(pending);}}break;
      }
      case 'profile': {
        status.textContent='Enregistrement…';const result=await request('/api/arcade/profile',{method:'PUT',body:data});if(revision!==state.revision)return;
        const initial=state.savedProfile.needsPersonalization;state.savedProfile=result;state.account.profile=result;accountSlots();form.elements.handle.value=result.handle;$('#identity-preview').innerHTML=playerIdentity(result);status.textContent='Modifications enregistrées.';
        if(initial){const pending=state.pendingGame;state.pendingGame=null;await bootstrap();history.replaceState(null,'','#arcade');await renderRoute();if(pending)await launch(pending);}break;
      }
      case 'password': {
        if(data.newPassword!==data.confirmation){status.textContent='Les mots de passe ne correspondent pas.';break;}
        status.textContent='Modification…';delete data.username;
        await request('/api/arcade/account/password',{method:'POST',body:data});form.reset();clearPrivate();announceSession();
        history.replaceState(null,'','#arcade');await renderRoute({refresh:true});auth();notify('Mot de passe modifié. Toutes tes sessions ont été fermées. Reconnecte-toi.');break;
      }
      case 'search': state.search=data.q;state.page=1;await renderRoute();break;
    }
  } catch(e){if(e.stale)return;if(status?.isConnected)status.textContent=form.dataset.form==='profile'?`Tes changements n’ont pas été enregistrés. ${e.message}`:e.message;else notify(e.message);}
  finally{submit.disabled=false;}
});
root.addEventListener('error',event=>{
  const img=event.target;if(!(img instanceof HTMLImageElement)||!img.matches('img.avatar,.avatar-picker img'))return;
  const label=img.closest('.avatar-picker label');if(label){label.querySelector('input').disabled=true;label.querySelector('span').textContent='Avatar indisponible';}
  const fallback=document.createElement('span');fallback.className='avatar avatar-unavailable';fallback.setAttribute('role','img');fallback.setAttribute('aria-label','Avatar indisponible');fallback.innerHTML=icon('user');img.replaceWith(fallback);
},true);
root.addEventListener('focusin',event=>{
  if(innerWidth>640||event.target.closest('dialog')||!event.target.matches('input,select,button,a,summary'))return;
  requestAnimationFrame(()=>{const rect=event.target.getBoundingClientRect();if(rect.bottom>innerHeight-90||rect.top<8)event.target.scrollIntoView({block:'center'});});
});
root.addEventListener('input',event=>{
  if(!event.target.closest('[data-form=profile]')||!state.savedProfile)return;
  const data=Object.fromEntries(new FormData(event.target.form));$('#identity-preview').innerHTML=playerIdentity({...state.savedProfile,...data});
  $('.form-status',event.target.form).textContent='Changements non enregistrés.';
});
root.addEventListener('change',event=>{
  if(event.target.id==='mission-choice'){state.selection=event.target.value;renderRoute();}
  const key=event.target.dataset.pref;if(!Object.hasOwn(preferences,key))return;
  preferences[key]=event.target.checked;applyPreferences();if(key==='sound')beep();
});
$('#start-button').addEventListener('click',()=>{beep();location.hash='arcade';});
root.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!state.route&&!event.defaultPrevented&&!$('#modal').open&&!$('#game-modal').open&&!event.target.closest('input,textarea,select,button,a,[contenteditable]')){event.preventDefault();location.hash='arcade';}
});
$('#modal').addEventListener('close',()=>{modalRevision++;$('#modal-body').replaceChildren();if(modalFocus?.isConnected)modalFocus.focus();});
$('#game-modal').addEventListener('cancel',event=>{event.preventDefault();closeGame();});
window.addEventListener('message',event=>{
  const game=state.game;
  if(!game||game.port||event.source!==game.frame.contentWindow||event.origin!=='null'||event.data?.type!=='eden:ready')return;
  const channel=new MessageChannel();game.port=channel.port1;channel.port1.onmessage=e=>gameMessage(game,e.data);
  game.frame.contentWindow.postMessage({type:'eden:connect'},'*',[channel.port2]);channel.port1.postMessage(game.context);
});
window.addEventListener('hashchange',()=>renderRoute());
window.addEventListener('pagehide',()=>{clearPrivate();audioContext?.close().catch(()=>{});audioContext=null;});
window.addEventListener('pageshow',event=>{if(event.persisted){clearPrivate();renderRoute({refresh:true});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){audioContext?.suspend().catch(()=>{});}else if(!state.game&&!$('#modal').open){clearPrivate();renderRoute({refresh:true});}});
if(sessionChannel)sessionChannel.onmessage=()=>{clearPrivate();renderRoute({refresh:true});};
reducedMotion.addEventListener('change',applyPreferences);
$$('[data-pixel]').forEach(el=>el.innerHTML=pixelText(el.dataset.pixel));
accountSlots();
await bootstrap().catch(e=>notify(e.message));
await renderRoute();
