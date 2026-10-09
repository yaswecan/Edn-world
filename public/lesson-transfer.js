// Native teacher transfer flow; renderer/editor contracts remain shared.
export function lessonTransferUI({api,post,modal,busy,esc,btn,closeModal,refresh,openLesson,user,toast}){
 let transfer=null,report=null,targetId=null,applying=false;
 const selected=new Set(),enc=encodeURIComponent;
 const digest=async file=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 const storageKey=hash=>`eden-transfer:${user().id}:${user().classId}:${hash}`;
 const message=text=>{const el=document.querySelector('#transfer-status');if(el)el.textContent=text;};
 async function raw(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options});if(!r.ok){let e;try{e=await r.json();}catch{}throw Object.assign(Error(e?.error||e?.message||`Transfert interrompu (${r.status}). Réessayez pour reprendre.`),{status:r.status});}return r;}
 const labels={new:'Nouvelle',matched:'Correspondance trouvée',identical:'Identique — aucune modification'};
 function chooseFile(id=null){targetId=id;transfer=null;report=null;modal(id?'Remplacer depuis un fichier':'Importer des séances',`<p>Choisissez une archive <strong>.tweenteach.zip</strong>. Vous pourrez choisir les séances et vérifier chaque destination avant application.</p><label class="transfer-drop" id="transfer-drop">Choisir ou déposer une archive<input id="lesson-package-file" type="file" accept=".tweenteach.zip,.zip,application/zip"></label><p class="section-note">Jusqu’à 64 Mio par archive. L’envoi reprend après une interruption si vous choisissez le même fichier.</p><p id="transfer-status" role="status"></p><div class="modal-actions">${btn('Analyser le fichier','transfer-upload','','primary')}</div>`);
 const drop=document.querySelector('#transfer-drop');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragging');});drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragging');if(e.dataTransfer.files.length===1){document.querySelector('#lesson-package-file').files=e.dataTransfer.files;message(e.dataTransfer.files[0].name);}});
 }
 function readChoices(){return [...document.querySelectorAll('[data-transfer-row]')].map(el=>{
  const action=el.querySelector('[data-transfer-action]').value,value={portableId:el.dataset.transferRow,action};
  if(action==='replace')value.targetId=el.querySelector('[data-transfer-target]').value;
  const entry=el.querySelector('[data-transfer-entry]').value;if(entry!=='keep')value.entryId=entry;
  value.reviewed=el.querySelector('[data-transfer-review]')?.checked||false;return value;
 });}
 function showReport(r){
  report=r;const c=r.counts,operation=[c.add?`Ajouter ${c.add} séance${c.add>1?'s':''}`:'',c.replace?`remplacer ${c.replace} séance${c.replace>1?'s':''}`:''].filter(Boolean).join(' et ')||'Confirmer sans modification';
  modal('Vérifier les séances à importer',`<p>Vérifiez chaque destination. Un ajout reste en brouillon. Un remplacement conserve le lien, la classe et la visibilité ; le créneau peut être changé explicitement.</p>${targetId&&r.rows.length>1?'<p class="alert">Choisissez la séance source à utiliser ; laissez les autres sur « Ignorer ».</p>':''}<div class="transfer-rows">${r.rows.map(row=>{
   const choice=r.choices.find(c=>c.portableId===row.portableId),d=row.differences;
   return `<section class="card pad spaced" data-transfer-row="${esc(row.portableId)}"><div class="flex between"><h3>${esc(row.title)}</h3><span class="pill">${esc(row.blockers.length?'Conflit':labels[row.status])}</span></div><p>${esc(row.date)}${row.targetTitle?` → ${esc(row.targetTitle)} · ${esc(row.destinationDate)}`:''}</p><div class="transfer-controls"><label>Action<select data-transfer-action aria-label="Action pour ${esc(row.title)}">${[['add','Ajouter'],['replace','Remplacer'],['ignore','Ignorer']].map(([v,l])=>`<option value="${v}" ${choice.action===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Séance cible<select data-transfer-target ${choice.action!=='replace'?'disabled':''}><option value="">Choisir une séance…</option>${r.targets.map(t=>`<option value="${esc(t.id)}" ${t.id===(choice.targetId||targetId)?'selected':''}>${esc(t.date)} · ${esc(t.title)} · ${t.status==='published'?'publiée':'brouillon'}</option>`).join('')}</select></label><label>Créneau<select data-transfer-entry ${choice.action==='ignore'?'disabled':''}><option value="keep">${choice.action==='replace'?'Conserver le rattachement':'Sans rattachement pour le moment'}</option>${r.entries.filter(e=>!['cancelled','postponed','replaced'].includes(e.status)).map(e=>`<option value="${esc(e.id)}" ${choice.entryId===e.id?'selected':''}>${esc(e.date)} · ${esc(e.title)}</option>`).join('')}</select></label></div><p class="section-note">${d.contentChanged?'Contenu pédagogique modifié.':'Contenu pédagogique identique.'} ${d.added} activité(s) ajoutée(s), ${d.removed} retirée(s), ${d.changed} modifiée(s). ${d.resourcesChanged?'Ressources modifiées.':'Ressources identiques.'}</p><p>${esc(row.publication)}</p>${row.requiresReview?`<label class="flex"><input type="checkbox" data-transfer-review ${choice.reviewed?'checked':''}>J’ai relu cette préparation et je la reprends sous ma responsabilité professeur.</label>`:''}${row.warnings.length?`<details><summary>${row.warnings.length} point(s) à connaître</summary><ul>${row.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details>`:''}${row.blockers.length?`<ul role="alert" class="transfer-blockers">${row.blockers.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>`:''}</section>`;
  }).join('')}</div><p id="transfer-status" role="status">${r.canApply?'Le lot est prêt à être validé.':'Corrigez les conflits ou ignorez les séances concernées, puis actualisez le récapitulatif.'}</p><div class="modal-actions">${btn('Actualiser le récapitulatif','transfer-review')}${btn(operation,'transfer-apply','','primary')}</div>`);
  document.querySelector('[data-action="transfer-apply"]').disabled=!r.canApply;
  document.querySelector('.transfer-rows').addEventListener('change',e=>{
   if(!e.target.matches('select,input'))return;
   const row=e.target.closest('[data-transfer-row]'),action=row.querySelector('[data-transfer-action]').value;
   row.querySelector('[data-transfer-target]').disabled=action!=='replace';row.querySelector('[data-transfer-entry]').disabled=action==='ignore';
   document.querySelector('[data-action="transfer-apply"]').disabled=true;message('La sélection a changé. Actualisez le récapitulatif avant de confirmer.');
  });
 }
 async function review(){const choices=report?readChoices():undefined;if(choices?.some(c=>c.action==='replace'&&!c.targetId))throw Error('Choisissez une séance cible pour chaque remplacement.');await busy(async()=>showReport(await post(`/api/lesson-transfers/${enc(transfer.id)}/preview`,{choices,targetId})),'Vérification des contenus et des destinations…');}
 async function upload(){
  const file=document.querySelector('#lesson-package-file')?.files[0];if(!file)throw Error('Choisissez votre archive de séances.');if(file.size>64*1024*1024)throw Error('Archive supérieure à 64 Mio. Exportez moins de séances.');
  const button=document.querySelector('[data-action="transfer-upload"]');button.disabled=true;
  try{
   message('Lecture et vérification du fichier…');const hash=await digest(file),saved=localStorage.getItem(storageKey(hash));let received=[];
   if(saved)try{transfer=await api(`/api/lesson-transfers/${enc(saved)}`);received=transfer.received||[];}catch{localStorage.removeItem(storageKey(hash));transfer=null;}
   if(!transfer){transfer=await post('/api/lesson-transfers',{bytes:file.size,sha256:hash});localStorage.setItem(storageKey(hash),transfer.id);}
   if(!transfer.sealed)for(let i=0;i<transfer.chunks;i++){message(`Envoi de l’archive : ${Math.round(i/transfer.chunks*100)} %`);if(!received.includes(i))await raw(`/api/lesson-transfers/${enc(transfer.id)}/chunks/${i}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.slice(i*transfer.chunkBytes,(i+1)*transfer.chunkBytes)});}
   message('Analyse du paquet…');await review();
  }finally{button.disabled=false;}
 }
 async function exportSelection(ids){
  if(!ids.length)throw Error('Sélectionnez au moins une séance à exporter.');
  await busy(async()=>{
   const result=await post('/api/lesson-transfers/export',{lessonIds:ids});
   modal('Archive de séances prête',`<p>${result.count} séance(s) enregistrée(s) sont prêtes à télécharger dans une archive unique.</p>${result.external.length?`<details open><summary>Liens externes conservés (${result.external.length})</summary><ul>${result.external.map(u=>`<li>${esc(u)}</li>`).join('')}</ul><p>Ces liens nécessitent l’accès à leurs sites d’origine.</p></details>`:''}<p id="transfer-status" role="status"></p>${btn('Télécharger les séances','transfer-download',result.id,'primary')}`);
   transfer=result;
  },'Préparation de l’archive et vérification des ressources…');
 }
 async function download(){
  const button=document.querySelector('[data-action="transfer-download"]');button.disabled=true;
  try{const parts=[];for(let i=0;i<transfer.chunks;i++){message(`Téléchargement : ${Math.round(i/transfer.chunks*100)} %`);parts.push(await(await raw(`/api/lesson-transfers/${enc(transfer.id)}/chunks/${i}`)).arrayBuffer());}
   const blob=new Blob(parts,{type:'application/zip'});if(await digest(blob)!==transfer.sha256)throw Error('Le téléchargement est incomplet. Réessayez.');
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=transfer.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);message('Archive téléchargée. Vous pouvez l’importer depuis votre espace professeur en ligne.');
  }finally{button.disabled=false;}
 }
 async function apply(){
  if(applying)return;applying=true;
  try{await busy(async()=>{
   try{
    const result=await post(`/api/lesson-transfers/${enc(transfer.id)}/apply`,{token:report.token,confirmed:true});await refresh();
    modal('Transfert terminé',`<p>Le lot a été appliqué.</p>${result.lessons.map(l=>`<div class="list-row"><div><strong>${esc(l.title)}</strong><p>${{added:'Ajoutée en brouillon',replaced:'Contenu remplacé',identical:'Identique — aucune modification'}[l.status]}</p></div>${btn('Ouvrir la séance','transfer-open',l.id)}</div>`).join('')}`);
   }catch(e){if(e.status===409){showReport(await post(`/api/lesson-transfers/${enc(transfer.id)}/preview`,{choices:report.choices}));message(e.message+' Vérifiez ce nouveau récapitulatif.');return;}throw e;}
  },'Application du lot vérifié…');}finally{applying=false;}
 }
 document.addEventListener('change',e=>{if(e.target.matches('[data-lesson-export]')){e.target.checked?selected.add(e.target.dataset.lessonExport):selected.delete(e.target.dataset.lessonExport);}});
 return {selected,actions:{'transfer-import':()=>chooseFile(),'transfer-replace':id=>chooseFile(id),'transfer-upload':upload,'transfer-review':review,'transfer-apply':apply,'transfer-download':download,'transfer-export':id=>exportSelection(id?[id]:[...document.querySelectorAll('[data-lesson-export]:checked')].map(el=>el.dataset.lessonExport)),'transfer-open':async id=>{await closeModal();await openLesson(id);},'transfer-select-all':()=>{const els=[...document.querySelectorAll('[data-lesson-export]')],checked=els.some(e=>!e.checked);els.forEach(el=>{el.checked=checked;checked?selected.add(el.dataset.lessonExport):selected.delete(el.dataset.lessonExport);});}}};
}
