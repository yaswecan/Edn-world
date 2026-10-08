const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function domInput(a,{disabled=false,answer}={}){
 let saved;try{saved=JSON.parse(answer).files;}catch{}
 const files=(Array.isArray(saved)?saved:a.workshop.files||[]).map(f=>({...f,content:!saved&&f.path==='main.js'?a.starter:f.content})),off=disabled?'disabled':'';
 return `<div data-dom-lab="${escape(a.id)}"><input type="hidden" data-answer="${escape(a.id)}" value="${escape(JSON.stringify({files}))}"><p>Modifie les trois fichiers, lance l’aperçu puis clique dans le rendu. Le clavier ci-dessous agit sur l’élément sélectionné.</p>${files.map(f=>`<label>${escape(f.path)}<textarea class="code" data-dom-file="${escape(f.path)}" spellcheck="false" ${off}>${escape(f.content)}</textarea></label>`).join('')}<div class="actions"><button type="button" class="btn" data-dom-action="load" ${off}>Retrouver mon projet</button><button type="button" class="btn primary" data-dom-action="render" ${off}>Enregistrer et lancer</button><button type="button" class="btn" data-dom-action="check" ${off}>Vérifier les interactions</button><button type="button" class="btn" data-dom-action="stop" ${off}>Arrêter l’aperçu</button><button type="button" class="btn" data-dom-action="reset" ${off}>Réinitialiser</button></div><p role="status">L’aperçu attend le lancement. Une exécution dure au plus 15 secondes.</p><img data-dom-image hidden alt="Aperçu interactif du projet ; cliquer pour agir" style="max-width:100%;height:auto;border:1px solid #cbd5d7"><label>Texte à saisir dans le champ sélectionné<input data-dom-text maxlength="500" ${off}></label><button type="button" class="btn" data-dom-action="text" ${off}>Saisir</button><label>Touche<select data-dom-key ${off}>${['Enter','Tab','Backspace','ArrowLeft','ArrowRight','Space'].map(key=>`<option>${key}</option>`).join('')}</select></label><button type="button" class="btn" data-dom-action="key" ${off}>Appuyer</button><pre class="console" data-dom-console></pre></div>`;
}
export function installDOMLabs({getLesson,getJob=()=>null}){
 const requests=new WeakMap(),previewActions=new WeakMap();
 const saveFiles=root=>{const field=root.querySelector('[data-answer]');if(!field)return;field.value=JSON.stringify({files:[...root.querySelectorAll('[data-dom-file]')].map(f=>({path:f.dataset.domFile,content:f.value}))});field.dispatchEvent(new Event('input',{bubbles:true}));};
 document.addEventListener('input',e=>{if(e.target.matches('[data-dom-file]'))saveFiles(e.target.closest('[data-dom-lab]'));});
 async function run(root,action,interaction){
  const status=root.querySelector('[role=status]');if(action==='stop'){requests.get(root)?.abort();requests.delete(root);root.querySelector('[data-dom-image]').hidden=true;status.textContent='Aperçu fermé. Le calcul distant s’arrête au plus tard à sa limite de 15 secondes.';return;}
  if(requests.has(root))return;
  if(action==='reset'&&!confirm('Réinitialiser le projet ? Une sauvegarde des fichiers sera conservée.'))return;
  const controller=new AbortController();requests.set(root,controller);status.textContent='Exécution dans le laboratoire…';
  const lesson=getLesson(),job=getJob(),files=Array.from(root.querySelectorAll('[data-dom-file]')).map(f=>({path:f.dataset.domFile,content:f.value})),activityId=root.dataset.domLab;
  const body={lessonId:lesson?.id,lessonVersionId:lesson?.versionId,activityId,action,confirmed:action==='reset',interaction};
  if(['render','check'].includes(action))body.files=files;
  if(job){const actions=previewActions.get(root)||[];if(['render','reset'].includes(action))actions.length=0;if(interaction)actions.push(interaction);previewActions.set(root,actions);body.actions=actions;body.files=files;}
  try{
   const response=await fetch(job?`/api/preparation/jobs/${encodeURIComponent(job)}/dom`:'/api/dom/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal}),result=await response.json();if(!response.ok)throw Error(result.error||'Laboratoire indisponible.');
   if(result.files)for(const file of result.files){const field=Array.from(root.querySelectorAll('[data-dom-file]')).find(f=>f.dataset.domFile===file.path);if(field)field.value=file.content;}
   saveFiles(root);const image=root.querySelector('[data-dom-image]');image.src='data:image/png;base64,'+result.screenshot;image.hidden=false;
   root.querySelector('[data-dom-console]').textContent=(result.logs||[]).join('\n');status.textContent=result.checks?.length?result.checks.map(c=>`${c.ok?'✓':'À reprendre'} ${c.label}`).join(' · '):'Aperçu prêt. Clique dans l’image pour interagir.';
  }catch(error){if(error.name!=='AbortError')status.textContent=error.message+' Aucun niveau de compétence déduit de cet incident.';}
  finally{if(requests.get(root)===controller)requests.delete(root);}
 }
 document.addEventListener('click',event=>{
  const root=event.target.closest('[data-dom-lab]');if(!root)return;
  const action=event.target.closest('[data-dom-action]')?.dataset.domAction;
  if(action){const interaction=action==='text'?{type:'text',text:root.querySelector('[data-dom-text]').value}:action==='key'?{type:'key',key:root.querySelector('[data-dom-key]').value}:undefined;void run(root,action,interaction);}
  else if(event.target.matches('[data-dom-image]')){const rect=event.target.getBoundingClientRect();void run(root,'interact',{type:'click',x:(event.clientX-rect.left)*800/rect.width,y:(event.clientY-rect.top)*500/rect.height});}
 });
}
