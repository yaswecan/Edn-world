const sessions=new WeakMap();
export function debuggerPanel(id,disabled=false){
 const off=disabled?'disabled':'';
 return `<details class="lesson-debugger" data-debugger="${id}"><summary>Exécuter et déboguer</summary>
 <p>Place un point d’arrêt avant une ligne. Observe les valeurs, puis avance d’une instruction. Le code utilise le sous-ensemble JavaScript de cet atelier.</p>
 <label>Fonction à appeler (facultatif)<input data-debug-function ${off} placeholder="autoriser"></label>
 <label>Arguments JSON<input data-debug-args ${off} value="[]"></label>
 <label>Points d’arrêt (numéros de lignes séparés par des virgules)<input data-debug-breakpoints ${off} inputmode="numeric"></label>
 <div class="actions"><button type="button" class="btn" data-debug="run" ${off}>Exécuter</button><button type="button" class="btn" data-debug="start" ${off}>Déboguer</button><button type="button" class="btn" data-debug="step" ${off}>Pas à pas</button><button type="button" class="btn" data-debug="continue" ${off}>Poursuivre</button><button type="button" class="btn" data-debug="stop" ${off}>Arrêter</button></div>
 <pre data-debug-output role="status" aria-live="polite">Le résultat et les variables apparaîtront ici.</pre></details>`;
}
export function installDebugger(){
 function stop(panel){const s=sessions.get(panel);if(s){s.worker?.terminate();clearTimeout(s.timer);s.worker=null;}}
 document.addEventListener('input',event=>{
  const root=event.target.closest('[data-workbench]'),panel=root?.querySelector('[data-debugger]');
  if(panel){stop(panel);sessions.delete(panel);panel.querySelector('[data-debug-output]').textContent='Code ou entrées modifiés. Relance le débogueur pour observer cette version.';}
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-debug]');if(!button||button.disabled)return;
  const panel=button.closest('[data-debugger]'),output=panel.querySelector('[data-debug-output]'),root=panel.closest('[data-workbench]');
  const mode=button.dataset.debug;stop(panel);
  if(mode==='stop'){sessions.delete(panel);output.textContent='Exécution arrêtée.';return;}
  const code=root.querySelector('textarea[data-answer]').value,invoke=panel.querySelector('[data-debug-function]').value.trim();
  let args;try{args=JSON.parse(panel.querySelector('[data-debug-args]').value);if(!Array.isArray(args))throw Error();}catch{output.textContent='Les arguments doivent être un tableau JSON, par exemple [true, false].';return;}
  const previous=sessions.get(panel),same=previous?.code===code&&previous.invoke===invoke&&JSON.stringify(previous.args)===JSON.stringify(args),step=same?previous.step||0:0;
  const breakpoints=panel.querySelector('[data-debug-breakpoints]').value.split(',').map(Number).filter(n=>Number.isInteger(n)&&n>0);
  const debug=mode==='run'?null:{breakpoints:mode==='step'?[]:breakpoints,afterStep:['continue','step'].includes(mode)?step:0,pauseAt:mode==='step'?step+1:mode==='start'&&!breakpoints.length?1:null};
  if(debug?.pauseAt===null)delete debug.pauseAt;
  const worker=new Worker('/debugger-worker.js',{type:'module'}),session={worker,code,invoke,args,step};sessions.set(panel,session);
  const finish=text=>{stop(panel);output.textContent=text;};
  session.timer=setTimeout(()=>finish('Durée maximale atteinte. Exécution arrêtée.'),1500);
  worker.onerror=()=>finish('Le moteur d’exécution n’est pas disponible. Aucun résultat validé.');
  worker.onmessage=({data})=>{
   const d=data.debug;session.step=d?.steps||0;
   let text=(data.logs||[]).join('\n');
   if(d?.paused){const line=d.current.line;const editor=root.querySelector('textarea[data-answer]'),start=code.split('\n').slice(0,line-1).reduce((n,s)=>n+s.length+1,0);editor.focus();editor.setSelectionRange(start,start+(code.split('\n')[line-1]?.length||0));text+=`\nArrêt avant la ligne ${line}, instruction ${d.steps}.\nVariables :\n`+JSON.stringify(d.current.variables,null,2);}
   else text+=data.error?'\n'+data.error:'\nExécution terminée. Résultat : '+JSON.stringify(data.value??null);
   finish(text.trim());
  };
  output.textContent='Exécution…';worker.postMessage({code,invoke,args,debug});
 });
}
