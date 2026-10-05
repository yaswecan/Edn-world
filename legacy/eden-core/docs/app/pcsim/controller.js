import {createSimulator,reduceSim,PARTS,CABLES,nextAssembly} from './model.js';
import {simulatorView} from './view.js';
/** La vue ne connaît ni le stockage du cours ni le serveur : callbacks d’intégration. */
export function mountSimulator(root,{state,onChange,onBack,onReport,onSync,syncStatus=''}){
 let s=state||createSimulator(),alive=true,timer=null;
 let ui={selected:'',cable:'',from:'',bios:false,fast:matchMedia('(prefers-reduced-motion: reduce)').matches,feedback:null,syncStatus};
 function draw(focus=null){
  if(!alive)return;root.innerHTML=simulatorView(s,ui);
  if(focus){root.querySelector(focus)?.focus({preventScroll:true});}
 }
 function chooseNext(){const n=nextAssembly(s);ui.selected=n.type==='part'?n.id:'';ui.cable=n.type==='cable'?n.id:'';ui.from='';}
 function dispatch(action,{rerender=true}={}){
  const r=reduceSim(s,action);s=r.state;if(r.message)ui.feedback={ok:r.ok,message:r.message};
  onChange(s,r.event);if(rerender)draw();return r;
 }
 function bootTick(){
  clearTimeout(timer);if(!alive||s.power!=='starting')return;
  timer=setTimeout(()=>{if(!alive)return;dispatch({type:'ADVANCE_BOOT'});bootTick();},ui.fast?35:480);
 }
 async function click(ev){
  const b=ev.target.closest('[data-sim]');if(!b||!root.contains(b)||b.disabled)return;
  const a=b.dataset.sim;
  if(a==='back'){onBack();return;}
  if(a==='report'){onReport();return;}
  if(a==='sync'){await onSync();return;}
  if(a==='select-part'){ui.selected=b.dataset.part;ui.cable='';ui.bios=false;ui.feedback={message:PARTS.find(p=>p.id===ui.selected).short};draw(`[data-sim="select-part"][data-part="${ui.selected}"]`);return;}
  if(a==='slot'){
   if(s.hardware[b.dataset.part]){ui.selected=b.dataset.part;ui.cable='';ui.feedback={message:PARTS.find(p=>p.id===ui.selected).short};draw();return;}
   if(!ui.selected){ui.feedback={ok:false,message:'Choisis d’abord une pièce dans le bac sous le PC.'};draw();return;}
   const r=dispatch({type:'INSTALL',id:ui.selected,slot:b.dataset.slot},{rerender:false});
   if(r.ok)chooseNext();draw();return;
  }
  if(a==='select-cable'){ui.cable=b.dataset.cable;ui.selected='';ui.from='';ui.bios=false;draw();return;}
  if(a==='port'){
   const c=CABLES.find(c=>c.id===ui.cable);if(!c)return;
   if(!ui.from){ui.from=b.dataset.port;ui.feedback={message:'Premier bout choisi. Clique sur l’autre port.'};draw();return;}
   const r=dispatch({type:'CONNECT',id:c.id,from:ui.from,to:b.dataset.port},{rerender:false});if(r.ok)chooseNext();else ui.from='';draw();return;
  }
  if(a==='bios'){const r=dispatch({type:'OPEN_BIOS'},{rerender:false});ui.bios=r.ok;draw();return;}
  if(a==='close-bios'){ui.bios=false;draw();return;}
  if(a==='power'){ui.bios=false;ui.selected='';ui.cable='';dispatch({type:'POWER'});bootTick();return;}
  if(a==='off'){clearTimeout(timer);ui.bios=false;dispatch({type:'OFF'});return;}
  if(a==='login'){dispatch({type:'LOGIN'});return;}
  if(a==='next-case'){ui.bios=false;ui.selected='';ui.cable='';dispatch({type:'NEXT_CASE'});return;}
  if(a==='diagnose'){dispatch({type:'DIAGNOSE',layer:b.dataset.layer});return;}
  if(a==='repair-loader'||a==='repair-os'){ui.bios=false;dispatch({type:'REPAIR_SOFTWARE',id:a==='repair-loader'?'restore-loader':'install-os'});return;}
  if(a==='hint'){dispatch({type:'HINT'});return;}
  if(a==='finish'){dispatch({type:'FINISH'});return;}
 }
 function input(ev){const el=ev.target;if(el.dataset.simInput==='explanation')dispatch({type:'EXPLAIN',text:el.value},{rerender:false});}
 function change(ev){const el=ev.target;if(el.dataset.simInput==='transfer')dispatch({type:'TRANSFER',value:el.value});if(el.dataset.simInput==='boot-target')dispatch({type:'BOOT_TARGET',target:el.value});if(el.dataset.simInput==='fast')ui.fast=el.checked;}
 function dragStart(ev){const el=ev.target.closest('[data-sim="select-part"]');if(!el)return;ui.selected=el.dataset.part;ui.cable='';ev.dataTransfer.setData('text/plain',el.dataset.part);ev.dataTransfer.effectAllowed='move';root.classList.add('sim-dragging');}
 function dragOver(ev){if(ev.target.closest('[data-slot]')){ev.preventDefault();ev.dataTransfer.dropEffect='move';}}
 function drop(ev){const target=ev.target.closest('[data-slot]');if(!target)return;ev.preventDefault();const id=ev.dataTransfer.getData('text/plain');if(!PARTS.some(p=>p.id===id))return;const r=dispatch({type:'INSTALL',id,slot:target.dataset.slot},{rerender:false});if(r.ok)chooseNext();root.classList.remove('sim-dragging');draw();}
 root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('dragstart',dragStart);root.addEventListener('dragover',dragOver);root.addEventListener('drop',drop);
 if(s.power==='starting')dispatch({type:'OFF'},{rerender:false});
 if(!s.baseline)chooseNext();draw();
 return {setSyncStatus(text){ui.syncStatus=text;const el=root.querySelector('#sim-sync-status');if(el)el.textContent=text;},getState:()=>s,destroy(){alive=false;clearTimeout(timer);if(s.power==='starting'){const r=reduceSim(s,{type:'OFF'});s=r.state;onChange(s,r.event);}for(const [name,fn]of [['click',click],['input',input],['change',change],['dragstart',dragStart],['dragover',dragOver],['drop',drop]])root.removeEventListener(name,fn);}};
}
