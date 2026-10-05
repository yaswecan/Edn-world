/** PC pédagogique fictif. Moteur pur, sans accès au matériel ni à un système réel. */
export const SIM_VERSION = 1;
export const EVENT_LIMIT = 500;
export const PARTS = [
  {id:'board',label:'Carte mère',short:'Elle relie les composants.',slot:'plateau',icon:'board'},
  {id:'cpu',label:'CPU',short:'Il exécute les instructions. Refroidissement inclus ici.',slot:'socket',icon:'cpu'},
  {id:'ram',label:'RAM',short:'Elle garde les données en cours d’utilisation.',slot:'dimm',icon:'ram'},
  {id:'ssd',label:'SSD',short:'Il conserve le système et les fichiers.',slot:'disk',icon:'ssd'},
  {id:'psu',label:'Alimentation',short:'Elle fournit l’énergie aux composants.',slot:'powerbay',icon:'psu'},
  {id:'gpu',label:'Carte graphique',short:'Elle produit l’image. Ce CPU fictif n’a pas de graphique intégré.',slot:'pcie',icon:'gpu'},
  {id:'screen',label:'Écran',short:'Il affiche l’image ; il ne lance pas l’OS.',slot:'display',icon:'screen'},
  {id:'keyboard',label:'Clavier',short:'Il permet de saisir du texte et des commandes.',slot:'keys',icon:'keyboard'},
  {id:'mouse',label:'Souris',short:'Elle permet de pointer et de cliquer.',slot:'pointer',icon:'mouse'},
];
export const CABLES = [
  {id:'atx',label:'Énergie carte mère',short:'Alimentation → carte mère',parts:['psu','board'],from:'psu-atx',to:'board-atx',a:[125,367],b:[494,162]},
  {id:'eps',label:'Énergie CPU',short:'Alimentation → alimentation CPU sur la carte mère',parts:['psu','board','cpu'],from:'psu-cpu',to:'board-cpu',a:[130,358],b:[218,102]},
  {id:'sata-power',label:'Énergie SSD',short:'Alimentation → SSD',parts:['psu','ssd'],from:'psu-ssd',to:'ssd-power',a:[112,345],b:[111,250]},
  {id:'sata-data',label:'Données SSD',short:'SSD → carte mère',parts:['ssd','board'],from:'ssd-data',to:'board-sata',a:[151,220],b:[477,280]},
  {id:'video',label:'Image écran',short:'Carte graphique → écran',parts:['gpu','screen'],from:'gpu-video',to:'screen-video',a:[467,343],b:[650,225]},
  {id:'keyboard-usb',label:'USB clavier',short:'Clavier → carte mère',parts:['keyboard','board'],from:'keyboard-usb',to:'board-usb1',a:[692,373],b:[190,294]},
  {id:'mouse-usb',label:'USB souris',short:'Souris → carte mère',parts:['mouse','board'],from:'mouse-usb',to:'board-usb2',a:[831,361],b:[190,313]},
];
export const STAGES = [
  {id:'power',label:'POWER',short:'Énergie'},
  {id:'firmware',label:'BIOS / UEFI',short:'Firmware'},
  {id:'post',label:'POST',short:'Vérifications'},
  {id:'detect',label:'Matériel détecté',short:'CPU · RAM · SSD'},
  {id:'boot',label:'Entrée de boot',short:'Où démarrer ?'},
  {id:'loader',label:'Chargeur',short:'Lancer le noyau'},
  {id:'os',label:'OS',short:'Démarrer le système'},
  {id:'session',label:'Connexion',short:'Ouvrir la session'},
];
export const CASES = [
  {id:'ram-missing',layer:'post',title:'Mémoire',hint:'Le journal s’arrête avant la recherche d’un disque.',repair:'ram'},
  {id:'ssd-missing',layer:'boot',title:'Support de démarrage',hint:'Compare « SSD détecté » et « Entrée de démarrage ».',repair:'ssd'},
  {id:'loader-missing',layer:'loader',title:'Chargeur de démarrage',hint:'Le disque est détecté. Quel logiciel devait prendre le relais ?',repair:'restore-loader'},
  {id:'os-missing',layer:'os',title:'Système d’exploitation',hint:'Le chargeur démarre, mais ce qu’il cherche manque.',repair:'install-os'},
];
export const LAYERS = [['post','POST / mémoire'],['boot','Disque / entrée de boot'],['loader','Chargeur'],['os','Système d’exploitation']];
const partIds=PARTS.map(p=>p.id),cableIds=CABLES.map(c=>c.id);
const truthMap=(ids,value=false)=>Object.fromEntries(ids.map(id=>[id,value]));
const clone=s=>structuredClone(s);
const uid=()=>globalThis.crypto?.randomUUID?.()||`run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const txt=(v,max=600)=>typeof v==='string'?v.slice(0,max):'';
const num=(v,max=1e9)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
function shuffled(ids,seed){let x=seed>>>0||1;const a=[...ids];for(let i=a.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;const j=(x>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function createSimulator(seed=Date.now()){
  return {version:SIM_VERSION,runId:uid(),phase:'assemble',hardware:truthMap(partIds),cables:truthMap(cableIds),
    software:{loader:true,os:true},bootTarget:'ssd',power:'off',stage:-1,trace:[],lastOutcome:null,
    baseline:false,caseOrder:shuffled(CASES.map(c=>c.id),seed),caseIndex:-1,observed:false,diagnosed:false,hypothesis:'',
    repaired:false,solved:[],bootAttempts:0,errors:0,hints:0,seq:0,events:[],explanation:'',transfer:'',
    startedAt:Date.now(),updatedAt:Date.now(),completedAt:null};
}
export function bonusUnlocked(lesson,steps){return !!lesson?.alias&&steps.every(s=>lesson.completed.includes(s.id));}
export function isAssembled(s){return partIds.every(id=>s.hardware[id])&&cableIds.every(id=>s.cables[id]);}
export function nextAssembly(s){const p=PARTS.find(p=>!s.hardware[p.id]);if(p)return {type:'part',id:p.id,label:`Place ${p.id==='psu'?"l’alimentation":p.id==='screen'?"l’écran":p.id==='cpu'?'le CPU':p.id==='ssd'?'le SSD':p.id==='keyboard'?'le clavier':p.id==='mouse'?'la souris':p.id==='gpu'?'la carte graphique':p.id==='ram'?'la RAM':'la carte mère'} dans sa zone.`};const c=CABLES.find(c=>!s.cables[c.id]);if(c)return {type:'cable',id:c.id,label:`Relie : ${c.short}.`};return {type:'power',label:'Tout est relié. Appuie sur POWER.'};}
function result(code,stage,message,note=''){return {ok:code==='ok',code,stage,message,note};}
/** Le POST fait partie du firmware ; les cartes de la frise sont des repères, pas huit logiciels. */
export function bootOutcome(s){
  const h=s.hardware,c=s.cables;
  if(!h.psu||!h.board||!c.atx)return result('no-power',0,'Pas d’alimentation principale.','La recherche d’un OS n’a pas commencé.');
  if(!h.cpu||!c.eps)return result('no-cpu',1,'Le CPU n’est pas prêt.','Dans ce modèle, le firmware ne peut pas poursuivre.');
  if(!h.ram)return result('no-ram',2,'POST arrêté : aucune RAM détectée.','Pas de passage à la recherche du disque.');
  if(!h.ssd||!c['sata-power']||!c['sata-data'])return result('no-disk',4,'POST réussi. Aucun SSD système détecté.','Pas d’autre support amorçable dans ce PC fictif.');
  if(s.bootTarget!=='ssd')return result('wrong-boot',4,'USB de données sélectionnée : aucune entrée amorçable.','Le SSD système est pourtant détecté.');
  if(!s.software.loader)return result('no-loader',5,'SSD détecté. Chargeur de démarrage introuvable.','Voir un disque ne garantit pas de pouvoir démarrer dessus.');
  if(!s.software.os)return result('no-os',6,'Chargeur lancé. Fichiers du système introuvables.','Le matériel et le chargeur ont déjà passé le relais.');
  if(!h.gpu||!h.screen||!c.video)return result('no-video',7,'Le système tourne, mais aucune image n’arrive à l’écran.','Un écran noir ne prouve pas que le PC n’a pas démarré.');
  return result('ok',7,'Écran de connexion prêt.','Ouvre la session pour vérifier le résultat.');
}
export function bootPlan(s){
  const o=bootOutcome(s);const labels=[
    'L’énergie arrive sur la carte mère.', 'Le firmware commence à préparer la machine.',
    'POST : vérifications de départ, dont la mémoire.',
    `CPU présent · RAM ${s.hardware.ram?'présente':'absente'} · SSD ${s.hardware.ssd&&s.cables['sata-power']&&s.cables['sata-data']?'détecté':'non détecté'}.`,
    `Entrée choisie : ${s.bootTarget==='ssd'?'SSD système':'USB de données'}.`,
    'Le chargeur cherche le noyau du système.', 'Le noyau puis les services de l’OS démarrent.', 'Écran de connexion.'
  ];
  return STAGES.slice(0,o.stage+1).map((st,i)=>({id:st.id,index:i,status:i===o.stage&&!o.ok?'stop':'ok',message:i===o.stage?o.message:labels[i]}));
}
function record(s,type,data={}){
  s.seq++;s.updatedAt=Date.now();const ev={id:`${s.runId}:${s.seq}`,runId:s.runId,seq:s.seq,at:s.updatedAt,type,caseId:s.caseOrder[s.caseIndex]||'assembly',...data};
  s.events.push(ev);if(s.events.length>EVENT_LIMIT)s.events.shift();return ev;
}
const fail=(s,msg,code)=>{s.errors++;const event=record(s,'action-refused',{code,message:msg});return {state:s,ok:false,message:msg,event};};
export function reduceSim(input,action){
  const s=clone(input);let event,message='';const type=action?.type;
  const changed=(text,evt,detail={})=>{message=text;event=record(s,evt,detail);return {state:s,ok:true,message,event};};
  const off=()=>s.power==='off';
  if(s.phase==='complete'&&type!=='FINISH')return {state:input,ok:false,message:'Le bonus est terminé. Reviens au bilan pour conserver ta preuve.'};
  switch(type){
    case 'INSTALL':{
      const p=PARTS.find(p=>p.id===action.id);if(!p)return fail(s,'Cette pièce ne fait pas partie du banc.','unknown-part');
      if(!off())return fail(s,'Éteins le PC simulé avant de toucher aux pièces.','power-on');
      if(s.phase==='complete')return fail(s,'Le défi est terminé. Reviens au bilan.','complete');
      if(s.phase==='cases'&&!s.diagnosed)return fail(s,'Observe un démarrage et choisis la zone en cause avant de réparer.','diagnosis-first');
      if(action.slot!==p.slot)return fail(s,`${p.label} ne va pas dans cette zone. Regarde sa forme et son étiquette.`,'wrong-slot');
      if(['cpu','ram','gpu'].includes(p.id)&&!s.hardware.board)return fail(s,'Pose la carte mère avant ses composants.','board-first');
      if(s.hardware[p.id])return {state:input,ok:true,message:'Cette pièce est déjà en place.'};
      s.hardware[p.id]=true;
      if(s.phase==='cases'&&CASES.find(c=>c.id===s.caseOrder[s.caseIndex])?.repair===p.id)s.repaired=true;
      return changed(`${p.label} en place. ${p.short}`,'part-installed',{part:p.id});
    }
    case 'CONNECT':{
      const c=CABLES.find(c=>c.id===action.id);if(!c)return fail(s,'Choisis un câble du banc.','unknown-cable');
      if(!off())return fail(s,'Éteins le PC simulé avant de brancher un câble.','power-on');
      if(s.phase==='cases'&&!s.diagnosed)return fail(s,'Observe et pose ton diagnostic avant de réparer.','diagnosis-first');
      if(!c.parts.every(id=>s.hardware[id]))return fail(s,'Place les composants de cette liaison avant le câble.','missing-part');
      if(!((action.from===c.from&&action.to===c.to)||(action.from===c.to&&action.to===c.from)))return fail(s,'Ces deux ports ne correspondent pas à ce câble.','wrong-port');
      s.cables[c.id]=true;return changed(`Liaison établie : ${c.short}.`,'cable-connected',{cable:c.id});
    }
    case 'POWER':{
      if(s.power==='starting')return {state:input,ok:false,message:'Le démarrage est déjà en cours.'};
      if(s.power!=='off')return fail(s,'Éteins puis relance pour tester une nouvelle fois.','power-state');
      if(!s.baseline&&!isAssembled(s))return fail(s,nextAssembly(s).label,'assembly-incomplete');
      s.bootAttempts++;s.power='starting';s.stage=-1;s.trace=[];s.lastOutcome=null;
      return changed('Observe où le démarrage s’arrête.','boot-started');
    }
    case 'ADVANCE_BOOT':{
      if(s.power!=='starting')return {state:input,ok:false,message:'Aucun démarrage en cours.'};
      const plan=bootPlan(s),i=s.trace.length;if(i>=plan.length)return {state:input,ok:false,message:'Trace déjà complète.'};
      s.trace.push(plan[i]);s.stage=i;
      if(i===plan.length-1){
        s.lastOutcome=bootOutcome(s);s.power=s.lastOutcome.ok?'login':'stopped';
        if(!s.lastOutcome.ok&&s.phase==='cases')s.observed=true;
        return changed(s.lastOutcome.message,'boot-ended',{code:s.lastOutcome.code,stage:s.lastOutcome.stage,success:s.lastOutcome.ok});
      }
      s.updatedAt=Date.now();return {state:s,ok:true,message:plan[i].message};
    }
    case 'OFF':{
      if(s.power==='off')return {state:input,ok:true,message:'Le PC est déjà éteint.'};
      const interrupted=s.power==='starting';s.power='off';return changed('PC simulé éteint. Tu peux manipuler les pièces.',interrupted?'boot-interrupted':'power-off');
    }
    case 'OPEN_BIOS':{
      if(['off','starting'].includes(s.power)||!s.hardware.cpu||!s.hardware.ram||!s.cables.eps)return fail(s,'Le firmware doit pouvoir démarrer. Sans RAM, ce BIOS simulé ne s’ouvre pas.','bios-unavailable');
      return changed('Compare matériel détecté et entrée de démarrage.','bios-opened');
    }
    case 'BOOT_TARGET':{
      if(!['ssd','usb'].includes(action.target))return fail(s,'Entrée inconnue.','bad-target');
      if(['off','starting'].includes(s.power)||!s.hardware.ram||!s.hardware.cpu)return fail(s,'Ouvre le BIOS sur un PC qui passe ses premiers contrôles.','bios-unavailable');
      s.bootTarget=action.target;return changed('Entrée enregistrée. Éteins puis relance pour la tester.','boot-target-changed',{target:s.bootTarget});
    }
    case 'LOGIN':{
      if(s.power!=='login'||!bootOutcome(s).ok)return fail(s,'Atteins d’abord un écran de connexion fonctionnel.','not-at-login');
      if(!s.hardware.keyboard||!s.cables['keyboard-usb'])return fail(s,'Le clavier doit être connecté pour ouvrir cette session fictive.','no-keyboard');
      s.power='session';
      if(!s.baseline){s.baseline=true;return changed('PC opérationnel. Tu peux maintenant chercher les pannes.','baseline-completed');}
      if(s.phase==='cases'){
        if(!s.observed||!s.diagnosed||!s.repaired)return fail(s,'La réparation doit être précédée d’un indice et d’un diagnostic.','missing-evidence');
        const id=s.caseOrder[s.caseIndex];if(!s.solved.includes(id))s.solved.push(id);
        return changed('Réparation vérifiée : la session est accessible.','case-completed',{code:id,errors:s.errors});
      }
      return changed('La session est ouverte.','session-opened');
    }
    case 'NEXT_CASE':{
      if(!s.baseline)return fail(s,'Fais fonctionner le PC une première fois.','baseline-first');
      if(s.caseIndex>=0&&!s.solved.includes(s.caseOrder[s.caseIndex]))return fail(s,'Répare et reteste le poste actuel avant le suivant.','case-unfinished');
      if(s.caseIndex>=s.caseOrder.length-1)return {state:input,ok:true,message:'Les quatre cas sont résolus. Explique ce que tu as compris.'};
      s.phase='cases';s.caseIndex++;s.hardware=truthMap(partIds,true);s.cables=truthMap(cableIds,true);
      s.software={loader:true,os:true};s.bootTarget='ssd';s.power='off';s.stage=-1;s.trace=[];s.lastOutcome=null;s.observed=false;s.diagnosed=false;s.repaired=false;s.hypothesis='';
      const id=s.caseOrder[s.caseIndex];
      if(id==='ram-missing')s.hardware.ram=false;
      if(id==='ssd-missing')s.hardware.ssd=false; // Câbles sur le banc : restent prêts à être rebranchés.
      if(id==='loader-missing')s.software.loader=false;
      if(id==='os-missing')s.software.os=false;
      return changed(`Intervention ${s.caseIndex+1} : appuie sur POWER et observe.`,'case-started');
    }
    case 'DIAGNOSE':{
      if(s.phase!=='cases'||!s.observed)return fail(s,'Lance d’abord POWER et lis le journal.','observe-first');
      const c=CASES.find(c=>c.id===s.caseOrder[s.caseIndex]);s.hypothesis=txt(action.layer,20);
      if(!LAYERS.some(([id])=>id===action.layer))return fail(s,'Choisis une zone proposée.','unknown-layer');
      if(action.layer!==c.layer){s.errors++;return {state:s,ok:false,message:'Cette zone ne correspond pas au point d’arrêt. Compare la dernière étape réussie et le message.',event:record(s,'diagnosis-wrong',{choice:action.layer})};}
      s.diagnosed=true;return changed('Zone repérée. Choisis une réparation, puis teste-la.','diagnosis-correct',{choice:action.layer});
    }
    case 'REPAIR_SOFTWARE':{
      if(s.phase!=='cases'||!s.diagnosed)return fail(s,'Il faut d’abord observer puis identifier la zone à réparer.','diagnosis-first');
      if(s.power==='starting')return fail(s,'Attends la fin du démarrage.','busy');
      if(!['restore-loader','install-os'].includes(action.id))return fail(s,'Outil de secours inconnu.','unknown-repair');
      if(!s.hardware.ssd)return fail(s,'Sans SSD, cet outil ne peut rien écrire.','no-disk');
      const expected=CASES.find(c=>c.id===s.caseOrder[s.caseIndex]).repair;
      if(expected!==action.id)return fail(s,'Cet outil ne traite pas la zone que tu as identifiée. Rien n’a été modifié.','wrong-repair');
      if(action.id==='restore-loader')s.software.loader=true;else s.software.os=true;
      s.repaired=true;s.power='off';return changed('Secours simulé terminé. Appuie sur POWER pour vérifier.','software-repaired',{repair:action.id});
    }
    case 'HINT':s.hints++;return changed(s.phase==='cases'?(CASES.find(c=>c.id===s.caseOrder[s.caseIndex])?.hint||'Observe le journal.'):nextAssembly(s).label,'hint-used');
    case 'EXPLAIN':s.explanation=txt(action.text,600);s.updatedAt=Date.now();return {state:s,ok:true,message:''};
    case 'TRANSFER':s.transfer=['not-bootable','broken-cpu','always-ready'].includes(action.value)?action.value:'';return changed('Réponse enregistrée.','transfer-chosen',{choice:s.transfer});
    case 'FINISH':{
      if(s.solved.length!==4||s.power!=='session')return fail(s,'Répare les quatre postes et ouvre la dernière session.','cases-unfinished');
      if(s.transfer!=='not-bootable')return fail(s,'Un SSD détecté peut ne pas contenir de chargeur ou de système utilisable.','transfer-retry');
      if(s.explanation.trim().length<12)return fail(s,'Écris une phrase : un indice, ton action et ce que le test a montré.','explanation-required');
      if(s.completedAt)return {state:input,ok:true,message:'Défi déjà terminé.'};
      s.completedAt=Date.now();s.phase='complete';return changed('Défi terminé. Ton explication reste à discuter avec le professeur.','bonus-completed');
    }
    default:return {state:input,ok:false,message:'Action inconnue.'};
  }
}
export function simulatorSummary(s){
  if(!s)return null;
  return {runId:s.runId,revision:s.seq,baseline:s.baseline,solved:s.solved,caseIndex:s.caseIndex,
    attempts:s.bootAttempts,errors:s.errors,hints:s.hints,phase:s.phase,lastStop:s.lastOutcome?.code||null,
    explanation:s.explanation,transfer:s.transfer,startedAt:s.startedAt,updatedAt:s.updatedAt,completedAt:s.completedAt,
    note:'Manipulations déclarées par le navigateur ; pas une note ni une certification. Explication à valider par le professeur.'};
}
/** Borne les données importées. Une sauvegarde élève n’est pas une preuve d’identité. */
export function sanitizeSimulator(v){
  if(!v||v.version!==1||typeof v.runId!=='string')return null;
  const s=createSimulator(1);s.runId=txt(v.runId,80);s.phase=['assemble','cases','complete'].includes(v.phase)?v.phase:'assemble';
  for(const id of partIds)s.hardware[id]=v.hardware?.[id]===true;
  for(const id of cableIds)s.cables[id]=v.cables?.[id]===true;
  s.software={loader:v.software?.loader===true,os:v.software?.os===true};s.bootTarget=v.bootTarget==='usb'?'usb':'ssd';
  s.power=['off','stopped','login','session'].includes(v.power)?v.power:'off';s.stage=Math.max(-1,Math.min(7,Number.isInteger(v.stage)?v.stage:-1));
  const order=Array.isArray(v.caseOrder)?[...new Set(v.caseOrder.filter(id=>CASES.some(c=>c.id===id)))]:[];if(order.length===4)s.caseOrder=order;
  s.caseIndex=Math.max(-1,Math.min(3,Number.isInteger(v.caseIndex)?v.caseIndex:-1));
  for(const key of ['baseline','observed','diagnosed','repaired'])s[key]=v[key]===true;
  s.solved=Array.isArray(v.solved)?[...new Set(v.solved.filter(id=>s.caseOrder.includes(id)))].slice(0,4):[];
  for(const key of ['bootAttempts','errors','hints','seq','startedAt','updatedAt'])s[key]=num(v[key],key.endsWith('At')?Date.now()+60000:1000000);
  s.completedAt=v.completedAt?num(v.completedAt,Date.now()+60000):null;
  s.explanation=txt(v.explanation,600);s.transfer=txt(v.transfer,30);s.hypothesis=txt(v.hypothesis,20);
  s.trace=Array.isArray(v.trace)?v.trace.slice(0,8).filter(t=>STAGES.some(st=>st.id===t?.id)).map(t=>({id:t.id,index:num(t.index,7),status:t.status==='stop'?'stop':'ok',message:txt(t.message,300)})):[];
  s.lastOutcome=v.lastOutcome?{ok:v.lastOutcome.ok===true,code:txt(v.lastOutcome.code,32),stage:num(v.lastOutcome.stage,7),message:txt(v.lastOutcome.message,300),note:txt(v.lastOutcome.note,300)}:null;
  s.events=Array.isArray(v.events)?v.events.slice(-EVENT_LIMIT).filter(ev=>ev&&typeof ev.type==='string').map(ev=>{
    const out={id:txt(ev.id,110),runId:txt(ev.runId,80),seq:num(ev.seq,1e6),at:num(ev.at,Date.now()+60000),type:txt(ev.type,40),caseId:txt(ev.caseId,40)};
    for(const key of ['code','message','part','cable','repair','target','choice'])if(typeof ev[key]==='string')out[key]=txt(ev[key],key==='message'?300:50);
    if(typeof ev.success==='boolean')out.success=ev.success;if(Number.isInteger(ev.stage))out.stage=num(ev.stage,7);return out;
  }):[];
  return s;
}
