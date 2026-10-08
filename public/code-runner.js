const sessions=new Map();
let installed=false;

// id is already escaped by the shared editor renderer.
export function codeRunnerPanel(id,disabled=false){
 return `<section class="lesson-code-runner" data-code-runner="${id}" aria-label="Exécution du code">
 <button type="button" class="btn primary" data-code-execute ${disabled?'disabled':''}>Exécuter</button>
 <p>Utilise <code>console.log()</code> pour afficher une valeur.</p>
 <strong>Console</strong>
 <pre data-code-output role="log" aria-label="Console" aria-live="polite" tabindex="0"></pre>
 <p class="lesson-execution-status" data-code-status role="status"></p></section>`;
}

export function installCodeRunner(){
 if(installed)return;
 installed=true;
 const stop=panel=>{
  const session=sessions.get(panel);if(!session)return;
  sessions.delete(panel);clearTimeout(session.timer);
  window.removeEventListener('message',session.receive);
  session.frame.contentWindow?.postMessage({type:'stop'},'*');session.frame.remove();
  panel.removeAttribute('aria-busy');
 };
 const observer=new MutationObserver(()=>{
  for(const panel of sessions.keys())if(!panel.isConnected)stop(panel);
 });
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>{for(const panel of sessions.keys())stop(panel);});
 document.addEventListener('input',event=>{
  if(!event.target.matches('textarea[data-answer]'))return;
  const panel=event.target.closest('[data-workbench]')?.querySelector('[data-code-runner]');
  if(panel&&sessions.has(panel)){
   stop(panel);panel.querySelector('[data-code-status]').textContent='Code modifié. Clique sur Exécuter pour lancer cette version.';
  }
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-code-execute]');if(!button||button.disabled)return;
  const panel=button.closest('[data-code-runner]'),editor=panel.closest('[data-workbench]').querySelector('textarea[data-answer]');
  if(!editor||editor.disabled)return;
  stop(panel);
  const code=editor.value,output=panel.querySelector('[data-code-output]'),status=panel.querySelector('[data-code-status]');
  output.textContent='';status.textContent='Exécution…';panel.setAttribute('aria-busy','true');
  const frame=document.createElement('iframe');
  frame.hidden=true;frame.title='Exécution isolée';frame.sandbox='allow-scripts';frame.src='/code-runner-frame.html';
  const session={frame,receive:null,timer:null,lines:0,size:0};sessions.set(panel,session);
  const append=text=>{output.append(document.createTextNode((session.lines++?'\n':'')+text));output.scrollTop=output.scrollHeight;};
  const finish=(message,error=false,engine=false)=>{
   if(sessions.get(panel)!==session)return;
   if(error)append(message);
   status.textContent=engine?'Exécution indisponible. Ton code est conservé.':error?'Exécution arrêtée. Tu peux corriger ton code et le relancer.':message;
   stop(panel);
  };
  session.receive=event=>{
   if(event.source!==frame.contentWindow||sessions.get(panel)!==session)return;
   const data=event.data;if(!data||typeof data!=='object')return;
   if(data.type==='ready'){
    if(session.started)return;session.started=true;
    clearTimeout(session.timer);
    session.timer=setTimeout(()=>finish('Durée maximale dépassée. Vérifie les conditions de tes boucles, puis relance le code.',true),2500);
    frame.contentWindow.postMessage({type:'run',code},'*');
   }else if(data.type==='log'&&typeof data.text==='string'){
    if(session.lines>=100||(session.size+=data.text.length)>64000){finish('Trop de messages dans la console. Réduis les console.log() ou le nombre de tours de boucle, puis relance.',true);return;}
    append(data.text);
   }else if(data.type==='done')finish(session.lines?'Exécution terminée.':'Exécution terminée. Aucun message affiché.');
   else if(data.type==='error'&&typeof data.message==='string')finish(data.message.slice(0,2000),true,data.kind==='engine');
  };
  window.addEventListener('message',session.receive);
  session.timer=setTimeout(()=>finish('Le moteur d’exécution n’a pas démarré. Clique sur Exécuter pour réessayer.',true,true),5000);
  document.body.append(frame);
 });
}
