import {escape as esc} from './lesson-renderer.js';

export const preparationLabels={queued:'En attente',running:'En cours',retry_wait:'En attente de réponse',completed:'Prête à relire',blocked:'À reprendre',cancelled:'Annulée',fixture:'Démonstration'};
export const preparationStages={context:'Choix de la séance',assemble:'Rassemblement des documents',analysis:'Lecture des documents',design:'Conception du parcours',planReview:'Vérification du parcours',write:'Rédaction de la séance',repair:'Amélioration de la séance',checks:'Vérification des exercices',review:'Relecture pédagogique',complete:'Vérifications terminées'};
export const formatDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'Date à préciser';
export function formatDuration(value){if(!Number.isFinite(value))return 'Durée à préciser';const hours=Math.floor(value/60),minutes=value%60;return [hours?`${hours} h`:'',minutes?`${minutes} min`:''].filter(Boolean).join(' ');}

export function preparationGuidance(job){
 if(job.status==='cancelled')return {tone:'neutral',title:'Cette préparation a été arrêtée',text:'Le travail déjà enregistré est conservé. Vous pouvez préparer une nouvelle séance à partir des mêmes consignes.',action:'prepare-again',label:'Préparer à nouveau cette séance'};
 if(job.status==='completed')return {tone:'success',title:'Votre séance est prête à relire',text:'Ouvrez le brouillon pour vérifier le contenu et essayer les exercices. La séance n’est pas encore publiée aux élèves.',action:job.lessonId?'open-preview':null,label:'Relire la séance'};
 if(job.status==='fixture')return {tone:'neutral',title:'Aperçu de démonstration',text:'Cette séance utilise des réponses IA simulées. Elle permet de vérifier l’interface et ne peut pas être publiée.',action:job.lessonId?'open-preview':null,label:'Ouvrir la démonstration'};
 if(job.stage==='context'&&job.status==='blocked')return {tone:'attention',title:'Quelle séance faut-il préparer ?',text:'Plusieurs lignes de votre fiche correspondent à cette date. Choisissez la bonne ligne ci-dessous pour poursuivre.'};
 if(job.status==='blocked'){
  if(job.budgetReason)return {tone:'attention',title:job.budgetReason.includes('durée')?'Le délai de cette préparation est dépassé':'La limite d’appels de cette préparation est atteinte',text:'Il s’agit d’une limite locale de cette demande, pas d’une indication de votre quota ChatGPT. Le brouillon est conservé. Vérifiez les consignes avant de lancer une nouvelle préparation.',action:'prepare-again',label:'Préparer à nouveau cette séance'};
  if(job.sourceChanged)return {tone:'attention',title:'Les documents ont changé',text:'Choisissez les documents à utiliser pour la nouvelle préparation. Le brouillon actuel restera dans l’historique.',action:'prepare-again',label:'Revoir les documents et les consignes'};
  if(job.recovery==='uncertain')return {tone:'attention',title:'La réponse de l’IA reste à vérifier',text:'L’application n’a pas reçu de confirmation complète. Vérifiez d’abord si un résultat a été enregistré. Une nouvelle tentative peut consommer du quota.',action:job.canReconcile?'reconcile':null,label:'Vérifier le résultat'};
  if(job.canResume)return {tone:'attention',title:'La préparation s’est interrompue',text:'Le travail déjà enregistré est conservé. Vous pouvez réessayer l’étape interrompue ; cette action peut consommer du quota.',action:'resume',label:'Réessayer l’étape'};
  if(job.canRevise)return {tone:'attention',title:'Le parcours doit être revu',text:'Les vérifications ont repéré un problème avant la rédaction. Vous pouvez demander une nouvelle conception dans les limites restantes de cette préparation.',action:'revise',label:'Revoir la conception'};
  return {tone:'attention',title:'La préparation ne peut pas continuer',text:job.reason||'Vérifiez le créneau, les documents et votre accès IA avant de préparer à nouveau la séance.',action:'prepare-again',label:'Revoir ma demande'};
 }
 if(job.status==='queued')return {tone:'neutral',title:job.waitingFor?'Votre séance attend son tour':'Votre demande est enregistrée',text:job.waitingFor?'Une autre préparation doit se terminer avant celle-ci. Votre demande est bien enregistrée ; inutile de la relancer.':'Elle attend son traitement. Vous pouvez quitter cette page et la retrouver dans l’historique. Inutile de lancer une seconde demande.'};
 if(job.status==='retry_wait')return {tone:'neutral',title:'La préparation attend une réponse',text:'Le suivi reprendra automatiquement. Le contenu déjà enregistré est conservé ; aucune action n’est nécessaire pour l’instant.'};
 return {tone:'active',title:preparationStages[job.stage]||'Préparation en cours',text:job.workerState==='lease_expired'?'Le traitement ne confirme plus son avancement. Vérifiez l’état avant de relancer une demande.':'La préparation se poursuit. Le suivi se met à jour automatiquement ; vous pouvez laisser cette page ouverte ou revenir plus tard.'};
}
export function renderPreparationProgress(job){
 const phases=[{label:'Documents',stages:['assemble','analysis']},{label:'Parcours',stages:['context','design','planReview']},{label:'Rédaction',stages:['write','repair']},{label:'Vérifications',stages:['checks','review','complete']}];
 const current=Math.max(0,phases.findIndex(p=>p.stages.includes(job.stage))),finished=['completed','fixture'].includes(job.status),waiting=job.status==='queued'&&job.stage==='assemble';
 return `<ol class="preparation-progress" aria-label="Étapes de préparation">${phases.map((phase,i)=>{
  const done=finished||i<current,active=!finished&&i===current,state=done?'Terminée':active?job.status==='blocked'?'À reprendre':job.status==='cancelled'?'Arrêtée':waiting?'À démarrer':preparationStages[job.stage]||'En cours':'À venir';
  return `<li class="${done?'is-done':active?'is-current':''}" ${active?'aria-current="step"':''}><span class="progress-marker" aria-hidden="true">${done?'✓':i+1}</span><span><strong>${phase.label}</strong><small>${esc(state)}</small></span></li>`;
 }).join('')}</ol>`;
}
export function renderPreparationHeader(job,{activity=''}={}){
 const entry=job.brief.entry,title=entry.objective.split('\n')[0],subtitle=entry.objective.split('\n').slice(1).join(' '),guidance=preparationGuidance(job);
 const action=guidance.action?`<button type="button" class="btn primary" id="${guidance.action}" ${guidance.action==='revise'?`data-revision="${job.revision}"`:''}>${guidance.label}</button>`:'';
 return `<div class="preparation-overview card pad">
  <div class="preparation-meta"><span>${esc(formatDate(entry.date))} · ${esc(formatDuration(entry.duration))}${entry.sequence?` · ${esc(entry.sequence)}`:''}</span><span class="preparation-badge ${guidance.tone}">${esc(preparationLabels[job.status]||job.status)}</span></div>
  <h2 tabindex="-1">${esc(title)}</h2>${subtitle?`<p class="preparation-subtitle">${esc(subtitle)}</p>`:''}
  ${renderPreparationProgress(job)}
  ${activity}
  <div class="preparation-next ${guidance.tone}"><p class="eyebrow">${job.status==='blocked'?'PROCHAINE ACTION':'OÙ EN EST VOTRE SÉANCE ?'}</p><h3>${guidance.title}</h3><p>${esc(guidance.text)}</p>${action?`<div class="actions">${action}</div>`:''}${job.waitingFor?`<div class="actions"><button type="button" class="btn" data-job="${esc(job.waitingFor.id)}">Voir la préparation précédente</button></div>`:''}</div>
  ${job.stage==='context'&&job.status==='blocked'?`<div class="session-choice"><label for="session-choice">Ligne de la fiche<select id="session-choice">${(job.brief.resolvedContext?.sessions||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.sheet)} · ligne ${s.row} · ${esc(s.cells.filter(Boolean).map(v=>typeof v==='object'?v.value||v.date||'':v).join(' — '))}</option>`).join('')}</select></label><button class="btn primary" id="choose-session" data-revision="${job.revision}">Continuer avec cette séance</button></div>`:''}
  <div class="preparation-followup"><span>Enregistrée automatiquement · avancement actualisé automatiquement</span><button type="button" class="btn subtle small" id="refresh-job">Actualiser l’état</button></div>
 </div>`;
}
