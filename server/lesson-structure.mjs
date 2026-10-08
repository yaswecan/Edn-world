import {validate,contentSchema} from './contracts.mjs';
import {fail} from './store.mjs';

export const phases=['opening','diagnostic','understand','observe','guided','pause','autonomy','extend','summary'];
export const teaching=(values={})=>({steps:[],hint:'',check:'',takeaways:[],diagram:[],...values});
export const block=(id,type,phase,title,content,minutes,activityIds=[],skills=[],guide={})=>({id,type,phase,title,content,minutes,activityIds,skills,teaching:teaching(guide)});
export const firstSentence=text=>String(text||'').split(/(?<=[.!?])\s/)[0];
export const shortTitle=text=>String(text||'').split(' // ').at(-1);

// The model receives content slots, never the layout, timing, assessment or game contract.
export function contentSlots(draft){return {title:draft.title,objectives:draft.objectives,sections:draft.blocks.filter(b=>!['Diagnostic','Pause','CodeStationLauncher','LiveCode'].includes(b.type)).map(({id,title,content,teaching:guide})=>({id,title,content,teaching:guide||teaching()})),activities:draft.activities.filter(a=>['manual','none','rubric'].includes(a.correctionMode)&&!a.workshop&&!['CodeEditor','Simulator','Blackboard'].includes(a.type)).map(({id,title,instruction,objective,expectedEvidence,reference})=>({id,title,instruction,objective,expectedEvidence,reference})),teacherGuide:draft.teacherGuide};}
// Narrow authoring check for platform microcopy. Course prose, examples and code
// deliberately remain outside this check (API, JSON, pipelines etc. may be taught).
export function presentationIssues(draft,result){
 const fields=[result.title,...result.sections.map(s=>s.title),...result.activities.map(a=>a.title),
  ...result.sections.filter(s=>draft.blocks.find(b=>b.id===s.id)?.phase==='opening').map(s=>s.content)];
 const internal=/Teacher Twin|DailyBundle|LessonSpec|contexte de génération|intention pédagogique résolue|corpus compilé|preuve collectée|politique de remédiation|critères? N[23]|parcours assigné par le moteur|runtime de séance|(?:notre|le) (?:renderer|workflow|pipeline|provider)|(?:fallback|mock|fixture|payload) (?:système|de séance)|rapport de contrôle|date de génération|(?:version|généré le)\s*[:#]?\s*\d|\bG[0-3]\s*·\s*BC|\bBC[T]?\d+-C\d+-\d+|\b\d{1,2}[h:]\d{2}\s*[–—-]\s*\d{1,2}[h:]\d{2}/i;
 return fields.filter(text=>internal.test(text||''));
}
export function mergeContent(draft,result){
 validate(contentSchema,result);
 const expected=contentSlots(draft),sameIds=(a,b)=>JSON.stringify(a.map(x=>x.id))===JSON.stringify(b.map(x=>x.id));
 if(!sameIds(expected.sections,result.sections)||!sameIds(expected.activities,result.activities))fail(422,'Le contenu a modifié les emplacements pédagogiques. Aucun brouillon remplacé.');
 // Markup is unnecessary even when escaped: reject it at the authoring boundary.
 if(/<\/?(?:script|style|html|div|iframe|img|svg|h[1-6]|p|section|button|a)\b/i.test(JSON.stringify(result)))fail(422,'Le contenu doit rester du texte, sans présentation HTML.');
 if(presentationIssues(draft,result).length)fail(422,'Les titres ou transitions élèves contiennent des métadonnées internes. Aucun brouillon remplacé.');
 const merged=structuredClone(draft);merged.title=result.title;merged.objectives=result.objectives;merged.teacherGuide=result.teacherGuide;
 for(const section of result.sections)Object.assign(merged.blocks.find(b=>b.id===section.id),section);
 for(const task of result.activities)Object.assign(merged.activities.find(a=>a.id===task.id),task);
 return merged;
}

export function orderAndTime(content,duration,diagnosticMinutes){
 if(!Number.isInteger(duration)||duration<1||content.blocks.some(b=>!Number.isInteger(b.minutes)||b.minutes<1))fail(422,'Durées de séance invalides.');
 content.blocks.sort((a,b)=>phases.indexOf(a.phase)-phases.indexOf(b.phase));
 content.blocks.find(b=>b.type==='Diagnostic').minutes=diagnosticMinutes;
 const fixed=content.blocks.filter(b=>['Diagnostic','Pause'].includes(b.type)),flex=content.blocks.filter(b=>!fixed.includes(b));
 const budget=duration-fixed.reduce((n,b)=>n+b.minutes,0),minimum=flex.length*2;
 if(!flex.length)return content;
 if(budget<minimum)return content; // Quality check blocks publication of an unrealistically short slot.
 const total=flex.reduce((n,b)=>n+b.minutes,0);
 for(const b of flex)b.minutes=Math.max(2,Math.floor(budget*b.minutes/total));
 let remaining=budget-flex.reduce((n,b)=>n+b.minutes,0);
 for(let i=0;remaining!==0;i=(i+1)%flex.length){const b=flex[i];if(remaining>0){b.minutes++;remaining--;}else if(b.minutes>2){b.minutes--;remaining++;}}
 // Activity clocks share their parent block's budget (optional challenges are outside it).
 for(const b of content.blocks){const tasks=b.activityIds.map(id=>content.activities.find(a=>a.id===id)).filter(a=>a?.required);for(const a of tasks)a.duration=Math.max(1,Math.floor(b.minutes/tasks.length));}
 return content;
}

export function pedagogyChecks(spec){
 const checks=[],add=(id,ok,message)=>checks.push({id,ok:!!ok,message});
 const inPhase=phase=>spec.blocks.filter(b=>b.phase===phase),hasTask=phase=>inPhase(phase).some(b=>b.activityIds.some(id=>spec.activities.some(a=>a.id===id&&a.required&&a.instruction.trim())));
 const required=phases.filter(p=>p!=='pause');
 add('lesson_sections',required.every(p=>inPhase(p).length),'Hero, diagnostic, comprendre, observer, aide, autonomie, prolongement et bilan présents');
 add('lesson_order',spec.blocks.every((b,i)=>phases.includes(b.phase)&&(!i||phases.indexOf(b.phase)>=phases.indexOf(spec.blocks[i-1].phase))),'Ordre pédagogique fixe');
 add('lesson_objectives',spec.objectives.length>0&&spec.objectives.every(s=>s.trim().length>=12),'Objectifs explicites');
 add('lesson_concept',inPhase('understand').some(b=>b.content.trim().length>=100&&b.teaching?.takeaways.some(t=>t.trim().length>=20)),'Apport notionnel et reformulation présents');
 add('lesson_example',inPhase('observe').some(b=>b.content.trim().length>=30&&b.teaching?.steps.length>=2&&b.teaching.check.trim()),'Exemple commenté avec vérification');
 add('lesson_guidance',hasTask('guided')&&inPhase('guided').some(b=>b.teaching?.steps.length>=2&&b.teaching.hint.trim()&&b.teaching.check.trim()),'Application guidée avec indice et vérification');
 add('lesson_autonomy',hasTask('autonomy'),'Activité autonome explicite');
 add('lesson_transfer',hasTask('extend')||inPhase('extend').some(b=>b.type==='CodeStationLauncher'&&spec.codeStation?.completionRule),'Mission ou réinvestissement explicite');
 add('lesson_summary',inPhase('summary').some(b=>b.teaching?.takeaways.length>=2)&&hasTask('summary'),'Synthèse notionnelle et ticket de sortie');
 add('lesson_diagnostic',inPhase('diagnostic').length===1&&inPhase('diagnostic')[0].type==='Diagnostic'&&spec.diagnostic?.tasks?.length>0,'Un diagnostic réel, sans doublon');
 add('lesson_coverage',spec.activities.filter(a=>a.required).every(a=>spec.blocks.some(b=>b.activityIds.includes(a.id))),'Toutes les activités obligatoires sont accessibles');
 const tasks=spec.activities.filter(a=>a.required&&a.type!=='Reflection'),types=new Set(tasks.map(a=>a.type));
 const lessonTypes=new Set([...types,...(spec.diagnostic?.tasks||[]).filter(a=>a.required&&a.type!=='Reflection').map(a=>a.type)]);
 add('lesson_variety',types.size>=2&&lessonTypes.size>=3,'Au moins trois formes d’activité dans la séance, dont deux hors diagnostic : produire, manipuler, représenter ou vérifier');
 add('lesson_manipulation',tasks.some(a=>['Blackboard','Simulator','DragDrop','Matching','TruthTable','CircuitExercise','Preview','Terminal'].includes(a.type))||types.has('CodeEditor')&&types.has('FillBlank'),'Une manipulation ou une reconstruction active, au-delà des questions ouvertes');
 add('lesson_subject_diagram',inPhase('understand').some(b=>b.boards?.length||b.teaching?.diagram.some(row=>row.includes('→')&&row!=='Observer → Comprendre → Essayer → Vérifier')),'Un schéma relié aux notions de la séance');
 const codeSkills=spec.skills.filter(c=>/^BC04-C[12]-|^BC04-C3-2$|^BC04-C4-2$|^BC05-C1-|^BC06-C2-[13]$|^BCT01-C2-1$|^BCT02-C3-1$|^BCT04-C2-1$|^BCT05-C3-2$|^BCT06-C1-2$/.test(c));
 const phaseTasks=phase=>inPhase(phase).flatMap(b=>b.activityIds.map(id=>tasks.find(a=>a.id===id)).filter(Boolean));
 add('lesson_code_path',codeSkills.every(skill=>['guided','autonomy'].every(phase=>phaseTasks(phase).some(a=>['CodeEditor','Preview','TestRunner'].includes(a.type)&&a.skills.includes(skill)))),'Pour chaque compétence de code : exercice guidé et production autonome dans un éditeur');
 add('lesson_code_contracts',tasks.filter(a=>['CodeEditor','TestRunner'].includes(a.type)).every(a=>a.starter.trim()&&(!['javascript','html','css','sql'].includes(a.correctionMode)||a.tests.length)),'Exercices de code avec point de départ et tests lorsqu’une correction automatique est annoncée');
 return checks;
}
