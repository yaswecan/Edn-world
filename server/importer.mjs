import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { uid, requireValue, fail } from './store.mjs';
export const hash = data => createHash('sha256').update(data).digest('hex');
export const codes = text => [...new Set(String(text||'').match(/BCT?\d{2}-C\d+-\d+/g)||[])];
const text = value => value==null?'':value instanceof Date?value.toISOString().slice(0,10):typeof value==='object'?value.richText?value.richText.map(x=>x.text).join(''):value.text??text(value.result):String(value);
const date = v => v?.formula?date(v.result):v instanceof Date?v.toISOString().slice(0,10):typeof v==='number'?new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10):/^\d{4}-\d{2}-\d{2}$/.test(text(v))?text(v):null;
export async function parseWorkbook(buffer) {
 // ExcelJS expects unprefixed SpreadsheetML tags. Normalize namespace prefixes
 // in a temporary in-memory copy; the original bytes remain the import identity.
 const zip=await JSZip.loadAsync(buffer);let inflated=0;
 for(const file of Object.values(zip.files).filter(f=>!f.dir&&f.name.endsWith('.xml'))){
  const xml=await file.async('string');inflated+=Buffer.byteLength(xml);if(inflated>50*1024*1024)fail(413,'Classeur décompressé trop volumineux.');
  const prefix=xml.match(/xmlns:(\w+)=["']http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main["']/)?.[1];
  let normalized=xml;
  if(prefix)normalized=xml.replace(new RegExp('(<\\/?)'+prefix+':','g'),'$1').replace('xmlns:'+prefix+'=', 'xmlns=');
  // Table styling is not pedagogical content; tolerate dangling table references
  // produced by the source exporter while preserving all cell values.
  if(file.name.startsWith('xl/worksheets/'))normalized=normalized.replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g,'');
  zip.file(file.name,normalized);
 }
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await zip.generateAsync({type:'nodebuffer'}));
 const sheets=wb.worksheets.map(s=>({name:s.name,merges:[...(s.model.merges||[])],cells:s.getRows(1,s.rowCount)?.flatMap(row=>{const cells=[];row.eachCell({includeEmpty:false},cell=>cells.push({address:cell.address,value:cell.value instanceof Date?{date:cell.value.toISOString().slice(0,10)}:cell.value,hyperlink:cell.hyperlink||null,master:cell.isMerged?cell.master.address:null}));return cells;})||[],rows:s.getSheetValues().slice(1).map(r=>(r||[]).slice(1).map(v=>v?.formula?{formula:v.formula,value:text(v.result)}:text(v)))}));
 const sheet=prefix=>requireValue(wb.worksheets.find(s=>s.name.startsWith(prefix)),`Feuille ${prefix} manquante.`);
 const warnings=[], criteria=[],entries=[],sequences=[],evaluations=[],resources=[],learners=[],journal=[],history=[];
 sheet('02 ').eachRow((r,n)=>{const a=r.values;const code=text(a[3]);if(!/^BCT?\d{2}-C\d+-\d+$/.test(code))return;
  criteria.push({id:code,n2_code:text(a[1]),n2_label:text(a[2]),n3_code:code,n3_label:text(a[4]),typology:text(a[5]),notions_tools:text(a[6]),examples:[],sequence_id:text(a[7]),planned_dates:text(a[8]),expected_trace:text(a[9]),status:text(a[10]),observable_criterion:text(a[12]),prerequisites:text(a[13]),prerequisiteCodes:codes(text(a[13])),mastery_rule:text(a[14]),scaffolding_rule:text(a[15]),sourceRow:n});
 });
 sheet('03 ').eachRow((r,n)=>{const a=r.values,d=date(a[1]);if(!d)return;entries.push({id:`PE-${d}-${n}`,date:d,day:text(a[2]),category:text(a[3]),sequence:text(a[4]),module:text(a[5]),skills:codes(text(a[6])),objective:text(a[7]),activity:text(a[8]),notes:text(a[9]),assessmentId:text(a[11]),assessmentDuration:text(a[12]),assessmentCriteria:codes(text(a[13])),resourcePack:(text(a[15]).match(/R-\d{6}/)||[])[0]||null,duration:175,durationConfirmed:false,status:'planned',sourceRow:n});});
 for(const entry of entries){const planning=sheet('03 '),row=planning.getRow(entry.sourceRow);entry.workbookSource={sheet:planning.name,row:entry.sourceRow,sha256:hash(buffer),cells:[]};row.eachCell({includeEmpty:false},cell=>entry.workbookSource.cells.push({address:cell.address,value:cell.value instanceof Date?{date:cell.value.toISOString().slice(0,10)}:cell.value,hyperlink:cell.hyperlink||null,master:cell.isMerged?cell.master.address:null}));}
 warnings.push('La durée du créneau n’est pas une colonne du planning détaillé : 175 minutes proposées, à confirmer avant publication. La durée d’évaluation n’est pas utilisée comme durée de séance.');
 for(const s of wb.worksheets.filter(s=>/^S\d{2}/.test(s.name)))sequences.push({id:s.name.slice(0,3),title:text(s.getCell('C6').value),objectives:text(s.getCell('C8').value),prerequisites:text(s.getCell('C10').value),tools:text(s.getCell('C12').value),source:sheets.find(x=>x.name===s.name)});
 sheet('05 ').eachRow(r=>{const a=r.values;if(!/^(PM|BP|EO|CC)-/.test(text(a[1])))return;evaluations.push({id:text(a[1]),date:date(a[2]),type:text(a[4]),duration:text(a[5]),sequence:text(a[6]),objective:text(a[7]),skills:codes(a.slice(8,12).map(text).join(' ')),status:'planned',official:/offici|commune/i.test(text(a[4]))});});
 sheet('12 ').eachRow(r=>{const a=r.values;if(!/^R-\d{6}/.test(text(a[1])))return;resources.push({id:text(a[1]),date:date(a[2]),sequence:text(a[4]),module:text(a[5]),title:text(a[6]),description:text(a[8]),url:text(a[9]),assessmentId:text(a[10]),status:text(a[12])});});
 sheet('10 ').eachRow(r=>{const a=r.values;if(typeof a[1]==='number'&&a[1]>=1&&a[1]<=100&&text(a[2]))learners.push({id:`learner-${String(a[1]).padStart(2,'0')}`,displayName:text(a[2]),username:`eleve${String(a[1]).padStart(2,'0')}`});});
 sheet('11 ').eachRow(r=>{const a=r.values,d=date(a[1]);if(!d)return;journal.push({date:d,morning:text(a[2]),afternoon:text(a[3]),comment:text(a[4]),skills:codes(text(a[5])),trace:text(a[6]),sequence:text(a[7]),status:text(a[8])});});
 sheet('09 ').eachRow(r=>{const a=r.values,d=date(a[1]);if(!d||!text(a[4]))return;history.push({date:d,assessmentId:text(a[2]),type:text(a[3]),learner:text(a[4]),criteria:[5,7,9,11].flatMap(i=>codes(text(a[i])).map(criterion=>({criterion,levelValue:Number(a[i+1])}))),comment:text(a[13])});});
 const known=new Set(criteria.map(c=>c.id));for(const e of entries)for(const c of [...e.skills,...e.assessmentCriteria])if(!known.has(c))warnings.push(`${e.date} : critère ${c} absent du référentiel.`);
 for(const e of entries)if(e.assessmentId&&e.assessmentCriteria.some(c=>!e.skills.includes(c)))warnings.push(`${e.date} : critères d’évaluation différents des compétences de séance (${e.assessmentId}).`);
 return {sha256:hash(buffer),sheets,criteria,entries,sequences,evaluations,resources,learners,journal,history,policy:{weeklyRhythm:{1:'construire',2:'comprendre',4:'raisonner',5:'remediation'},minEvidence:2,minSpacingDays:7,requireTransfer:true,recentWeights:[0.6,0.25,0.15],source:sheets.find(s=>s.name.startsWith('04 '))},warnings:[...new Set(warnings)]};
}
export async function previewImport(store,buffer,actor) {
 const parsed=await parseWorkbook(buffer),existing=(await store.list('imports',actor.classId)).find(x=>x.sha256===parsed.sha256&&x.status==='applied');
 if(existing)return {...existing,idempotent:true};
 const current=(await store.list('plan_versions',actor.classId)).at(-1),previous=current?(await store.list('plan_entries',actor.classId)).map(e=>({...e,id:e.id.replace(`${actor.classId}:`, '')})):[];
 const incoming=new Map(parsed.entries.map(e=>[e.id,e]));
 const diff={added:parsed.entries.filter(e=>!previous.some(p=>p.id===e.id)).map(e=>e.id),changed:previous.filter(p=>incoming.has(p.id)&&['date','objective','activity','skills','sequence'].some(k=>JSON.stringify(p[k])!==JSON.stringify(incoming.get(p.id)[k]))).map(p=>p.id),removed:previous.filter(p=>!incoming.has(p.id)).map(p=>p.id)};
 return store.insert('imports',{id:uid('import'),classId:actor.classId,sha256:parsed.sha256,status:'pending',baseVersion:current?.version||0,diff,conflicts:previous.filter(p=>p.editedBy&&([...diff.changed,...diff.removed].includes(p.id))).map(p=>p.id),mapping:parsed.sheets.map(s=>({sheet:s.name,rows:s.rows.length})),warnings:parsed.warnings,parsed});
}
export async function applyImport(store,importId,actor,{confirmed=false}={}) {
 return store.transaction(async tx=>{
 const report=await tx.get('imports',importId);if(!report||report.classId!==actor.classId)fail(404,'Import introuvable.');if(report.status==='applied')return report;
 requireValue(confirmed,'Validez le diff avant l’import.');const current=(await tx.list('plan_versions',actor.classId)).at(-1);
 if((current?.version||0)!==report.baseVersion)fail(409,'La planification a changé. Refaire la prévisualisation.');
 if(report.conflicts.length)fail(409,'Conflits avec des modifications EDEN : corrigez le fichier avant réimport.',report.conflicts);
 const p=report.parsed,version=(current?.version||0)+1,cv=uid('curriculum');
 await tx.insert('curriculum_versions',{id:cv,classId:actor.classId,version,sha256:p.sha256,criteria:p.criteria,sequences:p.sequences,sheets:p.sheets});
 for(const c of p.criteria) {const row={...c,id:`${actor.classId}:${c.id}`,classId:actor.classId,version,curriculumVersion:cv};if(await tx.get('competency_n3',row.id))await tx.put('competency_n3',row);else await tx.insert('competency_n3',row);}
 for(const s of p.sequences)await tx.insert('sequence_versions',{...s,id:`${actor.classId}:${s.id}:v${version}`,sequenceId:s.id,classId:actor.classId,version});
 for(const id of report.diff.removed)await tx.remove('plan_entries',`${actor.classId}:${id}`);
 const entries=p.entries.map(e=>({...e,id:`${actor.classId}:${e.id}`,classId:actor.classId,version,curriculumVersion:cv}));
 for(const e of entries){const old=await tx.get('plan_entries',e.id);if(old){e.duration=old.duration;e.durationConfirmed=old.durationConfirmed;if(old.editedBy){e.editedBy=old.editedBy;e.status=old.status;}await tx.put('plan_entries',e);}else await tx.insert('plan_entries',e);}
 await tx.insert('plan_versions',{id:uid('plan'),classId:actor.classId,version,curriculumVersion:cv,entries,reason:'Import Excel validé',sha256:p.sha256});
 await tx.insert('teacher_policies',{id:uid('policy'),classId:actor.classId,version,...p.policy});
 for(const r of p.resources)await tx.insert('resources',{...r,id:`${actor.classId}:${r.id}:v${version}`,resourceId:r.id,classId:actor.classId,version});
 for(const e of p.evaluations)await tx.insert('assessment_specs',{...e,id:`${actor.classId}:${e.id}:v${version}`,classId:actor.classId,version,source:'workbook'});
 for(const l of p.learners)if(!await tx.get('learners',`${actor.classId}:${l.id}`))await tx.insert('learners',{...l,id:`${actor.classId}:${l.id}`,classId:actor.classId});
 // A populated schedule is never evidence of a completed lesson. Source journal
 // and assessment rows are preserved for explicit teacher reconciliation.
 report.status='applied';report.version=version;report.curriculumVersion=cv;report.appliedBy=actor.id;
 await tx.put('imports',report);await tx.audit(actor,'import.applied',report.id,{version,sha256:p.sha256});return report;
 });
}
