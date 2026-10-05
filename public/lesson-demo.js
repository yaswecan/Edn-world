import {renderLessonPage} from './lesson-renderer.js';
import {terminalSimulation} from './components.js';
import {installWorkshopInteractions} from './workshop-runtime.js';
const demo=new URLSearchParams(location.search).get('lesson')==='flexbox'?'flexbox':'logic';
const response=await fetch(demo==='flexbox'?'/demo-flexbox.json':'/demo-lesson.json');
if(!response.ok)throw Error('Séance exemple introuvable. Exécuter npm run demo:lesson.');
const spec=await response.json(),answers={},completed=[];
installWorkshopInteractions({getActivity:id=>[...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===id)});
document.title='EDEN · '+spec.title;
let index=0;
function render(){document.querySelector('#app').innerHTML=renderLessonPage(spec,index,{demo:true,answers,completed,displayName:'Démonstration'});}
function notice(text){const node=document.querySelector('#toast');node.textContent=text;setTimeout(()=>node.textContent='',5000);}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 const action=button.dataset.action;
 if(action==='demo-step')index=Number(button.dataset.id);
 else if(action==='demo-prev')index=Math.max(0,index-1);
 else if(action==='demo-next'){if(!completed.includes(spec.blocks[index].id))completed.push(spec.blocks[index].id);index=Math.min(spec.blocks.length-1,index+1);}
 else if(action==='complete-activity'){if(!completed.includes(button.dataset.id))completed.push(button.dataset.id);notice('Activité terminée dans cette démonstration.');}
 else if(action==='save-answers'||action==='submit-answers'){notice('Réponses conservées dans cet onglet de démonstration. Aucun envoi au professeur.');return;}
 else if(action==='run-code'){
  const id=button.dataset.id,code=document.querySelector(`[data-answer="${CSS.escape(id)}"]`).value,output=document.querySelector(`#console-${CSS.escape(id)}`);answers[id]=code;output.hidden=false;button.disabled=true;
  try{const response=await fetch('/api/demo/lesson/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({demo,taskId:id,code})});if(!response.ok)throw Error('Vérification indisponible. Relance le serveur de démonstration.');const result=await response.json();output.textContent=result.logs.join('\n');}catch(error){output.textContent=error.message;}finally{button.disabled=false;}return;
 }
 else return;
 render();document.querySelector('.lesson-stage h1')?.focus();
});
document.addEventListener('input',event=>{
 const field=event.target;if(field.dataset.answer)answers[field.dataset.answer]=field.value;
 if(field.dataset.answerPart){let parts={};try{parts=JSON.parse(answers[field.dataset.answerPart]||'{}');}catch{}parts[field.dataset.part]=field.value;answers[field.dataset.answerPart]=JSON.stringify(parts);}
});
document.addEventListener('click',event=>{const button=event.target.closest('[data-terminal]');if(button)document.querySelector(`[data-terminal-output="${CSS.escape(button.dataset.terminal)}"]`).textContent=terminalSimulation(answers[button.dataset.terminal]||'');
 const sort=event.target.closest('[data-sort]');if(sort){const a=spec.activities.find(a=>a.id===sort.dataset.sort);if(!a)return;const order=answers[a.id]?JSON.parse(answers[a.id]):[...a.options],from=Number(sort.dataset.index),to=from+Number(sort.dataset.direction);if(to>=0&&to<order.length){order.splice(to,0,order.splice(from,1)[0]);answers[a.id]=JSON.stringify(order);render();}}
});
render();
