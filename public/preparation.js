import {escape as esc,renderLessonPage} from './lesson-renderer.js';
import {installWorkshopInteractions} from './workshop-runtime.js';
import {installDOMLabs} from './dom-lab.js';
import {installTerminalLabs} from './terminal-lab.js';
import {renderAIAccess,wireAIAccess} from './ai-access.js';
import {renderDocumentLibrary,fillClassification} from './document-library.js';
import {preparationLabels as labels,preparationStages as stages,formatDate,formatDuration,preparationGuidance,renderPreparationHeader} from './preparation-view.js';
import {renderPreparationActivity,updatePreparationActivity} from './preparation-activity.js';
import {previewEditorStep,focusPreviewEditor} from './preview-navigation.js';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
let sources=[],entries=[],selectedJob=params.get('job'),preview=null,previewAnswers={},step=0,lastJobJSON='';
let generationConfigured=false,preparationBusy=false,currentJob=null,previewInfo=null,activeView=selectedJob?'current':'new',jobActionBusy=false,jobLoading=false,savedJobs=[];
const cancellingJobs=new Set();
let jobCheckedAt=0,jobTrackingOffline=false;
const activityOptions=()=>({checkedAt:jobCheckedAt,offline:jobTrackingOffline});
installDOMLabs({getLesson:()=>preview,getJob:()=>selectedJob});
installTerminalLabs({getLesson:()=>({id:previewInfo?.lessonId,versionId:previewInfo?.lessonVersionId}),getJob:()=>selectedJob});
const roles={curriculum:'Référentiel',progression:'Progression',technical:'Documentation technique',reference:'Cours de référence',exercise:'Exercice',solution:'Corrigé privé',tone:'Exemple de ton',visual:'Référence visuelle'};
async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||data.message||`Erreur ${r.status}`);return data;}
const post=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});
function message(text,error=false){$('#message').textContent=text;$('#message').className=error?'error':'';}
function sourceList(){return sources.map(s=>`<div class="source"><label><input type="checkbox" name="source" value="${esc(s.id)}" ${s.status!=='extracted'?'disabled':''}> ${esc(s.title)} · v${s.version} · ${esc(roles[s.role])}</label><span>${s.status==='extracted'?'Extraite, analyse lors de la conception':'Extraction à vérifier'} · ${s.segments.length} segment(s)</span>${s.warnings.length?`<ul>${s.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}<details><summary>Structure et provenance</summary>${s.segments.map(x=>`<h4>${esc(x.parent)}</h4><small>${esc(x.location)}</small><pre>${esc(x.text)}</pre>`).join('')}<p>SHA-256 : ${esc(s.contentHash)}</p><a href="/api/preparation/sources/${encodeURIComponent(s.id)}/original">Document original</a></details>${s.status!=='extracted'&&s.segments.length?`<button class="btn" data-verify="${esc(s.id)}">J’ai vérifié l’extraction</button>`:''}</div>`).join('')||'<p>Aucun document importé. La bibliothèque existante reste disponible pour les compétences du créneau.</p>';}
async function refreshSources(){const checked=new Set([...document.querySelectorAll('[name=source]:checked')].map(x=>x.value));sources=await api('/api/preparation/sources');$('#sources').innerHTML=sourceList();for(const field of document.querySelectorAll('[name=source]'))field.checked=checked.has(field.value)&&!field.disabled;$('#document-library').innerHTML=renderDocumentLibrary(sources);fillClassification();updateSourceCount();}
document.addEventListener('documentary-updated',()=>refreshSources().catch(e=>message(e.message,true)));
async function loadJobs(){savedJobs=await api('/api/preparation/jobs');$('#jobs-count').textContent=savedJobs.length;renderJobs();}
function renderJobs(){
 const query=($('#history-search')?.value||'').toLocaleLowerCase('fr');
 const jobs=savedJobs.filter(j=>[j.brief.entry.objective,j.brief.entry.date,formatDate(j.brief.entry.date)].join(' ').toLocaleLowerCase('fr').includes(query));
 $('#jobs').innerHTML=jobs.map(j=>`<article class="preparation-history-row" data-history-job="${esc(j.id)}">
  <button type="button" class="preparation-history-open" data-job="${esc(j.id)}"><span><small>${esc(formatDate(j.brief.entry.date))} · ${esc(formatDuration(j.brief.entry.duration))}</small><strong>${esc(j.brief.entry.objective.split('\n')[0])}</strong><small>${esc(j.status==='cancelled'?'Préparation arrêtée':stages[j.stage]||'Préparation sauvegardée')}</small></span><span aria-hidden="true">→</span></button>
  <div class="preparation-history-actions"><span class="preparation-badge ${j.status==='blocked'?'attention':j.status==='completed'?'success':'neutral'}">${esc(labels[j.status]||j.status)}</span>${j.canCancel?`<button type="button" class="btn danger small" data-cancel-job="${esc(j.id)}" ${cancellingJobs.has(j.id)?'disabled':''}>${cancellingJobs.has(j.id)?'Annulation…':'Annuler la préparation'}</button>`:''}</div>
 </article>`).join('')||'<p class="empty-state">Aucune préparation à afficher.</p>';
}
const entryLabel=entry=>`${formatDate(entry.date)} · ${entry.objective.split('\n')[0]}`;
const selectedEntry=()=>entries.find(entry=>entry.id===$('#generate [name=entryId]').value);
function updateSourceCount(){const count=document.querySelectorAll('[name=source]:checked').length;$('#source-selection-count').textContent=count?`${count} document(s) sélectionné(s)`:'Facultatif · aucun document ajouté';}
function setView(view,{focus=false}={}){
 if(!['current','new','history','library'].includes(view))view=selectedJob?'current':'new';if(view==='current'&&!selectedJob)view='new';activeView=view;
 for(const [name,selector] of Object.entries({current:'#job',new:'#new-panel',history:'#history-panel',library:'#library-panel'}))$(selector).hidden=name!==view;
 $('#preview').hidden=view!=='current'||!$('#preview').hasChildNodes();$('#current-tab').hidden=!selectedJob;
 for(const button of document.querySelectorAll('[data-view]')){if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
 const headings={current:['Votre préparation','Retrouvez ici son avancement, le contenu disponible et la prochaine action.'],new:['Préparer une séance','Choisissez votre séance, ajoutez vos consignes, puis lancez la préparation.'],history:['Vos préparations','Reprenez un brouillon ou retrouvez une séance déjà préparée.'],library:['Votre bibliothèque','Ajoutez vos documents et retrouvez les passages utiles à vos séances.']};
 $('#page-title').textContent=headings[view][0];$('#page-description').textContent=headings[view][1];
 const url=new URL(location.href);if(selectedJob)url.searchParams.set('job',selectedJob);else url.searchParams.delete('job');if(view==='current')url.searchParams.delete('view');else url.searchParams.set('view',view);history.replaceState(null,'',url.pathname+url.search);
 if(focus){$('#page-title').setAttribute('tabindex','-1');$('#page-title').focus();window.scrollTo({top:0,behavior:'instant'});}
}
function prepareAgain(){
 if(!currentJob)return;const entry=entries.find(e=>e.id===currentJob.entryId);if(!entry)throw Error('Ce créneau n’est plus disponible. Choisissez une nouvelle séance dans la planification.');
 $('#generate [name=entryId]').value=entry.id;$('#generate [name=intent]').value=currentJob.brief.intent;showDuration();
 const wanted=new Set(currentJob.sourceIds||[]);for(const field of document.querySelectorAll('[name=source]'))field.checked=wanted.has(field.value)&&!field.disabled;updateSourceCount();
 sessionStorage.removeItem('tween-preparation-action');setView('new',{focus:true});
 const missing=[...wanted].filter(id=>!sources.some(s=>s.id===id&&s.status==='extracted'));
 message(`Les consignes ont été reprises. Vérifiez-les, puis lancez la préparation lorsque vous êtes prêt.${missing.length?' Certains documents ne sont plus disponibles : choisissez leurs remplacements.':''}`);
 $('#sources-options').open=missing.length>0||wanted.size>0;
}
function durationValue(){
 const hours=$('#duration-hours'),minutes=$('#duration-minutes');
 minutes.setCustomValidity('');
 const duration=hours.valueAsNumber*60+minutes.valueAsNumber;
 if(hours.validity.valid&&minutes.validity.valid&&(!Number.isInteger(duration)||duration<30||duration>600))minutes.setCustomValidity('La durée de la séance doit être comprise entre 30 minutes et 10 heures.');
 return duration;
}
function validatedDuration(){
 const duration=durationValue();
 return $('#duration-hours').reportValidity()&&$('#duration-minutes').reportValidity()?duration:null;
}
function updateDurationStatus(){
 const entry=selectedEntry(),duration=durationValue();
 $('#duration-status').textContent=!entry?'Aucun créneau à préparer.':entry.durationConfirmed&&entry.duration===duration?'Durée confirmée dans la planification.':'Durée à confirmer. Elle sera enregistrée dans la planification au lancement de la préparation.';
}
function showDuration(){
 const entry=selectedEntry();
 $('#duration-hours').value=entry?Math.floor(entry.duration/60):'';
 $('#duration-minutes').value=entry?entry.duration%60:'';
 $('#entry-summary').textContent=entry?[entry.module,entry.objective.split('\n').slice(1).join(' ')].filter(Boolean).join(' · '):'';
 updateDurationStatus();setPreparationBusy(preparationBusy);
}
function setPreparationBusy(busy){
 preparationBusy=busy;
 for(const control of document.querySelectorAll('#generate input, #generate select, #generate textarea, #generate button'))control.disabled=busy||!entries.length;
 $('#generate [type=submit]').disabled=busy||!entries.length||!generationConfigured;
 $('#generate [type=submit]').textContent=busy?'Enregistrement de la demande…':'Lancer la préparation';
}
async function confirmDuration(duration){
 const entry=selectedEntry();if(!entry)throw Error('Choisissez un créneau à préparer.');
 if(!entry.durationConfirmed||entry.duration!==duration){
  const path=`/api/plans/${encodeURIComponent(entry.classId)}/changes`;
  const proposal=await post(`${path}/propose`,{entryId:entry.id,patch:{duration,durationConfirmed:true},reason:'Confirmation de la durée de séance avant préparation'});
  const applied=await post(`${path}/${encodeURIComponent(proposal.id)}/apply`,{confirmed:true});
  Object.assign(entry,applied.newValue);
  const option=[...$('#generate [name=entryId]').options].find(option=>option.value===entry.id);if(option)option.textContent=entryLabel(entry);
  sessionStorage.removeItem('tween-preparation-action');
 }
 updateDurationStatus();return duration;
}
function showAIAccess(config){
 generationConfigured=config.configured;$('#ai-access').innerHTML=renderAIAccess(config);$('#ai-options').open=!generationConfigured;$('#ai-connection-summary').textContent=generationConfigured?(config.preference.provider==='chatgpt_plan'?'ChatGPT connecté':'API OpenAI configurée'):'Accès IA à configurer';setPreparationBusy(preparationBusy);
 wireAIAccess(config,{request:api,onConfigured:async()=>{
  const updated=await api('/api/preparation/config');showAIAccess(updated);
  // The new provider starts a new user action; old jobs retain their frozen configuration.
  sessionStorage.removeItem('tween-preparation-action');setView('new');
  message('ChatGPT est sélectionné. Vous pouvez lancer une nouvelle préparation.');
 }});
}
async function boot(){
 const session=await api('/api/session');if(session.user?.role!=='teacher'){message('Connectez-vous avec votre compte professeur dans l’espace principal.',true);return;}
 const [config,dashboard]=await Promise.all([api('/api/preparation/config'),api('/api/dashboard')]);entries=dashboard.entries.filter(e=>e.skills.length&&!['cancelled','replaced','postponed'].includes(e.status));
 $('#workspace').innerHTML=`
 <section id="new-panel" class="preparation-panel" hidden>
  <div class="preparation-form-layout">
   <div class="card pad preparation-form-card">
    <form id="generate">
     <div class="form-section"><p class="eyebrow">1 · VOTRE SÉANCE</p><h2>Quelle séance préparez-vous ?</h2>
      <label for="entry-choice">Créneau dans votre planification<select id="entry-choice" name="entryId">${entries.map(e=>`<option value="${esc(e.id)}" ${e.id===params.get('entry')?'selected':''}>${esc(entryLabel(e))}</option>`).join('')}</select></label><p id="entry-summary" class="field-help"></p>
      <fieldset class="session-duration" aria-describedby="duration-status"><legend>Durée avec les élèves</legend><div class="duration-fields"><label for="duration-hours">Heures<input id="duration-hours" name="durationHours" type="number" min="0" max="10" step="1" required></label><label for="duration-minutes">Minutes<input id="duration-minutes" name="durationMinutes" type="number" min="0" max="59" step="1" required></label></div><p id="duration-status" role="status"></p></fieldset>
     </div>
     <div class="form-section"><p class="eyebrow">2 · VOS CONSIGNES</p><h2>Vos objectifs pour les élèves</h2><label for="preparation-intent">Objectif, niveau des élèves et contraintes<textarea id="preparation-intent" name="intent" required maxlength="4000">Prépare une séance approfondie pour des débutants, avec prédiction, explication des mécanismes, enquête sur une erreur et production autonome justifiée.</textarea></label><p class="field-help">Précisez, par exemple, une difficulté à reprendre, un exercice à conserver ou un outil à utiliser.</p></div>
     <details id="sources-options" class="preparation-disclosure"><summary><span>Ajouter des documents</span><small id="source-selection-count">Facultatif</small></summary><p>La planification et les ressources existantes sont déjà prises en compte. Vous pouvez compléter avec vos cours, exercices ou références.</p><div id="sources"></div><button class="btn small" type="button" data-view="library">Importer un document dans la bibliothèque</button></details>
     <div class="preparation-submit"><button class="btn primary" type="submit">Lancer la préparation</button><p>Vous suivrez ensuite son avancement. La séance restera un brouillon jusqu’à votre publication.</p></div>
    </form>
   </div>
   <aside class="preparation-form-aside"><section class="card pad"><h2>Ce que vous allez préparer</h2><ul class="preparation-deliverables"><li>Un cours structuré pour vos élèves</li><li>Des activités et exercices progressifs</li><li>Un guide et des corrigés pour vous</li></ul><p>Vous pourrez relire et essayer la séance avant de la publier.</p><details id="ai-options" class="preparation-disclosure"><summary><span id="ai-connection-summary">Accès IA</span></summary><div id="ai-access"></div></details></section></aside>
  </div>
 </section>
 <section id="history-panel" class="preparation-panel card pad" hidden><div class="section-heading"><div><h2>Préparations sauvegardées</h2><p>Chaque demande conserve son brouillon et son avancement.</p></div><button type="button" class="btn" data-view="new">Préparer une autre séance</button></div><label for="history-search">Retrouver une séance<input type="search" id="history-search" placeholder="Un titre ou une date…"></label><div id="jobs"></div></section>
 <section id="library-panel" class="preparation-panel" hidden><div class="card pad"><h2>Ajouter un document</h2><p>Importez-le ici, puis sélectionnez-le dans les documents de votre prochaine préparation.</p><form id="import"><div class="import-fields"><label>Document<input type="file" name="file" required accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.html,.js,.mjs,.ts,.css,.py,.sh,.sql,.json,.yaml,.yml"></label><label>Type de document<select name="role">${Object.entries(roles).map(([v,l])=>`<option value="${v}" ${v==='reference'?'selected':''}>${l}</option>`).join('')}</select></label></div><details><summary>Préciser la version du document</summary><label>Version connue<input name="version"></label></details><button class="btn" type="submit">Importer le document</button></form><details><summary>Importer une page web</summary><form id="url"><label>Adresse de la page<input name="url" type="url" required placeholder="https://…"></label><button class="btn">Importer la page</button><p>La page doit appartenir à un domaine autorisé dans les réglages du serveur.</p></form></details></div><div id="document-library"></div><button class="btn" type="button" data-view="new">Revenir à ma demande</button></section>`;
 showDuration();showAIAccess(config);await Promise.all([refreshSources(),loadJobs()]);
 $('.preparation-nav').hidden=false;setView(params.get('view')||(selectedJob?'current':'new'));
 if(selectedJob)await showJob();

}
async function showJob(){
 if(!selectedJob||jobLoading)return;const requestedId=selectedJob;jobLoading=true;
 let job;try{job=await api('/api/preparation/jobs/'+encodeURIComponent(requestedId),{signal:AbortSignal.timeout(10000)});}
 catch(error){if(requestedId===selectedJob){jobTrackingOffline=true;updatePreparationActivity($('#job'),currentJob,activityOptions());}message('Connexion au suivi interrompue. Le statut du travail reste à vérifier.',true);throw error;}
 finally{jobLoading=false;}
 if(requestedId!==selectedJob)return;
 jobCheckedAt=Date.now();if(jobTrackingOffline)message('Connexion au suivi rétablie.');jobTrackingOffline=false;
 if(job.status==='queued'){
  await loadJobs();if(requestedId!==selectedJob)return;
  const previous=savedJobs.find(j=>j.id!==job.id&&j.createdAt<job.createdAt&&j.connectionId===job.connectionId&&['running','queued','retry_wait'].includes(j.status));
  if(previous)job.waitingFor={id:previous.id};
 }
 currentJob=job;
 const json=JSON.stringify(job);if(json===lastJobJSON){updatePreparationActivity($('#job'),job,activityOptions());return;}lastJobJSON=json;
 const review=job.decision,partial=job.preview?.completeness!=='candidate',guidance=preparationGuidance(job);
 const calls=job.callsTrace||[],detailStates=[...document.querySelectorAll('#job details[data-detail]')].map(d=>[d.dataset.detail,d.open]),choice=$('#session-choice')?.value,focused=$('#job').contains(document.activeElement)?document.activeElement.id:null,focusedDetail=$('#job').contains(document.activeElement)&&document.activeElement.matches('summary')?document.activeElement.closest('details[data-detail]')?.dataset.detail:null;
 const activity=renderPreparationActivity(job,activityOptions()),live=['running','retry_wait'].includes(job.status);
 $('#job').innerHTML=renderPreparationHeader(job,{activity:live?activity:''})+(live?'':activity)+`
 ${job.lessonId&&!['queued','running','retry_wait','fixture'].includes(job.status)?`<section class="card pad preparation-output"><h3>Modifier et publier le brouillon</h3><p>Demandez des ajustements par consigne, relisez les changements puis préparez la publication.</p><a class="btn primary" href="/?editLesson=${encodeURIComponent(job.lessonId)}">Ouvrir l’éditeur du brouillon</a></section>`:''}
 ${job.lessonId&&guidance.action!=='open-preview'?`<section class="card pad preparation-output"><h3>${partial?'Un premier aperçu est disponible':'Votre brouillon est disponible'}</h3><p>${partial?'Ce contenu est encore incomplet. Il ne constitue pas une séance validée.':'Vous pouvez essayer les activités avant de publier la séance.'}</p><div class="actions"><button type="button" class="btn" id="open-preview">${partial?'Voir l’aperçu partiel':'Relire la séance'}</button></div></section>`:''}
 ${job.corpus?.available?`<div class="preparation-download"><a class="btn" href="/api/corpus/${encodeURIComponent(job.lessonId)}/download?versionId=${encodeURIComponent(job.corpus.versionId)}">Télécharger les supports${job.corpus.complete?'':' partiels'}</a>${job.corpus.complete?'':'<span>Le cours complet et ses vérifications ne sont pas encore terminés.</span>'}</div>`:''}
 <details class="card pad preparation-disclosure" data-detail="request"><summary>Retrouver mes consignes et documents</summary><p>${esc(job.brief.intent)}</p><p>${job.sourceVersions?.length?job.sourceVersions.map(s=>esc(s.title)).join(' · '):'Planification et ressources existantes ; aucun document complémentaire.'}</p></details>
 <details class="card pad preparation-disclosure preparation-technical" data-detail="technical"><summary>Détails de conception et journal</summary>
 <p>Révision ${job.revision} · ${job.candidateCount} version(s) candidate(s) enregistrée(s).</p>
 ${job.reason?`<p class="error">${esc(job.reason)}</p>`:''}${job.budgetReason?`<p>${esc(job.budgetReason)}</p>`:''}
 <div class="actions">
 ${job.canReconcile&&guidance.action!=='reconcile'?'<button class="btn" id="reconcile">Vérifier le résultat enregistré</button>':''}
 ${job.canResume&&guidance.action!=='resume'?'<button class="btn" id="resume">Réessayer l’étape</button>':''}
 ${job.canRevise&&!job.budgetReason&&!job.sourceChanged&&guidance.action!=='revise'?`<button class="btn" id="revise" data-revision="${job.revision}">Revoir la conception</button>`:''}
 ${job.lessonId?`<button class="btn" data-diagnostic="${esc(job.lessonId)}">Consulter les diagnostics élèves</button>`:''}
 </div>
 ${job.documentary?`<details><summary>Analyse des sources enregistrée</summary><pre>${esc(JSON.stringify(job.documentary.content,null,2))}</pre></details>`:''}
 ${job.documentContext?`<details><summary>Passages consultés et limites documentaires</summary><p>${job.documentContext.omitted.length} passage(s) non transmis. Les analyses portent sur les passages listés ci-dessous.</p>${job.documentContext.passages.map(p=>`<button type="button" class="btn" data-passage-job="${esc(job.id)}" data-passage-source="${esc(p.sourceId)}" data-passage-id="${esc(p.segmentId)}">${esc(p.location)}</button>`).join('')}</details>`:''}
 ${job.plan?`<details><summary>Contrat de conception et couverture</summary>
 <p>${esc(job.plan.justification)}</p><p>Famille : ${esc(job.plan.contract?.family||'À préciser')} · ${job.plan.duration.minutes} min prévues.</p>
 <p>Résultat final : ${esc(job.plan.contract?.finalTask.production||'À préciser')}</p>
 <div class="table-wrap"><table><thead><tr><th>Acquis</th><th>Source → explication → pratique</th><th>Preuve et remédiation</th></tr></thead><tbody>${job.plan.coverage.map(c=>`<tr><td>${esc(c.skill)}</td><td>${esc(c.sourceSegments.join(', '))}<br>${esc(c.explanationBlockId)} → ${esc(c.activityIds.join(', '))}</td><td>${esc(c.evidence)}<br>${esc(c.remediation)}</td></tr>`).join('')}</tbody></table></div>
 <details><summary>Activités, fichiers et hypothèses</summary><pre>${esc(JSON.stringify(job.plan.contract,null,2))}</pre></details></details>`:''}

 ${job.contractIssues?.length?`<h3>Points à corriger avant rédaction</h3><ul>${job.contractIssues.map(i=>`<li>${esc(i.location+' : '+i.problem)}</li>`).join('')}</ul>`:''}
 ${review?`<details><summary>Bilan des vérifications${job.simulation?' simulées':''}</summary><p>Revue : ${review.score}/100</p>${review.report.issues.map(i=>`<article class="source"><strong>${esc(i.severity+' · '+i.location)}</strong><p>${esc(i.problem)}</p><p>${esc(i.requestedChange)}</p></article>`).join('')}<ul>${review.checks.map(c=>`<li><details><summary>${esc(c.status+' · '+c.id)}</summary><pre>${esc(c.evidence)}</pre></details></li>`).join('')}</ul></details>`:''}
 <details><summary>Revues des versions candidates</summary><pre>${esc(JSON.stringify(job.reports,null,2))}</pre></details>
 <details><summary>Étapes réelles et paramètres IA</summary>
 <p>${job.calls} appel(s) soumis · plafond ${job.maxCandidates} version(s) candidate(s), relectures distinctes · worker ${esc(job.workerState)}.</p>
 <p>${job.provider==='chatgpt_plan'?'Utilisation du forfait ChatGPT':'API OpenAI'} · ${esc(job.profiles?.design?.model||'Modèle non configuré')}</p>
 <p>Une tentative d’issue inconnue peut avoir consommé du quota. Sa provision reste réservée, même après annulation.</p>
 <pre>${esc(JSON.stringify({policyVersion:job.policyVersion,events:job.events,profiles:job.profiles,calls,estimatedUSD:job.spentUSD,reservedMaximumUSD:job.reservedUSD},null,2))}</pre></details></details>
 ${job.canCancel?'<div class="preparation-stop"><button type="button" class="btn danger" id="cancel">Annuler la préparation</button><span>Le travail enregistré sera conservé.</span></div>':''}`;
 for(const [key,open] of detailStates){const detail=$(`#job details[data-detail="${key}"]`);if(detail)detail.open=open;}
 if(choice&&$('#session-choice'))$('#session-choice').value=choice;
 if(focused&&document.getElementById(focused))document.getElementById(focused).focus({preventScroll:true});
 else if(focusedDetail)$(`#job details[data-detail="${focusedDetail}"]>summary`)?.focus({preventScroll:true});
}
document.addEventListener('change',event=>{if(event.target.matches('#generate [name=entryId]'))showDuration();if(event.target.matches('[name=source]'))updateSourceCount();});
document.addEventListener('input',event=>{if(event.target.matches('#history-search'))renderJobs();if(event.target.matches('#duration-hours, #duration-minutes'))updateDurationStatus();if(event.target.matches('#preview [data-answer]'))previewAnswers[event.target.dataset.answer]=event.target.value;});
document.addEventListener('submit',async event=>{
 const f=event.target;if(!['import','url','generate'].includes(f.id))return;event.preventDefault();
 if(f.id==='generate'&&preparationBusy)return;
 const duration=f.id==='generate'?validatedDuration():null;
 if(f.id==='generate'&&duration===null)return;
 const data=new FormData(f),button=f.querySelector('[type=submit]')||f.querySelector('button');
 if(f.id==='generate')setPreparationBusy(true);else button.disabled=true;
 try{
 if(f.id==='import'){const file=data.get('file'),r=await fetch('/api/preparation/sources',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Source-Filename':encodeURIComponent(file.name),'X-Source-Role':data.get('role'),'X-Source-Version':encodeURIComponent(data.get('version'))},body:file});const result=await r.json();if(!r.ok)throw Error(result.error);await refreshSources();message('Document conservé et extraction terminée. Vérifiez les limites signalées.');}
 if(f.id==='url'){await post('/api/preparation/sources/url',{url:data.get('url'),role:'reference'});await refreshSources();message('Page importée.');}
 if(f.id==='generate'){
  if(!generationConfigured)throw Error('Choisissez et enregistrez votre accès IA ci-dessus avant de lancer la préparation.');
  await confirmDuration(duration);
  const body={entryId:data.get('entryId'),intent:data.get('intent'),sourceIds:[...document.querySelectorAll('[name=source]:checked')].map(x=>x.value)},fingerprint=JSON.stringify({...body,duration});
  let action;try{action=JSON.parse(sessionStorage.getItem('tween-preparation-action'));}catch{}
  if(action?.fingerprint!==fingerprint)action={fingerprint,requestId:crypto.randomUUID()};
  sessionStorage.setItem('tween-preparation-action',JSON.stringify(action));
  const j=await post('/api/preparation/jobs',{...body,requestId:action.requestId});sessionStorage.setItem('tween-preparation-action',JSON.stringify({...action,jobId:j.id}));selectedJob=j.id;lastJobJSON='';preview=null;previewInfo=null;$('#preview').replaceChildren();setView('current',{focus:true});await showJob();await loadJobs();message('Votre demande est enregistrée. Vous pouvez suivre sa préparation ici.');
 }
 }catch(e){message(e.message,true);}finally{if(f.id==='generate')setPreparationBusy(false);else button.disabled=false;}
});
document.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b)return;try{
 if(b.dataset.view){
  if(preparationBusy)return;
  if(b.dataset.view==='new'&&activeView!=='new'){let action;try{action=JSON.parse(sessionStorage.getItem('tween-preparation-action'));}catch{}if(action?.jobId)sessionStorage.removeItem('tween-preparation-action');}
  setView(b.dataset.view,{focus:true});message('');if(activeView==='history')await loadJobs();if(activeView==='current')await showJob();return;
 }
 if(b.id==='prepare-again'){prepareAgain();return;}
 if(b.id==='refresh-job'){b.disabled=true;try{await showJob();message('État actualisé.');}finally{b.disabled=false;}return;}

 if(b.dataset.job){preview=null;previewInfo=null;previewAnswers={};$('#preview').replaceChildren();selectedJob=b.dataset.job;lastJobJSON='';$('#job').replaceChildren();setView('current',{focus:true});message('');await showJob();}
 if(['reconcile','resume','revise'].includes(b.id)){
  if(jobActionBusy)return;jobActionBusy=true;b.disabled=true;message('Vérification de l’avancement…');
  const action=b.id==='resume'?{action:'new_attempt'}:b.id==='revise'?{expectedRevision:Number(b.dataset.revision)}:{};
  if(b.id==='revise'&&currentJob?.sourceChanged){action.sourceIds=[...document.querySelectorAll('[name=source]:checked')].map(x=>x.value);if(!action.sourceIds.length)throw Error('Cochez les versions de documents à adopter avant de revoir la conception.');}
  try{const result=await post(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/${b.id}`,action);message(result.reconciliationReason||({worker_active:'La préparation se poursuit.',saved_result:'Résultat enregistré réutilisé.',remote_recovered:'Résultat récupéré.',remote_active:'La même réponse IA est toujours en cours.',unknown_unrecoverable:'Aucun résultat complet n’a pu être récupéré. Une nouvelle tentative reste une action distincte.'}[result.reconciliation]||'État actualisé.'));await showJob();await loadJobs();}finally{b.disabled=false;jobActionBusy=false;}
 }
 if(b.id==='choose-session'){await post(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/session`,{sessionId:$('#session-choice').value,expectedRevision:Number(b.dataset.revision)});await showJob();}
 if(b.id==='cancel'||b.dataset.cancelJob){
  const id=b.dataset.cancelJob||selectedJob;if(!id||jobActionBusy||cancellingJobs.has(id))return;
  cancellingJobs.add(id);jobActionBusy=true;b.disabled=true;b.textContent='Annulation…';
  try{
   const result=await post(`/api/preparation/jobs/${encodeURIComponent(id)}/cancel`,{});
   savedJobs=savedJobs.map(j=>j.id===id?result:j);renderJobs();
   if(selectedJob===id)await showJob();await loadJobs();
   message('Préparation annulée. Le brouillon enregistré est conservé.');
  }finally{cancellingJobs.delete(id);jobActionBusy=false;b.disabled=false;b.textContent='Annuler la préparation';renderJobs();if(activeView==='history')document.querySelector(`[data-job="${CSS.escape(id)}"]`)?.focus({preventScroll:true});}
 }
 if(b.dataset.diagnostic){const result=await api(`/api/preparation/diagnostic/${encodeURIComponent(b.dataset.diagnostic)}`),statuses={not_started:'Non commencé',incorrect:'Incorrect',partially_correct:'Partiellement correct',correct:'Correct',insufficient_observation:'Observation insuffisante',technical_incident:'Incident technique'};$('#preview').hidden=false;$('#preview').innerHTML=`<section class="card pad"><h2>Diagnostic de début de séance</h2><p>Prérequis : ${esc(result.prerequisites.join(' · '))}</p><div class="table-wrap"><table><thead><tr><th>Élève</th><th>Observation</th><th>Suite proposée</th></tr></thead><tbody>${result.observations.map(o=>`<tr><td>${esc(o.name)}</td><td>${esc(statuses[o.status])}</td><td>${esc(o.next)}</td></tr>`).join('')}</tbody></table></div></section>`;}
 if(b.dataset.verify){const reason=window.prompt('Qu’avez-vous vérifié dans l’original (pages, ordre, tableaux, code, figures) ?');if(reason){await post(`/api/preparation/sources/${encodeURIComponent(b.dataset.verify)}/verify`,{confirmed:true,reason});await refreshSources();}}
 if(b.id==='open-preview'){const result=await api(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/preview`);if(previewInfo?.lessonVersionId!==result.preparation.lessonVersionId)previewAnswers={};preview=result.spec;previewInfo=result.preparation;step=0;drawPreview();$('#preview').scrollIntoView({behavior:'instant',block:'start'});}
 if(b.dataset.action==='run-code'){const field=document.querySelector(`[data-answer="${CSS.escape(b.dataset.id)}"]`),result=await post(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/test`,{taskId:b.dataset.id,code:field?.value||'',lessonVersionId:previewInfo?.lessonVersionId}),output=document.getElementById('console-'+b.dataset.id);output.hidden=false;output.textContent=(result.logs||[]).join('\n');}
 if(b.dataset.action?.startsWith('demo-')){if(b.dataset.action==='demo-step')step=Number(b.dataset.id);if(b.dataset.action==='demo-next')step=Math.min(preview.blocks.length-1,step+1);if(b.dataset.action==='demo-prev')step=Math.max(0,step-1);drawPreview();}
 }catch(e){message(e.message,true);}});
function drawPreview(){$('#preview').hidden=false;$('#preview').innerHTML=`<p>Prévisualisation ${previewInfo?.preview?.completeness==='candidate'?'du brouillon':'partielle'} · version ${esc(preview?.lessonVersion)} · révision ${previewInfo?.revision}. Les réponses ne sont pas remises.</p>${previewEditorStep(preview)>=0?'<button type="button" class="btn" data-preview-editors>Aller aux éditeurs</button>':'<p>Cette version ne contient pas encore d’exercice avec éditeur de code.</p>'}`+renderLessonPage(preview,step,{demo:true,answers:previewAnswers});}
document.addEventListener('click',event=>{if(event.target.closest('[data-preview-editors]')&&preview){step=previewEditorStep(preview);drawPreview();focusPreviewEditor($('#preview'));}});
installWorkshopInteractions({getActivity:id=>[...(preview?.activities||[]),...(preview?.diagnostic.tasks||[])].find(a=>a.id===id)});
setInterval(()=>{if(selectedJob&&activeView==='current'&&!jobActionBusy&&!document.hidden)showJob().catch(()=>message('Connexion au suivi interrompue. Nouvelle vérification automatique au prochain essai.',true));},3000);
setInterval(()=>{if(activeView==='current'&&currentJob?.id===selectedJob&&!document.hidden)updatePreparationActivity($('#job'),currentJob,activityOptions());},1000);
boot().catch(e=>message(e.message,true));
