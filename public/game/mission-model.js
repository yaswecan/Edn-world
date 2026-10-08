/* Shared, deterministic mission data and navigation. Loaded as a classic script
 * in the opaque game frame and imported by the server for the same validation.
 * Collision sampling and four-pixel movement steps derive from Code Station V6
 * (legacy/pedagolab/public/legacy/code-station-v6.html, CS.Nav / Game.move).
 */
globalThis.StationModel = (() => {
  const rect = (x,y,w,h) => ({x,y,w,h});
  const room = (id,name,x,y,w,h,color='#83ebbc') => ({id,name,x,y,w,h,color,floor:'#95aebb'});
  const object = (id,label,x,y,kind='terminal') => ({id,label,x,y,kind,nav:{x,y:y+58},color:'#83ebbc'});
  const door = (id,x,y,w,h) => ({id,x,y,w,h});
  const referenceRooms = [
    {...room('engine','ATELIER MOTEURS',300,130,340,320,'#5ddbf1'),gap:[420,520],side:'bottom'},
    {...room('sequence','LABO SÉQUENCE',740,130,340,320,'#b7a1fc'),gap:[860,960],side:'bottom'},
    {...room('debug','DIAGNOSTIC',1180,130,340,320,'#ffbd7c'),gap:[1300,1400],side:'bottom'},
    {...room('battery','SALLE ÉNERGIE',320,630,380,270),gap:[450,570],side:'top'},
    {...room('archive','ARCHIVES',1080,630,390,270,'#77bede'),gap:[1215,1335],side:'top'}
  ];
  const reference = {
    id:'station-deck-01',name:'Pont de propulsion',width:1920,height:1080,reference:true,spawn:{x:810,y:549},
    rooms:referenceRooms,
    floors:[rect(133,467,1559,146),...referenceRooms.flatMap(r=>[rect(r.x+19,r.y+22,r.w-38,r.h-42),rect(r.gap[0]+12,(r.side==='bottom'?r.y+r.h:r.y)-47,r.gap[1]-r.gap[0]-24,96)])],
    scenery:[rect(326,190,60,157),rect(562,203,46,134),rect(770,204,49,117),rect(1000,204,47,117),rect(1300,185,114,102),rect(1212,192,52,90),rect(1450,196,42,130),rect(353,698,79,64),rect(353,800,79,64),rect(553,735,94,58),rect(1219,730,112,91),rect(1109,725,58,100),rect(1390,710,49,110),rect(650,485,62,64),rect(1520,531,62,58)],
    objects:[object('relay','Relais de diagnostic',910,282,'relay'),object('workstation','Commande énergie',511,745),object('archive','Archives du pont',1189,691,'archive'),object('machine','Propulsion',1350,346,'machine'),object('exit','Sas de transit',1634,482,'exit')],
    doors:[door('access',462,630,96,22),door('extraction',1575,467,22,146)]
  };
  const maps = {
    'code-station':reference,
    bunker:{id:'bunker-services',name:'Bunker des services',width:1560,height:1080,spawn:{x:210,y:830},
      rooms:[room('entry','ACCÈS SOUTERRAIN',90,650,400,280),room('power','LOCAL TECHNIQUE',90,140,400,290,'#e9bc74'),room('control','SALLE DES SERVICES',660,140,360,290),room('exit-room','SAS DE SURFACE',1080,650,360,280)],
      floors:[rect(110,670,360,240),rect(110,160,360,250),rect(230,400,120,300),rect(460,260,230,110),rect(680,160,320,250),rect(820,380,130,420),rect(900,740,230,100),rect(1100,670,320,240)],
      scenery:[rect(360,180,65,130),rect(720,180,65,80),rect(1300,680,70,80),rect(300,740,90,60)],
      objects:[object('relay','Disjoncteur ventilation',200,220,'relay'),object('workstation','Console des services',860,210),object('archive','Plan des conduites',200,690,'archive'),object('machine','Ventilation',940,340,'machine'),object('exit','Remontée en surface',1250,770,'exit')],
      doors:[door('access',530,260,24,110),door('extraction',1030,740,24,100)]},
    rocket:{id:'rocket-launch',name:'Base de lancement',width:1560,height:1080,spawn:{x:230,y:835},
      rooms:[room('cargo','BAIE DE PRÉPARATION',90,660,440,270,'#ffbd7c'),room('telemetry','TÉLÉMÉTRIE',90,170,440,300,'#b7a1fc'),room('command','COMMANDE DE VOL',830,170,480,300),room('launch','PAS DE TIR',880,660,440,270,'#ffbd7c')],
      floors:[rect(110,680,400,230),rect(240,420,120,290),rect(110,190,400,260),rect(480,290,400,120),rect(850,190,440,260),rect(1110,410,120,300),rect(900,680,400,230)],
      scenery:[rect(365,710,90,70),rect(390,205,55,150),rect(915,200,80,90),rect(940,690,90,85)],
      objects:[object('relay','Liaison télémétrie',260,255,'relay'),object('workstation','Ordinateur de vol',1090,275),object('archive','Protocole de vol',190,720,'archive'),object('machine','Propulseur',1160,780,'machine'),object('exit','Autorisation de décollage',1100,820,'exit')],
      doors:[door('access',720,290,24,120),door('extraction',1110,560,120,24)]},
    infiltration:{id:'infiltration-trace',name:'Réseau de surveillance',width:1640,height:1080,spawn:{x:200,y:530},
      rooms:[room('entry','POINT D’OBSERVATION',90,370,390,300,'#b7a1fc'),room('relay-room','RELAIS RÉSEAU',590,120,400,290),room('audit','ARCHIVES D’INCIDENT',590,650,400,290,'#77bede'),room('control','POSTE DE CONFINEMENT',1170,370,360,300,'#ffbd7c')],
      floors:[rect(110,390,350,260),rect(410,440,270,120),rect(610,350,130,390),rect(610,140,360,250),rect(610,670,360,250),rect(940,240,210,110),rect(1070,240,140,320),rect(1185,390,325,260),rect(940,740,420,100),rect(1250,610,110,170)],
      scenery:[rect(280,410,90,80),rect(815,170,80,110),rect(810,700,90,85),rect(1390,400,70,100)],
      objects:[object('relay','Isolateur réseau',700,225,'relay'),object('workstation','Analyse des traces',720,750),object('archive','Journal de situation',200,410,'archive'),object('machine','Réseau isolé',900,305,'machine'),object('exit','Sceller l’incident',1320,510,'exit')],
      doors:[door('access',610,590,130,24),door('extraction',1070,360,140,24),door('back-extraction',1090,740,24,100)]},
    assault:{id:'assault-recovery',name:'Secteur des drones',width:1760,height:1080,spawn:{x:200,y:550},
      rooms:[room('entry','ACCÈS ENDOMMAGÉ',80,350,360,330,'#ffbd7c'),room('energy','RELAIS D’ÉNERGIE',500,120,360,300),room('central','POSTE CENTRAL',1030,120,470,300,'#b7a1fc'),room('bay','BAIE DES DRONES',1030,650,560,300,'#77bede')],
      floors:[rect(100,370,320,290),rect(400,500,820,130),rect(610,360,130,180),rect(520,140,320,260),rect(1170,350,130,340),rect(1050,140,430,260),rect(1050,670,520,260)],
      scenery:[rect(245,420,85,105),rect(515,560,64,48),rect(735,170,60,140),rect(1080,190,70,110),rect(1340,190,85,110),rect(1360,750,120,80)],
      objects:[object('relay','Rétablir le relais',650,230,'relay'),object('workstation','Commande des drones',1220,235),object('archive','Ordre de mission',190,390,'archive'),object('machine','Escouade de secours',1200,700,'machine'),object('exit','Sécuriser le secteur',1480,830,'exit')],
      doors:[door('access',1170,420,130,24),door('extraction',1170,638,130,24)]}
  };
  // Each exercise keeps its original skill and validator. Physical effects are
  // controlled vocabulary, never generated code or commands in the parent app.
  const tasks = {
    battery:['Rétablir la réserve du sas','La réserve alimente de nouveau le sas.','Réserve disponible','Lis la valeur attendue, puis retourne la réserve configurée.'],
    motors:['Relancer les modules de propulsion','Les modules tournent. Le sas de transit est alimenté.','Modules actifs','Parcours les indices de 0 à nombreModules − 1, y compris quand il vaut 0.'],
    card:['Réparer le badge du sas','Badge lisible. Le lecteur autorise le passage.','Lecteur actif','Le titre NOVA, l’identité, le rôle et deux actions visibles sont nécessaires.'],
    stationFinal:['Remettre la propulsion en service','Réparation confirmée. La propulsion est disponible.','Propulsion active','batteryOk : réserve ≥ 80 ; cooled : températures > 70 ; modules : indices de 0 à modules − 1.'],
    commandPwd:['Localiser la console du bunker','Position confirmée. Le chemin de surface est balisé.','Itinéraire repéré','pwd affiche le dossier courant du terminal.'],
    commandExact:['Diagnostiquer les services du bunker','Diagnostic transmis. Le sas de surface est disponible.','Diagnostic reçu','Utilise la commande demandée dans le protocole affiché.'],
    healthcheck:['Réparer la surveillance du bunker','Les incidents sont repérés. Le passage de secours est ouvert.','Surveillance active','Retourne les noms des services dont online vaut false.'],
    distance:['Calibrer la trajectoire','Trajectoire calibrée. L’accès au pas de tir est ouvert.','Trajectoire calculée','Calcule la racine carrée de dx² + dy², même pour des coordonnées négatives.'],
    returnArray:['Rétablir la séquence de lancement','Séquence chargée. Le pas de tir est accessible.','Séquence prête','Le protocole est : cooling, pressure, ignition, release.'],
    countdown:['Synchroniser le compte à rebours','Compte à rebours synchronisé. La commande de décollage est prête.','Horloge synchronisée','Pars de from, descends jusqu’à 0 inclus et retourne la liste.'],
    rocketFinal:['Préparer le contrôleur de lancement','Contrôleur opérationnel. Rejoins le pas de tir.','Lancement autorisé','distance : √(dx²+dy²) ; passedChecks : nombre de true ; ready : tous les checks sont vrais.'],
    answerExact:['Identifier la trace HTTP','Trace identifiée. Le poste de confinement est accessible.','Trace identifiée','Une ressource absente est signalée par le code HTTP 404.'],
    errors:['Retrouver les erreurs du réseau','Erreurs isolées. Le poste de confinement est accessible.','Erreurs repérées','Garde les événements dont level vaut ERROR, sans modifier leur ordre.'],
    suspicious:['Détecter les sessions suspectes','Règle de détection active. Le confinement est prêt.','Détection active','La règle demande au moins 5 échecs ET un appareil inconnu.'],
    incidentFinal:['Reconstituer l’incident','Rapport transmis. Rejoins le poste de confinement.','Rapport transmis','Compte les ERROR et liste les id des sessions avec failed ≥ 5 et knownDevice faux.'],
    activeCount:['Recenser les drones de secours','Inventaire synchronisé. Les drones actifs s’allument dans la baie.','Drones recensés','Compte uniquement les éléments dont active vaut true.'],
    droneAction:['Rétablir la recharge des drones','Bornes de recharge actives. La baie est accessible.','Recharge active','Retourne RECHARGE si battery < 40, sinon READY.'],
    formation:['Organiser la sortie des drones','Les drones prennent position. La baie est ouverte.','Formation prête','Ignore les inactifs ; les slots des actifs commencent à 0 sans trou.'],
    assaultFinal:['Reprendre le secteur des drones','Contrôleur rétabli. Les drones rejoignent leurs postes. Sécurise la baie.','Secteur sous contrôle','Classe les id : inactifs dans ignore, actifs à moins de 40 dans recharge, autres dans deploy.']
  };
  const fnSpec = {
    stationFinal:['repair.js','repair',s=>[s]],healthcheck:['healthcheck.js','healthcheck',s=>[s.services]],distance:['distance.js','distance',s=>[s.dx,s.dy]],countdown:['countdown.js','countdown',s=>[s.from]],rocketFinal:['launch.js','launchReport',s=>[s.data]],errors:['logs.js','errors',s=>[s.events]],suspicious:['anomaly.js','suspicious',s=>[s.s]],incidentFinal:['incident.js','incidentReport',s=>[s.events,s.sessions]],activeCount:['drones.js','activeCount',s=>[s.drones]],droneAction:['energy.js','action',s=>[s.drone]],formation:['formation.js','formation',s=>[s.drones]],assaultFinal:['controller.js','controller',s=>[s.drones]]
  };
  const signature = value => {let n=2166136261;for(const c of JSON.stringify(value))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16);};
  const inRect=(x,y,r)=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
  function walkable(map,x,y,opened=[],radius=12) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    const rr=radius*.707;
    if(![[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius],[rr,rr],[-rr,rr],[rr,-rr],[-rr,-rr]].every(([a,b])=>map.floors.some(r=>inRect(x+a,y+b,r))))return false;
    const obstacles=[...map.scenery,...map.objects.filter(o=>o.kind!=='exit').map(o=>rect(o.x-34,o.y-27,68,57)),...map.doors.filter(d=>!opened.includes(d.id))];
    return !obstacles.some(o=>{const nx=Math.max(o.x,Math.min(x,o.x+o.w)),ny=Math.max(o.y,Math.min(y,o.y+o.h));return (x-nx)**2+(y-ny)**2<radius**2;});
  }
  function move(map,p,dx,dy,opened=[]) {
    const out={...p},n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
    for(let i=0;i<n;i++){if(walkable(map,out.x+dx/n,out.y,opened))out.x+=dx/n;if(walkable(map,out.x,out.y+dy/n,opened))out.y+=dy/n;}return out;
  }
  function sight(map,a,b,opened=[]) {
    const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/4);
    for(let i=0;i<=n;i++)if(!walkable(map,a.x+(b.x-a.x)*i/(n||1),a.y+(b.y-a.y)*i/(n||1),opened,2))return false;
    return true;
  }
  function path(map,from,to,opened=[]) {
    const cell=20,cols=Math.ceil(map.width/cell),rows=Math.ceil(map.height/cell),point=id=>({x:(id%cols)*cell+10,y:Math.floor(id/cols)*cell+10});
    const nearest=p=>{const candidates=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const xx=Math.floor(p.x/cell)+x,yy=Math.floor(p.y/cell)+y;if(xx<0||yy<0||xx>=cols||yy>=rows)continue;const id=yy*cols+xx,q=point(id);if(walkable(map,q.x,q.y,opened,18)&&sight(map,p,q,opened))candidates.push({id,d:Math.hypot(p.x-q.x,p.y-q.y)});}return candidates.sort((a,b)=>a.d-b.d)[0]?.id;};
    const start=nearest(from),end=nearest(to);if(start===undefined||end===undefined)return [];
    const parents=new Map([[start,null]]),queue=[start];
    for(let at=0;at<queue.length&&!parents.has(end);at++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const id=queue[at],x=id%cols+dx,y=Math.floor(id/cols)+dy,next=y*cols+x;if(x<0||y<0||x>=cols||y>=rows||parents.has(next))continue;const p=point(next);if(walkable(map,p.x,p.y,opened,18)&&sight(map,point(id),p,opened)){parents.set(next,id);queue.push(next);}
    }
    if(!parents.has(end))return [];const route=[{...to}];for(let id=end;id!==null;id=parents.get(id))route.push(point(id));return route.reverse();
  }
  function applyEffects(def,state,stepId) {
    const step=def.steps.find(s=>s.id===stepId);if(!step||state.done.includes(stepId)||!step.requires.every(id=>state.done.includes(id)))return false;
    for(const effect of step.effects){if(effect.type==='openDoor'&&!state.opened.includes(effect.target))state.opened.push(effect.target);if(effect.type==='activateObject'&&!state.active.includes(effect.target))state.active.push(effect.target);}
    state.done.push(step.id);return true;
  }
  function validate(def,challenge) {
    const errors=[],map=def?.map;
    if(!map||!Object.values(maps).some(m=>m.id===map.id))return ['Carte inconnue.'];
    if(!tasks[challenge?.validator]||!Array.isArray(challenge.scenarios)||!challenge.scenarios.length||challenge.scenarios.length>30||!challenge.files||!Object.values(challenge.files).every(v=>typeof v==='string'))errors.push('Challenge ou outil incompatible.');
    if(challenge?.scenarios?.some(s=>!s||typeof s.name!=='string'||!s.input||typeof s.input!=='object'||!Object.hasOwn(s,'expected')))errors.push('Scénario incomplet.');
    const file=fnSpec[challenge?.validator]?.[0]||({battery:'battery.js',motors:'motors.js',returnArray:'sequence.js',card:'index.html'})[challenge?.validator];
    if(file&&typeof challenge.files?.[file]!=='string'||challenge?.validator==='card'&&typeof challenge.files?.['style.css']!=='string')errors.push('Fichier de challenge absent.');
    const ids=def.steps?.map(s=>s.id)||[];if(new Set(ids).size!==ids.length||!ids.includes(def.victory))errors.push('Étapes ou victoire invalides.');
    if(new Set(map.objects.map(o=>o.id)).size!==map.objects.length||new Set(map.doors.map(d=>d.id)).size!==map.doors.length)errors.push('Identifiants dupliqués.');
    if(!walkable(map,map.spawn.x,map.spawn.y))errors.push('Départ inaccessible.');
    const state={done:[],opened:[],active:[]};let position=map.spawn;
    for(let n=0;n<ids.length;n++){
      const step=def.steps.find(s=>!state.done.includes(s.id)&&s.requires.every(id=>state.done.includes(id)));
      if(!step){errors.push('Dépendance circulaire ou absente.');break;}
      const o=map.objects.find(o=>o.id===step.objectId);
      if(!o)errors.push('Objet absent : '+step.objectId);
      else if(!path(map,position,o.nav,state.opened).length)errors.push('Objet inaccessible : '+o.id);
      if(step.kind==='challenge'&&step.challengeId!==def.challengeId)errors.push('Challenge absent.');
      for(const e of step.effects){const collection=e.type==='openDoor'?map.doors:e.type==='activateObject'?map.objects:[];if(!collection.some(o=>o.id===e.target))errors.push('Effet ou cible invalide.');}
      applyEffects(def,state,step.id);if(o)position=o.nav;
    }
    if(!state.done.includes(def.victory))errors.push('Victoire inaccessible.');
    return errors;
  }
  function compile(challenge) {
    if(!maps[challenge.world]||!tasks[challenge.validator])throw Error('Cette mission ne dispose pas d’une carte compatible.');
    const map=JSON.parse(JSON.stringify(maps[challenge.world])),task=tasks[challenge.validator];
    const challengeId=challenge.sourceId||challenge.id;
    const finish={'code-station':'rejoins le sas de transit',bunker:'rejoins le sas de surface',rocket:'rejoins le pas de tir pour autoriser le décollage',infiltration:'rejoins le poste de confinement pour sceller l’incident',assault:'rejoins la baie des drones pour sécuriser le secteur'}[challenge.world];
    const def={version:1,id:challengeId,challengeId,map,title:task[0],brief:`${map.name}. ${task[0]}. Rétablis le relais local, répare la commande à la console, puis ${finish}.`,hints:['Repère le prochain lieu sur le plan. Approche-toi du poste et appuie sur E.','Observe les entrées et le résultat attendu de chaque scénario.',task[3]],
      steps:[
        {id:'relay',objectId:'relay',kind:'interact',requires:[],objective:'Rétablir la liaison locale',message:'Liaison active. Le passage vers la console est ouvert.',effects:[{type:'openDoor',target:'access'},{type:'activateObject',target:'relay'}]},
        {id:'repair',objectId:'workstation',challengeId,kind:'challenge',requires:['relay'],objective:task[0],message:task[1],effects:[...map.doors.filter(d=>d.id!=='access').map(d=>({type:'openDoor',target:d.id})),{type:'activateObject',target:'workstation'},{type:'activateObject',target:'machine'}]},
        {id:'finish',objectId:'exit',kind:'interact',requires:['repair'],objective:map.objects.find(o=>o.id==='exit').label,message:task[2]+'. Mission accomplie.',effects:[{type:'activateObject',target:'exit'}]}
      ],victory:'finish'};
    map.rooms.forEach((r,i)=>r.code=String(i+1).padStart(2,'0'));map.objects.forEach((o,i)=>o.number=String(i+1).padStart(2,'0'));
    map.objects.find(o=>o.id==='workstation').label=challenge.title.replace(/^Évaluation · /,'');
    map.objects.find(o=>o.id==='machine').label=task[2];
    map.objects.find(o=>o.id==='machine').mode=challenge.validator;
    def.signature=signature({def,files:challenge.files,scenarios:challenge.scenarios,validator:challenge.validator,version:challenge.version});
    const errors=validate(def,challenge);if(errors.length)throw Error(errors.join(' '));return def;
  }
  function restore(def,saved) {
    const state={signature:def.signature,done:[],opened:[],active:[],position:{...def.map.spawn},won:false};
    if(saved?.signature!==def.signature)return state;
    for(const step of def.steps)if(saved.done?.includes(step.id))applyEffects(def,state,step.id);
    if(walkable(def.map,saved.position?.x,saved.position?.y,state.opened))state.position={x:saved.position.x,y:saved.position.y};
    state.won=state.done.includes(def.victory);return state;
  }
  return {maps,tasks,fnSpec,compile,validate,restore,applyEffects,walkable,move,path,sight,inRect,signature};
})();
