import {fail} from '../store.mjs';
import {digest} from './contracts.mjs';

// Exact workbook identities and dates; never a fuzzy title or corpus-id match.
export async function preparationContext(store,actor,entry,plan){
 const curriculum=await store.get('curriculum_versions',plan.curriculumVersion);
 const sequenceIds=[...new Set(String(entry.sequence||'').match(/S\d{2}\b/g)||[])];
 const linkedSheets=(entry.workbookSource?.cells||[]).map(c=>c.hyperlink||c.value?.formula?.match(/^HYPERLINK\(\s*"([^"]+)"/i)?.[1]).filter(Boolean).flatMap(link=>{
  const match=String(link).match(/^#?'?([^'!]+)'?!/);return match?[match[1]]:[];
 });
 const sequences=(curriculum?.sequences||[]).filter(s=>linkedSheets.length?linkedSheets.includes(s.source?.name):sequenceIds.includes(s.id));
 const evidence=(await store.list('lesson_runs',actor.classId)).filter(r=>['completed','partially_completed'].includes(r.status)&&r.closedAt&&r.date<entry.date).map(r=>({id:r.id,date:r.date,status:r.status,coveredSkills:r.coveredSkills||[],lessonVersionId:r.lessonVersionId}));
 const result={version:1,classId:actor.classId,date:entry.date,entryId:entry.id,planVersion:plan.version,workbookHash:curriculum?.sha256||null,planningSource:entry.workbookSource||{row:entry.sourceRow||null,limitation:'Ancien import sans adresses et liens détaillés ; réimport requis pour les reconstruire.'},
  curriculum:(curriculum?.criteria||[]).filter(c=>entry.skills.includes(c.n3_code)),sequences:sequences.map(s=>({id:s.id,title:s.title,objectives:s.objectives,prerequisites:s.prerequisites,tools:s.tools,source:s.source})),
  completedLearning:evidence,diagnosticResults:null,uncertainties:[]};
 if(sequenceIds.length&&!sequences.length)result.uncertainties.push('Fiche de séquence non retrouvée dans la version active ; aucun rapprochement par titre approchant.');
 result.sessions=sequences.flatMap(s=>(s.source?.rows||[]).flatMap((row,index)=>row.some(v=>v===entry.date||v?.date===entry.date||v?.value===entry.date)?[{id:digest([s.id,s.source.name,index+1,entry.date]),sequenceId:s.id,sheet:s.source.name,row:index+1,cells:row}]:[]));
 if(result.sessions.length>1)result.uncertainties.push('Plusieurs lignes de fiche à la même date : conserver toutes les activités et demander le choix du créneau si leurs acquis divergent.');
 if(sequences.length&&!result.sessions.length)result.uncertainties.push('La fiche ne comporte pas de ligne à cette date exacte ; la séance reste celle du créneau explicitement choisi.');
 return {...result,hash:digest(result)};
}
