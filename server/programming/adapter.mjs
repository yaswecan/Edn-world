import {canonical,sha256} from '../content-snapshots.mjs';
import {fail} from '../store.mjs';
import {CAPABILITIES,ENGINE,ENGINE_VERSION} from './contract.mjs';
import {tableauxPresentation} from './source-presentation.mjs';
import {readSourceComparison} from './source-comparison.mjs';
export function adaptEdenPackage(entries){
 const bad=(file,pointer,received,expected)=>fail(422,`${file}${pointer} : ${expected}`,{file,pointer,received,expected,action:'Corriger le paquet source et ses empreintes, ou exporter au format canonique programming-1.'});
 const read=path=>{try{return JSON.parse(entries.get(path).toString('utf8'));}catch{bad(path,'/',null,'Fichier JSON valide requis.');}};
 const mp='00_MANIFEST/manifest.json',manifest=read(mp);
 if(manifest.schemaVersion!==2)bad(mp,'/schemaVersion',manifest.schemaVersion,'Version de manifeste 2 attendue.');
 if(!Array.isArray(manifest.files))bad(mp,'/files',null,'Inventaire requis.');
 const seen=new Set([mp]),files=new Map();
 for(const [index,f] of manifest.files.entries()){
  const b=entries.get(f.path);
  if(seen.has(f.path)||!b||b.length!==f.bytes||sha256(b)!==f.sha256)bad(mp,`/files/${index}`,f.path,'Fichier unique, taille et SHA-256 conformes à l’inventaire.');
  if(!['student','teacher'].includes(f.audience))bad(mp,`/files/${index}/audience`,f.audience,'Audience student ou teacher.');
  seen.add(f.path);files.set(f.sha256,b);
 }
 if(entries.size!==seen.size||[...entries.keys()].some(p=>!seen.has(p)))bad(mp,'/files',entries.size,'Tous les fichiers doivent être déclarés.');
 const lp='07_SOURCES_EDEN/lesson.json',ap='07_SOURCES_EDEN/course-author.json',dp='02_DIAGNOSTIC/diagnostic-spec.json';
 const spec=read(lp),author=read(ap),activities=read('07_SOURCES_EDEN/activity-specs.json'),diagnostic=read(dp);
 // This source file is a JSON assignment, never executable input. The student
 // projection deliberately removes solutions and autonomy demonstration code.
 const studentPath='01_ELEVE/assets/course-data.js';
 let studentAuthor;
 try{
  const assignment=entries.get(studentPath)?.toString('utf8').match(/^\s*window\.ARRAY_COURSE\s*=\s*([\s\S]+);\s*$/);
  if(!assignment)throw Error();
  studentAuthor=JSON.parse(assignment[1]);
 }catch{bad(studentPath,'/',null,'Affectation de données JSON reconnue requise ; aucun script n’est exécuté.');}
 if(!Array.isArray(author.activities))bad(ap,'/activities',null,'Liste des ateliers requise.');
 const expectedStudent={...author,activities:author.activities.map(({reference,...a})=>({...a,demo:a.block===4?'':a.demo}))};
 if(canonical(studentAuthor)!==canonical(expectedStudent))bad(studentPath,'/',null,'Données élèves conformes aux données auteur, sans corrigés ni exemples des ateliers autonomes.');
 if(spec.schemaVersion!=='1.0')bad(lp,'/schemaVersion',spec.schemaVersion,'Version de cours source 1.0 attendue.');
 if(manifest.lessonId!==spec.lessonId||manifest.lessonVersion!==spec.lessonVersion)bad(lp,'/lessonId',spec.lessonId,'Identité et version conformes au manifeste.');
 if(author.title!==spec.title)bad(ap,'/title',author.title,'Titre conforme au cours.');
 for(const a of spec.activities){const matches=activities.filter(x=>x.id===a.id);if(matches.length!==1||canonical(matches[0])!==canonical(a))bad('07_SOURCES_EDEN/activity-specs.json','/'+a.id,a.id,'Activité identique à lesson.json.');}
 if(activities.length!==spec.activities.length)bad(lp,'/activities',spec.activities.length,'Inventaires d’activités identiques.');
 const find=id=>{const a=spec.activities.find(a=>a.id===id);if(!a)bad(ap,'/activities',id,'Identifiant existant dans lesson.json.');return a;};
 for(const key of ['activities','quizzes'])if(!Array.isArray(author[key])||new Set(author[key].map(x=>x.id)).size!==author[key].length)bad(ap,'/'+key,null,'Identifiants auteur uniques.');
 if(author.activities.length!==spec.activities.filter(a=>a.type==='CodeEditor').length)bad(ap,'/activities',author.activities.length,'Tous les ateliers doivent être décrits une fois.');
 for(const x of author.activities){
  const a=find(x.id);
  for(const k of ['starter','reference','title'])if(a[k]!==x[k])bad(ap,`/activities/${x.id}/${k}`,x[k],'Valeur identique à lesson.json.');
  if(canonical(a.tests.map(t=>({invoke:t.invoke,args:JSON.parse(t.argsJSON),expected:JSON.parse(t.expectedJSON)})))!==canonical(x.tests.map(t=>({invoke:x.invoke,args:t.args,expected:t.expected}))))bad(ap,`/activities/${x.id}/tests`,null,'Tests conformes à lesson.json.');
  if(a.objective!==x.goal||canonical(a.workshop.hints)!==canonical(x.hints)||canonical(a.workshop.checks)!==canonical(x.checks)||a.workshop.prediction!==x.prediction.question)bad(ap,`/activities/${x.id}`,x.id,'Objectif, indices, critères et prédiction conformes au cours.');
  if(a.required===x.transfer)bad(ap,`/activities/${x.id}/transfer`,x.transfer,'Intention facultative cohérente.');
  if(!x.transfer&&!spec.blocks.find(b=>b.id===`s${x.session}-bloc-${x.block}`)?.activityIds.includes(x.id))bad(ap,`/activities/${x.id}/block`,x.block,'Rattachement au déroulé cohérent.');
  a.interactive={kind:'code',explanation:x.explanation,demo:studentAuthor.activities.find(item=>item.id===x.id).demo,invoke:x.invoke,args:x.args,diagramType:x.diagramType,prediction:x.prediction,testLabels:x.tests.map(t=>t.label),reflection:'Ma trace : j’attendais… / j’ai observé… / j’ai corrigé…'};
  a.publicTests=structuredClone(a.tests);
 }
 for(const a of spec.activities.filter(a=>a.type==='FillBlank')){
  const sourceId=a.id.replace(/-rappel-s\d+$/,''),q=author.quizzes.find(q=>q.id===sourceId);
  if(q){if(!a.instruction.includes(q.question)||q.options.some(o=>!a.instruction.includes(o.text)||!a.reference.includes(o.feedback)))bad(ap,`/quizzes/${sourceId}`,sourceId,'Question, choix et feedbacks conformes au cours.');if(JSON.parse(a.expectedAnswer)['0']!==String.fromCharCode(65+q.correct))bad(ap,`/quizzes/${sourceId}/correct`,q.correct,'Réponse conforme au cours source.');a.type='Quiz';a.options=q.options.map(o=>o.text);a.instruction=q.question;a.expectedAnswer=String(q.correct);a.correctionMode='exact';a.interactive={kind:'quiz',question:{question:q.question,options:q.options,correct:q.correct,...q.code?{code:q.code}:{}},...sourceId!==a.id?{sourceId}:{}};}
  else {const session=Number(a.id.match(/^bilan-s(\d+)$/)?.[1]),c=author.cloze.find(c=>c.session===session);if(!c)bad(lp,`/activities/${a.id}`,a.type,'QCM structuré ou bilan à trous identifié requis.');if(canonical(Object.values(JSON.parse(a.expectedAnswer)))!==canonical(c.segments.filter(s=>typeof s!=='string').map(s=>s.answer)))bad(ap,`/cloze/${session}`,null,'Mots attendus conformes au cours source.');a.interactive={kind:'cloze',segments:c.segments,bank:c.bank,explanation:c.explanation};}
 }
 for(const q of author.quizzes)if(!spec.activities.some(a=>a.id===q.id&&a.type==='Quiz'))bad(ap,'/quizzes',q.id,'QCM auteur rattaché au cours.');
 if(author.cloze.length!==spec.activities.filter(a=>a.interactive?.kind==='cloze').length)bad(ap,'/cloze',author.cloze.length,'Chaque bilan auteur doit être conservé.');
 for(const t of diagnostic.tasks)if(canonical(activities.find(a=>a.id===t.id))!==canonical(t))bad(dp,'/tasks/'+t.id,t.id,'Question identique à l’activité, sans copie divergente.');
 spec.diagnostic={id:diagnostic.id,kind:diagnostic.kind,sourceLessonRunId:null,sourceLessonVersion:null,duration:diagnostic.duration,criteria:spec.skills,tasks:[],activityIds:diagnostic.tasks.map(t=>t.id),rubric:[],purpose:diagnostic.purpose};
 spec.planEntryId??='';spec.planVersion??=0;spec.sourceVersions.curriculumVersion??='';spec.sourceVersions.planVersion??=0;
 const comparisons=spec.programming&&Object.hasOwn(spec.programming,'comparisons')?spec.programming.comparisons:[readSourceComparison(entries.get('01_ELEVE/assets/lesson.js'),bad)];
 if(!Array.isArray(comparisons))bad(lp,'/programming/comparisons',comparisons,'Liste de comparatifs déclaratifs requise.');
 const sessions=[...new Set(spec.blocks.map(b=>b.id.match(/^s(\d+)-bloc-/)?.[1]))].map(n=>{if(!n)bad(lp,'/blocks',null,'Identifiant de séance du paquet EDEN attendu.');const blocks=spec.blocks.filter(b=>b.id.startsWith(`s${n}-bloc-`));return {id:`s${n}`,title:`Séance ${n}`,blockIds:blocks.map(b=>b.id),minutes:blocks.reduce((sum,b)=>sum+b.minutes,0)};});
 if(sessions.reduce((s,x)=>s+x.minutes,0)!==manifest.duration)bad(mp,'/duration',manifest.duration,'Durée égale au déroulé obligatoire.');
 spec.programming={format:'programming-1',family:'Programmation',contentVersion:String(manifest.lessonVersion),workVersion:1,language:'javascript',engine:{id:ENGINE,version:ENGINE_VERSION},requiredCapabilities:CAPABILITIES,sessions,optionalActivityIds:spec.activities.filter(a=>!a.required).map(a=>a.id),comparisons,provenance:{adapter:'eden-tableaux-1',sourceVersion:String(manifest.lessonVersion),conversions:['Manifeste 2 distinct du cours 1.0 ; métadonnées nulles normalisées.','Diagnostic formatif par références, sans duplication ni note certifiée.','12 QCM et 2 rappels restaurés ; 2 bilans à trous structurés.','Comparatif relu et converti en données ; aucun script importé exécuté.','Sources originales conservées côté professeur ; seuls PDF, consignes et départs autorisés aux élèves.']}};
 spec.sessionType='programming';
 spec.programming.presentation=tableauxPresentation();
 spec.programming.presentation.comparisons=spec.programming.presentation.comparisons.filter(copy=>comparisons.some(c=>c?.id===copy.id&&Array.isArray(c.programs)&&copy.rules.every(rule=>c.programs.some(p=>p?.id===rule.id))));
 spec.programming.provenance.conversions.push('Présentation originale relue et conservée en données : ouvertures, mémo, bilan, comparatif et consignes de réflexion.');
 const corpusFiles=manifest.files.map(f=>({...f,audience:/^01_ELEVE\/(memo-visuel\.pdf|fichiers-depart\/[^/]+\.(js|txt))$/.test(f.path)?'student':'teacher'}));
 spec.resources=corpusFiles.filter(f=>f.audience==='student').map(f=>`tweenteach-file:${f.sha256}:${f.mimeType}`);
 // Raw sources remain protected teacher resources for audit; never enter the student projection.
 const payload={sessionIdentity:{format:1,pedagogicalTitle:spec.title,missionTitle:null,titleSource:'imported',needsReview:true,associations:[]},spec,context:{entry:{duration:manifest.duration,durationConfirmed:false,objective:spec.objectives.join('\n'),activity:'Programmation'},criteria:[],diagnosticSource:null},assets:[],documents:[],mission:null,corpus:{complete:true,files:corpusFiles},preparation:{requiresReview:true,incomplete:false,state:'teacher_draft'},designContract:null,external:[]};
 const portableId=sha256('eden:'+manifest.lessonId).slice(0,32);
 return {manifest:{format:'tweenteach',version:1,packageId:portableId,adapter:'eden-tableaux-1'},lessons:[{portableId,title:spec.title,date:spec.date,sequence:spec.sequence,payload}],files};
}
