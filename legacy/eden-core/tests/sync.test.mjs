import test from 'node:test';
import assert from 'node:assert/strict';
import {SimulatorSync} from '../docs/app/pcsim/sync.js';
import {createSimulator,reduceSim} from '../docs/app/pcsim/model.js';

function setup(t,{enabled=true,base='./api/'}={}) {
 const store=new Map(),requests=[];
 const old={location:globalThis.location,window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
 globalThis.location={href:'https://school.example/cours/index.html',origin:'https://school.example'};
 globalThis.window={addEventListener(){}};
 globalThis.document={visibilityState:'hidden'};
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 globalThis.fetch=async(url,opt)=>{requests.push({url:String(url),...opt});return reply(200,{enabled:true});};
 const statuses=[],sync=new SimulatorSync({enabled,base,onStatus:v=>statuses.push(v)});
 t.after(()=>{clearInterval(sync.interval);clearTimeout(sync.timer);for(const [k,v]of Object.entries(old))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
 return {sync,store,requests,statuses};
}
const reply=(status,d)=>({ok:status>=200&&status<300,status,json:async()=>d});
const sample=()=>reduceSim(createSimulator(7),{type:'HINT'}).state;
function enrolled(sync){sync.available=true;sync.data.identity={alias:'A17',token:'learner-secret',studentId:'123'};}

test('suivi : sans opt-in, aucune tentative réseau après une action',async t=>{
 const {sync,requests}=setup(t);sync.offer('A17',sample(),36);await sync.flush();assert.equal(requests.length,0);assert.equal(sync.data.pending,null);
});
test('projection : pas de reprise ni de transmission du suivi',async t=>{
 const {sync,requests,store}=setup(t,{enabled:false});sync.offer('A17',sample(),36);await sync.discover();await sync.flush();assert.equal(requests.length,0);assert.equal(sync.interval,undefined);assert.equal(store.size,0);await assert.rejects(sync.connect('A17','code'),/désactivé/);
});
test('suivi : API d’une autre origine explicitement refusée',async t=>{
 const {sync,requests}=setup(t,{base:'https://other.example/api/'});await assert.rejects(sync.connect('A17','code'),/même origine/);assert.equal(requests.length,0);
});
test('suivi : inscription et premier reçu après réponse API',async t=>{
 const {sync,statuses}=setup(t);let eventsBody;
 globalThis.fetch=async(url,opt)=>String(url).endsWith('enroll')?reply(201,{token:'secret',studentId:'1',expiresAt:Date.now()+10000}):(eventsBody=JSON.parse(opt.body),reply(200,{receivedAt:new Date().toISOString()}));
 sync.offer('A17',sample(),36);await sync.connect('A17','classe');assert.equal(eventsBody.coreCompleted,36);assert.equal(sync.data.pending,null);assert(statuses.at(-1).startsWith('Reçu par le serveur'));
});
test('suivi : code de classe refusé ne crée pas de session',async t=>{
 const {sync}=setup(t);globalThis.fetch=async()=>reply(403,{error:'Code incorrect'});await assert.rejects(sync.connect('A17','x'),/incorrect/);assert.equal(sync.data.identity,null);
});
test('suivi : un autre code élève ne peut pas utiliser le jeton courant',async t=>{
 const {sync,requests}=setup(t);enrolled(sync);sync.offer('B18',sample(),36);await sync.flush();assert.equal(requests.length,0);assert.equal(sync.data.pending,null);
});
test('suivi : une coupure conserve le paquet, puis l’API l’acquitte',async t=>{
 const {sync,store}=setup(t);enrolled(sync);sync.offer('A17',sample(),36);globalThis.fetch=async()=>{throw new Error('offline');};await sync.flush();assert(sync.data.pending);assert([...store.values()][0].includes('pending'));assert(!sync.status.startsWith('Reçu'));
 globalThis.fetch=async()=>reply(200,{receivedAt:new Date().toISOString()});await sync.flush();assert.equal(sync.data.pending,null);assert(sync.status.startsWith('Reçu'));
});
test('suivi : pas de confirmation avant réception effective',async t=>{
 const {sync}=setup(t);enrolled(sync);sync.offer('A17',sample(),36);let resolve;
 globalThis.fetch=()=>new Promise(r=>resolve=r);const flight=sync.flush();assert(!sync.status.startsWith('Reçu'));resolve(reply(200,{receivedAt:new Date().toISOString()}));await flight;assert(sync.status.startsWith('Reçu'));
});
test('suivi : les nouveaux essais ne sont pas effacés par le reçu précédent',async t=>{
 const {sync}=setup(t);enrolled(sync);let s=sample();sync.offer('A17',s,36);const first=sync.data.pending.order;let resolve;
 globalThis.fetch=()=>new Promise(r=>resolve=r);const flight=sync.flush();s=reduceSim(s,{type:'HINT'}).state;sync.offer('A17',s,36);resolve(reply(200,{receivedAt:new Date().toISOString()}));await flight;assert(sync.data.pending.order>first);assert.equal(sync.data.pending.simulator.hints,2);
});
test('suivi : les événements déjà reçus sont filtrés du prochain paquet',async t=>{
 const {sync}=setup(t);enrolled(sync);let s=sample();globalThis.fetch=async()=>reply(200,{receivedAt:new Date().toISOString()});sync.offer('A17',s,36);await sync.flush();s=reduceSim(s,{type:'HINT'}).state;sync.offer('A17',s,36);assert.equal(sync.data.pending.simulator.events.length,1);assert.equal(sync.data.pending.simulator.events[0].seq,2);
});
test('suivi : session expirée indiquée sans faux succès',async t=>{
 const {sync}=setup(t);enrolled(sync);sync.offer('A17',sample(),36);globalThis.fetch=async()=>reply(401,{error:'Session expirée'});await sync.flush();assert.equal(sync.data.identity,null);assert(sync.data.pending);assert(sync.status.includes('expirée'));
});
test('suivi : déconnexion efface le jeton et les essais en file sur ce navigateur',async t=>{
 const {sync,store}=setup(t);enrolled(sync);sync.offer('A17',sample(),36);assert(sync.last);sync.disconnect();assert.equal(sync.data.identity,null);assert.equal(sync.data.pending,null);assert.equal(sync.last,null);assert.equal(store.size,0);
});
