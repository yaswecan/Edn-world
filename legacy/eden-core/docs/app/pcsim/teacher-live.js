/** Tableau professeur : données distantes seulement après authentification du service optionnel. */
import {escapeHTML as e} from '../model.js';
const root=document.querySelector('#teacher-live');
let currentId=null,logged=false,currentSummary=null;
const statusLabels={'a-valider':'À valider','valide':'Validé par le professeur','a-revoir':'À revoir'};
const eventLabels={'part-installed':'Pièce placée','cable-connected':'Câble relié','action-refused':'Action à revoir','boot-started':'Démarrage tenté','boot-ended':'Résultat du démarrage','bios-opened':'BIOS observé','boot-target-changed':'Entrée de boot modifiée','case-started':'Panne proposée','diagnosis-wrong':'Diagnostic à revoir','diagnosis-correct':'Zone correctement repérée','software-repaired':'Réparation logicielle simulée','case-completed':'Réparation vérifiée','baseline-completed':'Premier PC fonctionnel','bonus-completed':'Bonus terminé','hint-used':'Indice ouvert','power-off':'PC éteint','session-opened':'Session ouverte','boot-interrupted':'Animation interrompue','transfer-chosen':'Réponse de transfert'};
async function request(path,options={}){
 const r=await fetch(new URL(`../../api/${path}`,import.meta.url),{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(25000)});
 const d=await r.json().catch(()=>({error:'Service de suivi non disponible sur cet hébergement.'}));if(!r.ok)throw Object.assign(new Error(d.error||'Requête refusée'),{status:r.status});return d;
}
function login(message=''){
 root.innerHTML=`<h2>Suivi du simulateur</h2><p>Connecte le service de classe pour voir les essais des élèves qui ont activé le partage.</p><label class="field-label" for="live-password">Mot de passe professeur (côté serveur)</label><input type="password" id="live-password" autocomplete="current-password"><button class="primary small" data-live="login">Se connecter</button><p id="live-message" role="status">${e(message)}</p><p class="fine">Version Vercel + Neon. Le mot de passe est défini dans les variables serveur, jamais dans le code public.</p>`;
}
async function load(){
 const d=await request('teacher/learners');logged=true;
 root.innerHTML=`<div class="sim-panel-title"><h2>Suivi reçu par le serveur</h2><div class="actions"><button class="secondary small" data-live="reload">Actualiser</button><button class="quiet-button" data-live="logout">Déconnexion</button></div></div><p class="fine">Actualisation toutes les 10 s, page visible et sans fiche ouverte. Conservation configurée : ${e(d.retentionDays)} jours. Plusieurs codes identiques peuvent désigner des sessions distinctes.</p><div class="live-table-wrap"><table class="live-table"><thead><tr><th>Code élève</th><th>Écrans parcourus</th><th>PC monté</th><th>Pannes réparées</th><th>Essais / erreurs / indices</th><th>Validation humaine</th></tr></thead><tbody>${d.learners.length?d.learners.map(l=>`<tr><td><button data-live="detail" data-id="${e(l.id)}">${e(l.alias)}</button><small>${e(new Date(l.updated).toLocaleTimeString('fr-FR'))}</small></td><td>${e(l.core_completed)} / ${e(d.totalSteps)}</td><td>${l.summary?.baseline?'Oui':'En cours'}</td><td>${l.summary?.solved?.length||0}/4</td><td>${l.summary?.attempts||0} / ${l.summary?.errors||0} / ${l.summary?.hints||0}</td><td>${e(statusLabels[l.validation])}</td></tr>`).join(''):'<tr><td colspan="6">Aucun élève connecté. Fais activer « Partager / synchroniser » avec le code de classe.</td></tr>'}</tbody></table></div><p class="fine">Les erreurs ne sont pas une note. Les preuves viennent du navigateur et restent à apprécier. Pas de reconnaissance des comptes Eden Hub existants.</p><div id="live-detail"></div><p id="live-message" role="status"></p>`;
 if(currentId)await detail(currentId);
}
async function detail(id){
 const d=await request(`teacher/learner/${id}`);currentId=id;const l=d.learner,s=l.summary;currentSummary=s;
 document.querySelector('#live-detail').innerHTML=`<div class="teacher-box"><h3>${e(l.alias)} · détail du bonus</h3><p><strong>Dernier point d’arrêt :</strong> ${e(s?.lastStop||'Aucun')}</p><p><strong>Explication de l’élève :</strong></p><blockquote>${e(s?.explanation||'Pas encore saisie.')}</blockquote><p><strong>Fin des manipulations :</strong> ${s?.completedAt?e(new Date(s.completedAt).toLocaleString('fr-FR')):'En cours'}</p><label for="live-validation">Validation pédagogique</label><select id="live-validation">${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${l.validation===k?'selected':''}>${e(v)}</option>`).join('')}</select><label for="live-note">Retour professeur</label><textarea id="live-note" maxlength="1200" rows="2">${e(l.teacher_note)}</textarea><div class="actions"><button class="primary small" data-live="validate" data-id="${id}">Enregistrer la validation</button><button class="secondary small" data-live="export" data-id="${id}">Exporter le suivi</button><button class="quiet-button" data-live="delete" data-id="${id}">Supprimer cette session</button></div><details><summary>Voir les ${d.events.length} événements reçus (1 000 derniers maximum)</summary><ol class="live-events">${d.events.map(ev=>`<li><strong>${e(eventLabels[ev.type]||ev.type)}</strong> · ${e(ev.caseId)}<br>${e(ev.message||ev.code||ev.part||ev.cable||ev.choice||'')}<small>Réception serveur : ${e(new Date(ev.receivedAt).toLocaleTimeString('fr-FR'))}</small></li>`).join('')}</ol></details></div>`;
}
root.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-live]');if(!b)return;const action=b.dataset.live;b.disabled=true;
 try{
  if(action==='login'){const input=document.querySelector('#live-password');await request('teacher/login',{method:'POST',body:JSON.stringify({password:input.value})});input.value='';await load();}
  if(action==='reload')await load();
  if(action==='logout'){await request('teacher/logout',{method:'POST',body:'{}'});logged=false;currentId=null;login('Déconnecté.');}
  if(action==='detail')await detail(b.dataset.id);
  if(action==='validate'){await request(`teacher/learner/${b.dataset.id}`,{method:'POST',body:JSON.stringify({validation:document.querySelector('#live-validation').value,note:document.querySelector('#live-note').value,expectedRevision:currentSummary?.revision??null,expectedRunId:currentSummary?.runId??null})});await load();document.querySelector('#live-message').textContent='Validation enregistrée.';}
  if(action==='delete'&&confirm('Supprimer définitivement cette session et tous ses essais reçus ?')){await request(`teacher/learner/${b.dataset.id}`,{method:'DELETE'});currentId=null;await load();}
  if(action==='export'){const data=await request(`teacher/learner/${b.dataset.id}`),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`suivi_pc_${b.dataset.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 }catch(error){const target=document.querySelector('#live-message');if(target)target.textContent=error.message;if(error.status===401){logged=false;login('Session expirée.');}}
 finally{b.disabled=false;}
});
async function init(){
 try{const c=await request('config');if(!c.enabled){root.innerHTML=`<h2>Suivi à configurer</h2><p>${e(c.message||'Configuration serveur manquante.')}</p><p>Renseigne dans Vercel : <code>DATABASE_URL</code>, <code>TEACHER_PASSWORD</code> et <code>CLASS_CODE</code>, puis redéploie. <code>CRON_SECRET</code> active la purge planifiée.</p>`;return;}try{await load();}catch{login();}}
 catch{root.innerHTML='<h2>Suivi distant non activé</h2><p>Le simulateur et les exports fonctionnent sans serveur. Pour recevoir automatiquement les essais, vérifie les variables Vercel et la connexion Neon. Le fichier <code>DEPLOIEMENT_VERCEL.md</code> du projet décrit les étapes. Les essais restent locaux pendant une panne réseau.</p>';}
}
setInterval(()=>{if(logged&&!currentId&&document.visibilityState==='visible')load().catch(()=>{});},10000);
init();
