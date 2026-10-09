let loading;
const unsavedFiles=new Map();
const fileWrites=new Map();
globalThis.window?.addEventListener('eden-session-invalidated',()=>{unsavedFiles.clear();fileWrites.clear();});
export async function flushTerminalFiles(){
 for(const [key,file]of unsavedFiles){
  await fileWrites.get(key)?.catch(()=>{});
  const saving=call(`/api/labs/${file.sessionId}/files`,{action:'write',path:file.path,content:file.content});fileWrites.set(key,saving);
  await saving;if(unsavedFiles.get(key)===file){unsavedFiles.delete(key);localStorage.removeItem('eden-lab-draft:'+key);}
 }
}
function loadTerminal(){return loading??=new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/xterm.css';document.head.append(link);const script=document.createElement('script');script.src='/vendor/xterm.js';script.onload=resolve;script.onerror=()=>reject(Error('Interface terminal indisponible.'));document.head.append(script);});}
async function call(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),v=await r.json();if(!r.ok)throw Error(v.error||'Incident technique. Aucune compétence évaluée.');return v;}
export function installTerminalLabs({getLesson,getJob}){
 document.addEventListener('click',async event=>{const button=event.target.closest('[data-connect-lab]');if(!button)return;const root=button.closest('[data-real-lab]'),status=root.querySelector('[role=status]');button.disabled=true;
  let terminal,timer,resize,busy=false,cursor=0,pending='';
  try{
   const lesson=getLesson(),job=getJob?.(),session=await call(job?`/api/preparation/jobs/${encodeURIComponent(job)}/lab`:lesson.preview?`/api/lessons/${encodeURIComponent(lesson.id)}/preview/lab`:'/api/labs',{lessonId:lesson.id,lessonVersionId:lesson.versionId,assignmentId:lesson.assignmentId,activityId:root.dataset.realLab,...(lesson.editorSpec?{editorSpec:lesson.editorSpec,editorToken:lesson.editorToken}:{})});await loadTerminal();if(!root.isConnected)return;
   const editor=root.querySelector('[data-file-content]');
   const changed=()=>{const file={sessionId:session.id,path:root.querySelector('[data-file-path]').value,content:editor.value};unsavedFiles.set(session.id,file);localStorage.setItem('eden-lab-draft:'+session.id,JSON.stringify(file));};
   try{const saved=JSON.parse(localStorage.getItem('eden-lab-draft:'+session.id));if(saved){root.querySelector('[data-file-path]').value=saved.path;editor.value=saved.content;unsavedFiles.set(session.id,saved);}}catch{}
   editor.addEventListener('input',changed);
   terminal=new window.Terminal({cols:80,rows:20,convertEol:false,scrollback:1000,theme:{background:'#162b32'}});terminal.open(root.querySelector('[data-terminal-host]'));terminal.onData(data=>{pending=(pending+data).slice(-8192);});terminal.focus();status.textContent='Connecté au laboratoire. Ctrl+C interrompt une commande.';
   resize=new ResizeObserver(()=>terminal.resize(Math.max(20,Math.min(120,Math.floor(root.querySelector('[data-terminal-host]').clientWidth/9))),20));resize.observe(root.querySelector('[data-terminal-host]'));
   const poll=async()=>{if(!root.isConnected){clearInterval(timer);resize.disconnect();terminal.dispose();return;}if(busy)return;busy=true;const input=pending;pending='';try{const result=await call(`/api/labs/${session.id}/io`,{input,cursor,cols:terminal.cols,rows:terminal.rows});if(!root.isConnected)return;cursor=result.cursor;terminal.write(result.output||'');}catch(e){status.textContent=e.message;clearInterval(timer);resize.disconnect();button.disabled=false;}finally{busy=false;}};
   timer=setInterval(poll,350);await poll();
   root.querySelector('[data-lab-interrupt]').onclick=()=>{pending+='\x03';};
   root.querySelector('[data-lab-check]').onclick=async()=>{try{const result=await call(`/api/labs/${session.id}/check`,{});status.textContent=result.checks.map(c=>`${c.ok?'✓':'À reprendre'} ${c.label}`).join(' · ');}catch(e){status.textContent=e.message;}};
   root.querySelector('[data-lab-reset]').onclick=async()=>{if(!confirm('Conserver un instantané et réinitialiser les fichiers du laboratoire ?'))return;try{await call(`/api/labs/${session.id}/reset`,{confirmed:true});clearInterval(timer);resize.disconnect();terminal.dispose();root.querySelector('[data-terminal-host]').replaceChildren();button.disabled=false;status.textContent='Fichiers réinitialisés. Reconnecte le terminal.';}catch(e){status.textContent=e.message;}};
   root.querySelector('[data-lab-files]').onclick=async()=>{try{const result=await call(`/api/labs/${session.id}/files`,{action:'list'}),list=root.querySelector('[data-file-list]');list.replaceChildren();for(const file of result.files){const open=document.createElement('button');open.type='button';open.className='btn';open.textContent=file.path;open.onclick=async()=>{try{await flushTerminalFiles();root.querySelector('[data-file-path]').value=file.path;root.querySelector('[data-file-content]').value=new TextDecoder().decode(Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0)));}catch(e){status.textContent=e.message;}};list.append(open);}}catch(e){status.textContent=e.message;}};
   root.querySelector('[data-lab-save-file]').onclick=async()=>{try{changed();await flushTerminalFiles();status.textContent='Fichier enregistré dans le même laboratoire que le terminal.';}catch(e){status.textContent=e.message;}};
  }catch(e){status.textContent=e.message;button.disabled=false;resize?.disconnect();terminal?.dispose();clearInterval(timer);}
 });
}
export function terminalInput(a,escape,disabled,answer=''){return `<div data-real-lab="${escape(a.id)}"><p role="status">Le terminal exécute les commandes dans un laboratoire isolé lorsqu’il est disponible.</p><div data-terminal-host></div><div class="actions"><button type="button" class="btn" data-connect-lab ${disabled?'disabled':''}>Connecter le terminal</button><button type="button" class="btn" data-lab-interrupt>Interrompre</button><button type="button" class="btn" data-lab-check>Vérifier les fichiers</button><button type="button" class="btn" data-lab-reset>Réinitialiser</button></div><details><summary>Fichiers du laboratoire</summary><button type="button" class="btn" data-lab-files>Actualiser l’arborescence</button><div data-file-list class="actions"></div><label>Chemin relatif<input data-file-path value="notes.txt"></label><label>Contenu<textarea data-file-content></textarea></label><button type="button" class="btn" data-lab-save-file>Enregistrer le fichier</button></details><label>Ma prévision et mon explication<textarea data-answer="${escape(a.id)}" ${disabled?'disabled':''}>${escape(answer)}</textarea></label></div>`;}
