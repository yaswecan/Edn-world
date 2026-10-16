import {fail,requireValue,scoped,now} from './store.mjs';

// Identity belongs to the lesson, not to a historical content/assessment version.
// `title` remains a compatibility alias, never a fallback to a mission name.
export const identityKeys=['pedagogicalTitle','missionTitle','titleSource','titleValidatedBy','titleValidatedAt','identityRevision','competencyRefs','identityNeedsReview'];
export const identityFields=l=>Object.fromEntries(identityKeys.filter(k=>l?.[k]!==undefined).map(k=>[k,structuredClone(l[k])]));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const gamified=s=>/^(mission|vise|repare|debloque|construis|retrouver la trace|quatre cartes|le selecteur mystere|a toi)\b/.test(norm(s));
export function titleQuality(title){
 const t=clean(title),parts=t.split(/\s*:\s*/);
 return t.length>=10&&t.length<=160&&parts.length===2&&parts[0].length<=45&&parts[1].length>=5&&!gamified(t)&&!/atteindre la bonne cible|vise la bonne carte|a toi de jouer/.test(norm(t))&&!/^(decouvrir|apprendre|initiation|introduction|les bases|fondamentaux)(\b|$)/.test(norm(parts[1]))&&!/BCT?\d+-C\d+|qualityjob_|R-\d{6}|g[eé]n[eé]ration IA/i.test(t);
}
// This vocabulary extracts notions only when they occur in the pedagogical
// evidence. It does not map mission names to titles or invent competency codes.
const subjects=[
 ['CSS',/\bcss(?:3)?\b|flexbox|justify-content|box-sizing/i,[['liaison',/liaison|lier.{0,35}css|relier.{0,35}css|feuille.{0,20}style|stylesheet/i],['sélecteurs de type, de classe et d’identifiant',/s[eé]lecteur.{0,100}(classe|identifiant)|s[eé]lecteur.{0,40}type/i],['sélecteurs',/s[eé]lecteur/i],['combinaisons et descendance',/s[eé]lecteurs? combin|combinaison|descendance|descendants/i],['pseudo-classes de position',/first-child|last-child|nth-child/i],['spécificité',/sp[eé]cificit[eé]/i],['héritage',/h[eé]ritage/i],['cascade',/cascade/i],['modèle de boîte',/mod[eè]le de bo[iî]te|box.model|box-sizing|margin.{0,50}padding/i],['Flexbox',/flexbox|display\s*:\s*flex/i],['axes et alignement',/justify-content|align-items|axes/i],['espacement',/\bgap\b/i],['Grid',/\bgrid\b/i],['mise en page responsive',/responsive|media quer/i]]],
 ['JavaScript',/javascript|\bJS\b|\bDOM\b/i,[['conditions',/condition|\bif\b/i],['opérateurs logiques',/op[eé]rateurs? logiques?/i],['boucles for et while',/\bfor\b[\s\S]*\bwhile\b|\bwhile\b[\s\S]*\bfor\b/i],['boucles',/boucle/i],['fonctions',/fonction/i],['tableaux',/tableaux|array/i],['événements et DOM',/\bDOM\b|[eé]v[eé]nement/i],['variables',/variable/i]]],
 ['Linux',/linux|terminal|shell|\bpwd\b/i,[['terminal et shell',/terminal.{0,30}shell/i],['navigation et chemins',/\bpwd\b|\bcd\b|chemins? absolu|navig/i],['manipulation des fichiers',/\bmkdir\b|\btouch\b|\bcp\b|fichiers/i]]],
 ['Git',/\bgit\b/i,[['versionnement',/version|commit/i],['branches et fusion',/branche|merge/i],['dépôts distants',/remote|d[eé]p[oô]t.{0,20}distant|push|pull/i]]],
 ['HTML',/\bhtml(?:5)?\b/i,[['structure et balises',/structure|balise/i],['liens et images',/liens|images/i],['formulaires',/formulaire/i],['sémantique',/s[eé]mantique/i]]],
 ['SQL',/\bsql\b|SELECT.+FROM/i,[['requêtes et sélection',/requ[eê]te|SELECT/i],['jointures',/jointure|JOIN/i],['agrégation',/GROUP BY|agr[eé]gation/i]]],
 ['Gestion de projet',/gestion de projet|chef de projet|product owner|cycle de vie.{0,30}produit|[eé]quipe projet/i,[['besoin et conception',/besoin|conception/i],['cycle de vie du produit',/cycle de vie/i],['rôles de l’équipe',/r[oô]le|[eé]quipe projet/i],['cycle de développement',/d[eé]veloppement|recette|production/i]]]
];
export function proposeTitle({lesson={},spec={},entry={},journal=[],sequence={}}={}){
 if(lesson.pedagogicalTitle)return {title:lesson.pedagogicalTitle,source:lesson.titleSource||'generated',needsReview:!!lesson.identityNeedsReview};
 const precise=candidate=>titleQuality(candidate)&&(subjects.some(([name])=>norm(candidate.split(':')[0])===norm(name))||norm(candidate.split(':')[0])===norm(entry.module));
 const direct=[entry.pedagogicalTitle,entry.title,...journal.map(j=>j.pedagogicalTitle),String(entry.objective||'').split('\n')[0]];
 for(const candidate of direct)if(candidate&&precise(candidate))return {title:clean(candidate),source:'imported',needsReview:false};
 const objective=[...(spec.objectives||[]),entry.objective].filter(Boolean).join(' ');
 const content=(spec.blocks||[]).filter(b=>!['Diagnostic','CodeStationLauncher','Pause'].includes(b.type)).map(b=>[b.content,b.teaching?.takeaways?.join(' ')].join(' ')).join(' ');
 const evidence=clean([objective,content,...(spec.activities||[]).map(a=>a.objective)].join(' '));
 const context=clean([entry.activity,...journal.flatMap(j=>[j.morning,j.afternoon,j.comment]),sequence.sessionText,sequence.objectives,sequence.title,sequence.tools].join(' '));
 // Prefer the lesson's actual notions; a broad sequence is last-resort evidence.
 for(const text of [evidence,evidence+' '+context]){
  let candidates=subjects.filter(([,pattern])=>pattern.test(objective));
  if(!candidates.length)candidates=subjects.filter(([,pattern])=>pattern.test(entry.module||''));
  if(!candidates.length)candidates=subjects.filter(([,pattern])=>pattern.test(text));
  const parts=[];
  for(const [subject,,notions] of candidates){
   let labels=notions.filter(([,pattern])=>pattern.test(objective)).map(([label])=>label);
   if(!labels.length&&candidates.length>1)continue;
   if(!labels.length)labels=notions.filter(([,pattern])=>pattern.test(text)).map(([label])=>label);
   if(labels.includes('boucles')&&notions.find(([l])=>l==='boucles for et while')?.[1].test(text))labels=labels.map(l=>l==='boucles'?'boucles for et while':l);
   if(labels.some(l=>l.startsWith('sélecteurs de')))labels=labels.filter(l=>l!=='sélecteurs');
   if(labels.includes('boucles for et while'))labels=labels.filter(l=>l!=='boucles');
   if(labels.length)parts.push({subject,labels:labels.slice(0,5)});
  }
  if(parts.length){const selected=parts.slice(0,2),compose=()=>selected.map(p=>p.subject).join(' / ')+' : '+selected.map(p=>p.labels.join(', ')).join(' ; ');let title=compose();while(title.length>160&&selected.some(p=>p.labels.length>1)){selected.reduce((a,b)=>a.labels.length>=b.labels.length?a:b).labels.pop();title=compose();}if(titleQuality(title))return {title,source:'generated',needsReview:false};}
 }
 // An existing precise content title is admissible only after source evidence.
 if(spec.title&&precise(spec.title)&&!gamified(spec.title))return {title:clean(spec.title),source:'generated',needsReview:false};
 const discipline=clean(entry.module),notions=clean((spec.objectives||[])[0]||entry.objective).replace(/^(comprendre|utiliser|maîtriser|identifier|savoir|mettre en œuvre|expliquer)\s+/i,'').replace(/[.!]$/,'');
 const generic=discipline+' : '+notions;
 if(discipline&&notions.split(' ').length>=3&&titleQuality(generic)&&!gamified(notions))return {title:generic,source:'generated',needsReview:false};
 return {title:'Séance : intitulé pédagogique à valider',source:'generated',needsReview:true};
}

