/* Shared Code Station exploration runtime. The host authorizes the assignment;
 * this opaque frame owns movement and effects, workers own student execution. */
(()=>{
'use strict';
const M=StationModel,$=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys={arrowup:[0,-1],w:[0,-1],z:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],q:[-1,0],arrowright:[1,0],d:[1,0]};
let port=null,game=null;
const send=message=>{if(port)port.postMessage(message);else if(parent!==window)parent.postMessage(message,'*');};
class Expedition {
 constructor(context){
  this.context=context;this.challenge=context.worlds[context.worldId].missions.find(m=>m.id===context.missionId);
  if(!this.challenge)throw Error('Mission introuvable.');
  this.def=context.exploration||M.compile({...this.challenge,world:context.worldId});
  const errors=M.validate(this.def,this.challenge);if(errors.length)throw Error(errors.join(' '));
  this.map=this.def.map;this.progress=context.progress&&typeof context.progress==='object'?context.progress:{version:8,worldProgress:{}};
  this.progress.worldProgress||={};this.wp=this.progress.worldProgress[context.worldId]||={completed:{},drafts:{},explorations:{}};
  this.wp.completed||={};this.wp.drafts||={};this.wp.explorations||={};
  const saved=this.wp.explorations[this.def.id];this.state=M.restore(this.def,saved);
  const old=this.wp.drafts[context.missionId];
  this.draft=saved?.signature===this.def.signature&&saved.files?saved.files:old?.files&&(!old.signature||old.signature===this.def.signature)?old.files:this.challenge.files;
  this.draft=Object.fromEntries(Object.entries(this.challenge.files).map(([name,code])=>[name,typeof this.draft[name]==='string'?this.draft[name]:code]));
  this.activeFile=Object.keys(this.draft)[0];this.scenario=0;this.hint=0;
  this.player={...this.state.position,vx:0,vy:0,phase:0,facing:'down'};this.held=new Set();this.path=[];this.near=null;this.modal=null;this.job=null;this.generation=0;this.dirty=false;
  this.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.abort=new AbortController();this.render();this.bind();
  this.event('mission_started',{mission:this.def.id,map:this.map.id});
  if(saved?.signature===this.def.signature){this.say('Partie reprise. '+this.objective());this.canvas.focus();}else this.briefing();
  this.last=0;this.frame=t=>{if(this.destroyed)return;const dt=this.last?Math.min(.04,(t-this.last)/1000):.016;this.last=t;this.tick(dt);this.animation=requestAnimationFrame(this.frame);};
  this.animation=requestAnimationFrame(this.frame);
  this.saver=setInterval(()=>{if(this.dirty)this.save();},1200);
 }
 event(eventType,payload={}){send({type:'eden:event',eventType,payload:{mission:this.def.id,...payload}});}
 targetStep(){return this.def.steps.find(s=>!this.state.done.includes(s.id)&&s.requires.every(id=>this.state.done.includes(id)));}
 targetObject(){const step=this.targetStep();return this.map.objects.find(o=>o.id===step?.objectId);}
 objective(){return this.state.won?'Mission accomplie.':this.targetStep()?.objective||'Rejoins le sas.';}
 render(){
  $('#app').innerHTML=`<div class="expedition"><header class="game-header"><div><span class="eyebrow">${esc(this.context.worlds[this.context.worldId].title)} · ${esc(this.map.name)}</span><h1>${esc(this.def.title)}</h1></div><button id="leaveGame">Quitter la mission</button></header><div class="world-layout"><aside class="mission-sidebar"><span class="eyebrow">ORDRE DE MISSION</span><p>${esc(this.def.brief)}</p><ol id="missionSteps">${this.def.steps.map(s=>`<li data-step="${s.id}"><span class="step-dot"></span>${esc(s.objective)}</li>`).join('')}</ol><canvas id="miniMap" width="320" height="200" aria-label="Plan des secteurs : point orange pour ta position, point doré pour l’objectif"></canvas><p class="map-legend"><i></i> Toi <b>◆</b> Prochain objectif</p><button id="briefHelp">Relire la mission</button><p class="keys-help">Flèches · ZQSD · WASD<br><kbd>E</kbd> Interagir<br>Clique sur le sol pour marcher.</p></aside><main class="play-area"><div class="objective-bar"><span id="roomName"></span><strong id="objective" aria-live="polite"></strong><div class="zoom-controls"><button id="zoomOut" aria-label="Éloigner la caméra">−</button><button id="zoomIn" aria-label="Rapprocher la caméra">+</button></div></div><canvas id="worldCanvas" tabindex="0" aria-label="Explore la carte avec les flèches. E pour interagir."></canvas><div class="world-bottom"><p id="worldMessage" role="status"></p><button id="interact" disabled><kbd>E</kbd><span>Approche-toi d’un poste</span></button></div><div class="touch-pad" aria-label="Déplacement"><button data-key="arrowup" aria-label="Aller en haut">↑</button><button data-key="arrowleft" aria-label="Aller à gauche">←</button><button data-key="arrowdown" aria-label="Aller en bas">↓</button><button data-key="arrowright" aria-label="Aller à droite">→</button></div></main></div></div><dialog id="terminal" aria-labelledby="terminalTitle"></dialog><dialog id="briefing" aria-labelledby="briefTitle"></dialog>`;
  this.canvas=$('#worldCanvas');this.renderer=new StationRenderer(this.canvas,this.map);this.updateHUD();
 }
 bind(){
  const on=(el,name,handler)=>el.addEventListener(name,handler,{signal:this.abort.signal});
  on(document,'keydown',e=>{
   if(this.modal||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
   const k=e.key.toLowerCase();if(keys[k]){e.preventDefault();this.held.add(k);this.path=[];}else if(k==='e'&&!e.repeat){e.preventDefault();this.interact();}
  });
  on(document,'keyup',e=>this.held.delete(e.key.toLowerCase()));
  on(window,'blur',()=>{this.clear();this.capture();this.save();});
  on(document,'visibilitychange',()=>{this.clear();this.last=0;if(document.hidden){this.capture();this.save();}});
  on(window,'pagehide',()=>this.destroy());
  this.resize=new ResizeObserver(()=>this.renderer.resize());this.resize.observe(this.canvas);
  on(this.canvas,'pointerdown',e=>{if(this.modal)return;this.canvas.focus();const box=this.canvas.getBoundingClientRect(),to=this.renderer.screenToWorld(e.clientX-box.left,e.clientY-box.top);if(M.walkable(this.map,to.x,to.y,this.state.opened))this.path=M.path(this.map,this.player,to,this.state.opened);});
  for(const b of document.querySelectorAll('[data-key]')){
   on(b,'pointerdown',e=>{if(this.modal)return;e.preventDefault();b.setPointerCapture(e.pointerId);this.held.add(b.dataset.key);this.path=[];});
   for(const name of ['pointerup','pointercancel','lostpointercapture'])on(b,name,()=>this.held.delete(b.dataset.key));
   on(b,'click',e=>{if(e.detail===0&&!this.modal){const [x,y]=keys[b.dataset.key];this.player={...this.player,...M.move(this.map,this.player,x*24,y*24,this.state.opened)};this.dirty=true;}});
  }
  on($('#interact'),'click',()=>this.interact());on($('#leaveGame'),'click',()=>{this.capture();this.save();send({type:'eden:close'});});
  on($('#briefHelp'),'click',()=>this.briefing());
  on($('#zoomIn'),'click',()=>{this.renderer.zoom=Math.min(2.1,this.renderer.zoom+.2);this.canvas.focus();});on($('#zoomOut'),'click',()=>{this.renderer.zoom=Math.max(.8,this.renderer.zoom-.2);this.canvas.focus();});
  on($('#terminal'),'cancel',e=>{e.preventDefault();this.closeTerminal();});
  on($('#briefing'),'cancel',e=>{e.preventDefault();this.closeBriefing();});
 }
 clear(){this.held.clear();this.path=[];this.player.vx=0;this.player.vy=0;}
 briefing(){
  this.clear();this.modal='briefing';const dialog=$('#briefing');dialog.innerHTML=`<p class="eyebrow">${esc(this.map.name)}</p><h2 id="briefTitle">${esc(this.def.title)}</h2><p>${esc(this.def.brief)}</p><p>Marche jusqu’aux postes. Ton code remet les installations en service. Active le dernier poste indiqué sur le plan pour terminer la mission.</p><p class="keys-help">Flèches / ZQSD / WASD pour bouger · E pour interagir.</p><button id="startMission" class="primary">${this.state.done.length?'Reprendre':'Commencer la mission'}</button>`;dialog.showModal();$('#startMission').onclick=()=>this.closeBriefing();
 }
 closeBriefing(){$('#briefing').close();this.modal=null;this.clear();this.canvas.focus();}
 tick(dt){
  if(!this.modal){
   let vx=0,vy=0;for(const k of this.held){const v=keys[k];if(v){vx+=v[0];vy+=v[1];}}
   const len=Math.hypot(vx,vy);if(len){vx=vx/len*235;vy=vy/len*235;this.player={...this.player,...M.move(this.map,this.player,vx*dt,vy*dt,this.state.opened)};this.dirty=true;}
   else if(this.path.length){const p=this.path[0],dx=p.x-this.player.x,dy=p.y-this.player.y,d=Math.hypot(dx,dy);if(d<3)this.path.shift();else{const step=Math.min(d,225*dt);vx=dx/d*225;vy=dy/d*225;const before=this.player;this.player={...this.player,...M.move(this.map,this.player,dx/d*step,dy/d*step,this.state.opened)};if(Math.hypot(before.x-this.player.x,before.y-this.player.y)<.01)this.path=[];this.dirty=true;}}
   this.player.vx=vx;this.player.vy=vy;if(vx||vy){this.player.phase+=dt*13;this.player.facing=Math.abs(vx)>Math.abs(vy)?vx<0?'left':'right':vy<0?'up':'down';}
  }
  this.updateNear();this.renderer.render(this,dt);this.renderer.minimap($('#miniMap'),this);
  this.canvas.dataset.x=this.player.x.toFixed(1);this.canvas.dataset.y=this.player.y.toFixed(1);
 }
 updateNear(){
  this.near=null;let best=Infinity;
  for(const o of this.map.objects){if(o.kind==='machine')continue;const distance=Math.hypot(this.player.x-o.nav.x,this.player.y-o.nav.y);if(distance<64&&distance<best&&M.sight(this.map,this.player,o.nav,this.state.opened)){best=distance;this.near=o.id;}}
  const o=this.map.objects.find(o=>o.id===this.near),button=$('#interact');button.disabled=!o||!!this.modal||this.state.won;button.querySelector('span').textContent=o?o.label:'Approche-toi d’un poste';
  const room=this.map.rooms.find(r=>M.inRect(this.player.x,this.player.y,r));$('#roomName').textContent=room?.name||'PASSERELLE';
 }
 updateHUD(){
  $('#objective').textContent=this.objective();$('#app').dataset.stage=this.state.won?'won':this.targetStep()?.id||'';
  for(const el of document.querySelectorAll('[data-step]')){el.classList.toggle('done',this.state.done.includes(el.dataset.step));el.classList.toggle('current',el.dataset.step===this.targetStep()?.id);}
 }
 say(text){$('#worldMessage').textContent=text;}
 interact(){
  if(this.modal||this.state.won)return;this.updateNear();const o=this.map.objects.find(o=>o.id===this.near);if(!o)return;
  this.clear();this.event('terminal_opened',{object:o.id});
  if(o.kind==='archive'){this.say(this.def.brief+' '+this.def.hints[1]);this.canvas.focus();return;}
  const step=this.def.steps.find(s=>s.objectId===o.id);
  if(!step)return;
  if(!step.requires.every(id=>this.state.done.includes(id))){this.say('Accès encore verrouillé : '+this.objective().toLowerCase()+'.');this.canvas.focus();return;}
  if(step.kind==='challenge'){this.openTerminal();return;}
  if(this.state.done.includes(step.id)){this.say(step.message);this.canvas.focus();return;}
  this.completeStep(step.id);if(this.state.won)this.victory();else this.canvas.focus();
 }
 completeStep(id){
  if(!M.applyEffects(this.def,this.state,id))return false;
  const step=this.def.steps.find(s=>s.id===id);this.state.won=this.state.done.includes(this.def.victory);this.say(step.message);this.event('task_completed',{step:id});
  if(this.state.won){this.wp.completed[this.context.missionId]=true;this.event('mission_completed',{files:this.draft,map:this.map.id,steps:this.state.done});}
  this.updateHUD();this.dirty=true;this.save();return true;
 }
 victory(){
  this.clear();this.modal='briefing';const dialog=$('#briefing');dialog.innerHTML=`<p class="eyebrow">INSTALLATION OPÉRATIONNELLE</p><h2 id="briefTitle">Mission accomplie</h2><p>${esc(this.def.steps.at(-1).message)}</p><p>Tu as rétabli la liaison, réparé la commande et atteint la destination finale.</p><button id="finishMission" class="primary">Retour à l’arcade</button><button id="exploreAgain">Revoir la carte</button>`;dialog.showModal();$('#finishMission').onclick=()=>{this.save();send({type:'eden:close'});};$('#exploreAgain').onclick=()=>this.closeBriefing();
 }
 capture(){const area=$('#missionCode');if(area&&this.modal==='terminal'){this.draft[this.activeFile]=area.value;this.dirty=true;}}
 cancelJob(){this.generation++;this.job?.cancel();this.job=null;this.busy=false;}
 openTerminal(){this.clear();this.modal='terminal';this.hint=0;this.renderTerminal();$('#terminal').showModal();$('#missionCode').focus();}
 closeTerminal(){this.capture();this.cancelJob();$('#terminal').close();$('#terminal').replaceChildren();this.modal=null;this.clear();this.save();this.canvas.focus();}
 renderTerminal(){
  const m=this.challenge,scenario=m.scenarios[this.scenario],isWeb=m.validator==='card',isCommand=['commandPwd','commandExact'].includes(m.validator),isAnswer=m.validator==='answerExact';
  $('#terminal').innerHTML=`<header class="terminal-header"><div><span class="eyebrow">${esc(this.map.name)} / POSTE LOCAL</span><h2 id="terminalTitle">${esc(m.title)}</h2></div><button id="closeTerminal">Retour au monde · Échap</button></header><p class="terminal-mission">Effet attendu après réparation : ${esc(this.def.steps[1].message)}</p><div class="terminal-grid"><section><p>${esc(m.brief)}</p>${isCommand?'<p class="terminal-note">Terminal du bunker · simulation locale des commandes du secteur.</p>':''}<div class="code-tabs">${Object.keys(this.draft).map(n=>`<button data-file="${esc(n)}" class="${n===this.activeFile?'active':''}">${esc(n)}</button>`).join('')}</div><label class="sr-only" for="missionCode">${isCommand?'Commande':isAnswer?'Réponse':'Ton code'} · ${esc(this.activeFile)}</label><textarea id="missionCode" spellcheck="false" autocomplete="off">${esc(this.draft[this.activeFile])}</textarea><div class="mission-actions"><button id="runCode" class="primary">Exécuter</button><button id="testScenario">Tester ce scénario</button><button id="validateMission">Vérifier et appliquer</button><button id="saveDraft">Enregistrer</button></div><div id="missionResult" role="status">${this.state.done.includes('repair')?'Installation déjà rétablie. Tu peux continuer à essayer ton code.':'Un essai ne déverrouille rien. Vérifie tous les scénarios pour appliquer ta réparation.'}</div><h3>Console</h3><pre id="codeConsole" role="log" aria-live="polite"></pre></section><aside><h3>Scénarios de contrôle</h3><div class="scenario-list">${m.scenarios.map((s,i)=>`<button data-scenario="${i}" class="${i===this.scenario?'active':''}">${esc(s.name)}</button>`).join('')}</div><h4>Entrées</h4><pre>${esc(JSON.stringify(scenario.input,null,2))}</pre><h4>Résultat attendu</h4><pre>${esc(JSON.stringify(scenario.expected,null,2))}</pre>${isWeb?'<h3>Rendu de la carte</h3><div id="webPreview"></div>':''}<button id="showHint">Afficher un indice</button><p id="hintText" aria-live="polite"></p><p class="terminal-note">${esc(m.skill||'')} · Les fichiers restent disponibles après ton retour dans la carte.</p></aside></div>`;
  $('#closeTerminal').onclick=()=>this.closeTerminal();$('#saveDraft').onclick=()=>{this.capture();this.save();$('#missionResult').textContent='Enregistrement demandé.';};
  for(const b of document.querySelectorAll('[data-file]'))b.onclick=()=>{this.capture();this.cancelJob();this.activeFile=b.dataset.file;this.renderTerminal();$('#missionCode').focus();};
  for(const b of document.querySelectorAll('[data-scenario]'))b.onclick=()=>{this.capture();this.cancelJob();this.scenario=Number(b.dataset.scenario);this.renderTerminal();};
  $('#missionCode').oninput=()=>{this.capture();this.cancelJob();this.setBusy(false);};
  $('#missionCode').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const area=e.currentTarget;area.setRangeText('  ',area.selectionStart,area.selectionEnd,'end');area.dispatchEvent(new Event('input'));}};
  $('#runCode').onclick=()=>this.attempt('run');$('#testScenario').onclick=()=>this.attempt('test');$('#validateMission').onclick=()=>this.attempt('validate');
  $('#showHint').onclick=()=>{const index=Math.min(this.hint++,this.def.hints.length-1);$('#hintText').textContent=this.def.hints[index];this.event('hint_used',{index});};
  if(isWeb)this.layoutPreview(false);
 }
 setBusy(busy){this.busy=busy;for(const s of ['#runCode','#testScenario','#validateMission'])if($(s))$(s).disabled=busy;}
 layoutPreview(check,width=390){
  const frame=document.createElement('iframe');frame.title='Aperçu HTML et CSS';frame.sandbox='allow-scripts';frame.style.width=width+'px';frame.style.maxWidth='100%';frame.height='300';
  frame.srcdoc='<!doctype html><html lang="fr"><meta charset="utf-8"><script src="/game/layout-frame.js"></script></html>';
  const slot=$('#webPreview');if(!slot)return {promise:Promise.resolve({pass:false,message:'Aperçu absent.'}),cancel(){}};
  const token=this.generation+':'+Math.random();let done=false,timer,receive,finish;
  const promise=new Promise(resolve=>{finish=r=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',receive);resolve(r);};receive=e=>{if(e.source!==frame.contentWindow)return;if(e.data?.type==='layout-ready')frame.contentWindow.postMessage({type:'layout',files:this.draft,token},'*');if(e.data?.type==='layout-result'&&e.data.token===token)finish({pass:e.data.pass===true,message:e.data.message});};window.addEventListener('message',receive);timer=setTimeout(()=>finish({pass:false,message:'Le rendu HTML n’a pas répondu.'}),2500);});
  slot.replaceChildren(frame);const job={promise,cancel(){finish({pass:false,cancelled:true,message:'Aperçu interrompu.'});frame.remove();}};if(!check){this.job?.cancel();this.job=job;}return job;
 }
 async attempt(mode){
  if(this.busy||this.modal!=='terminal')return;this.capture();this.cancelJob();this.setBusy(true);const epoch=this.generation,files=JSON.stringify(this.draft);$('#codeConsole').textContent='';$('#missionResult').textContent=mode==='validate'?'Vérification des scénarios…':'Exécution…';
  const log=text=>{if(epoch===this.generation&&$('#codeConsole'))$('#codeConsole').append(document.createTextNode(text+'\n'));};
  let all=true;const messages=[];const indices=mode==='validate'?this.challenge.scenarios.map((_,i)=>i):[this.scenario];
  for(const index of indices){
   this.event(mode==='run'?'code_run':'test_run',{index});
   this.job=this.challenge.validator==='card'?this.layoutPreview(true):StationChallenge.start(this.challenge,JSON.parse(files),index,log);
   const r=await this.job.promise;if(epoch!==this.generation||this.modal!=='terminal'||r.cancelled)return;
   if(JSON.stringify(this.draft)!==files){this.setBusy(false);return;}
   all=all&&r.pass;messages.push(`${this.challenge.scenarios[index].name} : ${mode==='run'?r.message:r.pass?'OK':r.message}`);
   if(mode==='run'&&Object.hasOwn(r,'value'))log('Résultat retourné : '+(JSON.stringify(r.value)??'undefined'));
   if(mode!=='run')this.event(r.pass?'test_passed':'test_failed',{index});
  }
  this.job=null;this.setBusy(false);$('#missionResult').textContent=messages.join('\n');
  if(mode==='validate'&&all){this.completeStep('repair');$('#missionResult').textContent+='\n'+this.def.steps[1].message;}
  this.save();
 }
 save(){
  if(this.destroyed)return;this.state.position={x:this.player.x,y:this.player.y};
  this.wp.explorations[this.def.id]={...this.state,files:this.draft};
  this.wp.drafts[this.context.missionId]={files:this.draft,signature:this.def.signature,activeFile:this.activeFile,scenario:this.scenario};
  this.progress.lastWorld=this.context.worldId;send({type:'eden:progress',progress:this.progress});this.dirty=false;
 }
 destroy(){if(this.destroyed)return;this.capture();this.save();this.destroyed=true;this.cancelJob();this.abort.abort();this.resize.disconnect();clearInterval(this.saver);cancelAnimationFrame(this.animation);}
}
function init(context){if(context?.type!=='eden:init'||game)return;try{game=new Expedition(context);}catch(e){$('#app').innerHTML=`<section class="unavailable"><h1>Mission indisponible</h1><p>${esc(e.message)}</p><p>Reviens à la séance et signale cette mission au professeur.</p><button id="closeUnavailable">Retour</button></section>`;$('#closeUnavailable').onclick=()=>send({type:'eden:close'});}}
function receive(data){if(data?.type==='eden:flush'&&game){game.capture();game.save();send({type:'eden:flushed'});}else init(data);}
addEventListener('message',e=>{if(e.source!==parent||port)return;if(e.data?.type==='eden:connect'&&e.ports.length===1&&!game){port=e.ports[0];port.onmessage=e=>receive(e.data);port.start();}else receive(e.data);});
if(parent===window)$('#app').innerHTML='<section class="unavailable"><h1>Code Station</h1><p>Ouvre ta mission depuis l’arcade ou ta séance pour retrouver ta sauvegarde.</p><a href="/arcade">Ouvrir l’arcade</a></section>';
else parent.postMessage({type:'eden:ready'},'*');
})();
