import {sanitizeSimulator,simulatorSummary} from './pcsim/model.js';
import {SESSION, STEPS, FIELDS, BOOT_ORDER, RELAY_ORDER, APPS, CODE_START} from './content.js';
export const VERSION = 1;
export const MAX_IMPORT_BYTES = 250_000;
export function createState(alias='') {
  return {version:VERSION,sessionId:SESSION.id,alias:alias.trim().slice(0,48),current:STEPS[0].id,maxVisited:0,
    completed:[],answers:{},diagnosticStartedAt:null,diagnosticFinishedAt:null,diagnosticSnapshot:null,
    updatedAt:Date.now(),pauseStartedAt:null,simulator:null,
    game:{boot:[],relay:[],bootChecked:false,relayChecked:false,rightsChoice:'',rightsChecked:false,
      open:[],cpu:[],ramInitial:false,ramRefused:false,counter:0,counterReloaded:false,editorClosed:false,editorCounter:0,editorClickedClosed:false,
      code:CODE_START,codeResult:null,codeSawError:false,codePassed:false,codeLastTested:''}};
}
export const ramUsed = (open) => APPS.filter(a=>open.includes(a.id)).reduce((n,a)=>n+a.ram,0);
export function toggleApp(game,id) {
  if (!APPS.some(a=>a.id===id)) return {game,message:'Application inconnue.'};
  const g=structuredClone(game);
  if (g.open.includes(id)) {g.open=g.open.filter(x=>x!==id);g.cpu=[];return {game:g,message:'Application fermée : ses cases sont disponibles. Le planning CPU est à refaire.'};}
  const proposed=[...g.open,id];
  if(ramUsed(proposed)>8) {if(id==='game' && ['browser','music','editor'].every(x=>g.open.includes(x))) g.ramRefused=true;
    return {game:g,message:`Il faudrait ${ramUsed(proposed)} cases, mais il n’y en a que 8. Ferme une application avant de réessayer.`};}
  g.open=proposed;g.cpu=[];
  if(['browser','music','editor'].every(x=>g.open.includes(x)))g.ramInitial=true;
  return {game:g,message:`${ramUsed(g.open)} / 8 cases occupées. Un tour CPU ne libère pas la RAM.`};
}
export function assignCPU(game,id) {
  if(!game.open.includes(id)||game.cpu.length>=6)return game;
  return {...game,cpu:[...game.cpu,id]};
}
export function sameOrder(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
export const minutes = t=> Number(t.split(':')[0])*60+Number(t.split(':')[1]);
export const indexOf = id=>STEPS.findIndex(s=>s.id===id);
export function canVisit(state,id){const i=indexOf(id);return i>=0&&i<=state.maxVisited;}
export function elapsedRemaining(start,duration,now=Date.now()){
  if(!start)return duration*60;
  return Math.max(0,Math.ceil((duration*60_000-(now-start))/1000));
}
const enough = (s,min=2)=>typeof s==='string'&&s.trim().length>=min;
export function validateStep(step,state){
 const a=state.answers,g=state.game;
 const no=message=>({ok:false,message});const yes={ok:true,message:'Étape prête à expliquer.'};
 const filled=(keys)=>keys.every(k=>enough(a[k],1));
 switch(step.kind){
  case 'classify':return filled(['d_cpu','d_ssd','d_keyboard','d_editor','d_browser','d_ubuntu'])?yes:no('Choisis une réponse pour chaque élément, même « Je ne sais pas ».');
  case 'hardware':return filled(['d_exec','d_store','d_ram'])?yes:no('Choisis les trois rôles. « Je ne sais pas » reste possible.');
  case 'save-question':return filled(['d_version','d_why'])?yes:no('Indique la version retrouvée et une raison, ou écris « Je ne sais pas ».');
  case 'html-question':return filled(['d_tool','d_actions'])?yes:no('Indique l’outil et les deux actions, ou écris « Je ne sais pas ».');
  case 'text':return enough(a[step.field])?yes:no('Écris ta réponse en une ou deux phrases. Tu peux aussi signaler que tu ne sais pas.');
  case 'boot':return sameOrder(g.boot,BOOT_ORDER)&&g.bootChecked?yes:no('Compose cinq étapes et utilise « Tester mon ordre » avant de continuer.');
  case 'boot-explain':return filled(['m1_relay','m1_intruder'])?yes:no('Explique un relais puis pourquoi VS Code n’est pas nécessaire au démarrage.');
  case 'process':return filled(['m2_source','m2_process','m2_measure'])?yes:no('Indique la source, le processus et une mesure avec son unité.');
  case 'counter-predict':return enough(a.m2_prediction)&&g.counterReloaded?yes:no('Ajoute trois points, note ta prédiction, puis recharge seulement le compteur.');
  case 'counter-compare':return enough(a.m2_observation)?yes:no('Compare ce qui a changé dans le compteur et ce qui est resté enregistré.');
  case 'zero':return a.m2_zero==='waiting'?yes:no('La Calculatrice répond encore. Cela ne permet pas de dire que son processus a disparu.');
  case 'anchor':return filled(['anchor_boot','anchor_process'])?yes:no('Complète les deux phrases avec tes mots.');
  case 'ram':return g.ramInitial&&g.ramRefused&&g.open.includes('game')&&ramUsed(g.open)===8?yes:no('Observe d’abord le refus après Navigateur + Musique + Éditeur. Ouvre ensuite Jeu en occupant juste 8 cases.');
  case 'cpu':return g.cpu.length===6&&g.open.length>0&&g.open.every(id=>g.cpu.includes(id))?yes:no('Utilise six tours et donne au moins un tour à chaque application ouverte.');
  case 'relay':return sameOrder(g.relay,RELAY_ORDER)&&g.relayChecked?yes:no('Compose le relais de la demande puis teste-le.');
  case 'rights':return g.rightsChoice==='deny'&&g.rightsChecked?yes:no('Le dossier est en lecture seule. Teste la décision qui respecte ses droits.');
  case 'editor-predict':return enough(a.m5_prediction)?yes:no('Fais une prédiction avant l’expérience.');
  case 'editor-lab':return g.editorClosed&&g.editorClickedClosed&&enough(a.m5_observation)?yes:no('Ferme l’éditeur de démonstration, clique dans le compteur puis note le résultat.');
  case 'roles':return a.role_edit==='editor'&&a.role_engine==='engine'&&a.role_os==='os'&&a.role_cpu==='cpu'?yes:no('Revois les rôles : écrire, exécuter le JavaScript, organiser, exécuter les instructions machine.');
  case 'incident-a':return a.m6_a==='entries'&&enough(a.m6_a_reason)?yes:no('Il manque les entrées de démarrage. Choisis une information vérifiable et cite un indice.');
  case 'incident-b':return a.m6_b==='process'&&enough(a.m6_b_reason)?yes:no('Les autres fenêtres répondent. Examine d’abord l’application et son processus, puis justifie.');
  case 'code':return g.codeSawError&&g.codePassed&&g.code===g.codeLastTested&&enough(a.m6_c_reason)?yes:no('Observe l’erreur d’abord, teste ta correction pour obtenir « Score : 3 », puis explique. Toute modification doit être retestée.');
  default:return yes;
 }
}
export function completeStep(state,step){
 const verdict=validateStep(step,state);if(!verdict.ok)return {state,verdict};
 const next=structuredClone(state),idx=indexOf(step.id);
 if(!next.completed.includes(step.id))next.completed.push(step.id);
 if(step.id==='diag-html'&&!next.diagnosticFinishedAt){
  next.diagnosticFinishedAt=Date.now();next.diagnosticSnapshot=Object.fromEntries(Object.entries(next.answers).filter(([k])=>k.startsWith('d_')));
 }
 next.maxVisited=Math.max(next.maxVisited,Math.min(STEPS.length-1,idx+1));
 next.current=STEPS[Math.min(idx+1,STEPS.length-1)].id;next.updatedAt=Date.now();
 return {state:next,verdict};
}
export function safeURL(value){
 if(!value||typeof value!=='string')return '';
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
export function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const cleanString=(v,max=1200)=>typeof v==='string'?v.slice(0,max):'';
const cleanArray=(v,allowed,max)=>Array.isArray(v)?v.filter(x=>allowed.includes(x)).slice(0,max):[];
const time=(v)=>Number.isFinite(v)&&v>0&&v<Date.now()+60_000?v:null;
/** Reprise bornée : pas de HTML exécuté, pas de clés libres injectées dans l’état. */
export function parseState(raw){
 if(typeof raw!=='string'||raw.length>MAX_IMPORT_BYTES)throw new Error('Fichier trop volumineux (250 Ko maximum).');
 let input;try{input=JSON.parse(raw);}catch{throw new Error('Ce fichier n’est pas un JSON valide.');}
 if(!input||input.version!==VERSION||input.sessionId!==SESSION.id)throw new Error('Sauvegarde d’une autre séance ou version non prise en charge.');
 if(!enough(input.alias)||!input.game||typeof input.game!=='object')throw new Error('La sauvegarde ne contient pas les informations attendues.');
 const s=createState(input.alias),g=input.game;
 s.maxVisited=Math.max(0,Math.min(STEPS.length-1,Number.isInteger(input.maxVisited)?input.maxVisited:0));
 s.current=canVisit(s,input.current)?input.current:STEPS[0].id;
 s.completed=[...new Set(cleanArray(input.completed,STEPS.map(s=>s.id),STEPS.length))];
 for(const k of Object.keys(FIELDS))s.answers[k]=cleanString(input.answers?.[k]);
 s.diagnosticStartedAt=time(input.diagnosticStartedAt);s.diagnosticFinishedAt=time(input.diagnosticFinishedAt);s.pauseStartedAt=time(input.pauseStartedAt);
 s.updatedAt=time(input.updatedAt)||Date.now();
 if(input.diagnosticSnapshot&&s.diagnosticFinishedAt){s.diagnosticSnapshot={};for(const k of Object.keys(FIELDS).filter(k=>k.startsWith('d_')))s.diagnosticSnapshot[k]=cleanString(input.diagnosticSnapshot[k]);}
 s.game.boot=cleanArray(g.boot,[...BOOT_ORDER,'editor'],6);s.game.relay=cleanArray(g.relay,RELAY_ORDER,5);
 s.game.open=[...new Set(cleanArray(g.open,APPS.map(a=>a.id),4))];if(ramUsed(s.game.open)>8)s.game.open=[];
 s.game.cpu=cleanArray(g.cpu,s.game.open,6);
 for(const k of ['bootChecked','relayChecked','rightsChecked','ramInitial','ramRefused','counterReloaded','editorClosed','editorClickedClosed','codeSawError','codePassed'])s.game[k]=g[k]===true;
 s.game.rightsChoice=['deny','allow'].includes(g.rightsChoice)?g.rightsChoice:'';
 for(const k of ['counter','editorCounter'])s.game[k]=Number.isInteger(g[k])?Math.min(999,Math.max(0,g[k])):0;
 s.game.code=typeof g.code==='string'?g.code.slice(0,8000):CODE_START;s.game.codeLastTested=cleanString(g.codeLastTested,8000);
 if(g.codeResult&&typeof g.codeResult==='object')s.game.codeResult={ok:g.codeResult.ok===true,output:cleanString(g.codeResult.output,500),error:cleanString(g.codeResult.error,500),logs:Array.isArray(g.codeResult.logs)?g.codeResult.logs.slice(0,10).map(x=>cleanString(x,200)):[]};
 s.simulator=sanitizeSimulator(input.simulator);
 if(s.game.code!==s.game.codeLastTested)s.game.codePassed=false;
 return s;
}
export function makeReport(state){
 return {kind:'eden-learning-report',version:1,session:SESSION,alias:state.alias,exportedAt:new Date().toISOString(),
  completed:state.completed.length,total:STEPS.length,
  note:'Bilan formatif local. Les contrôles automatiques ne remplacent pas la validation du professeur. Aucun envoi automatique à Eden Hub.',
  answers:Object.entries(FIELDS).map(([id,label])=>({id,label,value:id.startsWith('d_')&&state.diagnosticSnapshot?state.diagnosticSnapshot[id]||'':state.answers[id]||''})),
  evidence:{boot:state.game.boot,ramOpen:state.game.open,ramCases:ramUsed(state.game.open),ramRefusalObserved:state.game.ramRefused,cpuTurns:state.game.cpu,relay:state.game.relay,
    rightsDecision:state.game.rightsChoice,counterReloaded:state.game.counterReloaded,editorTest:state.game.editorClickedClosed,
    code:state.game.code,codeResult:state.game.codeResult,codeTested:state.game.code===state.game.codeLastTested},
  simulator:state.simulator?{summary:simulatorSummary(state.simulator),events:state.simulator.events}:null,
  diagnostic:{startedAt:state.diagnosticStartedAt,finishedAt:state.diagnosticFinishedAt}};
}
export function reportHTML(state){
 const r=makeReport(state),esc=escapeHTML;
 return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><title>Bilan BIOS OS — ${esc(r.alias)}</title><style>body{font-family:Arial,sans-serif;max-width:860px;margin:40px auto;padding:24px;color:#172a30}h1{border-bottom:4px solid #62c6c7;padding-bottom:15px}h2{margin-top:32px;font-size:20px}section{border:1px solid #ccdadd;padding:12px 18px;margin:12px 0;break-inside:avoid}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#50646d}pre{padding:16px;background:#f0f6f8}h3{font-size:15px}</style><h1>${esc(r.alias)} · BIOS / OS / mon code</h1><p>${esc(SESSION.day)} · 13h20–16h15</p><small>${esc(r.note)}<br>Export : ${esc(r.exportedAt)}</small><h2>Mes réponses</h2>${r.answers.map(a=>`<section><h3>${esc(a.label)}</h3><p>${esc(a.value||'Non renseigné')}</p></section>`).join('')}<h2>Les manipulations</h2><pre>${esc(JSON.stringify({...r.evidence,code:undefined,codeResult:undefined},null,2))}</pre><h2>Mon code</h2><pre>${esc(r.evidence.code)}</pre><h3>Dernier résultat d’exécution</h3><pre>${esc(JSON.stringify(r.evidence.codeResult,null,2)||'Non exécuté')}</pre><p>Code actuel testé : ${r.evidence.codeTested?'oui':'non'}</p>${r.simulator?`<h2>Bonus facultatif · PC interactif</h2><p>Le bonus ne change pas le parcours obligatoire. Ce fichier ne confirme pas une réception distante.</p><pre>${esc(JSON.stringify(r.simulator.summary,null,2))}</pre><details><summary>Historique des essais</summary><pre>${esc(JSON.stringify(r.simulator.events,null,2))}</pre></details>`:""}<h2>Statut</h2><p>${r.completed} / ${r.total} écrans parcourus. Ce nombre n’est pas une note.</p></html>`;
}
