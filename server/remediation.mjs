import {uid,now,requireValue,fail,scoped} from './store.mjs';
import {mastery,valueOfLevel} from './assessment.mjs';
import {parisDate} from './generator.mjs';
import {validDate} from './planning.mjs';
export function weekStart(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
const summarize=groups=>groups.map(g=>({group:g.id,count:g.members.length,criteria:[...new Set(g.members.flatMap(m=>m.criteria))]}));
export async function calculateRemediation(store,actor,input={}){return store.transaction(async tx=>{
 const date=input.date||parisDate();requireValue(validDate(date),'Date invalide.');
 const [learners,corrections,evidence,policies,snapshots,observations,criteria]=await Promise.all(['learners','corrections','evidence','teacher_policies','remediation_snapshots','teacher_observations','competency_n3'].map(t=>tx.list(t,actor.classId)));
 const week=weekStart(date),previous=snapshots.filter(s=>s.week===week).sort((a,b)=>b.version-a.version)[0];
 const groups=['G0','G1','G2','G3','NE'].map((id,i)=>({id,title:['Reprise fondamentale','Atelier guidé','Consolidation','Transfert & challenge','À observer / à relire'][i],members:[],activities:[]}));
 const add=(learnerId,criterion,group,reason,metrics)=>{const g=groups.find(g=>g.id===group);let m=g.members.find(m=>m.learnerId===learnerId);if(!m){m={learnerId,criteria:[],reason,metrics:{}};g.members.push(m);}if(criterion)m.criteria.push(criterion);if(metrics)m.metrics[criterion]=metrics;};
 const usedCorrections=new Map(),usedEvidence=new Set(),usedObservations=new Set();
 for(const learner of learners){
  const proofs=evidence.filter(e=>e.learnerId===learner.id&&e.date<=date),feedback=corrections.filter(c=>c.learnerId===learner.id&&(c.createdAt||'').slice(0,10)<=date),notes=observations.filter(o=>o.learnerId===learner.id&&o.date<=date);
  const codes=[...new Set([...proofs.map(e=>e.criterion),...feedback.flatMap(c=>c.criteria.map(x=>x.criterion)),...notes.map(o=>o.criterion)])].filter(c=>c!=='baseline');
  if(!codes.length)add(learner.id,null,'NE','Aucune preuve corrigée.');
  for(const criterion of codes){
   const relevant=proofs.filter(e=>e.criterion===criterion),metrics=mastery(relevant,policies.at(-1),new Date(date+'T23:59:59Z'));for(const e of relevant)usedEvidence.add(e.id);
   const correction=feedback.filter(c=>c.criteria.some(x=>x.criterion===criterion)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
   const observation=notes.filter(o=>o.criterion===criterion).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))[0];
   let value=metrics.weightedLevel,reason='Historique pondéré des preuves validées';
   if(correction){usedCorrections.set(correction.id,correction.version);if(value==null){value=valueOfLevel[correction.criteria.find(c=>c.criterion===criterion).level];reason=correction.status==='approved'?'Correction validée':'Proposition sur pré-correction';}}
   if(observation){usedObservations.add(observation.id);if(observation.level!=='NE'){value=value==null?valueOfLevel[observation.level]:(value+valueOfLevel[observation.level])/2;reason+=' et observation professeur';}}
   let group=value==null?'NE':`G${Math.max(0,Math.min(3,Math.round(value)))}`;
   const manual=(previous?.manualAssignments||[]).find(m=>m.learnerId===learner.id&&m.criteria.includes(criterion));
   if(manual){group=manual.group;reason=`Ajustement professeur conservé : ${manual.reason}`;}
   else if(previous?.status==='stabilized'){const old=previous.groups.find(g=>g.members.some(m=>m.learnerId===learner.id&&m.criteria.includes(criterion)));if(old){group=old.id;reason='Groupe stabilisé pour la semaine ; nouvelles preuves conservées';}}
   add(learner.id,criterion,group,reason,metrics);
  }
 }
 for(const g of groups){const codes=[...new Set(g.members.flatMap(m=>m.criteria))];g.activities=codes.map(criterion=>{const node=criteria.find(c=>c.n3_code===criterion);return {criterion,title:node?.observable_criterion||criterion,mode:{G0:'Reprise avec exemple résolu',G1:'Pratique guidée avec indices',G2:'Pratique autonome et justification',G3:'Transfert dans un nouveau contexte',NE:'Observation individuelle sans note'}[g.id],duration:12,prerequisites:node?.prerequisiteCodes||[],evidence:'Production, démarche et vérification observables'};});}
 const summary=summarize(groups),weak=[...new Set(groups.filter(g=>['G0','G1'].includes(g.id)).flatMap(g=>g.members.flatMap(m=>m.criteria)))];
 return tx.insert('remediation_snapshots',{id:uid('remediation'),classId:actor.classId,version:(snapshots.reduce((n,s)=>Math.max(n,s.version),0))+1,week,asOf:date,groups,summary,status:previous?.status==='stabilized'?'stabilized':'proposed',manualAssignments:previous?.manualAssignments||[],sourceCorrectionVersions:[...usedCorrections].map(([id,version])=>({id,version})),sourceEvidenceIds:[...usedEvidence],sourceObservationIds:[...usedObservations],reactivationProposal:weak.length?{duration:12,criteria:weak.slice(0,3),status:'proposed',reason:'Réactivation ciblée avant les nouveaux apprentissages'}:null});
});}
export async function adjustRemediation(store,actor,input){return store.transaction(async tx=>{
 requireValue(input.reason?.trim(),'Justifiez l’ajustement des groupes.');const snapshots=await tx.list('remediation_snapshots',actor.classId),old=snapshots.sort((a,b)=>a.version-b.version).at(-1);requireValue(old,'Aucun groupe calculé.');if(input.version!==undefined&&input.version!==old.version)fail(409,'Les groupes ont changé. Rechargez-les.');
 await scoped(tx,'learners',input.learnerId,actor);const groups=structuredClone(old.groups),target=groups.find(g=>g.id===input.group);requireValue(target,'Groupe inconnu.');
 const known=[...new Set(groups.flatMap(g=>g.members.filter(m=>m.learnerId===input.learnerId).flatMap(m=>m.criteria)))];
 const selected=input.criteria?.length?input.criteria:known;requireValue(selected.every(c=>known.includes(c)),'Critère absent du profil de cet élève.');
 for(const g of groups){for(const m of g.members.filter(m=>m.learnerId===input.learnerId))m.criteria=m.criteria.filter(c=>!selected.includes(c));g.members=g.members.filter(m=>m.learnerId!==input.learnerId||m.criteria.length);}
 let member=target.members.find(m=>m.learnerId===input.learnerId);if(!member){member={learnerId:input.learnerId,criteria:[],reason:input.reason};target.members.push(member);}member.criteria=[...new Set([...member.criteria,...selected])];member.reason=input.reason;
 const assignments=(old.manualAssignments||[]).map(a=>a.learnerId===input.learnerId?{...a,criteria:a.criteria.filter(c=>!selected.includes(c))}:a).filter(a=>a.criteria.length);assignments.push({learnerId:input.learnerId,criteria:selected,group:input.group,reason:input.reason});
 const row=await tx.insert('remediation_snapshots',{...old,id:uid('remediation'),createdAt:now(),version:old.version+1,groups,summary:summarize(groups),manualAssignments:assignments,status:old.status==='stabilized'?'stabilized':'teacher_adjusted',authorId:actor.id,reason:input.reason});await tx.audit(actor,'remediation.adjusted',row.id,{reason:input.reason,criteria:selected});return row;
});}
export async function stabilizeRemediation(store,actor,input){return store.transaction(async tx=>{const old=(await tx.list('remediation_snapshots',actor.classId)).sort((a,b)=>a.version-b.version).at(-1);requireValue(old&&input.version===old.version,'Rechargez les groupes avant validation.');requireValue(input.confirmed===true,'Confirmation requise.');const row=await tx.insert('remediation_snapshots',{...old,id:uid('remediation'),createdAt:now(),version:old.version+1,status:'stabilized',authorId:actor.id});await tx.audit(actor,'remediation.stabilized',row.id,{week:old.week});return row;});}
export async function recordObservation(store,actor,input){await scoped(store,'learners',input.learnerId,actor);requireValue((await store.list('competency_n3',actor.classId)).some(c=>c.n3_code===input.criterion),'Critère inconnu.');requireValue(Object.hasOwn(valueOfLevel,input.level)&&validDate(input.date)&&input.date<=parisDate(),'Niveau ou date invalide.');requireValue(input.note?.trim(),'Observation requise.');return store.transaction(async tx=>{const row=await tx.insert('teacher_observations',{id:uid('observation'),classId:actor.classId,learnerId:input.learnerId,criterion:input.criterion,level:input.level,date:input.date,note:input.note,authorId:actor.id});await tx.audit(actor,'observation.recorded',row.id);return row;});}
