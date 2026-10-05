const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const parseState=value=>{try{const state=JSON.parse(value);return state&&typeof state==='object'&&!Array.isArray(state)?state:{};}catch{return {};}};
const boards={
 '01-parent':'Le parent et ses enfants directs', '02-axes':'Les axes en ligne et en colonne',
 '03-espace-libre':'La répartition de l’espace libre','04-aligner':'Aligner sur le deuxième axe',
 '05-espaces':'Gap, padding et marge','06-une-regle':'Une seule règle change',
 '07-deboguer':'Observer, modifier, vérifier','08-refaire':'Les repères à reconstruire'
};
export function subjectBoard(id,{blank=false}={}){
 if(!boards[id])return '';
 return `<figure class="lesson-subject-board" data-component="SubjectBoard"><button type="button" data-enlarge-board aria-label="Agrandir : ${esc(boards[id])}"><img src="/assets/boards/${id}${blank?'-a-completer':''}.svg" alt="${esc(boards[id])}${blank?' · schéma à compléter':''}" loading="lazy"></button><figcaption>${esc(boards[id])} · Clique pour agrandir.</figcaption></figure>`;
}
export function previewDocument(a,code){
 const w=a.workshop||{},css=w.language==='css'?code:'',html=w.language==='css'?w.document:code;
 // A style end tag must never turn editable CSS into markup. The opaque iframe
 // additionally denies scripts, network, forms, popups and parent access.
 const safeStyle=String((w.style||'')+'\n'+css).replace(/<\/style/gi,'<\\/style');
 return `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${safeStyle}</style>${html||''}`;
}
export const labDefaults={direction:'row',justify:'flex-start',align:'flex-start',gap:'0'};
export const labChoices={direction:['row','column'],justify:['flex-start','center','space-between'],align:['flex-start','center','flex-end','stretch'],gap:['0','12','24']};
export const labProperties={direction:'flex-direction',justify:'justify-content',align:'align-items',gap:'gap'};
export const labSettings=value=>Object.fromEntries(Object.keys(labDefaults).map(key=>[key,labChoices[key].includes(value?.[key])?value[key]:labDefaults[key]]));
export function labStage(settings){
 const s=labSettings(settings);
 return `<div class="lesson-lab-axes">${s.direction==='row'?'Principal → · transversal ↓':'Principal ↓ · transversal →'}</div><div class="lesson-lab-stage" style="flex-direction:${s.direction};justify-content:${s.justify};align-items:${s.align};gap:${s.gap}px"><div>01<br>Photo</div><div>02<br>Lecture<br><small>Une ligne en plus.</small></div><div>03<br>Dessin</div></div><pre class="console">.groupe {\n  display: flex;\n  flex-direction: ${s.direction};\n  justify-content: ${s.justify};\n  align-items: ${s.align};\n  gap: ${s.gap}px;\n}</pre>`;
}
const colors=['#162b32','#218e97','#bd4d2e'];
// Keep existing pupils’ strokes exactly as saved with the previous palette.
const savedColors=[...colors,'#17262c','#5145cd'];
export function drawingPaths(state){
 return (Array.isArray(state.strokes)?state.strokes:[]).slice(0,60).filter(stroke=>stroke&&typeof stroke==='object').map(stroke=>{
  const points=(Array.isArray(stroke.points)?stroke.points:[]).slice(0,160).filter(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1000));
  return points.length?`<path d="${points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')}" fill="none" stroke="${savedColors.includes(stroke.color)?stroke.color:colors[0]}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`:'';
 }).join('');
}
export function workshopInput(a,answer,{disabled=false}={}){
 const id=esc(a.id),off=disabled?'disabled':'',w=a.workshop||{},state=parseState(answer);
 if(a.type==='Blackboard')return `<div class="lesson-drawing" data-drawing="${id}"><input type="hidden" data-answer="${id}" value="${esc(answer||'{}')}" ${off}><div class="lesson-drawing-tools"><span>TON TABLEAU</span>${colors.map((color,i)=>`<button type="button" data-pen="${color}" aria-label="Feutre ${['noir','turquoise','orange'][i]}" aria-pressed="${i===0}" ${off}><i style="background:${color}"></i>${['Noir','Turquoise','Orange'][i]}</button>`).join('')}<button type="button" data-undo-stroke ${off}>Annuler le trait</button></div><svg class="lesson-drawing-surface" viewBox="0 0 1000 500" role="img" aria-label="Tableau à dessiner au pointeur ; une légende textuelle est disponible juste après" data-locked="${disabled}"><g data-strokes>${drawingPaths(state)}</g></svg><label>Légende · tu peux aussi décrire ton schéma ici<textarea data-board-caption ${off} placeholder="Élément → relation → élément. Ce que montrent mes flèches…">${esc(state.caption||'')}</textarea></label>${w.board?`<details class="lesson-hint"><summary>Comparer avec le tableau du cours</summary>${subjectBoard(w.board)}</details>`:''}</div>`;
 if(a.type==='Simulator'&&parseState(a.starter).preset==='flexbox'){
  const settings=labSettings(state.applied);state.history=Array.isArray(state.history)?state.history:[];
  return `<div class="lesson-lab" data-flex-lab="${id}"><input type="hidden" data-answer="${id}" value="${esc(answer||'{}')}" ${off}><div class="lesson-lab-controls">${Object.entries(labChoices).map(([key,choices])=>`<label>${labProperties[key]}<select data-lab-setting="${key}" ${off}>${choices.map(v=>`<option value="${v}" ${settings[key]===v?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div><label>Avant de tester, ma prévision<input data-lab-prediction value="${esc(state.prediction||'')}" placeholder="Je pense que les cartes vont…" ${off}></label><button type="button" class="btn primary" data-lab-run ${off}>Tester cette modification →</button><p data-lab-feedback role="status" class="lesson-lab-feedback">${esc(state.history?.at(-1)?.comparison||'Change un seul réglage pour observer son effet.')}</p><div data-lab-stage>${labStage(settings)}</div><label>Après l’essai · compare avec ta prévision<textarea data-lab-explanation ${off}>${esc(state.explanation||'')}</textarea></label><span class="lesson-stamp" data-lab-count>${Array.isArray(state.history)?state.history.length:0} essai(s) conservé(s)</span></div>`;
 }
 if(a.type==='CodeEditor'&&w.language){
  const code=answer??a.starter,web=['html','css'].includes(w.language);
  return `<div class="lesson-workbench ${web?'has-preview':''}" data-workbench="${id}"><section class="lesson-editor"><div class="lesson-window-bar"><span><i></i><i></i><i></i></span><span>${{css:'style.css',html:'index.html',javascript:'main.js',sql:'requete.sql',text:'production.txt'}[w.language]}</span><span>À TOI DE CODER</span></div>${w.language==='css'?`<details class="lesson-source"><summary>Voir le HTML à organiser</summary><pre><code>${esc(w.document)}</code></pre></details>`:''}<label class="sr-only" for="answer-${id}">Ton code ${esc(w.language)}</label><textarea id="answer-${id}" class="code" data-answer="${id}" spellcheck="false" ${off}>${esc(code)}</textarea></section>${web?`<section class="lesson-preview"><div class="lesson-preview-toolbar"><strong>LE RENDU</strong><label>Largeur<select data-preview-width ${off}><option value="100%">Disponible</option><option value="360px">360 px</option><option value="900px">900 px</option></select></label><button type="button" class="btn" data-workshop-preview="${id}" ${off}>Actualiser</button></div><div class="lesson-preview-viewport"><iframe sandbox="" referrerpolicy="no-referrer" title="Rendu de ${esc(a.title)}" data-workshop-frame="${id}" srcdoc="${esc(previewDocument(a,code))}"></iframe></div><p>Teste une largeur réduite et regarde ce qui change.</p></section>`:''}</div>${w.checks?.length?`<div class="lesson-test-contract"><span class="lesson-kicker">LES CAS À VÉRIFIER</span><ul>${w.checks.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`:''}${w.hints?.map((h,i)=>`<details class="lesson-hint"><summary>Indice ${i+1} · ${i?'une piste supplémentaire':'par où commencer'}</summary><p>${esc(h)}</p></details>`).join('')||''}`;
 }
 return null;
}
