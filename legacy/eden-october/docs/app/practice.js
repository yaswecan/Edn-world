import {runSafe} from './safe-js.js';
import {testDiagnostic,recordPractice,valueText,fingerprint} from './diagnostic.js';
import {testFunction} from './exercises.js';
import {outputMarkup,watchMarkup,testMarkup} from './practice-view.js';
import {mountEditor} from './code-editor.js';
export function mountPractice(step,rec,{save,onResult,projection=false,locked=false}={}){
 mountEditor();const $=id=>document.getElementById(id),editor=$('code');
 if(!editor)return;
 const code=()=>editor.value;
 const next=()=>{$('next').disabled=!projection&&!rec.done;};
 const drawRun=run=>{$('function-console').textContent=[...run.logs,...(run.error?['Erreur : '+run.error]:[])].join('\n')||'(console vide : aucun console.log exécuté)';$('code-preview').innerHTML=outputMarkup(step,run);$('code-watch').innerHTML=watchMarkup(run);};
 const finish=(action,result)=>{rec.tries++;recordPractice(rec,action,code(),result);save();};
 editor.addEventListener('input',()=>{delete rec.input.skip;rec.done=false;$('execution-status').textContent='Code modifié : relance-le et vérifie à nouveau les cas.';$('practice-tests').innerHTML='';$('function-console').textContent='Code modifié. Clique sur Exécuter pour actualiser.';$('code-preview').innerHTML='<p class="preview-placeholder">Résultat à actualiser.</p>';$('code-watch').textContent='Relance ton code.';next();});
 $('run-function').onclick=()=>{if(locked)return;const run=runSafe(code());drawRun(run);finish('run',run);$('execution-status').textContent=run.ok?'Programme exécuté. Compare la console et le résultat visualisé.':'Exécution arrêtée : répare le premier message signalé.';};
 $('check').onclick=()=>{if(locked)return;const result=step.diagnostic?testDiagnostic(code(),step.id):testFunction(code(),step.exercise);drawRun(result.run||runSafe(code()));rec.done=result.ok;delete rec.input.skip;finish('test',result);$('practice-tests').innerHTML=testMarkup(result);$('execution-status').textContent=result.ok?'Contrôles réussis pour ce code. Tu peux expliquer puis continuer.':'Compare le premier écart. Corrige une chose, puis reteste.';onResult?.(result.ok?'Défi réussi pour les cas proposés. Explique ce que tu as changé avant de continuer.':'Le test te donne une piste, pas un échec définitif.',result.ok);next();};
 if($('code-hint'))$('code-hint').onclick=()=>{if(locked)return;const n=Math.min((rec.hints||0)+1,step.hints.length);rec.hints=n;$('code-hint-text').textContent=step.hints.slice(0,n).join(' ');$('code-hint').textContent=n<step.hints.length?'Un autre indice':'Indices affichés';$('code-hint').disabled=n>=step.hints.length;save();};
 $('reset-code').onclick=()=>{if(locked||!confirm('Repartir du texte de départ ? Le premier essai et l’historique sont conservés.'))return;editor.value=step.starter||'';editor.dispatchEvent(new Event('input',{bubbles:true}));};
 if($('skip-code'))$('skip-code').onclick=()=>{if(locked||!confirm('Garder ce code et marquer ce défi « À reprendre » ? Tu pourras revenir dessus avant la remise.'))return;rec.input.code=code();rec.input.skip='yes';rec.done=true;recordPractice(rec,'skip',code(),{ok:false});save();onResult?.('Essai conservé. Ce défi est à reprendre, pas validé. Tu peux continuer.',false);next();};
 if($('custom-run'))$('custom-run').onclick=()=>{if(locked)return;const names={'diag-saluer':'saluer','diag-doubler':'doubler','diag-retour':'additionner'};const args=[...document.querySelectorAll('[data-custom-arg]')].map(el=>el.type==='number'?(el.value.trim()===''?NaN:Number(el.value)):el.value);
 if(args.some(a=>typeof a==='number'&&(!Number.isFinite(a)||Math.abs(a)>1e6))){$('custom-result').textContent='Choisis des nombres entre -1 000 000 et 1 000 000.';return;}
 const run=runSafe(code(),{invoke:names[step.id],args});$('custom-result').textContent=run.ok?`Console de cet appel : ${run.logs.join(' / ')||'(vide)'}\nValeur renvoyée : ${valueText(run.value)} (${typeof run.value})`:'Erreur : '+run.error;finish('case',run);};
 if(rec.practice?.lastAttempt?.fingerprint===fingerprint(code())&&rec.practice.lastAttempt.action==='test'){$('practice-tests').innerHTML=testMarkup(step.diagnostic?testDiagnostic(code(),step.id):testFunction(code(),step.exercise));drawRun(runSafe(code()));}
 if(rec.input.skip==='yes')$('execution-status').textContent='Défi marqué « À reprendre ». Ton code est conservé.';
 if(locked){editor.disabled=true;for(const id of ['run-function','check','reset-code','code-hint','skip-code','custom-run'])if($(id))$(id).disabled=true;$('execution-status').textContent='Copie remise et figée. Le professeur peut la rouvrir.';}
}
