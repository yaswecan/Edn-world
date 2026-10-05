import {mountSimulator} from './pcsim/controller.js';
import {bonusUnlocked,createSimulator} from './pcsim/model.js';
import {SimulatorSync} from './pcsim/sync.js';
import config from '../config.js';
import {STEPS,CHAPTERS,SCHEMAS,BOOT_ORDER,RELAY_ORDER,CODE_START} from './content.js';
import {createState,completeStep,validateStep,indexOf,canVisit,sameOrder,toggleApp,assignCPU,elapsedRemaining,parseState,MAX_IMPORT_BYTES,reportHTML,safeURL,escapeHTML as e} from './model.js';
import * as storage from './storage.js';
import {home,lesson,renderActivity,reportPreview,schema} from './views.js';
import {runCode} from './runner.js';

const preview=new URLSearchParams(location.search).get('projection')==='1';
const loaded=preview?{state:null,error:null}:storage.load();
let state=loaded.state,localWarning=loaded.error,conflict=false,running=false,runEpoch=0,lastFocus=null;
const app=document.querySelector('#app'),modal=document.querySelector('#modal');
let simController=null;
const sync=new SimulatorSync({enabled:!preview,base:config.simulatorApiBase||'./api/',onStatus:text=>{simController?.setSyncStatus(text);const n=document.querySelector('#sync-dialog-state');if(n)n.textContent=text;}});
if(!preview)sync.discover();
const current=()=>STEPS.find(s=>s.id===state?.current)||STEPS[0];
if(preview){state=createState('Projection');state.maxVisited=STEPS.length-1;}
if(config.loadGoogleInter){
 const l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;750;800&display=swap';document.head.append(l);
}
function notify(text){const el=document.querySelector('#toast');el.textContent=text;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,4500);}
function warning(text){const el=document.querySelector('#warning');el.textContent=text||'';el.hidden=!text;}
function persist(){
 if(!state||preview)return;
 const ok=!conflict&&storage.save(state),el=document.querySelector('#save-state');
 el.textContent=ok?'Enregistré sur ce navigateur':'Export conseillé';
 if(!ok)warning(conflict?'Un autre onglet a changé la progression. Exporte ton travail ici puis recharge, pour ne pas écraser l’autre onglet.':'Sauvegarde locale indisponible : garde cette page ouverte et exporte régulièrement dans « Mon espace ».');
}
function stopSimulator(){const previous=simController;simController=null;previous?.destroy();}
function render({focus=false}={}){
 stopSimulator();
 const hash=decodeURIComponent(location.hash.slice(1)||'');
 if(hash==='bonus-pc'&&state&&(preview||bonusUnlocked(state,STEPS))){
  if(!state.simulator)state.simulator=createSimulator();
  app.innerHTML='';
  simController=mountSimulator(app,{state:state.simulator,syncStatus:preview?'Mode projection : aucun essai partagé.':sync.status,
   onChange:(sim)=>{if(!state)return;state.simulator=sim;persist();if(!preview&&!conflict)sync.offer(state.alias,sim,state.completed.length);},
   onBack:()=>navigate('fin',{force:true}),onReport:()=>handleAction({dataset:{action:'export-html'}}),onSync:()=>openSync()});
  return;
 }
 if(!state?.alias||hash==='accueil')app.innerHTML=home(state,localWarning||'');
 else{
  if(hash&&canVisit(state,hash))state.current=hash;
  else if(hash&&preview&&indexOf(hash)>=0)state.current=hash;
  if(location.hash!=='#'+state.current)history.replaceState(null,'','#'+state.current);
  app.innerHTML=lesson(state,current(),preview);
  if(current().kind==='finish'){if(!preview&&!state.completed.includes('fin')){state.completed.push('fin');persist();}renderSubmission();}
  if(focus){const title=document.querySelector('#step-title');title?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 }
 updateClocks();
}
function navigate(id,{force=false}={}){
 if(!state||(!preview&&!force&&!canVisit(state,id)))return;
 runEpoch++;running=false;state.current=id;persist();history.pushState(null,'','#'+id);render({focus:true});
}
function refreshActivity(){
 const activity=document.querySelector('#activity');if(activity)activity.innerHTML=renderActivity(current(),state);
 updateClocks();
}
function feedback(message,ok=false,game=false){
 const target=document.querySelector(game?'#game-feedback':'#step-feedback');
 if(target)target.innerHTML=`<p class="feedback ${ok?'good':'bad'}">${e(message)}</p>`;
 else notify(message);
}
function renderSubmission(){
 const el=document.querySelector('#submission-link');if(!el)return;
 const url=safeURL(config.submissionUrl);
 el.innerHTML=url?`<div class="takeaway"><strong>Dernière action :</strong> enregistre ton bilan, puis joins ce fichier au dépôt.<br><a class="secondary small" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(config.submissionLabel)}</a></div>`:'<p class="rule">Demande au professeur où remettre ton bilan. Aucun dépôt automatique n’est configuré dans cette version.</p>';
}
function updateClocks(){
 const diag=document.querySelector('#diagnostic-clock');
 if(diag&&state){const n=elapsedRemaining(state.diagnosticStartedAt,config.diagnosticMinutes);diag.textContent=state.diagnosticFinishedAt?'Terminé':n===0?'Temps indicatif écoulé':`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;}
 const pause=document.querySelector('#pause-clock');
 if(pause&&state){const n=elapsedRemaining(state.pauseStartedAt,config.pauseMinutes);pause.textContent=`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;}
}
function openModal(title,body){
 lastFocus=document.activeElement;
 document.querySelector('#modal-content').innerHTML=`<div class="modal-head"><h2 id="modal-title">${e(title)}</h2><button data-action="close-modal" aria-label="Fermer">×</button></div><div class="modal-body">${body}</div>`;
 if(!modal.open)modal.showModal();
}
function openSync(){
 if(preview){notify('Mode projection : aucun envoi professeur.');return;}
 const connected=sync.data.identity?.alias===state?.alias;
 openModal('Partager les essais du simulateur',`<p id="sync-dialog-state" role="status">${e(sync.status)}</p><p>Le partage concerne ton code élève, les étapes du bonus, tes essais et ton explication. Les réponses aux autres missions ne sont pas envoyées par ce service.</p>${connected?`<p>Connecté comme <strong>${e(state.alias)}</strong>.</p><button class="secondary" data-action="retry-sync">Synchroniser maintenant</button><button class="quiet-button" data-action="disconnect-sync">Désactiver le partage</button>`:`<label class="field-label" for="sync-class-code">Code de classe donné par le professeur</label><input type="password" id="sync-class-code" autocomplete="off"><p class="fine">En activant le partage, tu envoies aussi les essais déjà présents dans ce bonus. N’utilise pas de nom complet.</p><button class="primary" data-action="connect-sync">Activer le partage</button><button class="quiet-button" data-action="retry-sync">Rechercher le service</button>`}<p class="fine">Sans service serveur, garde et remets le bilan exporté. Aucun code de classe ni secret de connexion n’est inclus dans les exports.</p>`);
}
function closeModal(){modal.close();lastFocus?.focus?.({preventScroll:true});}
modal.addEventListener('click',ev=>{if(ev.target===modal){const r=modal.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)closeModal();}});
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
const slug=()=>state.alias.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]/gi,'_').slice(0,48)||'eleve';
function tools(){
 openModal('Mon espace',`${state?.alias?`<div class="profile"><span class="avatar">${e(state.alias.slice(0,1).toUpperCase())}</span><div><strong>${e(state.alias)}</strong><br><span class="fine">Sur ce navigateur uniquement · pas un compte connecté</span></div></div>`:''}<section class="modal-section"><h3>Garder mon travail</h3><p>La sauvegarde est locale. Un export permet de reprendre sur un autre appareil. Le suivi du bonus est envoyé seulement après activation du partage.</p><div class="actions"><button class="secondary small" data-action="export-json" ${!state||preview?'disabled':''}>Sauvegarder mes réponses (JSON)</button><button class="secondary small" data-action="export-html" ${!state||preview?'disabled':''}>Enregistrer mon bilan (HTML)</button></div></section><section class="modal-section"><h3>Reprendre une sauvegarde</h3><p>Choisis un fichier JSON de cette séance (250 Ko maximum). Il remplacera la progression ouverte ici.</p><label class="field-label" for="import-input">Fichier de progression</label><input id="import-input" type="file" accept=".json,application/json" ${preview?'disabled':''}><p id="import-message" role="status"></p></section><section class="modal-section"><h3>Sur un ordinateur partagé</h3><p>Après avoir remis ton bilan, efface tes réponses de ce navigateur. Un prénom ne protège pas ton travail par mot de passe.</p><button class="quiet-button danger" data-action="erase" ${preview?'disabled':''}>Effacer ma progression locale</button></section>${safeURL(config.edenHubUrl)?`<a class="secondary small" href="${e(safeURL(config.edenHubUrl))}" rel="noopener noreferrer">Retour à Eden Hub</a>`:''}<p class="tiny"><a href="a-propos.html">Fonctionnement, confidentialité et sources</a></p>`);
}
function notebook(){
 if(!state)return;
 if(current().chapter==='diag'||current().chapter==='ticket'){notify('Pendant le diagnostic et le ticket, réponds sans le mémo.');return;}
 const allowed=SCHEMAS.filter(sc=>preview||indexOf(STEPS.find(st=>st.chapter===sc.chapter).id)<=state.maxVisited);
 openModal('Mes schémas repères',`<p class="fine">Les schémas apparaissent au fil du cours. Clique pour agrandir.</p><div class="diagram-links">${allowed.map(sc=>`<button class="diagram-link" data-action="zoom" data-schema="${sc.id}"><img src="assets/schemas/${sc.id}.webp" alt="${e(sc.alt)}">${e(sc.title)}</button>`).join('')}</div>`);
}
function start(){
 const name=document.querySelector('#alias')?.value.trim()||'';
 if(name.length<2){document.querySelector('#home-error').innerHTML='<p class="error-note">Écris un prénom ou un code élève d’au moins deux caractères.</p>';return;}
 state=createState(name);state.diagnosticStartedAt=Date.now();localWarning=null;conflict=false;persist();navigate(STEPS[0].id);
}
async function handleAction(button){
 const action=button.dataset.action,id=button.dataset.value;
 if(button.disabled)return;
 switch(action){
 case 'start':start();return;
 case 'open-simulator':
  if(!preview&&!bonusUnlocked(state,STEPS)){notify('Termine les six missions, le ticket et le bilan avant ce bonus.');return;}
  history.pushState(null,'','#bonus-pc');render({focus:true});window.scrollTo({top:0,behavior:'instant'});return;
 case 'connect-sync':{
  const el=document.querySelector('#sync-class-code'),message=document.querySelector('#sync-dialog-state');
  if(!el)return;button.disabled=true;
  try{if(state?.simulator)sync.last={alias:state.alias,simulator:state.simulator,coreCompleted:state.completed.length};await sync.connect(state.alias,el.value);el.value='';openSync();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}return;
 }
 case 'disconnect-sync':sync.disconnect();openSync();return;
 case 'retry-sync':await sync.discover();await sync.flush();openSync();return;
 case 'resume':if(state)navigate(state.current);return;
 case 'menu':document.querySelector('#sidebar')?.classList.toggle('open');return;
 case 'tools':tools();return;
 case 'close-modal':closeModal();return;
 case 'zoom':{const sc=SCHEMAS.find(s=>s.id===button.dataset.schema);if(sc)openModal(sc.title,schema(sc.id));return;}
 case 'chapter':navigate(button.dataset.id);return;
 case 'notebook':notebook();return;
 case 'back':{const i=indexOf(current().id);if(i>0)navigate(STEPS[i-1].id);return;}
 case 'next':{
  const step=current();
  if(preview){navigate(STEPS[Math.min(indexOf(step.id)+1,STEPS.length-1)].id);return;}
  const {state:next,verdict}=completeStep(state,step);
  if(!verdict.ok){feedback(verdict.message);return;}
  state=next;persist();navigate(next.current);return;
 }
 case 'choice':{
  const key=button.dataset.field;
  if(key==='_rights'){state.game.rightsChoice=id;state.game.rightsChecked=false;}
  else state.answers[key]=id;
  persist();refreshActivity();return;
 }
 case 'unknown':state.answers[button.dataset.field]='Je ne sais pas encore.';persist();refreshActivity();return;
 case 'boot-add':if(!state.game.boot.includes(id)&&state.game.boot.length<5)state.game.boot.push(id);state.game.bootChecked=false;break;
 case 'boot-remove':state.game.boot.splice(Number(button.dataset.index),1);state.game.bootChecked=false;break;
 case 'boot-reset':state.game.boot=[];state.game.bootChecked=false;break;
 case 'boot-check':{
  state.game.bootChecked=sameOrder(state.game.boot,BOOT_ORDER);persist();
  feedback(state.game.bootChecked?'Les cinq étapes sont dans l’ordre. Quelle flèche peux-tu expliquer ?':'Regarde les relais. Le chargeur lance le noyau ; les services et la session viennent après.',state.game.bootChecked,true);return;
 }
 case 'relay-add':if(!state.game.relay.includes(id)&&state.game.relay.length<5)state.game.relay.push(id);state.game.relayChecked=false;break;
 case 'relay-remove':state.game.relay.splice(Number(button.dataset.index),1);state.game.relayChecked=false;break;
 case 'relay-reset':state.game.relay=[];state.game.relayChecked=false;break;
 case 'relay-check':state.game.relayChecked=sameOrder(state.game.relay,RELAY_ORDER);persist();refreshActivity();if(!state.game.relayChecked)feedback('L’application demande un service à l’OS ; le noyau et le pilote participent ensuite à l’écriture.',false,true);return;
 case 'sample':state.answers.m2_source='simule';state.answers.m2_process='calculator';state.answers.m2_measure='mémoire : 12 Mo (relevé simulé)';break;
 case 'counter-plus':state.game.counter=Math.min(3,state.game.counter+1);break;
 case 'counter-reload':if(state.game.counter===3&&state.answers.m2_prediction){state.game.counter=0;state.game.counterReloaded=true;}break;
 case 'pause-start':state.pauseStartedAt=Date.now();persist();updateClocks();return;
 case 'toggle-app':{const result=toggleApp(state.game,id);state.game=result.game;persist();refreshActivity();feedback(result.message,true,true);return;}
 case 'cpu-turn':state.game=assignCPU(state.game,id);break;
 case 'cpu-reset':state.game.cpu=[];break;
 case 'rights-check':state.game.rightsChecked=state.game.rightsChoice==='deny';persist();refreshActivity();if(!state.game.rightsChecked)feedback('Lecture seule : on peut lire, pas modifier. Respecte la règle du dossier.',false,true);return;
 case 'editor-close':state.game.editorClosed=true;break;
 case 'editor-plus':state.game.editorCounter++;if(state.game.editorClosed)state.game.editorClickedClosed=true;break;
 case 'code-reset':if(confirm('Revenir au code de départ ? Ta modification actuelle sera remplacée.')){state.game.code=CODE_START;state.game.codePassed=false;state.game.codeResult=null;state.game.codeLastTested='';}break;
 case 'run-code':{
  if(running)return;
  running=true;const epoch=++runEpoch,code=state.game.code;
  button.disabled=true;button.textContent='Test en cours…';
  const result=await runCode(code);
  if(epoch!==runEpoch)return;
  running=false;state.game.codeResult=result;state.game.codeLastTested=code;
  if(!result.ok)state.game.codeSawError=true;
  state.game.codePassed=result.ok&&result.output.trim()==='Score : 3';persist();refreshActivity();
  if(result.ok&&!state.game.codePassed)feedback('Le code s’exécute, mais le résultat attendu est « Score : 3 ». Vérifie la valeur et l’affichage.');return;
 }
 case 'diagnostic-view':openModal('Mon diagnostic',reportPreview(state,true));return;
 case 'report':if(!preview)openModal('Mon bilan de séance',reportPreview(state)+`<div class="actions" style="margin-top:18px"><button class="primary" data-action="export-html">Enregistrer mon bilan</button><button class="secondary" data-action="export-json">Sauvegarde JSON</button></div>`);else notify('Mode projection : aucun bilan élève à exporter.');return;
 case 'export-json':if(state&&!preview){download(`BIOS_OS_${slug()}_progression.json`,JSON.stringify(state,null,2),'application/json');notify('Sauvegarde créée. Elle sert à reprendre, pas à envoyer automatiquement.');}return;
 case 'export-html':if(state&&!preview){download(`BIOS_OS_${slug()}_bilan.html`,reportHTML(state),'text/html');notify('Le bilan contient tes réponses et ton code. Remets-le au professeur.');}return;
 case 'new-profile':case 'erase':
  if(preview)return;
  if(state&&!confirm('As-tu enregistré ton bilan ? Cette action efface les réponses de ce navigateur.'))return;
  stopSimulator();sync.disconnect();storage.clear();state=null;conflict=false;localWarning=null;runEpoch++;warning('');if(modal.open)closeModal();history.replaceState(null,'','#accueil');render();return;
 }
 persist();refreshActivity();
}
document.addEventListener('click',ev=>{
 const button=ev.target.closest('[data-action]');if(!button)return;
 ev.preventDefault();handleAction(button).catch(error=>{console.error(error);running=false;feedback('Une action n’a pas abouti. Tes réponses déjà saisies restent conservées. Recharge ou utilise « Mon espace ».');});
});
document.addEventListener('keydown',ev=>{if(ev.target.id==='alias'&&ev.key==='Enter'){ev.preventDefault();start();}});
document.addEventListener('input',ev=>{
 const el=ev.target;if(!state)return;
 if(el.dataset.field){
  if(el.dataset.field.startsWith('d_')&&state.diagnosticFinishedAt)return;
  state.answers[el.dataset.field]=el.value.slice(0,1200);persist();
 }
 if(el.dataset.code){state.game.code=el.value.slice(0,8000);state.game.codePassed=false;persist();const s=document.querySelector('#code-status');if(s)s.textContent='Code modifié : relance le test.';}
});
document.addEventListener('change',async ev=>{
 const el=ev.target;
 if(el.dataset.field==='m2_prediction'&&current().id==='counter-predict')refreshActivity();
 if(el.dataset.field==='m2_source'){
  if(el.value==='reel'){state.answers.m2_process='';state.answers.m2_measure='';persist();}
  refreshActivity();
 }
 if(el.id==='import-input'&&el.files?.length){
  const status=document.querySelector('#import-message');
  try{
   const file=el.files[0];if(file.size>MAX_IMPORT_BYTES)throw new Error('Fichier trop volumineux : 250 Ko maximum.');
   const incoming=parseState(await file.text());
   if(state&&!confirm(`Remplacer la progression ouverte par celle de ${incoming.alias} ?`))return;
   stopSimulator();sync.disconnect();state=incoming;conflict=false;localWarning=null;runEpoch++;persist();closeModal();navigate(state.current);notify('Ta progression a été reprise. Réactive le partage du bonus si nécessaire.');
  }catch(error){status.textContent=error.message;status.className='error-note';}
 }
});
window.addEventListener('hashchange',()=>{if(location.hash==='#bonus-pc'){render({focus:true});return;}if(location.hash==='#accueil'){render();return;}const id=decodeURIComponent(location.hash.slice(1));if(state&&(preview||canVisit(state,id))&&indexOf(id)>=0){state.current=id;persist();render({focus:true});}else render();});
window.addEventListener('popstate',()=>render());
window.addEventListener('storage',ev=>{if(ev.key===storage.storageKey&&!preview&&ev.newValue){conflict=true;warning('Un autre onglet a modifié cette progression. Exporte ce travail avant de recharger.');}});
window.addEventListener('pagehide',()=>persist());
setInterval(updateClocks,1000);
if(localWarning)warning(localWarning);
render();
