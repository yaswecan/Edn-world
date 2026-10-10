import {renderRich} from './rich-document.js';
import {edenLogo} from './brand.js';
import {componentInput} from './components.js';
import {subjectBoard} from './workshop-ui.js';
import {studentCopy, studentBlockTitle, studentBlockContent, studentFeedback, studentResultStatus} from './student-copy.js';

export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraphs=text=>String(text||'').split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${escape(p)}</p>`).join('');
const list=items=>`<ul>${items.map(s=>`<li>${escape(s)}</li>`).join('')}</ul>`;
const action=(label,name,id='',primary=false)=>`<button type="button" class="btn ${primary?'primary':''}" data-action="${name}" data-id="${escape(id)}">${label}</button>`;
const stamp=(label,tone='')=>`<span class="lesson-stamp ${tone}">${escape(label)}</span>`;
export const PHASES=[['opening','Le départ'],['diagnostic','Évaluation'],['understand','Comprendre'],['observe','Observer'],['guided','Faire avec aide'],['autonomy','Faire seul'],['extend','Aller plus loin'],['summary','Le bilan']];
export function phaseOf(b){return b.phase||({LessonHero:'opening',Diagnostic:'diagnostic',ConceptCard:'understand',LiveCode:'observe',Reflection:'summary',Pause:'pause',CodeStationLauncher:'extend'}[b.type])||(b.id==='autonomy'?'autonomy':'guided');}
const guide=b=>b.teaching||{steps:[],hint:'',check:'',takeaways:[],diagram:[]};
const prose=b=>studentBlockContent(b)?.trim()?`<div class="lesson-prose">${paragraphs(studentBlockContent(b))}</div>`:'';
const check=text=>text?`<div class="lesson-check"><span aria-hidden="true">✓</span><div><strong>Comment vérifier ?</strong><p>${escape(text)}</p></div></div>`:'';
const hint=text=>text?`<details class="lesson-hint"><summary>Un coup de pouce ? <span aria-hidden="true">+</span></summary><p>${escape(text)}</p></details>`:'';
const steps=items=>items?.length?`<ol class="lesson-method">${items.map((s,i)=>`<li><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span><p>${escape(s)}</p></li>`).join('')}</ol>`:'';

function STEMIllustration(){return `<div class="lesson-illustration" aria-hidden="true"><img class="lesson-board-machine" src="/assets/icons/editor.png" alt="" width="325" height="198"><div class="lesson-board-route"><div><img src="/assets/icons/browser.png" alt="">Observer</div><span>→</span><div><img src="/assets/icons/file.png" alt="">Essayer</div><span>→</span><div><img src="/assets/icons/magnifier.png" alt="">Expliquer</div></div></div>`;}
const heroTitle=title=>{const words=String(title||'').trim().split(/\s+/),last=words.pop();return `${words.length?escape(words.join(' '))+' ':''}<span class="lesson-underlined">${escape(last)}</span>`;};

export function ObjectiveCard(objectives){if(!objectives?.length)return '';return `<section class="lesson-objectives" data-component="ObjectiveCard"><div><h2>Objectifs</h2></div><ol>${objectives.map((o,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><p>${escape(o.replace(/^[A-Z]/,c=>c.toLowerCase()))}</p></li>`).join('')}</ol></section>`;}
export function LessonHero(spec,b){return `<div data-component="LessonHero"><div class="lesson-hero"><div><h1 tabindex="-1">${heroTitle(spec.title)}</h1>${studentBlockContent(b)?.trim()?`<p class="lesson-lead">${escape(studentBlockContent(b))}</p>`:''}</div>${STEMIllustration()}</div>${ObjectiveCard(spec.objectives)}</div>`;}
export function SessionTimeline(spec,index,{preview=false,completed=[]}={}){
 if(spec.editorVersion===1)return `<nav class="lesson-timeline" aria-label="Étapes de la séance"><div class="lesson-kicker">TON PARCOURS</div>${spec.blocks.map((b,n)=>`<div class="lesson-phase ${n===index?'is-active':''}"><button type="button" data-action="${preview?'demo-step':'student-step'}" data-id="${n}" ${n===index?'aria-current="step"':''}><span>${String(n+1).padStart(2,'0')}</span> ${escape(b.title)}</button></div>`).join('')}</nav>`;
 const current=spec.blocks[index];if(!current)return '<p>Aucune section.</p>';const phase=phaseOf(current);
 return `<nav class="lesson-timeline" data-component="SessionTimeline" aria-label="Étapes de la séance"><div class="lesson-kicker">TON PARCOURS</div>${PHASES.map(([key,label],i)=>{const blocks=spec.blocks.map((b,index)=>({b,index})).filter(({b})=>phaseOf(b)===key);if(!blocks.length)return '';return `<div class="lesson-phase ${key===phase?'is-active':''}"><div class="lesson-phase-label"><span>${String(i+1).padStart(2,'0')}</span><strong>${label}</strong></div>${blocks.map(({b,index:n})=>`<button type="button" data-action="${preview?'demo-step':'student-step'}" data-id="${n}" ${n===index?'aria-current="step"':''}><span class="lesson-step-dot" aria-hidden="true">${completed.includes(b.id)?'✓':''}</span>${escape(studentBlockTitle(b))}</button>`).join('')}</div>`;}).join('')}</nav>`;
}
export function BlackboardSchema(rows,title='Le schéma à garder en tête'){if(!rows?.length)return '';return `<figure class="lesson-blackboard" data-component="BlackboardSchema"><figcaption><span aria-hidden="true">↳</span> ${escape(title)}</figcaption>${rows.map(row=>`<div class="lesson-diagram-row">${row.split(/\s*→\s*|\s*->\s*/).map((node,i)=>`${i?'<span class="lesson-diagram-arrow" aria-hidden="true">→</span>':''}<span class="lesson-diagram-node">${escape(node)}</span>`).join('')}</div>`).join('')}</figure>`;}
export function DiagnosticIntro(spec){const d=spec.diagnostic;return `<div data-component="DiagnosticIntro" class="lesson-diagnostic-intro"><div>${stamp(`${d.tasks.length} exercices${d.rubric?.length?' · Note sur '+d.rubric.reduce((n,r)=>n+r.max,0):''}`)}</div><p>${d.kind==='baseline'?'':'Ces exercices reprennent la séance précédente. '}Réponds sans aide, puis rends ton travail pour continuer. Tu peux rendre une réponse incomplète.</p>${d.expectations?`<div class="diagnostic-targets"><p><strong>A1 · Les bases</strong> ${escape(d.expectations.a1)}</p><p><strong>A2 · Autonomie et vérification</strong> ${escape(d.expectations.a2)}</p><small>${d.duration} minutes · A2 à partir de 15/20, après relecture. Les tests automatiques ne suffisent pas à valider la démarche.</small></div>`:''}</div>`;}
export function CorrectionFlashBlock(text){return `<aside class="lesson-flash" data-component="CorrectionFlashBlock"><span class="lesson-kicker">LE RÉFLEXE À GARDER</span>${paragraphs(text)}</aside>`;}
export function LiveCodeBlock(content){return `<div class="lesson-code-window" data-component="LiveCodeBlock"><div class="lesson-window-bar"><span><i></i><i></i><i></i></span><span>EXEMPLE À LIRE</span><span aria-hidden="true">&lt;/&gt;</span></div><pre tabindex="0"><code>${escape(content)}</code></pre></div>`;}
export function ObservationBlock(b){const g=guide(b),isCode=/\b(const|let|function|console\.|return|def |SELECT|print\()|[{}]|\n.*\|/.test(b.content);return `<div data-component="ObservationBlock" class="lesson-observation"><div>${isCode?LiveCodeBlock(b.content):`<div class="lesson-example"><span class="lesson-kicker">LE CAS CONCRET</span>${prose(b)}</div>`}${g.takeaways.length?CorrectionFlashBlock(g.takeaways.join('\n\n')):''}</div><div class="lesson-reading"><span class="lesson-kicker">ON DÉROULE ENSEMBLE</span>${steps(g.steps)}${check(g.check)}</div></div>`;}

function exercise(a,ctx,component,kind=''){
 const {answers={},diagnostic=false,preview=false,submitted=false,completed=[]}=ctx;
 const disabled=ctx.readOnly||(preview&&!ctx.interactivePreview)||(diagnostic&&submitted);
 const controls=ctx.readOnly||diagnostic&&submitted?'':[['CodeEditor','TestRunner'].includes(a.type)&&a.workshop?.profile!=='dom'&&a.workshop?.language!=='text'&&(!preview||ctx.interactivePreview)?action('Vérifier mon code',preview?'preview-run-code':'run-code',a.id):'',!diagnostic&&!preview?action(completed.includes(a.id)?'Activité terminée ✓':'Terminer l’activité','complete-activity',a.id):''].join('');
 return `<article class="lesson-exercise ${kind}" data-component="${component}" data-activity="${escape(a.id)}"><header><div><span class="lesson-kicker">${diagnostic||a.required?'EXERCICE':'FACULTATIF'}</span><h3>${escape(a.title)}</h3></div></header>${a.observation?`<figure class="diagnostic-observation"><figcaption>${escape(a.observation.title)}</figcaption>${LiveCodeBlock(a.observation.code)}${a.observation.output?`<div class="diagnostic-observed-output"><strong>Sortie observée</strong><pre>${escape(a.observation.output)}</pre></div>`:''}</figure>`:''}<div class="lesson-instruction">${a.richText?.instruction?renderRich(a.richText.instruction):paragraphs(a.instruction)}</div><div class="lesson-input">${componentInput(a,answers[a.id],{disabled})}</div>${a.expectedEvidence?`<div class="lesson-evidence"><span aria-hidden="true">↳</span><p><strong>À rendre</strong> ${a.richText?.expectedEvidence?renderRich(a.richText.expectedEvidence):escape(a.expectedEvidence)}</p></div>`:''}${controls?`<div class="lesson-exercise-actions">${controls}</div>`:''}<pre class="console" id="console-${escape(a.id)}" hidden></pre></article>`;
}
export const FillBlankBlock=(a,c={})=>exercise(a,c,'FillBlankBlock','lesson-fillblank');
export const QuizBlock=(a,c={})=>exercise(a,c,'QuizBlock','lesson-quiz');
export const CodeExerciseBlock=(a,c={})=>exercise(a,c,'CodeExerciseBlock','lesson-code-exercise');
export const TerminalExerciseBlock=(a,c={})=>exercise(a,c,'TerminalExerciseBlock','lesson-terminal-exercise');
export const ReflectionBlock=(a,c={})=>exercise(a,c,'ReflectionBlock','lesson-reflection');
export const ExitTicketBlock=(a,c={})=>`<div data-component="ExitTicketBlock">${ReflectionBlock(a,c)}</div>`;
export function renderActivity(a,ctx={}){if(ctx.exit)return ExitTicketBlock(a,ctx);const renderer={FillBlank:FillBlankBlock,Quiz:QuizBlock,MasteryCheck:QuizBlock,CodeEditor:CodeExerciseBlock,TestRunner:CodeExerciseBlock,Terminal:TerminalExerciseBlock,Reflection:ReflectionBlock};return (renderer[a.type]||((a,c)=>exercise(a,c,'ApplicationBlock')))(a,ctx);}
export function CodeStationLaunchBlock(spec,b,{preview=false}={}){return `<div class="lesson-mission" data-component="CodeStationLaunchBlock"><span class="lesson-kicker">PÉDAGOLAB</span>${paragraphs(b.content)}${spec.codeStation?.completionRule?`<div class="lesson-mission-rule"><strong>Pour réussir</strong><p>${escape(spec.codeStation.completionRule)}</p></div>`:''}${!preview&&spec.codeStation?action('Jouer','launch-game','',true):''}</div>`;}
export function SummaryBlock(b){return `<section class="lesson-summary" data-component="SummaryBlock"><h2>À retenir</h2>${list(guide(b).takeaways.length?guide(b).takeaways:[b.content])}<p>Pour vérifier que tu as compris, explique une de ces idées avec ton propre exemple.</p></section>`;}


function renderEditedSection(spec,b,ctx){
 let html=`<header class="lesson-section-heading"><h1 tabindex="-1">${escape(b.type==='LessonHero'?spec.title:b.title)}</h1></header>`;
 for(const i of b.editor.items){
  if(i.kind==='rich')html+=`<div class="rich-content ${['hint','takeaways'].includes(i.role)?'lesson-flash':i.role==='check'?'lesson-check':''}">${renderRich(i.doc)}</div>`;
  if(i.kind==='board')html+=subjectBoard(i.board);
  if(i.kind==='objectives')html+=ObjectiveCard(spec.objectives);
  if(i.kind==='timeline')html+=steps(spec.blocks.map(b=>b.title));
  if(i.kind==='mission')html+=CodeStationLaunchBlock(spec,{...b,content:''},ctx);
  if(i.kind==='diagnostic')html+=DiagnosticIntro(spec);
  if(['activity','diagnosticActivity'].includes(i.kind)){const diagnostic=i.kind==='diagnosticActivity',a=(diagnostic?spec.diagnostic.tasks:spec.activities).find(a=>a.id===i.activityId);if(a)html+=renderActivity(a,{...ctx,diagnostic});}
 }
 if(b.type==='Diagnostic'&&!ctx.preview&&!ctx.readOnly)html+=ctx.submitted?`<div role="status">✓ ${studentCopy.submitted}</div>${action('Voir le résultat','student-result')}`:`<div class="lesson-submit">${action(studentCopy.save,'save-answers')}${action(studentCopy.submit,'submit-answers','',true)}<span id="save-status" role="status" aria-live="polite"></span></div>`;
 const notes=spec.sourceNotes?.filter(n=>n.blockId===b.id)||[];if(notes.length)html+=`<details><summary>Sources</summary>${notes.map(n=>`<p>${escape(n.title)} · ${escape(n.location)}</p>${paragraphs(n.note)}`).join('')}</details>`;
 return html;
}

export function renderLessonBlock(spec,index,ctx={}){
 const b=spec.blocks[index];if(!b)return '';
 if(b.editor)return renderEditedSection(spec,b,ctx);
 if(b.type==='LessonHero')return LessonHero(spec,b);
 const g=guide(b),phase=phaseOf(b),label=PHASES.find(([id])=>id===phase)?.[1]||'Une pause';
 let html=`<header class="lesson-section-heading">${label===studentBlockTitle(b)?'':`<div>${stamp(label,'brand-tone')}</div>`}<h1 tabindex="-1">${escape(studentBlockTitle(b))}</h1></header>`;
 const support=ctx.support?.find(s=>s.blockId===b.id);
 if(support)html+=`<aside class="lesson-flash"><h2>Un rappel pour poursuivre</h2>${paragraphs(support.reminder)}${paragraphs(support.action)}</aside>`;
 const sourceNotes=spec.sourceNotes?.filter(n=>n.blockId===b.id)||[];
 if(sourceNotes.length)html+=`<details class="lesson-hint"><summary>Retrouver les sources utiles</summary>${sourceNotes.map(n=>`<p><strong>${escape(n.title)}</strong> · ${escape(n.location)}</p>${paragraphs(n.note)}${n.url?.startsWith('https://')?`<a href="${escape(n.url)}" target="_blank" rel="noopener noreferrer">Consulter la source</a>`:''}`).join('')}</details>`;
 if(b.type==='Diagnostic'){
  html+=DiagnosticIntro(spec);
  if(ctx.submitted&&!ctx.preview)html+=spec.diagnostic.tasks.map(a=>renderActivity(a,{...ctx,diagnostic:true})).join('')+`<div class="lesson-receipt" role="status">✓ ${studentCopy.submitted}</div>${action('Voir le résultat','student-result')}`;
  else {html+=spec.diagnostic.tasks.map(a=>renderActivity(a,{...ctx,diagnostic:true})).join('');if(!ctx.preview&&!ctx.readOnly)html+=`<div class="lesson-submit">${action(studentCopy.save,'save-answers')}${action(studentCopy.submit,'submit-answers','',true)}<span id="save-status" role="status" aria-live="polite"></span></div>`;}
 }else if(['Diagram','BlackboardDiagram'].includes(b.type))html+=BlackboardSchema(b.content.split('\n'),b.title);
 else if(b.type==='ObjectiveCard')html+=ObjectiveCard(spec.objectives);
 else if(b.type==='Timeline')html+=steps(spec.blocks.filter(block=>block.type!=='Pause').map(studentBlockTitle));
 else if(phase==='observe')html+=ObservationBlock(b);
 else if(b.type==='CodeStationLauncher')html+=CodeStationLaunchBlock(spec,b,ctx);
 else if(phase==='summary')html+=SummaryBlock(b);
 else if(b.type==='Pause')html+=`<div class="lesson-rest"><span aria-hidden="true">☀</span>${prose(b)}</div>`;
 else{
  html+=prose(b);
 if(phase==='understand')html+=(b.boards?.length?`<div class="lesson-board-gallery">${b.boards.map((id,i)=>`<details ${i===0?'open':''}><summary>Repère ${i+1} · ${['Parent et enfants','Les deux axes','Les espaces'][i]||'Au tableau'}</summary>${subjectBoard(id)}</details>`).join('')}</div>`:BlackboardSchema(g.diagram,'Relier les idées'))+(g.takeaways.length?CorrectionFlashBlock(g.takeaways.join('\n\n')):'');
  const codeWorkshop=b.activityIds.some(id=>spec.activities.some(a=>a.id===id&&a.type==='CodeEditor'&&a.workshop));
  if(phase==='guided')html+=codeWorkshop?`<details class="lesson-hint"><summary>La méthode en trois gestes</summary>${steps(g.steps)}</details>`:steps(g.steps);
  if(!codeWorkshop)html+=hint(g.hint);
 }
 html+=b.activityIds.map(id=>spec.activities.find(a=>a.id===id)).filter(Boolean).map(a=>renderActivity(a,{...ctx,exit:phase==='summary'})).join('');
 if(['guided','autonomy','extend'].includes(phase))html+=check(g.check);
 return html;
}

export function renderLessonPage(spec,index=0,ctx={}){
 if(!spec.blocks.length)return '<main class="lesson-view"><p>Cette séance ne contient pas encore de section.</p></main>';
 const displayDate=ctx.displayDate||spec.date;
 const date=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'}).format(new Date(`${displayDate}T12:00:00Z`)),completed=ctx.completed||[];
 const count=spec.blocks.filter(b=>completed.includes(b.id)).length;
 return `<main id="main" class="lesson-view"><header class="lesson-topbar"><a href="${ctx.demo?'/lesson-demo.html':'/today'}" class="lesson-brand" aria-label="EDEN School, aujourd’hui">${edenLogo}<span class="lesson-brand-meta"><time datetime="${escape(displayDate)}">${date}</time></span></a><div>${stamp(ctx.demo?'Aperçu':ctx.displayName||'Aujourd’hui','brand-tone')}${!ctx.demo?`${action('Actualiser','refresh-student')}${action('Se déconnecter','logout')}`:''}</div></header><div class="lesson-layout-student"><aside><details class="lesson-mobile-nav" ${ctx.navOpen?'open':''}><summary>Le parcours · ${index+1} / ${spec.blocks.length}</summary>${SessionTimeline(spec,index,{preview:ctx.demo,completed})}</details><div class="lesson-desktop-nav">${SessionTimeline(spec,index,{preview:ctx.demo,completed})}</div></aside><div class="lesson-main"><div class="lesson-breadcrumb"><span>Aujourd’hui</span><time datetime="${escape(displayDate)}">${date}</time></div><div class="lesson-progress-row"><span>ÉTAPE ${String(index+1).padStart(2,'0')} / ${String(spec.blocks.length).padStart(2,'0')}</span><span>${count} étape${count>1?'s':''} terminée${count>1?'s':''}</span></div><div class="lesson-progress" role="progressbar" aria-label="Étapes terminées" aria-valuemin="0" aria-valuemax="${spec.blocks.length}" aria-valuenow="${count}"><span style="width:${count/spec.blocks.length*100}%"></span></div><section class="student-stage lesson-stage" aria-label="Activité en cours">${ctx.readOnly?'<fieldset disabled class="read-only-work">':''}${renderLessonBlock(spec,index,ctx)}${ctx.readOnly?'</fieldset>':''}</section><footer class="lesson-navigation"><button type="button" class="btn" data-action="${ctx.demo?'demo-prev':'student-prev'}" ${index===0?'disabled':''}>← Étape précédente</button>${ctx.readOnly&&index===spec.blocks.length-1?'':action(index===spec.blocks.length-1?(ctx.demo?'Terminer':'Remettre mon travail'):'Continuer',ctx.demo?'demo-next':'student-next','',true)}</footer>${ctx.demo?'<p class="lesson-storage-note">Les réponses de cet aperçu restent dans cet onglet.</p>':''}</div></div></main>`;
}

export function renderStudentResult(result){
 if(result.status==='submitted')return '<p>Travail rendu. Ton professeur prépare la correction.</p>';
 if(result.status==='results_pending')return '<p>Résultats en préparation. Ils seront disponibles après publication par ton professeur.</p>';
 if(result.status==='not_submitted')return '<p>Aucun travail rendu.</p>';
 const feedback=studentFeedback(result.feedback),status=studentResultStatus(result);
 const label=result.score==null?(result.grade||'Non évalué'):`${result.score} / ${result.scoreMax??20}${result.level?' · '+result.level:''}`;
 return `${stamp(label,'brand-tone')}${status?`<p>${escape(status)}</p>`:''}${feedback&&feedback!==status?`<p>${escape(feedback)}</p>`:''}${(result.items||[]).map(item=>{const detail=studentFeedback(item.feedback);return `<div class="list-row"><div><div class="row-title">${escape(item.label)}</div>${detail?`<p class="row-sub">${escape(detail)}</p>`:''}</div>${stamp(item.exempt?'Dispensé':item.observedGrade|| (item.points==null?'Non évalué':`${item.points} / ${item.max}${item.coefficient&&item.coefficient!==1?' · coef. '+item.coefficient:''}`))}</div>`;}).join('')}`;
}
