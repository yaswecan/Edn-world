/* Two original, small playable front-end demos. These are NOT the production games.
   Scores are local UI state, never an authoritative leaderboard. */
'use strict';
window.ArcadeGames=(()=>{
 const W=960,H=600;
 let scene=null,raf=0,previousTime=0,keys=new Set(),lastConfig=null,lastId=null;
 const $=s=>document.querySelector(s);
 const icon=id=>`<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const inRect=(x,y,r)=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h;
 function rect(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
 function label(ctx,text,x,y,size=12,color='#aac4d6',align='left'){ctx.font=`600 ${size}px "Courier New",monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,Math.round(x),Math.round(y));ctx.textAlign='left';}
 function glow(ctx,color,blur,draw){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur;draw();ctx.restore();}
 function character(ctx,x,y,color,time=0,facing=1,moving=false){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(facing,1);
  const bounce=moving?Math.sin(time*15)*1.5:0;ctx.translate(0,bounce);
  rect(ctx,-12,13,24,7,'#080d1880');
  rect(ctx,-8,-18,17,5,'#171325');rect(ctx,-11,-13,22,15,'#322639');
  rect(ctx,-8,-13,17,10,'#ffd4ac');rect(ctx,-8,-17,17,7,'#253445');
  rect(ctx,-4,-10,14,5,'#73eafa');rect(ctx,1,-10,6,2,'#eefcff');
  rect(ctx,-9,0,19,16,color);rect(ctx,-5,2,11,6,'#1d3547');rect(ctx,-12,2,4,10,'#151c2e');rect(ctx,10,2,4,10,color);
  rect(ctx,-8,16,6,6,'#28394c');rect(ctx,3,16,6,6,'#28394c');
  if(moving){rect(ctx,-9,20+(Math.sin(time*15)>0?2:0),7,3,'#7b91aa');rect(ctx,3,20+(Math.sin(time*15)>0?0:2),7,3,'#7b91aa');}
  else{rect(ctx,-9,20,7,3,'#7b91aa');rect(ctx,3,20,7,3,'#7b91aa');}
  ctx.restore();
 }
 function stars(ctx,time=0){for(let i=0;i<60;i++){const x=(i*167+41)%W,y=(i*83+19)%H;rect(ctx,x,y,i%7===0?2:1,i%7===0?2:1,i%5===0?'#7766a1':'#2d355a');}}
 function progressHtml(done,total){return `<div class="mission-progress"><span>OBJECTIF</span><strong>${done} / ${total}</strong></div><div class="progress-track"><span style="width:${done/total*100}%"></span></div>`;}
 function winPanel(s){s.config.panel.innerHTML=`<div class="mission-win">${icon('trophy')}<p class="eyebrow">MISSION ACCOMPLIE</p><h3>${s.id==='code-station'?'SIGNAL RÉTABLI.':'LA VILLE EST À TOI.'}</h3><p>${s.id==='code-station'?'Les terminaux sont réparés. Le sas est ouvert, l’équipage peut continuer sa route.':'Les cinq fragments sont à l’abri. Tu as trouvé ton chemin à travers Neo Eden.'}</p><p style="color:#edd08a;margin-top:15px">200 XP de démo pour la première réussite.</p><button class="button primary" data-action="close-game">Retour à l’arcade ${icon('arrow')}</button><button class="button" data-action="restart-game">Rejouer</button></div>`;}
 function finish(s){if(s.won)return;s.won=true;s.config.sound(880);winPanel(s);s.config.onComplete();}
 const stationTerminals=[
  {x:174,y:150,name:'OXYGÈNE',topic:'VARIABLES',question:'Fixe la réserve d’oxygène à 100.',options:['const oxygene = 100;','const 100 = oxygene;','oxygene === const 100;'],answer:0,hint:'On écrit le nom de la variable, puis le signe =, puis sa valeur.'},
  {x:786,y:152,name:'ÉNERGIE',topic:'CONDITIONS',question:'Le moteur démarre si l’énergie est au moins égale à 80. Quelle condition choisir ?',options:['energie < 80','energie >= 80','energie === 0'],answer:1,hint:'« Au moins » inclut l’égalité. Cherche le symbole supérieur ou égal.'},
  {x:772,y:440,name:'TRANSMISSION',topic:'BOUCLES',question:'Envoie exactement trois impulsions. Quelle boucle choisir ?',options:['for (let i = 0; i <= 3; i++)','for (let i = 3; i < 0; i++)','for (let i = 0; i < 3; i++)'],answer:2,hint:'En commençant à 0, les trois tours correspondent à i = 0, 1 et 2.'}
 ];
 const stationWalls=[{x:322,y:132,w:45,h:186},{x:555,y:281,w:48,h:184},{x:406,y:387,w:86,h:48}];
 function stationNear(s){let best=-1,dist=110;s.terminals.forEach((t,i)=>{if(t.done)return;const d=Math.hypot(t.x-s.player.x,t.y-s.player.y);if(d<dist){dist=d;best=i;}});return best;}
 function stationPanel(s){
  if(s.won){winPanel(s);return;}
  if(s.question!==null){const t=s.terminals[s.question];s.config.panel.innerHTML=`<p class="eyebrow">TERMINAL ${s.question+1} / ${t.topic}</p><h3>${t.name}</h3><p class="terminal-question">${t.question}</p>${t.options.map((x,i)=>`<button class="terminal-option" data-station-choice="${i}"><code>${x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></button>`).join('')}<p class="terminal-feedback" id="terminal-feedback" role="status"></p><button class="button small" data-station-back>Revenir à la station</button>`;return;}
  const done=s.terminals.filter(t=>t.done).length,near=stationNear(s);s.lastNear=near;
  s.config.panel.innerHTML=`<p class="eyebrow">PONT 01 — PROTOCOLE HÉLIX</p><h3>${done===3?'REJOINS LE SAS.':'RÉTABLIS LE SIGNAL.'}</h3><p>${done===3?'Les trois systèmes répondent. Rejoins le sas lumineux, au centre du mur du haut.':'Trois terminaux ne répondent plus. Approche-toi de chacun et trouve la bonne instruction.'}</p>${progressHtml(done,3)}<div class="mission-tip"><strong>${near>=0?'Terminal à portée':'À toi de bouger'}</strong><p>${near>=0?'Appuie sur E ou sur le bouton ci-dessous pour inspecter le terminal.':'Déplace-toi avec les flèches ou ZQSD. Les terminaux portent les numéros 1, 2 et 3.'}</p></div>${done<3?`<button class="button cyan mission-action" data-station-interact ${near<0?'disabled':''}>${icon('terminal')} Inspecter le terminal</button>`:''}`;
 }
 function stationInteract(s){if(s.won||s.paused||s.question!==null)return;const near=stationNear(s);if(near>=0){s.question=near;keys.clear();stationPanel(s);s.config.sound(520);}}
 function stationUpdate(s,dt){if(s.won||s.question!==null)return;let dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);s.moving=Boolean(dx||dy);if(dx||dy){const n=Math.hypot(dx,dy);dx=dx/n*180*dt;dy=dy/n*180*dt;const valid=(x,y)=>x>=96&&x<=864&&y>=99&&y<=500&&!stationWalls.some(w=>inRect(x,y,{x:w.x-13,y:w.y-18,w:w.w+26,h:w.h+36}));if(valid(s.player.x+dx,s.player.y))s.player.x+=dx;if(valid(s.player.x,s.player.y+dy))s.player.y+=dy;if(dx)s.facing=dx<0?-1:1;}
  const near=stationNear(s);if(near!==s.lastNear)stationPanel(s);
  if(s.terminals.every(t=>t.done)&&Math.hypot(s.player.x-477,s.player.y-107)<39)finish(s);
 }
 function stationDraw(s,time){const ctx=s.ctx;rect(ctx,0,0,W,H,'#080f1e');stars(ctx);
  glow(ctx,'#3ed6f0',15,()=>rect(ctx,72,74,816,462,'#10243a'));rect(ctx,79,81,802,448,'#17243a');
  for(let y=86;y<514;y+=36)for(let x=84;x<874;x+=36){rect(ctx,x,y,34,34,((x+y)/36)%2>.8?'#142033':'#18253a');rect(ctx,x,y,34,1,'#22354a');}
  rect(ctx,82,89,792,3,'#43637a');rect(ctx,82,515,792,3,'#43637a');rect(ctx,82,89,3,429,'#33516e');rect(ctx,871,89,3,429,'#33516e');
  for(let x=111;x<875;x+=82){glow(ctx,'#40cae6',8,()=>rect(ctx,x,77,36,3,'#73def0'));glow(ctx,'#ff5477',8,()=>rect(ctx,x,531,36,3,'#ff7395'));}
  // Wall-bounded machinery creates readable routes through the deck.
  stationWalls.forEach((r,i)=>{rect(ctx,r.x-4,r.y-4,r.w+8,r.h+8,'#080f1d');rect(ctx,r.x,r.y,r.w,r.h,'#263349');rect(ctx,r.x+4,r.y+4,r.w-8,r.h-8,'#141d2d');for(let y=r.y+10;y<r.y+r.h-5;y+=15)rect(ctx,r.x+8,y,r.w-16,3,'#334459');glow(ctx,'#7898e1',5,()=>rect(ctx,r.x,r.y,2,r.h,'#537b9e'));});
  // Non-interactive props stay visibly different from numbered terminals.
  rect(ctx,190,354,85,36,'#0b1825');rect(ctx,195,359,75,25,'#273b4a');rect(ctx,204,367,25,8,'#476875');rect(ctx,238,364,20,15,'#304658');
  const all=s.terminals.every(t=>t.done);glow(ctx,all?'#65efc0':'#556b8b',all?18:0,()=>{rect(ctx,438,65,80,44,'#0b1b2b');rect(ctx,443,71,70,30,all?'#2c736a':'#273850');rect(ctx,476,71,3,30,all?'#c1fff1':'#596e8a');});label(ctx,all?'SAS OUVERT':'SAS VERROUILLÉ',477,54,11,all?'#a0ffe0':'#768ba6','center');
  s.terminals.forEach((t,i)=>{const near=s.lastNear===i&&s.question===null,color=t.done?'#6bf1bd':'#ff5f94';rect(ctx,t.x-23,t.y-25,46,50,'#070e1c');rect(ctx,t.x-20,t.y-23,40,30,'#3a4661');glow(ctx,color,near?18:6,()=>rect(ctx,t.x-16,t.y-19,32,22,t.done?'#19483f':'#402235'));label(ctx,t.done?'OK':String(i+1),t.x,t.y-3,16,color,'center');rect(ctx,t.x-21,t.y+11,42,11,'#314258');rect(ctx,t.x-14,t.y+13,21,3,'#7392a7');rect(ctx,t.x+13,t.y+13,4,4,color);label(ctx,t.name,t.x,t.y+41,10,t.done?'#70c9b5':'#7997b3','center');if(near&&!s.paused){glow(ctx,'#65e9ff',5,()=>{ctx.strokeStyle='#65e9ff';ctx.lineWidth=1;ctx.strokeRect(t.x-32,t.y-33,64,65);});label(ctx,'[E] INSPECTER',t.x,t.y-47,11,'#d2f5ff','center');}});
  label(ctx,'CODE // STATION',100,562,13,'#668bac');label(ctx,'HÉLIX — PONT 01',857,562,11,'#668bac','right');
  character(ctx,s.player.x,s.player.y,'#5fd3e6',time,s.facing,s.moving&&s.question===null&&!s.paused);
  if(s.question!==null){rect(ctx,0,0,W,H,'#08112588');label(ctx,'TERMINAL OUVERT',480,285,27,'#d9f4ff','center');label(ctx,'Choisis une instruction dans le panneau de mission.',480,320,13,'#98bed1','center');}
  if(s.won){rect(ctx,0,0,W,H,'#071524bb');label(ctx,'SIGNAL RÉTABLI',480,281,42,'#76edc3','center');label(ctx,'L’équipage te remercie.',480,321,17,'#b8d7e2','center');}
 }
 const platforms=[{x:0,y:469,w:380},{x:425,y:436,w:218},{x:689,y:393,w:208},{x:941,y:438,w:282},{x:1265,y:397,w:202},{x:1507,y:443,w:238},{x:1787,y:402,w:221},{x:2051,y:442,w:409}];
 const fragmentPositions=[{x:245,y:424},{x:780,y:346},{x:1387,y:351},{x:1894,y:356},{x:2227,y:395}];
 function cyberPanel(s){if(s.won){winPanel(s);return;}const done=s.fragments.filter(f=>f.done).length;s.config.panel.innerHTML=`<p class="eyebrow">DISTRICT 01 — NEON RUN</p><h3>${done===5?'LE DERNIER SAUT.':'PRENDS DE LA HAUTEUR.'}</h3><p>${done===5?'Les fragments sont réunis. Rejoins le portail rose, tout à droite.':'Récupère cinq fragments de données sur les toits, puis rejoins le portail.'}</p>${progressHtml(done,5)}<div class="mission-tip"><strong>Garde ton élan</strong><p>Flèches gauche et droite pour courir. Espace pour sauter. Tu peux sauter plus loin en gardant une direction appuyée.</p><p style="margin-top:12px">Une chute ? Tu repars du dernier toit. Tes fragments restent acquis.</p></div><button class="button mission-action" data-cyber-jump>${icon('bolt')} Sauter</button>`;}
 function jump(s){if(s.id!=='cyber-funk'||s.paused||s.won)return;if(s.player.grounded){s.player.vy=-450;s.player.grounded=false;s.config.sound(430);}}
 function cyberUpdate(s,dt){if(s.won)return;const p=s.player;let dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0);s.moving=dx!==0;if(dx)s.facing=dx<0?-1:1;p.x=clamp(p.x+dx*235*dt,24,2400);const oldFeet=p.y+23;p.vy+=1130*dt;p.y+=p.vy*dt;p.grounded=false;
  for(let i=0;i<platforms.length;i++){const a=platforms[i];if(p.vy>=0&&p.x+9>a.x&&p.x-9<a.x+a.w&&oldFeet<=a.y+3&&p.y+23>=a.y){p.y=a.y-23;p.vy=0;p.grounded=true;s.checkpoint=i;break;}}
  if(p.y>670){const a=platforms[s.checkpoint];p.x=a.x+Math.min(85,a.w/2);p.y=a.y-60;p.vy=0;s.config.sound(155);}
  s.camera=clamp(p.x-300,0,1500);
  for(const f of s.fragments){if(!f.done&&Math.hypot(f.x-p.x,f.y-p.y)<35){f.done=true;cyberPanel(s);s.config.sound(690);}}
  if(s.fragments.every(f=>f.done)&&Math.abs(p.x-2343)<40&&p.grounded)finish(s);
 }
 function cyberDraw(s,time){const ctx=s.ctx;const reduced=document.body.classList.contains('reduce-motion');const t=reduced?0:time;const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#090f22');bg.addColorStop(.7,'#251631');bg.addColorStop(1,'#140e24');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);stars(ctx);ctx.save();ctx.globalAlpha=.32;glow(ctx,'#f07bac',30,()=>{ctx.fillStyle='#bfa5c7';ctx.beginPath();ctx.arc(740-s.camera*.06,113,44,0,Math.PI*2);ctx.fill();});ctx.restore();
  for(let layer=0;layer<2;layer++){const factor=layer === 0 ? .12 : .28;for(let i=0;i<26;i++){const x=i*74-((s.camera*factor)%74)-60,y=185+((i*37+layer*71)%140),height=H-y;rect(ctx,x,y,61,height,layer===0?'#111a32':'#15233b');rect(ctx,x+8,y-12,44,12,layer===0?'#111a32':'#18253d');for(let wy=y+15;wy<height+y;wy+=18)for(let wx=x+7;wx<x+57;wx+=13){if((Math.floor(wx)+wy+i)%5!==0)rect(ctx,wx,wy,4,6,(i+wy)%3===0?'#a43c6448':'#47a1c347');}if(i%4===0&&layer===1){rect(ctx,x+42,y+17,15,58,'#812449');label(ctx,'E',x+49,y+33,12,'#ff9bce','center');label(ctx,'D',x+49,y+50,12,'#ff9bce','center');label(ctx,'N',x+49,y+67,12,'#ff9bce','center');}}}
  for(let i=0;i<3;i++){const x=((t*(i%2?22:-17)+i*331+10000)%1120)-80;rect(ctx,x,92+i*68,21,5,'#17283f');rect(ctx,x+3,90+i*68,12,3,'#2b4056');rect(ctx,x+21,95+i*68,7,1,'#72ecff');}
  ctx.save();ctx.translate(-Math.round(s.camera),0);
  platforms.forEach((p,i)=>{rect(ctx,p.x,p.y,p.w,H-p.y+20,'#121725');rect(ctx,p.x,p.y,p.w,8,'#425168');rect(ctx,p.x,p.y+8,p.w,7,'#171b2a');glow(ctx,i%2?'#e970be':'#53d9ef',8,()=>rect(ctx,p.x+6,p.y+3,p.w-12,2,i%2?'#ed68af':'#55c9e4'));for(let x=p.x+20;x<p.x+p.w-15;x+=38)rect(ctx,x,p.y+32,15,29,i%2?'#482947':'#233449');rect(ctx,p.x+9,p.y-13,6,13,'#29354b');rect(ctx,p.x+p.w-14,p.y-13,6,13,'#29354b');if(i===0){rect(ctx,35,p.y-65,97,39,'#351629');glow(ctx,'#f377b3',8,()=>label(ctx,'NEO EDEN',83,p.y-40,14,'#ff8ec0','center'));rect(ctx,43,p.y-26,4,26,'#3b314a');}});
  s.fragments.forEach((f,i)=>{if(f.done)return;const y=f.y+(reduced?0:Math.sin(t*2+i)*4);glow(ctx,'#5df4ff',18,()=>{ctx.fillStyle='#65dfee';ctx.beginPath();ctx.moveTo(f.x,y-12);ctx.lineTo(f.x+9,y);ctx.lineTo(f.x,y+12);ctx.lineTo(f.x-9,y);ctx.fill();});rect(ctx,f.x-2,y-5,4,9,'#e7feff');label(ctx,String(i+1),f.x,y-24,10,'#90afc7','center');});
  const ready=s.fragments.every(f=>f.done);glow(ctx,'#ff70b3',ready?26:7,()=>{rect(ctx,2319,352,47,90,'#653353');rect(ctx,2324,357,37,85,ready?'#ca57996b':'#301933');rect(ctx,2328,361,29,77,ready?'#ed81dc80':'#452d41');});label(ctx,ready?'PORTAIL OUVERT':'PORTAIL',2343,339,11,ready?'#ffc1e9':'#b976a0','center');
  character(ctx,s.player.x,s.player.y,'#ec609a',time,s.facing,s.moving&&s.player.grounded&&!s.paused);ctx.restore();
  rect(ctx,22,22,222,45,'#0c1020dd');rect(ctx,22,22,3,45,'#ff66a1');label(ctx,'FRAGMENTS',39,42,10,'#9c89ae');label(ctx,`${s.fragments.filter(f=>f.done).length} / 5`,229,54,22,'#75e7ec','right');label(ctx,'CYBER FUNK 3026',W-27,44,13,'#d46ba2','right');
  if(s.won){rect(ctx,0,0,W,H,'#160d26bb');label(ctx,'NEON RUN — TERMINÉ',480,282,39,'#ff93d0','center');label(ctx,'Tous les fragments sont à l’abri.',480,321,15,'#debadf','center');}
 }
 function makeScene(id,config){const base={id,config,ctx:config.canvas.getContext('2d'),paused:false,won:false,moving:false,facing:1,clock:0};if(!base.ctx)throw new Error('Canvas 2D indisponible.');
  if(id==='code-station')return {...base,player:{x:177,y:244},terminals:stationTerminals.map(t=>({...t,done:false})),question:null,lastNear:-2};
  return {...base,player:{x:155,y:390,vy:0,grounded:false},fragments:fragmentPositions.map(f=>({...f,done:false})),camera:0,checkpoint:0};
 }
 function loop(now){if(!scene)return;const dt=Math.min((now-previousTime)/1000,.034)||.016;previousTime=now;if(!scene.paused){scene.clock+=dt;if(scene.id==='code-station')stationUpdate(scene,dt);else cyberUpdate(scene,dt);}if(scene.id==='code-station')stationDraw(scene,scene.clock);else cyberDraw(scene,scene.clock);raf=requestAnimationFrame(loop);}
 function stop(){cancelAnimationFrame(raf);raf=0;keys.clear();scene=null;}
 function start(id,config){stop();lastConfig=config;lastId=id;scene=makeScene(id,config);scene.ctx.imageSmoothingEnabled=false;if(id==='code-station')stationPanel(scene);else cyberPanel(scene);previousTime=performance.now();config.onPause(false);raf=requestAnimationFrame(loop);}
 function restart(){if(lastConfig&&lastId)start(lastId,lastConfig);}
 function pause(){if(!scene||scene.paused||scene.won)return;scene.paused=true;keys.clear();scene.config.onPause(true);}
 function resume(){if(!scene)return;scene.paused=false;keys.clear();scene.config.onPause(false);previousTime=performance.now();}
 function normalize(e){const k=e.key.toLowerCase();if(['arrowleft','q','a'].includes(k))return 'ArrowLeft';if(['arrowright','d'].includes(k))return 'ArrowRight';if(['arrowup','z','w'].includes(k))return 'ArrowUp';if(['arrowdown','s'].includes(k))return 'ArrowDown';return e.key;}
 function act(){if(!scene)return;if(scene.id==='code-station')stationInteract(scene);else jump(scene);}
 document.addEventListener('keydown',e=>{if(!scene||e.target.closest('input,textarea,select,[contenteditable=true]'))return;const k=normalize(e);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','e','E','p','P','r','R'].includes(k)){e.preventDefault();if(k.toLowerCase()==='p'&&!e.repeat){scene.paused?resume():pause();return;}if(k.toLowerCase()==='r'&&!e.repeat){restart();return;}if(scene.paused)return;if((k===' '||k.toLowerCase()==='e')&&!e.repeat){act();return;}keys.add(k);}});
 document.addEventListener('keyup',e=>keys.delete(normalize(e)));
 document.addEventListener('click',e=>{if(!scene)return;const el=e.target.closest('[data-station-choice],[data-station-back],[data-station-interact],[data-cyber-jump]');if(!el)return;
  if(el.hasAttribute('data-station-interact')){stationInteract(scene);return;}
  if(el.hasAttribute('data-cyber-jump')){jump(scene);return;}
  if(el.hasAttribute('data-station-back')){scene.question=null;stationPanel(scene);$('#game-canvas').focus();return;}
  if(el.hasAttribute('data-station-choice')&&scene.question!==null){const t=scene.terminals[scene.question];if(Number(el.dataset.stationChoice)===t.answer){t.done=true;scene.question=null;scene.config.sound(784);stationPanel(scene);$('#game-canvas').focus();}else{const f=$('#terminal-feedback');f.textContent=t.hint;scene.config.sound(160);}}
 });
 document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-key]');if(!b||!scene)return;e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch{}if(b.dataset.key==='action')act();else keys.add(b.dataset.key);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>{const b=e.target.closest('[data-key]');if(b)keys.delete(b.dataset.key);});
 return Object.freeze({start,stop,restart,pause,resume});
})();
