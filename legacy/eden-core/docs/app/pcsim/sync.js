/** Synchronisation opt-in. Zéro clé professeur dans le code public. API même origine uniquement. */
import {sanitizeSimulator} from './model.js';
const key=`eden-pcsim-sync:${new URL('../../',import.meta.url).pathname}`;
const clone=v=>structuredClone(v);
const uuid=()=>crypto.randomUUID();
export class SimulatorSync {
 constructor({base='./api/',onStatus=()=>{},enabled=true}={}){
  this.enabled=enabled;this.base=new URL(base,location.href);this.onStatus=onStatus;this.available=false;this.busy=false;this.timer=null;this.last=null;this.retry=2000;
  this.status='Suivi local : aucun envoi au professeur.';this.data={identity:null,pending:null,order:0,acked:{}};
  if(!enabled){this.status='Mode projection : aucun essai partagé.';return;}
  try{const d=JSON.parse(localStorage.getItem(key)||'null');if(d&&d.identity?.token&&typeof d.identity.alias==='string')this.data={identity:d.identity,pending:d.pending||null,order:Math.max(0,Number(d.order)||0),acked:d.acked||{}};}catch{/* Reste utilisable sans stockage. */}
  window.addEventListener('online',()=>this.available?this.flush():this.discover());
  this.interval=setInterval(()=>{if(document.visibilityState==='visible'){if(!this.available&&this.data.identity)this.discover();else this.flush();}},15000);
 }
 save(){try{localStorage.setItem(key,JSON.stringify(this.data));return true;}catch{return false;}}
 say(text){this.status=text;this.onStatus(text);}
 async request(path,options={}){
  if(!this.enabled)throw new Error('Partage désactivé dans ce mode.');
  if(this.base.origin!==location.origin)throw new Error('Le service de suivi doit être sur la même origine. Voir integration/API.md.');
  const r=await fetch(new URL(path,this.base),{...options,headers:{'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(25000),credentials:'same-origin'});
  const data=await r.json().catch(()=>({error:'Service de suivi indisponible.'}));if(!r.ok){const er=new Error(data.error||'Requête refusée.');er.status=r.status;throw er;}return data;
 }
 async discover(){
  if(!this.enabled)return;
  try{const c=await this.request('config');this.available=c.enabled===true;if(!this.available){this.say(c.message||'Suivi à configurer dans Vercel. Tes essais restent sur cet appareil.');return;}
   this.say(this.data.identity?'Suivi activé. Vérification des envois…':'Suivi de classe disponible. Active le partage avec le code du professeur.');this.flush();
  }catch{this.available=false;this.say('Service de suivi indisponible : travail local conservé. Réessaie ou exporte le bilan.');}
 }
 async connect(alias,classCode){
  if(!alias?.trim())throw new Error('Ouvre d’abord ta séance avec ton code élève.');
  const d=await this.request('enroll',{method:'POST',body:JSON.stringify({alias,classCode})});
  this.available=true;this.data={identity:{token:d.token,alias,studentId:d.studentId,expiresAt:d.expiresAt},pending:null,order:0,acked:{}};this.save();this.say('Suivi activé : tes essais du simulateur seront partagés.');if(this.last)this.offer(alias,this.last.simulator,this.last.coreCompleted);await this.flush();
 }
 disconnect(){this.last=null;clearTimeout(this.timer);this.data={identity:null,pending:null,order:0,acked:{}};try{localStorage.removeItem(key);}catch{}this.say('Partage désactivé sur ce navigateur. Les données déjà reçues restent côté professeur.');}
 offer(alias,simulator,coreCompleted=0){
  if(!this.enabled||!simulator)return;this.last={alias,simulator:clone(simulator),coreCompleted};
  if(!this.data.identity||this.data.identity.alias!==alias)return;
  const sanitized=sanitizeSimulator(simulator);if(!sanitized)return;
  const ack=this.data.acked[sanitized.runId]||0;sanitized.events=sanitized.events.filter(ev=>ev.seq>ack);
  this.data.order++;
  this.data.pending={packetId:uuid(),order:this.data.order,coreCompleted,simulator:sanitized};
  const saved=this.save();this.say(saved?'Essais enregistrés, synchronisation en attente…':'Envoi en attente ; stockage local indisponible. Garde cette page ouverte.');
  clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),650);
 }
 async flush(){
  if(!this.enabled||this.busy||!this.available||!this.data.identity||!this.data.pending)return;
  const packet=clone(this.data.pending),identity=this.data.identity;this.busy=true;
  try{
   const d=await this.request('events',{method:'POST',headers:{Authorization:`Bearer ${identity.token}`},body:JSON.stringify(packet)});
   if(this.data.identity?.token!==identity.token)return;
   this.data.acked[packet.simulator.runId]=Math.max(this.data.acked[packet.simulator.runId]||0,packet.simulator.seq);
   if(this.data.pending?.packetId===packet.packetId)this.data.pending=null;
   this.save();this.retry=2000;this.say(`Reçu par le serveur professeur à ${new Date(d.receivedAt).toLocaleTimeString('fr-FR')}. Ce n’est pas une validation pédagogique.`);
  }catch(error){
   if(error.status===401){this.say('Session de suivi expirée. Réactive le partage ; tes essais restent locaux.');this.data.identity=null;this.save();}
   else {if(error.status===429)this.retry=60000;this.say('Réseau ou service indisponible : essais conservés, nouvel envoi prévu.');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),this.retry);this.retry=Math.min(60000,this.retry*2);}
  }finally{this.busy=false;if(this.data.pending&&this.available&&this.data.identity&&this.retry===2000){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),1500);}}
 }
}
