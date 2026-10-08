import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseWorkbook} from '../server/importer.mjs';
import {preparationContext} from '../server/pedagogy/context.mjs';
import {enqueueGeneration} from '../server/pedagogy/jobs.mjs';
import {qualityConfig} from '../server/pedagogy/provider.mjs';
import {pedagogyFixture} from './fixtures/pedagogy.mjs';

test('persisted blank sequence rows allow preparation and preserve exact session positions and ambiguity',async()=>{
 const {store,actor}=await pedagogyFixture();
 try{
  const entry=await store.get('plan_entries','logic');entry.sequence='S04';await store.put('plan_entries',entry);
  const curriculum=await store.get('curriculum_versions','quality-curriculum');
  const rows=[];rows[0]=['Fiche'];rows[3]=[null,entry.date,'Séance du matin'];rows[6]=[{date:entry.date},'Séance de l’après-midi'];rows[8]=['2026-10-08','Autre date'];
  curriculum.sequences=[{id:'S04',source:{name:'S04 Logique',rows}}];await store.put('curriculum_versions',curriculum);
  assert.equal((await store.get('curriculum_versions',curriculum.id)).sequences[0].source.rows[1],null);
  const plan=await store.get('plan_versions','quality-plan'),context=await preparationContext(store,actor,entry,plan);
  assert.deepEqual(context.sessions.map(s=>s.row),[4,7]);
  assert.equal(context.sessions[0].cells[0],null);assert.notEqual(context.sessions[0].id,context.sessions[1].id);
  assert.ok(context.uncertainties.some(s=>s.includes('Plusieurs lignes')));
  const input={entryId:entry.id,intent:'Concevoir depuis une fiche comportant des lignes vides.',requestId:'blank-rows-request'};
  const job=await enqueueGeneration(store,actor,input,{config:qualityConfig({EDEN_AI_MODEL:'gpt-6.1-sol'}),simulation:true});
  assert.equal(job.status,'queued');assert.equal(job.calls,0);assert.deepEqual(job.brief.resolvedContext,context);
  assert.equal((await enqueueGeneration(store,actor,input)).id,job.id);
  assert.equal((await store.list('generation_jobs',actor.classId)).length,1);
 }finally{await store.close();}
});

test('new workbook imports retain blank rows as empty arrays across storage without shifting dates',async()=>{
 const workbook=new ExcelJS.Workbook();
 for(const name of ['02 Référentiel','03 Planning','05 Évaluations','12 Ressources','10 Élèves','11 Journal','09 Historique'])workbook.addWorksheet(name);
 const sequence=workbook.addWorksheet('S04 Logique');
 sequence.getCell('A1').value='Fiche de séquence';sequence.getCell('C6').value='Logique';
 sequence.getCell('A15').value=new Date('2026-10-06T00:00:00Z');
 const parsed=await parseWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
 const rows=JSON.parse(JSON.stringify(parsed)).sequences[0].source.rows;
 assert.deepEqual(rows[1],[]);assert.deepEqual(rows[13],[]);assert.equal(rows[14][0],'2026-10-06');
 assert.equal(rows.length,15);assert.ok(rows.every(Array.isArray));
});
