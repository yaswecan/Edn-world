import {readFileSync,readdirSync} from 'node:fs';
import {lessonSchema,validate} from '../contracts.mjs';
import {testActivityCode} from '../workshop-testing.mjs';
import {renderLessonBlock} from '../../public/lesson-renderer.js';
import {digest,reviewSchema,DIMENSIONS,CHARTER_VERSION,planSchema,unitSchema} from './contracts.mjs';
import {mechanisms,runtimeProfiles} from './catalog.mjs';
import {requireValue} from '../store.mjs';
import {validateDOMFiles} from './dom.mjs';
import {phases} from '../lesson-structure.mjs';

const runtimeFiles=['./quality.mjs','./contracts.mjs','../contracts.mjs','./prompts.mjs','../../public/app.js','../../public/style.css','../../public/workshops.css','../safe-js.mjs','../structural-grading.mjs','../workshop-testing.mjs','../../public/workshop-ui.js','../../public/workshop-runtime.js','../../public/lesson-renderer.js','../../public/lesson.css','../../public/brand.css','../../public/brand.js','../../public/components.js','../../public/student-copy.js','../../public/terminal-lab.js','../../public/dom-lab.js','./dom.mjs','./labs.mjs','../../labs/dom-runner.mjs','../../labs/broker.py','../../labs/files.py'];
export function runtimeFingerprint(){const assets=readdirSync(new URL('../../public/assets/',import.meta.url),{recursive:true,withFileTypes:true}).filter(f=>f.isFile()).map(f=>new URL(f.name,`file://${f.parentPath}/`)).sort((a,b)=>a.href.localeCompare(b.href));return digest([...runtimeFiles.map(name=>[name,digest(readFileSync(new URL(name,import.meta.url)))]),...assets.map(url=>[url.pathname.split('/public/')[1],digest(readFileSync(url))])]);}
export function candidateHash(spec,sources=[]){return digest({spec,sources:sources.map(s=>({id:s.id,contentHash:s.contentHash})),runtime:runtimeFingerprint(),labImages:{shell:process.env.EDEN_LAB_SHELL_IMAGE||null,dom:process.env.EDEN_LAB_DOM_IMAGE||null},charter:CHARTER_VERSION});}
export function validatePlan(plan,spec,sources,{knownEvidence=[]}={}){
 validate(planSchema,plan);const ids=new Set(plan.analysis.map(c=>c.conceptId));requireValue(ids.size===plan.analysis.length&&ids.size>0,'Notions absentes ou identifiants dupliqués.');
 requireValue(plan.alternatives.length>=2,'Comparer au moins deux ordres plausibles.');
 requireValue(plan.selectedOrder.length===ids.size&&new Set(plan.selectedOrder).size===ids.size&&plan.selectedOrder.every(c=>ids.has(c)),'Ordre incomplet.');
 for(const alternative of plan.alternatives)requireValue(alternative.order.length===ids.size&&new Set(alternative.order).size===ids.size&&alternative.order.every(id=>ids.has(id)),'Alternative de parcours incomplète.');
 for(const prerequisite of plan.prerequisites)if(prerequisite.status==='known')requireValue(knownEvidence.includes(prerequisite.evidence),'Acquis déclaré sans preuve issue de l’historique ; prévoir un rappel ou une vérification diagnostique.');
 for(const concept of plan.analysis)for(const dependency of concept.prerequisites){
  const earlier=plan.selectedOrder.indexOf(dependency)<plan.selectedOrder.indexOf(concept.conceptId);
  requireValue(ids.has(dependency)?earlier:plan.prerequisites.some(p=>p.conceptId===dependency&&p.action.trim()),`Prérequis non préparé ou cycle : ${concept.conceptId} → ${dependency}.`);
 }
 const segments=new Set(sources.flatMap(s=>s.segments.map(x=>x.id)));
 for(const c of plan.analysis)for(const citation of c.citations)requireValue(sources.some(s=>s.id===citation.sourceId&&s.segments.some(x=>x.id===citation.segmentId)),'Citation de source inventée.');
 requireValue(plan.coverage.length===spec.skills.length&&new Set(plan.coverage.map(c=>c.skill)).size===spec.skills.length,'Couverture dupliquée ou incomplète.');
 for(const skill of spec.skills){const coverage=plan.coverage.find(c=>c.skill===skill);requireValue(coverage&&coverage.conceptIds.length&&coverage.conceptIds.every(id=>ids.has(id)),'Compétence sans notion.');
  requireValue(coverage.sourceSegments.length&&coverage.sourceSegments.every(s=>segments.has(s)),'Compétence sans passage source vérifiable.');
  requireValue(spec.blocks.some(b=>b.id===coverage.explanationBlockId&&b.phase==='understand'&&b.skills.includes(skill)),'Bloc explicatif absent.');
  requireValue(coverage.activityIds.length&&coverage.activityIds.every(id=>spec.activities.some(a=>a.id===id&&a.skills.includes(skill))),'Activités de couverture absentes.');
  requireValue(mechanisms.some(m=>m.id===coverage.mechanismId)&&runtimeProfiles.some(r=>r.id===coverage.runtimeProfile),'Mécanisme ou atelier inconnu.');
 }
 requireValue(plan.duration.minutes<=spec.blocks.reduce((n,b)=>n+b.minutes,0),'Plan trop long pour le créneau.');
 requireValue(plan.diagnosticBranches.length>=2,'Branches diagnostiques absentes.');return plan;
}
export function applyPlanOrder(spec,plan){
 const result=structuredClone(spec),rank=skill=>Math.min(...(plan.coverage.find(c=>c.skill===skill)?.conceptIds||[]).map(c=>plan.selectedOrder.indexOf(c)));
 result.skills.sort((a,b)=>rank(a)-rank(b));
 result.blocks.sort((a,b)=>phases.indexOf(a.phase)-phases.indexOf(b.phase)||Math.min(...a.skills.map(rank))-Math.min(...b.skills.map(rank)));
 result.timeline=result.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));return result;
}
export function unitSlots(spec,skill){
 // Shared blocks belong to the first skill only; no concurrent overwrite.
 const owned=block=>block.skills[0]===skill;
 const sections=spec.blocks.filter(b=>owned(b)&&!['Diagnostic','Pause','CodeStationLauncher'].includes(b.type));
 const activities=spec.activities.filter(a=>a.skills[0]===skill&&a.type!=='Simulator'&&a.type!=='Blackboard');
 return {skill,sections,activities};
}
export function applyUnit(spec,unit,sources){
 validate(unitSchema,unit);
 const slots=unitSlots(spec,unit.skill),same=(a,b)=>JSON.stringify(a.map(x=>x.id))===JSON.stringify(b.map(x=>x.id));
 requireValue(same(slots.sections,unit.sections)&&same(slots.activities,unit.activities),'L’unité doit conserver tous les emplacements dans leur ordre.');
 requireValue(unit.depth.citations.length&&unit.depth.citations.every(c=>sources.some(s=>s.id===c.sourceId&&s.segments.some(x=>x.id===c.segmentId))),'Explication sans sources localisables.');
 const result=structuredClone(spec);
 for(const section of unit.sections){const b=result.blocks.find(b=>b.id===section.id);Object.assign(b,section);if(b.phase==='understand'){b.depth=unit.depth;b.content=[unit.depth.question,unit.depth.prerequisiteReminder,unit.depth.mechanism,unit.depth.workedExample,unit.depth.misconception].join('\n\n');}}
 result.sourceNotes=(result.sourceNotes||[]).filter(n=>!unit.sections.some(s=>s.id===n.blockId));
 for(const citation of unit.depth.citations){const source=sources.find(s=>s.id===citation.sourceId),segment=source?.segments.find(s=>s.id===citation.segmentId);
  if(source?.visibility==='student'&&source.role!=='solution'&&segment?.visibility==='student')for(const b of result.blocks.filter(b=>b.phase==='understand'&&unit.sections.some(s=>s.id===b.id)))result.sourceNotes.push({blockId:b.id,title:source.title,location:segment.location,note:citation.claim,url:source.sourceURL?.startsWith('https://')?source.sourceURL:null});
 }
 for(const task of unit.activities){const a=result.activities.find(a=>a.id===task.id),{hints,files,...fields}=task;Object.assign(a,fields);if(a.workshop){a.workshop.hints=hints;if(files.length)a.workshop.files=files;if(a.workshop.profile==='dom')validateDOMFiles(a.workshop.files);}
  requireValue(!['javascript','html','css','sql'].includes(a.correctionMode)||a.tests.length,'Tests supprimés de l’atelier.');
 }
 // No synopsis replaces the complete lesson when compiling slides.
 result.slides=result.blocks.filter(b=>!['Diagnostic','Pause'].includes(b.type)).map(b=>({title:b.title,body:b.content}));validate(lessonSchema,result);return result;
}
export async function softwareChecks(spec,{baseline=null,sources=[],browserEvidence=null,labEvidence=null}={}){
 const checks=[],add=(id,status,evidence)=>checks.push({id,status,evidence,blocking:true});
 try{validate(lessonSchema,spec);add('schema','PASS','DailyLessonSpec validé.');}catch(e){add('schema','FAIL',e.message);}
 const first=spec.blocks.find(b=>b.type!=='LessonHero');add('diagnostic-first',first?.type==='Diagnostic'?'PASS':'FAIL','Première activité après l’annonce des objectifs.');
 for(const skill of spec.skills){const block=spec.blocks.find(b=>b.phase==='understand'&&b.skills.includes(skill));add(`depth:${skill}`,block?.depth&&Object.values(block.depth).every(v=>typeof v==='string'?v.trim():v.length)?'PASS':'FAIL',`blocks/${block?.id||skill} : contrat de profondeur renseigné ; valeur pédagogique soumise au relecteur.`);}
 const text=JSON.stringify(spec);add('complete',/expliquer ici|exercice à compléter|TODO_PEDAGOGY|schéma à prévoir/i.test(text)?'FAIL':'PASS','Absence de placeholders rédactionnels connus.');
 for(const a of [...spec.activities,...spec.diagnostic.tasks]){
  if(a.workshop?.profile!=='dom'&&['javascript','html','css','sql'].includes(a.correctionMode)){
   const result=await testActivityCode(a,a.reference);add(`reference:${a.id}`,result.ok?'PASS':result.pending?'NOT RUN':'FAIL',JSON.stringify(result));
  }
  if(a.type==='Terminal'||a.workshop?.profile==='shell-git'||a.workshop?.profile==='dom')add(`lab:${a.id}`,labEvidence?.[a.id]?.status||'NOT RUN',labEvidence?.[a.id]?.evidence||'Aucune exécution indépendante du laboratoire disponible.');
 }
 if(baseline){const missing=baseline.activities.filter(a=>a.required&&!spec.activities.some(b=>b.id===a.id&&b.required));add('preserved-activities',missing.length?'FAIL':'PASS',missing.length?missing.map(a=>a.id).join(', '):'Identifiants et accès aux activités obligatoires conservés. Le relecteur vérifie leur sens.');}
 let rendered=true;for(let i=0;i<spec.blocks.length;i++){const html=renderLessonBlock(spec,i,{preview:true});if(!html.trim())rendered=false;}
 add('render-components',rendered?'PASS':'FAIL','Rendu serveur des composants ; ne remplace pas une inspection navigateur.');
 let browserStatus=browserEvidence?.status||'NOT RUN';if(browserStatus==='PASS'){let proof;try{proof=JSON.parse(browserEvidence.evidence);}catch{/* Unit tests explicitly use fixture evidence. */}if(proof?.hash&&proof.hash!==candidateHash(spec,sources))browserStatus='FAIL';}
 add('browser-render',browserStatus,browserEvidence?.evidence||'Inspection du rendu et des interactions non exécutée pour ce hash.');
 add('sources',sources.length&&sources.every(s=>s.segments.length)?'PASS':'FAIL','Segments versionnés disponibles au relecteur.');return checks;
}
export function decideQuality({spec,sources,brief,report,checks,policy={minimum:90,dimensionMinimum:3}}){
 validate(reviewSchema,report);const hash=candidateHash(spec,sources);
 requireValue(report.contentHash===hash&&report.briefHash===digest(brief)&&report.charterVersion===CHARTER_VERSION,'Revue obsolète : hash du candidat ou du brief différent.');
 const knownLocations=new Set([...spec.blocks.map(b=>`blocks/${b.id}`),...spec.activities.map(a=>`activities/${a.id}`),'session','diagnostic','sources','plan']);
 for(const issue of report.issues)requireValue([...knownLocations].some(l=>issue.location===l||issue.location.startsWith(l+'/')),'Anomalie sans emplacement valide.');
 requireValue(new Set(report.issues.map(i=>i.id)).size===report.issues.length,'Identifiants d’anomalie dupliqués.');
 for(const d of Object.values(report.dimensions))requireValue(d.evidence.length>0,'Dimension sans preuve localisée.');
 for(const check of report.externalChecks)if(check.status==='PASS')requireValue(checks.some(c=>c.id===check.id&&c.status==='PASS'),'Le relecteur a inventé une vérification réussie.');
 const score=Object.entries(DIMENSIONS).reduce((n,[key,weight])=>n+report.dimensions[key].score*weight/4,0);
 const required=['schema','diagnostic-first','complete','preserved-activities','render-components','browser-render','sources',...spec.skills.map(s=>`depth:${s}`)];
 for(const a of [...spec.activities,...spec.diagnostic.tasks]){if(a.workshop?.profile!=='dom'&&['javascript','html','css','sql'].includes(a.correctionMode))required.push(`reference:${a.id}`);if(a.type==='Terminal'||['shell-git','dom'].includes(a.workshop?.profile))required.push(`lab:${a.id}`);}
 const missing=required.filter(id=>!checks.some(c=>c.id===id&&c.blocking===true&&c.status==='PASS'));
 const blockers=[...new Set([...missing,...report.issues.filter(i=>['critical','major'].includes(i.severity)).map(i=>i.id),...checks.filter(c=>c.blocking&&c.status!=='PASS').map(c=>c.id)])];
 const accepted=report.decision==='accept'&&score>=policy.minimum&&Object.values(report.dimensions).every(d=>d.score>=policy.dimensionMinimum)&&!blockers.length&&!report.coverageGaps.length&&!report.regressions.length;
 return {state:accepted?'ready':'draft',score,blockers,contentHash:hash,briefHash:digest(brief),charterVersion:CHARTER_VERSION,policy,report,checks,checkedAt:new Date().toISOString()};
}
export async function publicationGate(store,lesson,spec){
 if(!lesson.qualityRequired)return [];
 const job=await store.get('generation_jobs',lesson.qualityJobId),validation=lesson.pedagogicalValidation;
 return [{id:'independent_review',ok:!!(job?.status==='completed'&&!job.simulation&&!job.sourceChanged&&validation?.state==='ready'&&validation.contentHash===candidateHash(spec,job.sources)),message:'Revue indépendante acceptée sur le contenu, les sources et le runtime exacts ; aucune simulation.'}];
}
