import {CHAPTERS,STEPS} from './content.js';
import {parseState,MAX_IMPORT_BYTES,escapeHTML as e,makeReport} from './model.js';
import {reportPreview} from './views.js';
const timeline=document.querySelector('#teacher-timeline');
timeline.innerHTML=CHAPTERS.map(ch=>{const step=STEPS.find(s=>s.chapter===ch.id);return `<div class="teacher-row"><span>${e(ch.time)}</span><a href="index.html?projection=1#${step.id}" target="_blank" rel="noopener">${e(ch.label)}</a></div>`;}).join('');
document.querySelector('#teacher-import').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];if(!file)return;const message=document.querySelector('#teacher-message');
 try{
  if(file.size>MAX_IMPORT_BYTES)throw new Error('250 Ko maximum.');
  const state=parseState(await file.text()),report=makeReport(state);
  message.textContent=`${state.alias} — ${report.completed} / ${report.total} écrans parcourus (pas une note).`;message.className='feedback good';
  document.querySelector('#teacher-report').innerHTML=reportPreview(state)+`<h3>Preuves de manipulation</h3><pre class="report-data fine">${e(JSON.stringify(report.evidence,null,2))}</pre>`;
 }catch(error){message.textContent=error.message;message.className='error-note';document.querySelector('#teacher-report').replaceChildren();}
});
