import {escape as esc} from './lesson-renderer.js';

const connectionStates={
 connected:'La connexion a réussi. Choisissez un modèle pour préparer une séance.',
 not_connected:'Connectez votre compte ChatGPT dans les réglages IA.',
 permission_missing:'L’utilisation du forfait n’est pas autorisée pour cette connexion.',
 usage_limit:'Une limite d’utilisation ChatGPT a été atteinte. Consultez la gestion de l’usage.',
 reconnect_required:'Reconnectez votre compte ChatGPT dans les réglages IA.',
 temporary:'ChatGPT est temporairement indisponible. Vérifiez la connexion dans les réglages IA.',
};
const modelOptions=(models,selected)=>'<option value="">Choisir un modèle</option>'+models.map(m=>`<option value="${esc(m.slug)}" ${m.slug===selected?'selected':''}>${esc(m.displayName)}</option>`).join('');
const eligible=config=>config.connections.filter(c=>c.planAuthorized&&['connected','available'].includes(c.state));

export function renderAIAccess(config){
 const plan=config.preference.provider==='chatgpt_plan',connections=eligible(config),selected=connections.find(c=>c.id===config.preference.connectionId)||connections.at(-1);
 let reason='';
 if(!config.configured){
  if(!plan&&connections.length&&config.chatgpt.enabled)reason='Votre compte ChatGPT est connecté, mais le mode API reste sélectionné. Choisissez un modèle ci-dessous puis confirmez l’utilisation du forfait.';
  else if(plan)reason=config.chatgpt.reason||connectionStates[config.chatgpt.state]||'Vérifiez la connexion et le modèle choisis dans les réglages IA.';
  else reason='Le mode API n’est pas prêt. '+(config.api.reason||'Complétez les réglages IA.')+(config.chatgpt.enabled?' Vous pouvez aussi y connecter votre compte ChatGPT.':'');
 }
 return `<p>${config.configured?'Utilisation':'Mode sélectionné'} : ${plan?'forfait ChatGPT':'API OpenAI · facturation API distincte'} · <a href="/ai-settings.html">Modifier les réglages IA</a>${plan?' · <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener noreferrer">Gérer l’usage</a>':''}</p>${reason?`<p role="status">${esc(reason)}</p>`:''}${!config.configured&&config.chatgpt.enabled&&selected?`
 <form id="activate-chatgpt"><h2>Utiliser mon abonnement ChatGPT</h2>
 <label>Connexion ChatGPT<select name="connectionId" required>${connections.map(c=>`<option value="${esc(c.id)}" ${c.id===selected.id?'selected':''}>${esc(c.label+' · '+(c.email||'Compte ChatGPT'))}</option>`).join('')}</select></label>
 <label>Modèle accessible<select name="model" required>${modelOptions(selected.models||[],config.preference.model)}</select></label>
 <p id="ai-model-message" role="status"></p><button class="btn primary" type="submit">Utiliser ChatGPT pour les préparations</button>
 <p>Ce choix s’applique aux prochaines préparations. Aucune génération ne démarre à cette étape.</p></form>`:''}`;
}

export function wireAIAccess(config,{request,onConfigured}){
 const form=document.querySelector('#activate-chatgpt');if(!form)return;
 const connection=form.elements.connectionId,model=form.elements.model,button=form.querySelector('button'),message=form.querySelector('#ai-model-message');let version=0;
 async function loadModels(){
  const current=++version;button.disabled=true;model.disabled=true;model.innerHTML=modelOptions([],null);message.textContent='Chargement des modèles accessibles…';
  try{
   const profile=config.connections.find(c=>c.id===connection.value);
   const models=profile?.models?.length?profile.models:await request(`/api/ai/chatgpt/${encodeURIComponent(connection.value)}/models`);
   if(current!==version)return;
   model.innerHTML=modelOptions(models,config.preference.connectionId===connection.value?config.preference.model:null);model.disabled=!models.length;button.disabled=!models.length;
   message.textContent=models.length?'Choisissez le modèle, puis confirmez ci-dessous.':'Aucun modèle accessible. Vérifiez cette connexion dans les réglages IA.';
  }catch(error){if(current===version)message.textContent=error.message;}
 }
 connection.addEventListener('change',loadModels);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(button.disabled||!model.value)return;
  button.disabled=true;connection.disabled=true;model.disabled=true;
  try{
   await request('/api/ai/settings',{method:'PUT',body:JSON.stringify({provider:'chatgpt_plan',connectionId:connection.value,model:model.value})});
   await onConfigured();
  }catch(error){message.textContent=error.message;button.disabled=false;connection.disabled=false;model.disabled=false;}
 });
 void loadModels();
}
