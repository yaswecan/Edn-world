export const solutions = {
 battery:{'battery.js':'const battery = 80; console.log("Réserve", battery); return battery;'},
 stationFinal:{'repair.js':'function repair(c){return {batteryOk:c.battery>=80,cooled:c.temps.filter(t=>t>70).length,modules:Array.from({length:c.modules},(_,i)=>i)};}'},
 healthcheck:{'healthcheck.js':'function healthcheck(services){return services.filter(s=>!s.online).map(s=>s.name);}'},
 rocketFinal:{'launch.js':'function launchReport(d){return {distance:Math.hypot(d.dx,d.dy),ready:d.checks.every(Boolean),passedChecks:d.checks.filter(Boolean).length};}'},
 incidentFinal:{'incident.js':'function incidentReport(events,sessions){return {errors:events.filter(e=>e.level==="ERROR").length,suspiciousIds:sessions.filter(s=>s.failed>=5&&!s.knownDevice).map(s=>s.id)};}'},
 assaultFinal:{'controller.js':'function controller(drones){const report={deploy:[],recharge:[],ignore:[]};for(const d of drones)report[!d.active?"ignore":d.battery<40?"recharge":"deploy"].push(d.id);console.log("Drones traités",drones.length);return report;}'},
};
// Browser navigation sends keyboard events into the real input listener and
// observes rendered positions. It never teleports or writes progress/state.
export async function walkTo(frame,definition,target,opened=[]) {
 const position=await frame.locator('#worldCanvas').evaluate(c=>({x:Number(c.dataset.x),y:Number(c.dataset.y)}));
 const route=globalThis.StationModel.path(definition.map,position,target,opened);
 if(!route.length)throw Error('No route to '+JSON.stringify(target));
 await frame.locator('#worldCanvas').focus();
 await frame.evaluate(route=>new Promise((resolve,reject)=>{
  const canvas=document.querySelector('#worldCanvas'),start=performance.now();let at=0,held=new Set(),previous='',stalledAt=performance.now();
  const set=next=>{for(const key of held)if(!next.has(key))document.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));for(const key of next)if(!held.has(key))document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));held=next;};
  const tick=()=>{
   const x=Number(canvas.dataset.x),y=Number(canvas.dataset.y),p=route[at];
   if(!p){set(new Set());resolve();return;}
   if(performance.now()-start>45000){set(new Set());reject(Error('Navigation timed out at '+x+','+y+' target '+JSON.stringify(p)));return;}
   const here=x+','+y;if(here!==previous){previous=here;stalledAt=performance.now();}
   if(performance.now()-stalledAt>2000){set(new Set());reject(Error('Movement blocked at '+here+' target '+JSON.stringify(p)));return;}
   if(Math.hypot(p.x-x,p.y-y)<7){at++;requestAnimationFrame(tick);return;}
   const next=new Set();if(Math.abs(p.x-x)>4)next.add(p.x>x?'ArrowRight':'ArrowLeft');if(Math.abs(p.y-y)>4)next.add(p.y>y?'ArrowDown':'ArrowUp');set(next);requestAnimationFrame(tick);
  };tick();
 }),route);
}

export async function enterAssignedTerminal(page,mission) {
 await page.frameLocator('.game-frame').locator('#worldCanvas').waitFor();
 const frame=page.frames().find(f=>f.url().includes('/game/index.html'));
 if(await frame.locator('#startMission').isVisible())await frame.locator('#startMission').click();
 const def=globalThis.StationModel.compile(mission);
 if(await frame.locator('#app').getAttribute('data-stage')==='relay'){
  await walkTo(frame,def,def.map.objects.find(o=>o.id==='relay').nav);await frame.locator('#worldCanvas').press('e');
 }
 await walkTo(frame,def,def.map.objects.find(o=>o.id==='workstation').nav,def.map.doors.map(d=>d.id));
 await frame.locator('#worldCanvas').press('e');await frame.locator('#missionCode').waitFor();return frame;
}
