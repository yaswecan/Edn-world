import {parseState,previewDocument,labSettings,labProperties,labStage,drawingPaths} from './workshop-ui.js';
import {installCodeRunner} from './code-runner.js';

export function installWorkshopInteractions({getActivity}){
 installCodeRunner();
 const fieldOf=node=>node.querySelector('input[type="hidden"][data-answer]');
 const save=(node,state)=>{const field=fieldOf(node);if(!field||field.disabled)return;field.value=JSON.stringify(state);field.dispatchEvent(new Event('input',{bubbles:true}));};
 const read=node=>{const state=parseState(fieldOf(node)?.value);if(node.matches('[data-drawing]'))state.strokes=Array.isArray(state.strokes)?state.strokes:[];return state;};
 const geometry=lab=>[...lab.querySelectorAll('.lesson-lab-stage>div')].map(el=>{const box=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return [Math.round(box.x-parent.x),Math.round(box.y-parent.y)];});
 document.addEventListener('input',event=>{
  const el=event.target,board=el.closest('[data-drawing]'),lab=el.closest('[data-flex-lab]');
  if(el.matches('[data-board-caption]'))save(board,{...read(board),caption:el.value});
  if(el.matches('[data-lab-prediction],[data-lab-explanation]'))save(lab,{...read(lab),[el.matches('[data-lab-prediction]')?'prediction':'explanation']:el.value});
 });
 document.addEventListener('change',event=>{
  if(event.target.matches('[data-preview-width]'))event.target.closest('[data-workbench]').querySelector('iframe').style.width=event.target.value;
 });
 document.addEventListener('click',event=>{
  const el=event.target.closest('button');if(!el||el.disabled)return;
  if(el.hasAttribute('data-workshop-preview')){
   const a=getActivity(el.dataset.workshopPreview),root=el.closest('[data-workbench]');if(a)root.querySelector('iframe').srcdoc=previewDocument(a,root.querySelector('textarea[data-answer]').value);
  }
  if(el.hasAttribute('data-enlarge-board')){
   const source=el.querySelector('img'),dialog=document.createElement('dialog');dialog.className='lesson-board-dialog';dialog.setAttribute('aria-label',source.alt);
   const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Fermer le tableau';dialog.append(close,source.cloneNode());document.body.append(dialog);dialog.showModal();close.focus();
   const finish=()=>{dialog.close();dialog.remove();el.focus();};close.addEventListener('click',finish);dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});
  }
  const board=el.closest('[data-drawing]');
  if(board&&el.hasAttribute('data-pen')){board.dataset.color=el.dataset.pen;board.querySelectorAll('[data-pen]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));}
  if(board&&el.hasAttribute('data-undo-stroke')){const state=read(board);state.strokes=Array.isArray(state.strokes)?state.strokes.slice(0,-1):[];board.querySelector('[data-strokes]').innerHTML=drawingPaths(state);save(board,state);}
  if(el.hasAttribute('data-lab-run')){
   const lab=el.closest('[data-flex-lab]'),state=read(lab),before=labSettings(state.applied),after=Object.fromEntries([...lab.querySelectorAll('[data-lab-setting]')].map(input=>[input.dataset.labSetting,input.value]));
   const changed=Object.keys(before).filter(k=>before[k]!==after[k]),feedback=lab.querySelector('[data-lab-feedback]');
   if(changed.length!==1){feedback.textContent='Change un seul réglage pour relier la modification au résultat.';return;}
   if(!state.prediction?.trim()){feedback.textContent='Écris d’abord ta prévision : où les cartes vont-elles se déplacer ?';lab.querySelector('[data-lab-prediction]').focus();return;}
   const positionsBefore=geometry(lab);lab.querySelector('[data-lab-stage]').innerHTML=labStage(after);const positionsAfter=geometry(lab),key=changed[0];
   const comparison=`${labProperties[key]} : ${before[key]} → ${after[key]}.\nPositions (x, y) : ${positionsBefore.map(p=>p.join(', ')).join(' · ')} → ${positionsAfter.map(p=>p.join(', ')).join(' · ')}.`;
   const history=[...(Array.isArray(state.history)?state.history:[]),{before,after,prediction:state.prediction,comparison}].slice(-20);save(lab,{...state,applied:after,history});feedback.textContent=comparison+'\nCompare avec ta prévision et nomme l’axe concerné.';lab.querySelector('[data-lab-count]').textContent=`${history.length} essai(s) conservé(s)`;
  }
 });
 let drawing=null;
 const point=(event,svg)=>{const rect=svg.getBoundingClientRect();return [Math.round(Math.max(0,Math.min(1000,(event.clientX-rect.left)/rect.width*1000))),Math.round(Math.max(0,Math.min(500,(event.clientY-rect.top)/rect.height*500)))];};
 document.addEventListener('pointerdown',event=>{
  const svg=event.target.closest('[data-drawing] svg');if(!svg||svg.dataset.locked==='true'||event.button!==0)return;
  const root=svg.closest('[data-drawing]'),state=read(root);if((state.strokes?.length||0)>=60)return;
  event.preventDefault();svg.setPointerCapture(event.pointerId);drawing={root,svg,pointerId:event.pointerId,state,stroke:{color:root.dataset.color||'#162b32',points:[point(event,svg)]}};
 });
 document.addEventListener('pointermove',event=>{
  if(!drawing||event.pointerId!==drawing.pointerId)return;
  const {svg,state,stroke}=drawing;if(stroke.points.length>=160)return;stroke.points.push(point(event,svg));svg.querySelector('[data-strokes]').innerHTML=drawingPaths({...state,strokes:[...(state.strokes||[]),stroke]});
 });
 const finish=event=>{if(!drawing||event.pointerId!==drawing.pointerId)return;const {root,state,stroke,svg}=drawing;drawing=null;const next={...state,strokes:[...(state.strokes||[]),stroke]};svg.querySelector('[data-strokes]').innerHTML=drawingPaths(next);save(root,next);};
 document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
}
