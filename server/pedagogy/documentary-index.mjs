import {performance} from 'node:perf_hooks';
import {uid,now,fail,requireValue,scoped} from '../store.mjs';
import {canonical,sha256} from '../content-snapshots.mjs';
import {validate} from '../contracts.mjs';
import {documentContextSchema} from '../storage-contracts.mjs';

export const TAXONOMY_VERSION='eden-documentary-1';
export const INDEX_VERSION='lexical-context-1';
const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stop=new Set('les des une dans pour avec sur par aux est qui que du de la le un et en au a'.split(' '));
const words=s=>[...new Set((fold(s).match(/[\w.-]+/g)||[]).filter(t=>t.length>1&&!stop.has(t)))];
const concepts=[
 {id:'css.box',family:'Design',terms:['box-sizing','border-box','content-box','modele de boite','dimensions','largeur','padding']},
 {id:'css.flex',family:'Design',terms:['flexbox','display: flex','axe principal','alignement','align-items']},
 {id:'js.condition',family:'Programmation',terms:['condition','conditions','booleen','boolean','decision','&&','||']},
 {id:'system.path',family:'Savoir',terms:['chemin','repertoire','dossier','pwd','mkdir','arborescence']},
 {id:'git.index',family:'Savoir',terms:['git','commit','index','staging','versionner']}
];
export function canReadSource(source,actor){
 return !!source&&actor.role==='teacher'&&source.classId===actor.classId&&!source.access?.revoked&&(!source.access?.teacherIds||source.access.teacherIds.includes(actor.id));
}
export async function authorizedSource(store,id,actor){const s=await scoped(store,'pedagogical_sources',id,actor);if(!canReadSource(s,actor))fail(404,'Source non accessible.');return s;}
export function suggestClassification(source){
 const text=fold(source.segments.map(p=>p.text).join('\n')),matches=concepts.filter(c=>c.terms.some(t=>text.includes(t)));
 return {taxonomyVersion:TAXONOMY_VERSION,families:[...new Set(matches.map(c=>c.family))],topics:matches.map(c=>c.id),role:source.role,relations:matches.map(c=>({concept:c.id,relation:'mentions',reason:`Terme repéré : ${c.terms.find(t=>text.includes(t))}. Explication et prérequis à vérifier.`})),skills:[],language:null,level:null,prerequisites:[],tools:[],technicalVersions:[],format:source.filename.split('.').at(-1),acquisition:source.git?'git':source.sourceURL?'url':'teacher-import',nature:'undetermined',editorialState:'to_review',origin:'rules',processorVersion:INDEX_VERSION,validated:false};
}
export async function classifySource(store,actor,id,input){return store.transaction(async tx=>{
 const s=await authorizedSource(tx,id,actor);requireValue(input.expectedVersion===(s.annotationVersion||0),'Classement modifié : rechargez la source.');
 const allowed=['families','topics','role','language','level','prerequisites','tools','technicalVersions','nature','editorialState'];
 requireValue(input.values&&Object.keys(input.values).every(k=>allowed.includes(k)),'Dimension de classement invalide.');
 const value={...(s.classification||suggestClassification(s)),...input.values};
 requireValue(Array.isArray(value.families)&&value.families.every(f=>['Design','Programmation','Savoir'].includes(f)),'Famille invalide.');
 for(const key of ['topics','prerequisites','tools','technicalVersions'])requireValue(Array.isArray(value[key])&&value[key].length<=40&&value[key].every(x=>typeof x==='string'&&x.length<=200),'Catégories invalides.');
 for(const key of ['language','level'])requireValue(value[key]===null||typeof value[key]==='string'&&value[key].length<=200,'Contexte de classement invalide.');
 requireValue(['curriculum','progression','technical','reference','exercise','solution','tone','visual'].includes(value.role),'Rôle invalide.');
 requireValue(['undetermined','original','derived','generated','student-work'].includes(value.nature)&&['to_review','validated','superseded','archived'].includes(value.editorialState),'État ou origine invalide.');
 requireValue(JSON.stringify(value).length<12000,'Classement trop volumineux.');
 s.annotationVersion=(s.annotationVersion||0)+1;s.classification={...value,origin:'teacher',validated:true};
 await tx.insert('source_annotations',{id:uid('annotation'),classId:s.classId,sourceId:id,documentId:s.documentId||s.sourceKey,sourceHash:s.contentHash,version:s.annotationVersion,by:actor.id,value:s.classification});
 await tx.put('pedagogical_sources',s);return s;
});}
// Builds are immutable and activated only if their complete source fingerprint
// still matches. Processing is local and deterministic; rerunning reuses the build.
export async function buildDocumentIndex(store,actor,id){
 const source=await authorizedSource(store,id,actor),fingerprint=sha256(canonical({source:source.contentHash,extraction:source.extractionId||source.id,segments:source.segments,version:INDEX_VERSION}));
 const buildId=`index_${sha256(id+fingerprint)}`;
 const segments=source.segments.map((p,order)=>({...p,sourceId:id,documentId:source.documentId||source.sourceKey,sourceVersion:source.version,sourceHash:source.contentHash,extractionId:source.extractionId||`${id}:extraction:legacy`,chunkingVersion:INDEX_VERSION,sha256:sha256(p.text),order,blockTypes:[...new Set((p.blocks||[]).map(b=>b.type))],previousId:source.segments[order-1]?.id||null,nextId:source.segments[order+1]?.id||null,visibility:'teacher',warnings:source.warnings||[]}));
 requireValue(segments.length>0&&new Set(segments.map(p=>p.id)).size===segments.length&&segments.every(p=>p.text&&p.location),'Passages incomplets : index non activé.');
 return store.transaction(async tx=>{
  const current=await authorizedSource(tx,id,actor);requireValue(current.contentHash===source.contentHash&&canonical(current.segments)===canonical(source.segments),'Source modifiée pendant l’indexation.');
  let build=await tx.get('document_indexes',buildId);
  if(!build)build=await tx.insert('document_indexes',{id:buildId,classId:source.classId,sourceId:id,fingerprint,status:'complete',version:1,strategyVersion:INDEX_VERSION,taxonomyVersion:TAXONOMY_VERSION,segments,manifest:{sourceId:id,sourceHash:source.contentHash,expectedSegments:segments.map(p=>({id:p.id,sha256:p.sha256})),warnings:source.warnings||[],exclusions:[]}});
  current.activeIndexId=build.id;current.classification??=suggestClassification(current);await tx.put('pedagogical_sources',current);return build;
 });
}
export async function searchDocuments(store,actor,{query='',sourceIds,limit=8,role,technicalVersion,expand=true}={}){
 requireValue(typeof query==='string'&&query.length<=1000,'Recherche limitée à 1 000 caractères.');
 const started=performance.now(),terms=words(query),expanded=new Set(terms);
 for(const c of concepts)if(c.terms.some(t=>fold(query).includes(t)))for(const t of c.terms)words(t).forEach(x=>expanded.add(x));
 let sources=(await store.list('pedagogical_sources',actor.classId)).filter(s=>canReadSource(s,actor)&&(!sourceIds||sourceIds.includes(s.id)));
 if(!sourceIds){const latest=new Map();for(const s of sources){const key=s.documentId||s.sourceKey;if(!latest.has(key)||latest.get(key).version<s.version)latest.set(key,s);}sources=[...latest.values()];}
 const ranked=[],exclusions=[];
 for(const source of sources){
  if(source.status!=='extracted'){exclusions.push({sourceId:source.id,reason:'extraction_to_review'});continue;}
  if(role&&(source.classification?.role||source.role)!==role||technicalVersion&&source.declaredVersion!==technicalVersion&&!source.classification?.technicalVersions?.includes(technicalVersion))continue;
  const index=source.activeIndexId&&await store.get('document_indexes',source.activeIndexId);
  const build=index?.status==='complete'&&index.manifest.sourceHash===source.contentHash?index:await buildDocumentIndex(store,actor,source.id);
  for(const segment of build.segments){
   const body=fold(segment.text),title=fold(source.title+' '+segment.parent),literal=query.trim()&&body.includes(fold(query.trim()));
   const score=(literal?15:0)+[...expanded].reduce((n,t)=>n+(title.includes(t)?4:0)+(body.includes(t)?terms.includes(t)?2:0.5:0),0);
   if(score||!query.trim())ranked.push({sourceId:source.id,sourceVersion:source.version,title:source.title,sourceHash:source.contentHash,buildId:build.id,classification:source.classification||suggestClassification(source),segment,score,neighbors:expand?build.segments.filter(p=>p.id===segment.previousId||p.id===segment.nextId):[]});
  }
 }
 const results=ranked.sort((a,b)=>b.score-a.score||a.segment.id.localeCompare(b.segment.id)).slice(0,Math.max(1,Math.min(30,Number(limit)||8)));
 // No cache: permissions and parent expansion are checked on every retrieval.
 for(const r of results)await authorizedSource(store,r.sourceId,actor);
 return {strategy:INDEX_VERSION,taxonomyVersion:TAXONOMY_VERSION,query,results,exclusions,latencyMs:Math.round((performance.now()-started)*100)/100,externalCalls:0,gap:results.length?null:'Aucun passage pertinent dans le périmètre autorisé.'};
}
export async function freezeDocumentContext(store,actor,sources,{queries=[],maxCharacters=120000}={}){
 const managed=sources.filter(s=>s.documentId||s.sourceKey),ids=managed.map(s=>s.id),searches=[],selected=new Map(),sourceScope=[];
 for(const s of managed){const current=await authorizedSource(store,s.id,actor);requireValue(current.contentHash===s.contentHash,'Version de source modifiée.');const build=await buildDocumentIndex(store,actor,s.id);sourceScope.push({sourceId:s.id,sourceHash:s.contentHash,version:s.version,buildId:build.id,annotationVersion:s.annotationVersion||0});}
 for(const s of sources.filter(s=>!managed.includes(s)))sourceScope.push({sourceId:s.id,sourceHash:s.contentHash,version:s.version||1,buildId:s.id,annotationVersion:0,kind:'existing-library-index'});
 let total=0;
 const add=(s,p)=>{if(selected.has(p.id)||total+p.text.length>maxCharacters)return;selected.set(p.id,{sourceId:s.id,segment:p});total+=p.text.length;};
 // Read short central documents completely. Keep sections/code/tables intact.
 for(const s of sources)if(s.segments.reduce((n,p)=>n+p.text.length,0)<=16000)for(const p of s.segments)add(s,p);
 for(const query of [...new Set(queries)].filter(Boolean)){
  const found=await searchDocuments(store,actor,{query:query.slice(0,1000),sourceIds:ids,limit:8});
  searches.push({query:found.query,strategy:found.strategy,results:found.results.map(r=>r.segment.id),gap:found.gap});
  for(const r of found.results){const s=sources.find(s=>s.id===r.sourceId);add(s,r.segment);for(const p of r.neighbors)add(s,p);}
 }
 const selectedSources=sources.map(s=>({...s,segments:s.segments.filter(p=>selected.has(p.id))})).filter(s=>s.segments.length);
 const omitted=sources.flatMap(s=>s.segments.filter(p=>!selected.has(p.id)).map(p=>({sourceId:s.id,segmentId:p.id,reason:'context_budget_or_selection'})));
 requireValue(selectedSources.length||!sources.length,'Aucun passage ne tient dans le budget documentaire ; sélectionner une source plus ciblée.');
 const content={version:1,taxonomyVersion:TAXONOMY_VERSION,strategy:INDEX_VERSION,scope:sourceScope,searches,passages:selectedSources.flatMap(s=>s.segments.map(p=>({sourceId:s.id,sourceHash:s.contentHash,segmentId:p.id,location:p.location,sha256:sha256(p.text),text:p.text}))),omitted,maxCharacters,characters:total};
 validate(documentContextSchema,content);
 const hash=sha256(canonical(content)),id=`context_${hash}`;
 await store.transaction(async tx=>{for(const s of managed)await authorizedSource(tx,s.id,actor);if(!await tx.get('document_contexts',id))await tx.insert('document_contexts',{id,classId:actor.classId,...content,sha256:hash});});
 return {sources:selectedSources,manifest:{id,sha256:hash,...content,passages:content.passages.map(({text,...p})=>p)}};
}
export async function verifyContextAccess(store,job){
 for(const id of job.sourceIds||[])await authorizedSource(store,id,job.actor);
 if(job.documentContext){const saved=await store.get('document_contexts',job.documentContext.id);requireValue(saved?.sha256===job.documentContext.sha256,'Contexte documentaire absent ou corrompu.');}
}
