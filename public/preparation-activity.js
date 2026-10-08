import {escape as esc} from './lesson-renderer.js';

const pending=new Set(['submitting','running','unknown']);
const stamp=value=>Date.parse(value)||0;
const clock=value=>value?new Date(value).toLocaleTimeString('fr-FR'):'—';
export function elapsed(milliseconds){
 const seconds=Math.max(0,Math.floor(milliseconds/1000)),minutes=Math.floor(seconds/60);
 return minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min ${seconds%60} s`:minutes?`${minutes} min ${seconds%60} s`:`${seconds} s`;
}
export function preparationActivity(job,{now=Date.now(),checkedAt=now,offline=false}={}){
 const calls=(job.callsTrace||[]).filter(c=>(c.revision||1)===(job.revision||1)).sort((a,b)=>stamp(a.createdAt)-stamp(b.createdAt));
 const call=calls.find(c=>c.id===job.inflight?.id)||calls.at(-1),activity=call?.activity;
 const active=!!call&&['running','retry_wait'].includes(job.status)&&pending.has(call.outcome)&&!call.finishedAt&&!call.retryAuthorizedAt;
 const started=stamp(call?.createdAt||call?.trace?.startedAt),lastSignal=stamp(activity?.lastSignalAt||call?.lastEventAt);
 const callEnd=stamp(call?.completedAt||call?.finishedAt)|| (Number.isFinite(call?.trace?.durationMs)?started+call.trace.durationMs:0),jobEnd=stamp(job.finishedAt);
 const end=(jobEnd&&callEnd?Math.min(jobEnd,callEnd):callEnd||jobEnd)||lastSignal||started;
 const stalled=active&&now-(lastSignal||started)>60000,disconnected=offline||now-checkedAt>15000;
 let state='idle',label='En attente',description='Aucun appel IA en cours pour cette préparation.';
 if(active){
  state=stalled||!lastSignal?'waiting':'live';
  label=activity?.phase==='writing'?'Réponse en cours':activity?.phase==='reasoning'?'Préparation de la réponse':call.responseId?'Demande acceptée':'Demande envoyée';
  description=activity?.phase==='writing'?'Le texte de la séance arrive progressivement. Il sera vérifié avant de devenir un brouillon.':activity?.phase==='reasoning'?'Le fournisseur a signalé une étape de raisonnement. Le texte de la réponse n’est pas encore terminé.':call.responseId?'Le fournisseur a accepté cet appel. Le suivi attend la suite de la réponse.':'La demande a été envoyée. Le fournisseur n’a pas encore confirmé sa prise en charge.';
  if(stalled){label='En attente de signal';description='Aucun nouveau signal depuis plus d’une minute. L’appel peut encore être en cours ; le suivi ne permet pas de confirmer son avancement.';}
 }else if(call){
  label=call.outcome==='completed'?'Dernier appel terminé':'Dernier appel interrompu';
  description=call.outcome==='completed'?'La réponse de cet appel a été enregistrée. Les étapes de préparation ci-dessus indiquent la suite.':'Les dernières informations reçues sont conservées ci-dessous.';
 }
 if(job.status==='cancelled'){state='idle';label='Préparation annulée';description='Le suivi est arrêté. Les dernières informations reçues restent consultables.';}
 else if(job.status==='blocked'){state='waiting';label='Préparation interrompue';description='Aucun nouvel appel n’est lancé. Suivez l’action proposée ci-dessus pour reprendre la préparation.';}
 else if(job.status==='queued'){state='idle';label='En attente de traitement';description='La préparation attend son tour. Aucun appel IA en cours n’est confirmé.';}
 else if(job.workerState==='lease_expired'){state='waiting';label='Traitement à vérifier';description='Le traitement ne confirme plus son activité. Les informations affichées sont les dernières reçues.';}
 if(disconnected){state='offline';label='Suivi déconnecté';description='Impossible de vérifier l’état actuel. La connexion au suivi sera réessayée automatiquement.';}
 const model=call?.effectiveModel||call?.trace?.effectiveModel;
 const characters=activity?.outputCharacters??(call?.partialCharacters>0?call.partialCharacters:null);
 return {state,label,description,model:model||call?.profile?.model||job.profiles?.[job.stage]?.model||job.profiles?.design?.model||'Non configuré',modelLabel:model?'Modèle confirmé':'Modèle demandé',duration:started?elapsed((active?now:end)-started):'—',characters:characters===null?'—':new Intl.NumberFormat('fr-FR').format(characters),signal:lastSignal?(active?`Dernier signal du fournisseur il y a ${elapsed(now-lastSignal)}.`:`Dernier signal du fournisseur à ${clock(lastSignal)}.`):'Aucun signal du fournisseur enregistré.',sync:`Suivi vérifié à ${clock(checkedAt)} · actualisation toutes les 3 s.`,summary:activity?.summary||'',summaryTruncated:activity?.summaryTruncated,hasCall:!!call};
}
export function renderPreparationActivity(job,options){
 const data=preparationActivity(job,options);
 return `<section class="preparation-activity" data-state="${data.state}" aria-labelledby="activity-title">
  <div class="activity-heading"><h3 id="activity-title">Activité de l’IA</h3><span class="activity-state" data-activity="label" role="status">${esc(data.label)}</span></div>
  <p data-activity="description">${esc(data.description)}</p>
  <dl class="activity-metrics"><div><dt data-activity="modelLabel">${data.modelLabel}</dt><dd data-activity="model">${esc(data.model)}</dd></div><div><dt>Temps de cet appel</dt><dd data-activity="duration">${data.duration}</dd></div><div><dt>Caractères de réponse reçus</dt><dd data-activity="characters">${data.characters}</dd></div></dl>
  <p class="activity-signal" data-activity="signal">${esc(data.signal)}</p>
  ${data.summary?`<details data-detail="reasoning-summary" class="activity-summary" open><summary>Résumé fourni par le modèle</summary><p>${esc(data.summary)}</p>${data.summaryTruncated?'<small>Affichage limité aux 6 000 premiers caractères du résumé.</small>':''}</details>`:`<p class="activity-summary-empty">${data.hasCall?'Aucun résumé de raisonnement fourni pour cet appel.':'Les résumés éventuellement fournis par le modèle apparaîtront ici.'} Le raisonnement interne n’est pas affiché.</p>`}
  <p class="activity-sync" data-activity="sync">${esc(data.sync)}</p>
 </section>`;
}
// Update clocks and connection state without rebuilding focused controls or announcing each second.
export function updatePreparationActivity(root,job,options){
 const panel=root?.querySelector('.preparation-activity');if(!panel||!job)return;
 const data=preparationActivity(job,options);panel.dataset.state=data.state;
 for(const node of panel.querySelectorAll('[data-activity]')){const value=data[node.dataset.activity];if(node.textContent!==value)node.textContent=value;}
}
