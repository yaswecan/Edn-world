import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulator,reduceSim,PARTS,CABLES,CASES,STAGES,bootOutcome,bootPlan,isAssembled,nextAssembly,bonusUnlocked,sanitizeSimulator,simulatorSummary,EVENT_LIMIT} from '../docs/app/pcsim/model.js';
import {createState,parseState,makeReport,reportHTML} from '../docs/app/model.js';
import {STEPS} from '../docs/app/content.js';
export function act(s,a){return reduceSim(s,a).state;}
export function assembly(){let s=createSimulator(7);for(const p of PARTS)s=act(s,{type:'INSTALL',id:p.id,slot:p.slot});for(const c of CABLES)s=act(s,{type:'CONNECT',id:c.id,from:c.from,to:c.to});return s;}
export function boot(s){s=act(s,{type:'POWER'});for(let i=0;i<8&&s.power==='starting';i++)s=act(s,{type:'ADVANCE_BOOT'});return s;}
export function baseline(){return act(boot(assembly()),{type:'LOGIN'});}
export function repair(s){
 s=boot(s);const c=CASES.find(c=>c.id===s.caseOrder[s.caseIndex]);s=act(s,{type:'DIAGNOSE',layer:c.layer});
 if(['ram','ssd'].includes(c.repair)){s=act(s,{type:'OFF'});const p=PARTS.find(p=>p.id===c.repair);s=act(s,{type:'INSTALL',id:p.id,slot:p.slot});}
 else s=act(s,{type:'REPAIR_SOFTWARE',id:c.repair});
 return act(boot(s),{type:'LOGIN'});
}
test('bonus séparé : parcours obligatoire toujours 36 écrans',()=>{assert.equal(STEPS.length,36);assert(!STEPS.some(s=>s.id==='bonus-pc'));});
test('bonus verrouillé avant la fin du ticket et bilan',()=>{const s=createState('Alex');assert(!bonusUnlocked(s,STEPS));s.maxVisited=35;assert(!bonusUnlocked(s,STEPS));s.completed=STEPS.map(x=>x.id);assert(bonusUnlocked(s,STEPS));s.completed=s.completed.filter(id=>id!=='ticket-3');assert(!bonusUnlocked(s,STEPS));});
test('PC vide : une action principale, la carte mère',()=>{const s=createSimulator(1);assert.equal(nextAssembly(s).id,'board');assert(!isAssembled(s));});
test('pas de POWER initial avant les pièces et les liaisons',()=>{const s=reduceSim(createSimulator(),{type:'POWER'});assert(!s.ok);assert.equal(s.state.bootAttempts,0);});
test('CPU refuse un socket sans carte mère',()=>{const r=reduceSim(createSimulator(),{type:'INSTALL',id:'cpu',slot:'socket'});assert(!r.ok);assert(!r.state.hardware.cpu);});
test('mauvaise zone : aucune installation et erreur enregistrée',()=>{const s=createSimulator();const r=reduceSim(s,{type:'INSTALL',id:'board',slot:'dimm'});assert(!r.ok);assert.equal(s.errors,0);assert.equal(r.state.errors,1);assert(!r.state.hardware.board);});
test('câbles refusés sans leurs composants',()=>{const r=reduceSim(createSimulator(),{type:'CONNECT',id:'atx',from:'psu-atx',to:'board-atx'});assert(!r.ok);});
test('câble inversé accepté, mauvais port refusé',()=>{let s=assembly();s.cables.atx=false;const c=CABLES[0];assert(reduceSim(s,{type:'CONNECT',id:c.id,from:c.to,to:c.from}).ok);assert(!reduceSim(s,{type:'CONNECT',id:c.id,from:'wrong',to:c.to}).ok);});
test('9 pièces et 7 liaisons : PC prêt',()=>{const s=assembly();assert(isAssembled(s));assert.equal(nextAssembly(s).type,'power');});
test('chaîne complète en 8 repères pédagogiques',()=>{const s=boot(assembly());assert.equal(s.power,'login');assert.equal(s.trace.length,8);assert.deepEqual(s.trace.map(t=>t.id),STAGES.map(t=>t.id));assert(s.lastOutcome.ok);});
test('connexion nécessaire à la première validation',()=>{let s=boot(assembly());assert(!s.baseline);s=act(s,{type:'LOGIN'});assert(s.baseline);assert.equal(s.power,'session');});
test('un double POWER pendant animation ne duplique pas les essais',()=>{let s=act(assembly(),{type:'POWER'});s=act(s,{type:'POWER'});assert.equal(s.bootAttempts,1);});
test('hardware intouchable sous tension',()=>{let s=boot(assembly());s.hardware.ram=false;const r=reduceSim(s,{type:'INSTALL',id:'ram',slot:'dimm'});assert(!r.ok);});
test('sans RAM : arrêt au POST, avant recherche du disque',()=>{const s=assembly();s.hardware.ram=false;assert.equal(bootOutcome(s).stage,2);assert.equal(bootOutcome(s).code,'no-ram');assert(!bootPlan(s).some(st=>st.id==='boot'));});
test('sans SSD : le POST réussit, pas de disque amorçable',()=>{const s=assembly();s.hardware.ssd=false;const plan=bootPlan(s);assert.equal(plan.find(p=>p.id==='post').status,'ok');assert.equal(plan.at(-1).id,'boot');assert.equal(bootOutcome(s).code,'no-disk');});
test('sans chargeur : disque vu, arrêt chargeur',()=>{const s=assembly();s.software.loader=false;assert.equal(bootOutcome(s).code,'no-loader');assert.equal(bootOutcome(s).stage,5);});
test('sans OS : chargeur exécuté, système manquant',()=>{const s=assembly();s.software.os=false;assert.equal(bootPlan(s).find(p=>p.id==='loader').status,'ok');assert.equal(bootOutcome(s).code,'no-os');});
test('mauvaise entrée boot : distincte du disque absent',()=>{const s=assembly();s.bootTarget='usb';assert.equal(bootOutcome(s).code,'wrong-boot');assert(s.hardware.ssd);});
test('écran absent : système peut fonctionner sans image',()=>{const s=assembly();s.hardware.screen=false;assert.equal(bootOutcome(s).code,'no-video');assert.equal(bootPlan(s).find(p=>p.id==='os').status,'ok');});
test('sans CPU : pas de recherche OS',()=>{const s=assembly();s.hardware.cpu=false;assert.equal(bootOutcome(s).code,'no-cpu');assert.equal(bootPlan(s).length,2);});
test('sans alimentation : pas de firmware',()=>{const s=assembly();s.cables.atx=false;assert.equal(bootOutcome(s).code,'no-power');});
test('clavier absent ne bloque pas le POST mais la connexion fictive',()=>{let s=baseline();s.power='off';s.hardware.keyboard=false;s=boot(s);assert.equal(s.power,'login');assert(!reduceSim(s,{type:'LOGIN'}).ok);});
test('BIOS fermé sans RAM',()=>{let s=assembly();s.hardware.ram=false;s.power='stopped';assert(!reduceSim(s,{type:'OPEN_BIOS'}).ok);});
test('BIOS disponible sans SSD : détecter n’est pas démarrer',()=>{let s=assembly();s.hardware.ssd=false;s.power='stopped';assert(reduceSim(s,{type:'OPEN_BIOS'}).ok);});
test('changer entrée BIOS ne restaure pas un OS',()=>{let s=baseline();s.software.os=false;s=act(s,{type:'BOOT_TARGET',target:'ssd'});assert(!s.software.os);});
test('quatre pannes uniques dans un ordre stable à la reprise',()=>{const s=createSimulator(44);assert.equal(new Set(s.caseOrder).size,4);assert.deepEqual(s.caseOrder,sanitizeSimulator(s).caseOrder);});
test('les scénarios ne commencent pas avant un PC fonctionnel',()=>assert(!reduceSim(assembly(),{type:'NEXT_CASE'}).ok));
test('POWER autorisé en diagnostic malgré une pièce manquante',()=>{let s=baseline();s.caseOrder=['ram-missing','ssd-missing','loader-missing','os-missing'];s=act(s,{type:'NEXT_CASE'});assert(!isAssembled(s));assert(reduceSim(s,{type:'POWER'}).ok);});
test('diagnostic avant observation refusé',()=>{let s=act(baseline(),{type:'NEXT_CASE'});assert(!reduceSim(s,{type:'DIAGNOSE',layer:'post'}).ok);});
test('mauvaise hypothèse tracée, pas de réparation débloquée',()=>{let s=act(baseline(),{type:'NEXT_CASE'});s=boot(s);const right=CASES.find(c=>c.id===s.caseOrder[s.caseIndex]).layer;const wrong=right==='post'?'os':'post';const r=reduceSim(s,{type:'DIAGNOSE',layer:wrong});assert(!r.ok);assert(!r.state.diagnosed);assert.equal(r.state.events.at(-1).type,'diagnosis-wrong');});
test('réparation matérielle refusée sans diagnostic',()=>{let s=act(baseline(),{type:'NEXT_CASE'});s.power='off';assert(!reduceSim(s,{type:'INSTALL',id:'ram',slot:'dimm'}).ok);});
test('restaurer le chargeur ne réinstalle pas l’OS',()=>{let s=baseline();s.caseOrder=['os-missing','ram-missing','ssd-missing','loader-missing'];s=boot(act(s,{type:'NEXT_CASE'}));s=act(s,{type:'DIAGNOSE',layer:'os'});const r=reduceSim(s,{type:'REPAIR_SOFTWARE',id:'restore-loader'});assert(!r.ok);assert(!r.state.software.os);});
test('changer de panne est interdit avant réparation retestée',()=>{let s=act(baseline(),{type:'NEXT_CASE'});assert(!reduceSim(s,{type:'NEXT_CASE'}).ok);});
for(const c of CASES)test(`diagnostic complet : ${c.id}`,()=>{let s=baseline();s.caseOrder=[c.id,...CASES.filter(x=>x.id!==c.id).map(x=>x.id)];s=act(s,{type:'NEXT_CASE'});s=repair(s);assert.equal(s.power,'session');assert.deepEqual(s.solved,[c.id]);assert(s.events.some(e=>e.type==='diagnosis-correct'));assert(s.events.some(e=>e.type==='case-completed'));});
test('explication et transfert requis après quatre pannes',()=>{let s=baseline();for(let i=0;i<4;i++)s=repair(act(s,{type:'NEXT_CASE'}));assert(!reduceSim(s,{type:'FINISH'}).ok);s=act(s,{type:'TRANSFER',value:'not-bootable'});assert(!reduceSim(s,{type:'FINISH'}).ok);s=act(s,{type:'EXPLAIN',text:'J’ai vu le chargeur absent, je l’ai restauré puis j’ai ouvert la session.'});const r=reduceSim(s,{type:'FINISH'});assert(r.ok);assert(r.state.completedAt);assert.equal(r.state.phase,'complete');});
test('interruption animation persistée sans faux succès',()=>{let s=act(assembly(),{type:'POWER'});s=act(s,{type:'ADVANCE_BOOT'});const restored=sanitizeSimulator(s);assert.equal(restored.power,'off');assert(!restored.baseline);});
test('événements bornés, compteurs conservés',()=>{let s=createSimulator();for(let i=0;i<550;i++)s=act(s,{type:'HINT'});assert.equal(s.events.length,EVENT_LIMIT);assert.equal(s.hints,550);assert.equal(s.seq,550);});
test('import du bonus borné et champs inconnus ignorés',()=>{const s=assembly();s.extra='script';s.events=[{id:'x',type:'x',runId:s.runId,seq:-9,at:0,message:'x'.repeat(1000),html:'<script>'}];s.explanation='x'.repeat(1000);const n=sanitizeSimulator(s);assert.equal(n.extra,undefined);assert.equal(n.events[0].html,undefined);assert.equal(n.events[0].message.length,300);assert.equal(n.explanation.length,600);});
test('ancienne sauvegarde de cours sans simulateur toujours lisible',()=>{const s=createState('Alex');delete s.simulator;assert.equal(parseState(JSON.stringify(s)).simulator,null);});
test('sauvegarde et bilan incluent le bonus sans secrets de suivi',()=>{const s=createState('Alex');s.simulator=baseline();const parsed=parseState(JSON.stringify(s));assert(parsed.simulator.baseline);assert(makeReport(parsed).simulator);const html=reportHTML(parsed);assert(html.includes('Bonus facultatif'));assert(!html.includes('Bearer'));});
test('explication hostile reste échappée dans le rapport HTML',()=>{const s=createState('Alex');s.simulator=baseline();s.simulator.explanation='<script>alert(1)</script>';const html=reportHTML(s);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));});
test('le résumé ne prétend pas être une note',()=>{assert(simulatorSummary(baseline()).note.includes('pas une note'));});
test('bonus terminé : les manipulations sont figées',()=>{const s=baseline();s.phase='complete';s.completedAt=Date.now();assert(!reduceSim(s,{type:'BOOT_TARGET',target:'usb'}).ok);assert.equal(reduceSim(s,{type:'OFF'}).state.power,'session');});
