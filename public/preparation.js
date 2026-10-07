import {escape as esc,renderLessonPage} from './lesson-renderer.js';
import {installWorkshopInteractions} from './workshop-runtime.js';
import {installDOMLabs} from './dom-lab.js';
import {installTerminalLabs} from './terminal-lab.js';
import {renderAIAccess,wireAIAccess} from './ai-access.js';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
let sources=[],entries=[],selectedJob=params.get('job'),preview=null,previewAnswers={},step=0,lastJobJSON='';
let generationConfigured=false,preparationBusy=false,currentJob=null,previewInfo=null;
installDOMLabs({getLesson:()=>preview,getJob:()=>selectedJob});
installTerminalLabs({getLesson:()=>({id:previewInfo?.lessonId,versionId:previewInfo?.lessonVersionId}),getJob:()=>selectedJob});
const labels={queued:'En attente',running:'En cours',retry_wait:'Reprise temporisée',completed:'Séance prête à relire',blocked:'Brouillon bloqué',cancelled:'Annulée',fixture:'Fixture de recette — pas une génération IA'};
const stages={context:'Préciser la séance dans la fiche',assemble:'Assembler les sources et le diagnostic',analysis:'Analyser les sources',design:'Analyser les documents et concevoir le parcours',planReview:'Vérifier le parcours',write:'Rédiger les unités',repair:'Corriger les anomalies',checks:'Vérifier les solutions et le rendu',review:'Relecture pédagogique indépendante',complete:'Revue terminée'};
const roles={curriculum:'Référentiel',progression:'Progression',technical:'Documentation technique',reference:'Cours de référence',exercise:'Exercice',solution:'Corrigé privé',tone:'Exemple de ton',visual:'Référence visuelle'};
async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||data.message||`Erreur ${r.status}`);return data;}
const post=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});
function message(text,error=false){$('#message').textContent=text;$('#message').className=error?'error':'';}
function sourceList(){return sources.map(s=>`<div class="source"><label><input type="checkbox" name="source" value="${esc(s.id)}" ${s.status!=='extracted'?'disabled':''}> ${esc(s.title)} · v${s.version} · ${esc(roles[s.role])}</label><span>${s.status==='extracted'?'Extraite, analyse lors de la conception':'Extraction à vérifier'} · ${s.segments.length} segment(s)</span>${s.warnings.length?`<ul>${s.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}<details><summary>Structure et provenance</summary>${s.segments.map(x=>`<h4>${esc(x.parent)}</h4><small>${esc(x.location)}</small><pre>${esc(x.text)}</pre>`).join('')}<p>SHA-256 : ${esc(s.contentHash)}</p><a href="/api/preparation/sources/${encodeURIComponent(s.id)}/original">Document original</a></details>${s.status!=='extracted'&&s.segments.length?`<button class="btn" data-verify="${esc(s.id)}">J’ai vérifié l’extraction</button>`:''}</div>`).join('')||'<p>Aucun document importé. La bibliothèque existante reste disponible pour les compétences du créneau.</p>';}
async function refreshSources(){sources=await api('/api/preparation/sources');$('#sources').innerHTML=sourceList();}
async function loadJobs(){const jobs=await api('/api/preparation/jobs');$('#jobs').innerHTML=jobs.map(j=>`<button type="button" class="btn" data-job="${esc(j.id)}">${esc(j.brief.entry.objective)} · ${esc(labels[j.status]||j.status)}</button>`).join('')||'<p>Aucune préparation.</p>';}
const entryLabel=entry=>`${entry.date} · ${entry.objective}${entry.durationConfirmed?'':' · durée à confirmer'}`;
const selectedEntry=()=>entries.find(entry=>entry.id===$('#generate [name=entryId]').value);
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
 updateDurationStatus();setPreparationBusy(preparationBusy);
}
function setPreparationBusy(busy){
 preparationBusy=busy;
 for(const control of document.querySelectorAll('#generate input, #generate select, #generate textarea, #generate button'))control.disabled=busy||!entries.length;
 $('#generate [type=submit]').disabled=busy||!entries.length||!generationConfigured;
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
 generationConfigured=config.configured;$('#ai-access').innerHTML=renderAIAccess(config);setPreparationBusy(preparationBusy);
 wireAIAccess(config,{request:api,onConfigured:async()=>{
  const updated=await api('/api/preparation/config');showAIAccess(updated);
  // The new provider starts a new user action; old jobs retain their frozen configuration.
  sessionStorage.removeItem('tween-preparation-action');selectedJob=null;lastJobJSON='';$('#job').innerHTML='';
  const url=new URL(location.href);url.searchParams.delete('job');history.replaceState(null,'',url.pathname+url.search);
  message('ChatGPT est sélectionné. Vous pouvez lancer une nouvelle préparation.');
 }});
}
async function boot(){
 const session=await api('/api/session');if(session.user?.role!=='teacher'){message('Connectez-vous avec votre compte professeur dans l’espace principal.',true);return;}
 const [config,dashboard]=await Promise.all([api('/api/preparation/config'),api('/api/dashboard')]);entries=dashboard.entries.filter(e=>e.skills.length&&!['cancelled','replaced','postponed'].includes(e.status));
 $('#workspace').innerHTML=`<section class="card pad" id="ai-access"></section><div class="columns"><section class="card pad"><h2>1. Documents de travail</h2><form id="import"><label>Document<input type="file" name="file" required accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.html,.js,.mjs,.ts,.css,.py,.sh,.sql,.json,.yaml,.yml"></label><label>Rôle<select name="role">${Object.entries(roles).map(([v,l])=>`<option value="${v}" ${v==='reference'?'selected':''}>${l}</option>`).join('')}</select></label><label>Version connue (facultatif)<input name="version"></label><button class="btn" type="submit">Importer le document</button></form><details><summary>Importer une URL autorisée</summary><form id="url"><label>URL HTTPS<input name="url" type="url" required></label><button class="btn">Importer la page</button><p>Les domaines sont autorisés dans la configuration du serveur.</p></form></details><div id="sources"></div></section><section class="card pad"><h2>2. Préparer la séance</h2><form id="generate"><label>Créneau<select name="entryId">${entries.map(e=>`<option value="${esc(e.id)}" ${e.id===params.get('entry')?'selected':''}>${esc(entryLabel(e))}</option>`).join('')}</select></label><fieldset class="session-duration" aria-describedby="duration-help duration-status"><legend>Durée de la séance</legend><div class="duration-fields"><label for="duration-hours">Heures<input id="duration-hours" name="durationHours" type="number" min="0" max="10" step="1" required></label><label for="duration-minutes">Minutes<input id="duration-minutes" name="durationMinutes" type="number" min="0" max="59" step="1" required></label></div><p id="duration-help">De 30 minutes à 10 heures, pauses comprises.</p><p id="duration-status" role="status"></p><button class="btn" type="button" id="confirm-duration">Confirmer la durée</button></fieldset><label>Objectif, niveau et contraintes<textarea name="intent" required maxlength="4000">Prépare une séance approfondie pour des débutants, avec prédiction, explication des mécanismes, enquête sur une erreur et production autonome justifiée.</textarea></label><p>Cochez les documents à utiliser. Les corrigés restent réservés au professeur et aux agents de préparation.</p><button class="btn primary" type="submit">Préparer la séance complète</button><button class="btn" type="button" id="new-version">Nouvelle version</button></form><h2>Préparations sauvegardées</h2><div id="jobs" class="actions"></div><details><summary>Mécanismes de conception</summary>${config.mechanisms.map(m=>`<h3>${esc(m.use)}</h3><p>${esc(m.production)}</p><small>Adaptation Tween Teach · ${esc(m.inspiration)}</small>`).join('')}</details></section></div>`;
 showDuration();showAIAccess(config);await Promise.all([refreshSources(),loadJobs()]);if(selectedJob)await showJob();
}
async function showJob(){
 if(!selectedJob)return;
 let job;try{job=await api('/api/preparation/jobs/'+encodeURIComponent(selectedJob));}
 catch(error){message('Connexion au suivi interrompue. Le statut du travail reste à vérifier.',true);throw error;}
 currentJob=job;
 const json=JSON.stringify(job);if(json===lastJobJSON)return;lastJobJSON=json;
 const review=job.decision,partial=job.preview?.completeness!=='candidate';
 const state=job.recovery==='uncertain'?'Résultat de la dernière tentative non confirmé':labels[job.status]||job.status;
 const calls=job.callsTrace||[];
 $('#job').innerHTML=`<div class="card pad"><h2>${esc(job.brief.entry.objective)}</h2>
 <p class="status" role="status">${esc(state)} · ${esc(stages[job.stage]||job.stage)}</p>
 <p>Révision ${job.revision} · ${job.candidateCount} version(s) candidate(s) enregistrée(s).</p>
 ${job.simulation?'<p class="error">Fixture de recette : appels IA simulés, publication indisponible.</p>':''}
 ${job.reason?`<p class="error">${esc(job.reason)}</p>`:''}
 ${job.status==='blocked'&&job.budgetReason?`<p>${esc(job.budgetReason)}</p>`:''}
 <div class="actions">
 ${job.canReconcile?'<button class="btn" id="reconcile">Vérifier l’avancement</button>':''}
 ${job.canResume?'<button class="btn" id="resume">Nouvelle tentative de cette étape</button>':''}
 ${job.canRevise?`<button class="btn" id="revise" data-revision="${job.revision}">Actualiser la conception et ses règles</button>`:''}
 ${job.canCancel?'<button class="btn" id="cancel">Annuler la préparation</button>':''}
 ${job.lessonId?`<button class="btn" id="open-preview" data-lesson="${esc(job.lessonId)}">${partial?'Aperçu partiel disponible':'Aperçu élève du brouillon'}</button><button class="btn" data-diagnostic="${esc(job.lessonId)}">Diagnostic de début de séance</button>`:''}
 ${job.corpus?.available?`<a class="btn" href="/api/corpus/${encodeURIComponent(job.lessonId)}/download?versionId=${encodeURIComponent(job.corpus.versionId)}">Corpus professeur${job.corpus.complete?'':' partiel'}</a>`:''}
 </div>
 ${job.corpus?.missing?.length?`<p>${esc(job.corpus.missing.join(' '))}</p>`:''}
 ${job.documentary?`<details><summary>Analyse des sources enregistrée</summary><pre>${esc(JSON.stringify(job.documentary.content,null,2))}</pre></details>`:''}
 ${job.plan?`<details open><summary>Contrat de conception et couverture</summary>
 <p>${esc(job.plan.justification)}</p><p>Famille : ${esc(job.plan.contract?.family||'À préciser')} · ${job.plan.duration.minutes} min prévues.</p>
 <p>Résultat final : ${esc(job.plan.contract?.finalTask.production||'À préciser')}</p>
 <div class="table-wrap"><table><thead><tr><th>Acquis</th><th>Source → explication → pratique</th><th>Preuve et remédiation</th></tr></thead><tbody>${job.plan.coverage.map(c=>`<tr><td>${esc(c.skill)}</td><td>${esc(c.sourceSegments.join(', '))}<br>${esc(c.explanationBlockId)} → ${esc(c.activityIds.join(', '))}</td><td>${esc(c.evidence)}<br>${esc(c.remediation)}</td></tr>`).join('')}</tbody></table></div>
 <details><summary>Activités, fichiers et hypothèses</summary><pre>${esc(JSON.stringify(job.plan.contract,null,2))}</pre></details></details>`:''}
 ${job.stage==='context'?`<label>Séance dans la fiche<select id="session-choice">${job.brief.resolvedContext.sessions.map(s=>`<option value="${esc(s.id)}">${esc(s.sheet)} · ligne ${s.row} · ${esc(s.cells.filter(Boolean).join(' — '))}</option>`).join('')}</select></label><button class="btn" id="choose-session" data-revision="${job.revision}">Utiliser cette séance</button>`:''}
 ${job.contractIssues?.length?`<h3>Points à corriger avant rédaction</h3><ul>${job.contractIssues.map(i=>`<li>${esc(i.location+' : '+i.problem)}</li>`).join('')}</ul>`:''}
 ${review?`<details open><summary>Bilan des vérifications${job.simulation?' simulées':''}</summary><p>Revue : ${review.score}/100</p>${review.report.issues.map(i=>`<article class="source"><strong>${esc(i.severity+' · '+i.location)}</strong><p>${esc(i.problem)}</p><p>${esc(i.requestedChange)}</p></article>`).join('')}<ul>${review.checks.map(c=>`<li><details><summary>${esc(c.status+' · '+c.id)}</summary><pre>${esc(c.evidence)}</pre></details></li>`).join('')}</ul></details>`:''}
 <details><summary>Revues des versions candidates</summary><pre>${esc(JSON.stringify(job.reports,null,2))}</pre></details>
 <details><summary>Étapes réelles et paramètres IA</summary>
 <p>${job.calls} appel(s) soumis · plafond ${job.maxCandidates} version(s) candidate(s), relectures distinctes · worker ${esc(job.workerState)}.</p>
 <p>${job.provider==='chatgpt_plan'?'Utilisation du forfait ChatGPT':'API OpenAI'} · ${esc(job.profiles?.design?.model||'Modèle non configuré')}</p>
 <p>Une tentative d’issue inconnue peut avoir consommé du quota. Sa provision reste réservée, même après annulation.</p>
 <pre>${esc(JSON.stringify({policyVersion:job.policyVersion,events:job.events,profiles:job.profiles,calls,estimatedUSD:job.spentUSD,reservedMaximumUSD:job.reservedUSD},null,2))}</pre></details></div>`;
}
document.addEventListener('change',event=>{if(event.target.matches('#generate [name=entryId]'))showDuration();});
document.addEventListener('input',event=>{if(event.target.matches('#duration-hours, #duration-minutes'))updateDurationStatus();if(event.target.matches('#preview [data-answer]'))previewAnswers[event.target.dataset.answer]=event.target.value;});
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
  const j=await post('/api/preparation/jobs',{...body,requestId:action.requestId});selectedJob=j.id;history.replaceState(null,'','?job='+encodeURIComponent(j.id));await showJob();await loadJobs();message('Demande enregistrée. Le statut ci-dessous indique les étapes réellement effectuées.');
 }
 }catch(e){message(e.message,true);}finally{if(f.id==='generate')setPreparationBusy(false);else button.disabled=false;}
});
document.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b)return;try{
 if(b.id==='confirm-duration'){
  if(preparationBusy)return;
  const duration=validatedDuration();if(duration===null)return;
  setPreparationBusy(true);
  try{await confirmDuration(duration);message('Durée de la séance enregistrée. Vous pouvez lancer la préparation.');}finally{setPreparationBusy(false);}
 }
 if(b.dataset.job){preview=null;previewInfo=null;previewAnswers={};$('#preview').replaceChildren();selectedJob=b.dataset.job;history.replaceState(null,'','?job='+encodeURIComponent(selectedJob));await showJob();}
 if(b.id==='new-version'){sessionStorage.removeItem('tween-preparation-action');message('Le prochain lancement créera une nouvelle préparation et pourra consommer du quota.');}
 if(['reconcile','resume','revise'].includes(b.id)){
  b.disabled=true;message('Vérification de l’avancement…');
  const action=b.id==='resume'?{action:'new_attempt'}:b.id==='revise'?{expectedRevision:Number(b.dataset.revision)}:{};
  try{const result=await post(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/${b.id}`,action);message(result.reconciliationReason||({worker_active:'Le worker poursuit le même travail.',saved_result:'Résultat enregistré réutilisé.',remote_recovered:'Résultat distant récupéré.',remote_active:'Le même appel distant est toujours en cours.',unknown_unrecoverable:'Cette intégration ne peut pas récupérer cet appel. Une nouvelle tentative reste distincte.'}[result.reconciliation]||'État actualisé.'));await showJob();await loadJobs();}finally{b.disabled=false;}
 }
 if(b.id==='choose-session'){await post(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/session`,{sessionId:$('#session-choice').value,expectedRevision:Number(b.dataset.revision)});await showJob();}
 if(b.id==='cancel'){await post(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/cancel`,{});await showJob();await loadJobs();}
 if(b.dataset.diagnostic){const result=await api(`/api/preparation/diagnostic/${encodeURIComponent(b.dataset.diagnostic)}`),statuses={not_started:'Non commencé',incorrect:'Incorrect',partially_correct:'Partiellement correct',correct:'Correct',insufficient_observation:'Observation insuffisante',technical_incident:'Incident technique'};$('#preview').innerHTML=`<section class="card pad"><h2>Diagnostic de début de séance</h2><p>Prérequis : ${esc(result.prerequisites.join(' · '))}</p><div class="table-wrap"><table><thead><tr><th>Élève</th><th>Observation</th><th>Suite proposée</th></tr></thead><tbody>${result.observations.map(o=>`<tr><td>${esc(o.name)}</td><td>${esc(statuses[o.status])}</td><td>${esc(o.next)}</td></tr>`).join('')}</tbody></table></div></section>`;}
 if(b.dataset.verify){const reason=window.prompt('Qu’avez-vous vérifié dans l’original (pages, ordre, tableaux, code, figures) ?');if(reason){await post(`/api/preparation/sources/${encodeURIComponent(b.dataset.verify)}/verify`,{confirmed:true,reason});await refreshSources();}}
 if(b.id==='open-preview'){const result=await api(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/preview`);if(previewInfo?.lessonVersionId!==result.preparation.lessonVersionId)previewAnswers={};preview=result.spec;previewInfo=result.preparation;step=0;drawPreview();}
 if(b.dataset.action==='run-code'){const field=document.querySelector(`[data-answer="${CSS.escape(b.dataset.id)}"]`),result=await post(`/api/preparation/jobs/${encodeURIComponent(selectedJob)}/test`,{taskId:b.dataset.id,code:field?.value||'',lessonVersionId:previewInfo?.lessonVersionId}),output=document.getElementById('console-'+b.dataset.id);output.hidden=false;output.textContent=(result.logs||[]).join('\n');}
 if(b.dataset.action?.startsWith('demo-')){if(b.dataset.action==='demo-step')step=Number(b.dataset.id);if(b.dataset.action==='demo-next')step=Math.min(preview.blocks.length-1,step+1);if(b.dataset.action==='demo-prev')step=Math.max(0,step-1);drawPreview();}
 }catch(e){message(e.message,true);}});
function drawPreview(){$('#preview').innerHTML=`<p>Prévisualisation ${previewInfo?.preview?.completeness==='candidate'?'du brouillon':'partielle'} · version ${esc(preview?.lessonVersion)} · révision ${previewInfo?.revision}. Les réponses ne sont pas remises.</p>`+renderLessonPage(preview,step,{demo:true,answers:previewAnswers});}
installWorkshopInteractions({getActivity:id=>[...(preview?.activities||[]),...(preview?.diagnostic.tasks||[])].find(a=>a.id===id)});
setInterval(()=>{if(selectedJob&&!document.hidden)showJob().catch(()=>message('Connexion au suivi interrompue. Nouvelle vérification automatique au prochain essai.',true));},3000);
boot().catch(e=>message(e.message,true));