export async function competencyCatalog(tx,classId){
 const result=(await tx.list('competency_n3',classId)).map(c=>({ref:{competencyId:c.id},code:c.n3_code||null,label:c.n3_label,parent:c.n2_code?{code:c.n2_code,label:c.n2_label}:null,criteria:c.observable_criterion?[{label:c.observable_criterion}]:[]}));
 for(const f of await tx.list('framework_versions',classId))for(const n of f.nodes||[])if(['competency','subcompetency'].includes(n.kind)){
  const parent=f.nodes.find(p=>p.id===n.parentId);
  result.push({ref:{frameworkVersionId:f.id,competencyId:n.id},code:n.code,label:n.title,parent:parent?{code:parent.code,label:parent.title}:null,criteria:(n.criteria||[]).map(c=>({code:c.code,label:c.title})),framework:f.title});
 }
 return result;
}
export const refKey=r=>JSON.stringify([r.frameworkVersionId||null,r.competencyId]);
export function resolveCompetencies(refs,catalog){return refs.map(r=>catalog.find(c=>refKey(c.ref)===refKey(r))).filter(Boolean);}
export async function identityContext(tx,lesson,spec){
 const entry=await tx.get('plan_entries',lesson.planEntryId||spec.planEntryId||'')||lesson.transferContext?.entry||{};
 const curriculum=await tx.get('curriculum_versions',spec.sourceVersions?.curriculumVersion||'');
 const imported=curriculum&&!curriculum.journal?(await tx.list('imports',lesson.classId)).find(i=>i.curriculumVersion===curriculum.id&&i.status==='applied'):null;
 const journal=(curriculum?.journal||imported?.parsed?.journal||[]).filter(j=>j.date===(lesson.date||spec.date));
 const sequence=curriculum?.sequences?.find(s=>s.id===spec.sequence)||{};
 const sessionText=(sequence.source?.rows||[]).filter(row=>Array.isArray(row)&&row.some(v=>v===(lesson.date||spec.date))).flat().filter(v=>typeof v==='string').join(' ');
 return {lesson,spec,entry,journal,sequence:{...sequence,sessionText}};
}
export async function legacyManualTitle(tx,lesson,spec){
 if(lesson.pedagogicalTitle)return null;
 let version=lesson.versionId?await tx.get('lesson_versions',lesson.versionId):null;
 const visited=new Set();
 while(version&&!visited.has(version.id)){
  visited.add(version.id);
  const previous=version.previousVersionId?await tx.get('lesson_versions',version.previousVersionId):null;
  if(version.spec?.title===(lesson.title||spec.title)&&/éditeur|modification/i.test(version.reason||'')&&previous&&previous.spec?.title!==version.spec.title)return {pedagogicalTitle:version.spec.title,titleSource:'validated',titleValidatedBy:version.authorId||'legacy-teacher',identityNeedsReview:!titleQuality(version.spec.title)};
  version=previous;
 }
 return null;
}
export async function deriveIdentity(tx,lesson,spec){
 lesson={...lesson,...await legacyManualTitle(tx,lesson,spec)};
 const proposal=proposeTitle(await identityContext(tx,lesson,spec)),catalog=await competencyCatalog(tx,lesson.classId);
 const refs=lesson.competencyRefs??(spec.skills||[]).flatMap(code=>{
  const n3=catalog.find(c=>!c.ref.frameworkVersionId&&c.code===code);
  const matches=catalog.filter(c=>c.code===code);return n3?[n3.ref]:matches.length===1?[matches[0].ref]:[];
 });
 return {...identityFields(lesson),pedagogicalTitle:proposal.title,titleSource:proposal.source,identityNeedsReview:proposal.needsReview,missionTitle:lesson.missionTitle??((lesson.title||spec.title)&&(lesson.title||spec.title)!==proposal.title?(lesson.title||spec.title):spec.missionTitle||null),competencyRefs:refs,identityRevision:lesson.identityRevision||0};
}
export async function sessionIdentity(tx,lesson,spec){
 if(!lesson)return {title:'Séance : contexte pédagogique indisponible',pedagogicalTitle:'Séance : contexte pédagogique indisponible',competencies:[],identityNeedsReview:true};
 spec??=(await tx.get('lesson_versions',lesson.versionId||''))?.spec||{};
 const fields=await deriveIdentity(tx,lesson,spec),catalog=await competencyCatalog(tx,lesson.classId),competencies=resolveCompetencies(fields.competencyRefs,catalog);
 return {...fields,title:fields.pedagogicalTitle,competencies,missingCompetencies:fields.competencyRefs.length-competencies.length};
}
export async function presentLesson(tx,lesson,spec){return {...lesson,...await sessionIdentity(tx,lesson,spec)};}
export async function presentSpec(tx,lesson,spec){return {...spec,...await sessionIdentity(tx,lesson,spec)};}
export async function saveIdentity(tx,lesson,input,actor){
 if(actor.role!=='teacher')fail(403,'Accès professeur requis.');
 if(lesson.classId!==actor.classId)fail(404,'Séance introuvable dans cette classe.');
 if(input.identityRevision!==(lesson.identityRevision||0))fail(409,'L’intitulé ou les compétences ont changé. Rechargez la séance.');
 requireValue(typeof input.pedagogicalTitle==='string'&&clean(input.pedagogicalTitle).length>0&&input.pedagogicalTitle.length<=160,'Titre pédagogique requis (160 caractères maximum).');
 requireValue(Array.isArray(input.competencyRefs)&&input.competencyRefs.length<=100,'Associations de compétences attendues.');
 const catalog=await competencyCatalog(tx,actor.classId);
 requireValue(input.competencyRefs.every(r=>r&&typeof r.competencyId==='string'&&Object.keys(r).every(k=>['competencyId','frameworkVersionId'].includes(k)))&&new Set(input.competencyRefs.map(refKey)).size===input.competencyRefs.length&&resolveCompetencies(input.competencyRefs,catalog).length===input.competencyRefs.length,'Compétence absente du référentiel de cette classe.');
 const before=identityFields(lesson);
 Object.assign(lesson,{pedagogicalTitle:clean(input.pedagogicalTitle),title:clean(input.pedagogicalTitle),competencyRefs:structuredClone(input.competencyRefs),titleSource:'validated',titleValidatedBy:actor.id,titleValidatedAt:now(),identityRevision:(lesson.identityRevision||0)+1,identityNeedsReview:false});
 await tx.put('lessons',lesson);await tx.audit(actor,'lesson.identity_updated',lesson.id,{before,after:identityFields(lesson)});return lesson;
}
export function identityRoutes(app,store,teacher){
 app.get('/api/session-competencies',teacher,async(req,res)=>res.json(await competencyCatalog(store,req.user.classId)));
 app.put('/api/lessons/:id/identity',teacher,async(req,res)=>res.json(await store.transaction(async tx=>{
  await tx.lockTables();const lesson=await scoped(tx,'lessons',req.params.id,req.user);
  Object.assign(lesson,await deriveIdentity(tx,lesson,(await tx.get('lesson_versions',lesson.versionId||''))?.spec||{}));
  await saveIdentity(tx,lesson,req.body,req.user);return presentLesson(tx,lesson);
 })));
}
