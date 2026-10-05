import {fail,requireValue,scoped} from './store.mjs';
import {parisDate,resolveEntry} from './generator.mjs';
import {proposePlanOperations} from './planning.mjs';
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export async function interpretIntent(store,actor,input){
 requireValue(typeof input.intent==='string'&&input.intent.trim()&&input.intent.length<=4000,'Intention attendue (4000 caractères maximum).');
 const text=normalize(input.intent),entries=await store.list('plan_entries',actor.classId),active=entries.filter(e=>!['replaced','cancelled','postponed'].includes(e.status));
 if(input.operations||input.mode==='change_plan')return {kind:'plan_proposal',proposal:await proposePlanOperations(store,actor,input.operations?input:{reason:input.reason||input.intent,operations:[{type:'update',entryId:input.entryId,patch:input.patch}]})};
 const before=text.match(/(?:faire|placer|mettre|deplacer)\s+(.+?)\s+avant\s+(?:le |la |les |l['’])?(.+?)[.!?]?$/);
 if(before){
  const match=term=>{const needle=term.replace(/^(le |la |les |l['’])/,'').trim();return active.filter(e=>e.date>=parisDate()&&normalize([e.objective,e.module,e.sequence,...e.skills].join(' ')).includes(needle)).sort((a,b)=>a.date.localeCompare(b.date));};
  const sources=match(before[1]),targets=match(before[2]);
  if(!sources.length||!targets.length)return {kind:'plan_selector',message:'Choisissez les deux créneaux à réordonner dans le plan.'};
  // Ambiguous concepts are presented for selection instead of silently moving an entire sequence.
  if(sources.length!==1||targets.length!==1)return {kind:'reorder_choice',message:'Plusieurs séances correspondent. Choisissez les deux créneaux à permuter.',sources,targets,reason:input.intent};
  if(sources[0].date<targets[0].date)return {kind:'clarification',message:'Cet ordre est déjà prévu dans le plan.',candidates:[]};
  return {kind:'plan_proposal',proposal:await proposePlanOperations(store,actor,{reason:input.intent,operations:[{type:'swap',entryId:sources[0].id,otherEntryId:targets[0].id}]})};
 }
 if(/(?:pas fait|pas realise|pas eu lieu)/.test(text)){
  const sequence=text.match(/\bs\d{2}\b/)?.[0],runs=(await store.list('lesson_runs',actor.classId)).filter(r=>!r.closedAt),lessons=await store.list('lessons',actor.classId);
  const candidates=lessons.filter(l=>runs.some(r=>r.lessonId===l.id)&&(!sequence||entries.some(e=>e.date===l.date&&normalize(e.sequence).includes(sequence))));
  return {kind:'journal_proposal',message:'Confirmez la séance non réalisée dans le cahier de texte. Aucun contenu ne sera marqué comme travaillé.',status:'not_completed',candidates:candidates.map(l=>({id:l.id,date:l.date,objective:l.title}))};
 }
 if(/plus pratique|garde la seance/.test(text))return {kind:'adaptation_request',message:'Sélectionnez le brouillon à adapter.',candidates:(await store.list('lessons',actor.classId)).filter(l=>l.status==='draft').map(l=>({id:l.id,date:l.date,objective:l.title})),strategy:'practice'};
 if(/(?:deplace|reporte|scinde|fusionne|insere|ajoute|change la sequence)/.test(text))return {kind:'plan_selector',message:'Choisissez les créneaux et relisez le changement structurel.'};
 let entry;
 try{entry=input.entryId?await scoped(store,'plan_entries',input.entryId,actor):resolveEntry(entries,input);}catch(error){
  if(error.status!==409)throw error;
  if(error.details?.entries)return {kind:'clarification',message:error.message,candidates:entries.filter(e=>error.details.entries.includes(e.id))};
  return {kind:'unplanned_draft',date:error.details?.targetDate||input.targetDate||parisDate(),objective:input.intent,message:'Aucun créneau prévu. Complétez ce brouillon et validez son insertion dans le plan avant la préparation.'};
 }
 requireValue(!['replaced','cancelled','postponed'].includes(entry.status),'Ce créneau n’est plus actif.');
 if(!entry.durationConfirmed)return {kind:'confirm_duration',entryId:entry.id,intent:input.intent};
 return {kind:'prepare',entryId:entry.id,mode:/remediation/.test(text)?'remediation':'prepare'};
}
