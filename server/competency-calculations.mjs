// Pure, reproducible V2 calculations. Category order is explicit; no ordinal averages.
import {requireValue} from './store.mjs';
export const unique=values=>[...new Set(values)];
export const rank=(categories,grade)=>categories.find(c=>c.id===grade)?.order??-Infinity;
const compare={gte:(a,b)=>a>=b,gt:(a,b)=>a>b,lte:(a,b)=>a<=b,lt:(a,b)=>a<b,eq:(a,b)=>a===b};
export function validateCategories(categories){
 requireValue(Array.isArray(categories)&&categories.length>0&&categories.length<=12,'Définissez de 1 à 12 catégories.');
 requireValue(unique(categories.map(c=>c.id)).length===categories.length&&unique(categories.map(c=>c.order)).length===categories.length,'Catégories et ordres distincts attendus.');
 for(const c of categories)requireValue(typeof c.id==='string'&&c.id.length>0&&c.id.length<=40&&Number.isInteger(c.order)&&typeof c.description==='string'&&c.description.trim(),'Chaque catégorie exige un ordre et un descripteur.');
}
export function validateGradeRules(rules,itemIds,categories){
 requireValue(Array.isArray(rules)&&rules.length<=12,'Règles de grade invalides.');
 requireValue(unique(rules.map(r=>r.grade)).length===rules.length,'Un grade ne peut avoir deux règles.');
 for(const rule of rules){
  requireValue(categories.some(c=>c.id===rule.grade)&&Array.isArray(rule.conditions)&&rule.conditions.length<=100,'Catégorie ou conditions invalides.');
  for(const c of rule.conditions)requireValue(Array.isArray(c.itemIds)&&c.itemIds.length>0&&unique(c.itemIds).length===c.itemIds.length&&c.itemIds.every(id=>itemIds.includes(id))&&['points','ratio','grade'].includes(c.metric)&&Object.hasOwn(compare,c.op)&&(c.metric==='grade'?categories.some(g=>g.id===c.value):Number.isFinite(c.value)),'Seuil invalide ou item hors du périmètre.');
 }
}
const coefficient=i=>i.coefficient??1;
export function scoreItems(items,{digits=2,mode='nearest'}={}){
 const active=items.filter(i=>!i.exempt),maximum=active.reduce((n,i)=>n+i.max*coefficient(i),0),raw=active.reduce((n,i)=>n+(i.points??0)*coefficient(i),0),complete=active.length>0&&active.every(i=>Number.isFinite(i.points));
 const round={nearest:Math.round,down:Math.floor,up:Math.ceil}[mode],factor=10**digits;
 return {score:complete?round((raw+Number.EPSILON)*factor)/factor:null,raw:complete?raw:null,partial:raw,maximum:maximum||null,complete,rounding:{digits,mode}};
}
export function selectGrade(rules,items,categories,{roundBeforeGrade=false,rounding}={}){
 if(!rules?.length)return {grade:null,status:'Grade à déterminer',reasons:['Aucune règle de grade configurée.']};
 const blocked=[];
 for(const rule of [...rules].sort((a,b)=>rank(categories,b.grade)-rank(categories,a.grade))){
  const checks=rule.conditions.map(c=>{
   const rows=c.itemIds.map(id=>items.find(i=>i.id===id));
   if(c.metric==='grade'){const known=rows.every(i=>i&&categories.some(g=>g.id===i.observedGrade));return {known,ok:known&&rows.every(i=>compare[c.op](rank(categories,i.observedGrade),rank(categories,c.value))),label:c.label||'Niveau du critère'};}
   const score=scoreItems(rows.filter(Boolean),rounding);
   if(rows.some(i=>!i)||!score.complete)return {known:false,ok:false,label:c.label||'Preuve manquante'};
   const value=c.metric==='ratio'?score.raw/score.maximum:roundBeforeGrade?score.score:score.raw;
   return {known:true,ok:compare[c.op](value,c.value),label:c.label||`${c.itemIds.join(', ')} : ${c.op} ${c.value}`,value};
  });
  if(checks.some(c=>!c.known))return {grade:null,status:'Grade à déterminer',reasons:[...blocked,...checks.filter(c=>!c.known).map(c=>c.label)]};
  if(checks.every(c=>c.ok))return {grade:rule.grade,status:'observed',reasons:blocked,conditions:checks};
  blocked.push(...checks.filter(c=>!c.ok).map(c=>`${rule.grade} — ${c.label}`));
 }
 return {grade:null,status:'Grade à déterminer',reasons:blocked};
}
export function coverage(node,criteria){
 const observed=unique(criteria.filter(c=>c.grade!==null&&c.grade!==undefined).map(c=>c.criterionId)),targeted=unique(criteria.map(c=>c.criterionId)),achieved=unique(criteria.filter(c=>c.meetsExpected===true).map(c=>c.criterionId));
 const set=node.criterionSet,official=unique((set?.criterionIds||[]).filter(id=>node.criteria.find(c=>c.id===id)?.origin==='source'));
 return {targeted:targeted.length,observed:observed.length,achieved:achieved.length,officialObserved:official.filter(id=>observed.includes(id)).length,total:set?.exhaustive===true?official.length:null,setName:set?.name||null,setVersion:set?.version||null,partial:!set?.exhaustive||official.some(id=>!observed.includes(id)),scope:'Sur les critères travaillés'};
}
export function calculateGrid(grid,items,frameworks){
 const weighted=items.map(i=>({...i,coefficient:grid.items.find(g=>g.id===i.id)?.coefficient??1})),score=scoreItems(weighted,grid.rounding);
 if(grid.mode==='ordinal'){score.score=null;score.raw=null;score.maximum=null;}
 const global=(score.complete||grid.mode==='ordinal')?selectGrade(grid.globalRules,weighted,grid.categories,grid):{grade:null,status:'Grade à déterminer',reasons:['Correction incomplète ; le barème complet est conservé.']};
 const observations=grid.competencies.map(mapping=>{
  const framework=frameworks.find(f=>f.id===mapping.frameworkVersionId),node=framework.nodes.find(n=>n.id===mapping.competencyId);
  const criteria=mapping.criteria.map(c=>{
   const relevant=weighted.filter(i=>c.itemIds.includes(i.id)),result=selectGrade(c.rules,relevant,grid.categories,grid);
   if(result.grade&&rank(grid.categories,result.grade)>rank(grid.categories,c.maximumGrade)){result.grade=c.maximumGrade;result.reasons.push('Niveau limité à la demande de cette situation.');}
   return {criterionId:c.criterionId,title:node.criteria.find(k=>k.id===c.criterionId).title,itemIds:c.itemIds,grade:result.grade,reasons:result.reasons,essential:c.essential,maximumGrade:c.maximumGrade,meetsExpected:!!result.grade&&!!c.expectedGrade&&rank(grid.categories,result.grade)>=rank(grid.categories,c.expectedGrade)};
  });
  const relevant=weighted.filter(i=>mapping.criteria.some(c=>c.itemIds.includes(i.id))),result=selectGrade(mapping.rules,relevant,grid.categories,grid);
  if(result.grade&&rank(grid.categories,result.grade)>rank(grid.categories,mapping.maximumGrade))result.grade=mapping.maximumGrade;
  return {frameworkVersionId:framework.id,competencyId:node.id,code:node.code,title:node.studentLabel||node.title,expectedLevel:node.expectedLevel||null,...result,criteria,coverage:coverage(node,criteria),rule:{categories:grid.categories,globalRules:mapping.rules,criteria:mapping.criteria,rounding:grid.rounding}};
 });
 return {score,...global,observations,categories:grid.categories,rule:{globalRules:grid.globalRules,rounding:grid.rounding,roundBeforeGrade:grid.roundBeforeGrade,items:grid.items}};
}
// Date of the work, then stable identity; never use correction/import time.
export const newest=(a,b)=>String(b.workedAt||'').localeCompare(String(a.workedAt||''))||(a.submissionId&&a.submissionId===b.submissionId?(b.correctionVersion||0)-(a.correctionVersion||0):0)||String(b.id).localeCompare(String(a.id),'en');
export function consolidate(observations,rule,retained=null){
 const excluded=[],valid=[];
 for(const o of observations){let reason=!o.validated?'Observation non validée':!o.workedAt||!Number.isFinite(Date.parse(o.workedAt))?'Date du travail inconnue':!o.situationId?'Origine de la situation inconnue':o.practice||o.afterCorrection?'Entraînement ou reprise après corrigé':o.scaleKey!==rule.scaleKey?'Échelle non comparable':null;
  if(reason)excluded.push({id:o.id,reason});else valid.push(o);
 }
 const groups=new Map();for(const o of valid.sort(newest)){if(groups.has(o.situationId))excluded.push({id:o.id,reason:'Tentative antérieure de la même situation'});else groups.set(o.situationId,o);}
 const recent=[...groups.values()],selected=new Map(),missing=[];
 for(const criterion of rule.criteria){const rows=recent.filter(o=>o.criteria.some(c=>c.criterionId===criterion.id&&c.grade)).sort(newest),count=criterion.essential?rule.minSituations:criterion.minSituations;
  const chosen=rows.slice(0,count);selected.set(criterion.id,chosen);
  if(chosen.length<count)missing.push(`${criterion.id} : ${chosen.length} situation(s) sur ${count}`);
  for(const o of rows.slice(count))excluded.push({id:o.id,criterionId:criterion.id,reason:'Situation plus ancienne que la sélection requise'});
 }
 if(excluded.some(e=>e.reason==='Date du travail inconnue'))missing.push('Chronologie à compléter avant calcul automatique.');
 let grade=null;
 if(!missing.length)for(const candidate of [...rule.categories].sort((a,b)=>b.order-a.order)){
  const satisfied=rule.criteria.every(c=>{const rows=selected.get(c.id),target=rank(rule.categories,candidate.id);return rows.every(o=>{const proof=o.criteria.find(k=>k.criterionId===c.id);return rank(rule.categories,proof.grade)>=target&&rank(rule.categories,proof.maximumGrade)>=target;})&&(!rule.requireAutonomy||!c.essential||rows.some(o=>o.autonomy==='demonstrated'));});
  if(satisfied){grade=candidate.id;break;}
 }
 if(!grade&&!missing.length)missing.push('Niveau de demande, résultats ou autonomie insuffisamment démontrés.');
 const latest=recent[0]||null;
 const contradiction=!!retained&&recent.some(o=>o.workedAt>=(retained.lastWorkedAt||'')&&o.criteria.some(c=>rule.criteria.some(k=>k.id===c.criterionId)&&c.grade&&rank(rule.categories,c.grade)<rank(rule.categories,retained.grade)));
 const proofs=unique([...selected.values()].flat().map(o=>o.id)).map(id=>recent.find(o=>o.id===id));
 return {grade,status:contradiction?'À examiner':grade?'À valider':'À confirmer',reason:contradiction?'Une observation récente contredit le niveau retenu. Prévoir une vérification.':missing.join(' ')||'Les situations récentes démontrent les critères requis.',latest:latest?{grade:latest.grade,workedAt:latest.workedAt,id:latest.id}:null,selection:Object.fromEntries([...selected].map(([id,rows])=>[id,rows.map(o=>o.id)])),proofs:proofs.map(o=>({id:o.id,submissionId:o.submissionId,correctionVersion:o.correctionVersion,gridId:o.gridId,workedAt:o.workedAt})),excluded,lastWorkedAt:proofs.map(o=>o.workedAt).sort().at(-1)||null};
}
