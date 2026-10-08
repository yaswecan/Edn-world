import {escape as esc} from './lesson-renderer.js';
let sources=[];
const request=async(path,body)=>{const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),v=await r.json();if(!r.ok)throw Error(v.error||'Action non confirmée.');return v;};
export function renderDocumentLibrary(value){sources=value;return `<section class="card pad" aria-label="Fonds documentaire"><h2>Retrouver un passage</h2><form id="document-search"><label>Notion, commande ou expression<input name="query" maxlength="1000" placeholder="modèle de boîte, git status…" required></label><button class="btn" type="submit">Rechercher dans mes sources</button></form><div id="document-results" role="status"></div><details><summary>Corriger le classement d’une source</summary><form id="source-classification"><label>Source et version<select name="sourceId">${sources.map(s=>`<option value="${esc(s.id)}">${esc(s.title)} · v${s.version}</option>`).join('')}</select></label><label>Famille<select name="family"><option value="">Non déterminée</option><option>Design</option><option>Programmation</option><option>Savoir</option></select></label><label>Notions (séparées par des virgules)<input name="topics" maxlength="1000"></label><label>Rôle<select name="role"><option value="reference">Cours de référence</option><option value="technical">Documentation technique</option><option value="exercise">Exercice</option><option value="solution">Corrigé</option><option value="curriculum">Référentiel</option><option value="progression">Progression</option><option value="tone">Exemple de ton</option><option value="visual">Référence visuelle</option></select></label><p>Le classement ne publie pas le document et ne modifie pas ses droits d’accès.</p><button class="btn" ${sources.length?'':'disabled'}>Enregistrer le classement</button></form></details><details><summary>Versions et remises archivées</summary><button type="button" class="btn" data-load-archives>Actualiser les archives</button><div id="document-archives"></div></details><p id="document-message" role="status"></p></section>`;}
export function fillClassification(){const form=document.querySelector('#source-classification');if(!form)return;const source=sources.find(s=>s.id===form.elements.sourceId.value);if(!source)return;form.elements.family.value=source.classification?.families?.[0]||'';form.elements.topics.value=source.classification?.topics?.join(', ')||'';form.elements.role.value=source.classification?.role||source.role;}
document.addEventListener('change',e=>{if(e.target.matches('#source-classification [name=sourceId]'))fillClassification();});
document.addEventListener('submit',async event=>{
 const form=event.target;if(!['document-search','source-classification'].includes(form.id))return;event.preventDefault();
 const status=document.querySelector('#document-message');try{
  if(form.id==='document-search'){
   const found=await request('/api/preparation/search?q='+encodeURIComponent(form.elements.query.value));
   document.querySelector('#document-results').innerHTML=found.results.map(r=>`<article class="source"><h3>${esc(r.title)} · v${r.sourceVersion}</h3><p>${esc(r.segment.parent)} · ${esc(r.segment.location)}</p><pre>${esc(r.segment.text)}</pre><button type="button" class="btn" data-passage-source="${esc(r.sourceId)}" data-passage-id="${esc(r.segment.id)}">Ouvrir le passage et sa provenance</button></article>`).join('')||`<p>${esc(found.gap)}</p>`;
   status.textContent=found.exclusions.length?`${found.exclusions.length} source(s) demandent une vérification d’extraction.`:'';
  }else{
   const source=sources.find(s=>s.id===form.elements.sourceId.value);
   await request(`/api/preparation/sources/${encodeURIComponent(source.id)}/classification`,{expectedVersion:source.annotationVersion||0,values:{families:form.elements.family.value?[form.elements.family.value]:[],topics:form.elements.topics.value.split(',').map(s=>s.trim()).filter(Boolean),role:form.elements.role.value}});
   document.dispatchEvent(new Event('documentary-updated'));status.textContent='Classement enregistré.';
  }
 }catch(e){status.textContent=e.message;}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-passage-id],[data-load-archives],[data-archive-retry]');if(!button)return;
 try{
  if(button.hasAttribute('data-passage-id')){
   const path=button.dataset.passageJob?`/api/preparation/jobs/${encodeURIComponent(button.dataset.passageJob)}/passages/${encodeURIComponent(button.dataset.passageId)}`:`/api/preparation/sources/${encodeURIComponent(button.dataset.passageSource)}/passages/${encodeURIComponent(button.dataset.passageId)}`;
   const result=await request(path);
   const dialog=document.createElement('dialog');dialog.innerHTML=`<h2>${esc(result.title)} · v${result.version}</h2><p>${esc(result.passage.location)}</p><pre>${esc(result.passage.text)}</pre><p>SHA-256 : ${esc(result.sourceHash)}</p><form method="dialog"><button class="btn">Fermer</button></form>`;document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();button.focus();});dialog.showModal();
  }else{
   if(button.dataset.archiveRetry)await request(`/api/preparation/archives/${encodeURIComponent(button.dataset.archiveRetry)}/retry`,{});
   const data=await request('/api/preparation/archives'),labels={pending:'En attente',running:'En cours',retry:'Reprise prévue',failed:'À reprendre',confirmed:'Confirmé'};
   document.querySelector('#document-archives').innerHTML=`<p>${data.configured?'Archivage Git configuré.':'Git non configuré : les instantanés restent conservés dans l’application.'}</p>`+data.items.slice(-30).reverse().map(row=>`<article class="source"><strong>${esc(row.event)} · ${esc(labels[row.state])}</strong><p>${esc(row.lastError||'')}</p><a href="/api/preparation/snapshots/${encodeURIComponent(row.snapshotId)}">Contenu figé et manifeste</a>${row.archive?`<p>Commit ${esc(row.archive.commit)}</p>`:''}${row.state==='failed'?`<button type="button" class="btn" data-archive-retry="${esc(row.id)}">Reprendre l’archivage</button>`:''}</article>`).join('');
  }
 }catch(e){document.querySelector('#document-message').textContent=e.message;}
});
