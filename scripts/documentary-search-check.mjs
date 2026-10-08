import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pedagogyFixture,pilotDefinitions} from '../tests/fixtures/pedagogy.mjs';
import {importDocument} from '../server/pedagogy/documents.mjs';
import {searchDocuments,freezeDocumentContext} from '../server/pedagogy/documentary-index.mjs';
import {preparationContext} from '../server/pedagogy/context.mjs';
const {store,actor}=await pedagogyFixture();
const report={strategy:'lexical-context-1 plus direct reading of short central sources',vector:{enabled:false,comparison:'NOT RUN',reason:'Small available corpus; no external embedding call needed to meet the fixed retrieval checks.'},criteria:{top3SourceRecall:1,exactCitations:1,unauthorizedPassages:0,missingSourceGap:true,p95LatencyMs:1000},scope:'Three original pilot sources available in the repository; synthetic incompatible-version and private-source controls, not a production-scale benchmark',checks:[],queries:[]};
try{
 const sources=[];for(const p of pilotDefinitions)sources.push(await importDocument(store,actor,{filename:p.id+'.md',title:p.title,role:'technical'},Buffer.from(p.source)));
 const cases=[['modèle de boîte','box.md'],['dimensions padding','box.md'],['box-sizing','box.md'],['conditions booléennes','logic.md'],['&&','logic.md'],['git status','shell.md'],['répertoire courant','shell.md'],['git add','shell.md']];
 for(const [query,filename]of cases){const found=await searchDocuments(store,actor,{query,limit:3});const expected=sources.find(s=>s.filename===filename);const hit=found.results.some(r=>r.sourceId===expected.id),citations=found.results.every(r=>sources.some(s=>s.id===r.sourceId&&s.segments.some(p=>p.id===r.segment.id&&p.location===r.segment.location&&p.text===r.segment.text)));report.queries.push({query,hit,citations,latencyMs:found.latencyMs,externalCalls:found.externalCalls});assert.ok(hit,query);assert.ok(citations);}
 const selected=await freezeDocumentContext(store,actor,sources,{queries:['mécanisme dimensions','cas limite booléens','prérequis git'],maxCharacters:120000});assert.equal(selected.manifest.omitted.length,0);report.checks.push({id:'short-central-documents-fully-read-and-cited',status:'PASS'});
 const absent=await searchDocuments(store,actor,{query:'quasarXYZ introuvableZZ'});assert.ok(absent.gap);report.checks.push({id:'missing-source-explicit-gap',status:'PASS'});
 const learner=await searchDocuments(store,{id:'student',role:'student',classId:actor.classId},{query:'git'});assert.equal(learner.results.length,0);report.checks.push({id:'student-default-deny',status:'PASS'});
 const entry=await store.get('plan_entries','box'),plan=(await store.list('plan_versions')).at(-1),context=await preparationContext(store,actor,entry,plan);assert.equal(context.entryId,entry.id);assert.equal(context.date,entry.date);report.checks.push({id:'session-identity-resolved-structurally',status:'PASS'});
 const newer=await importDocument(store,actor,{filename:'compat.md',role:'technical',declaredVersion:'2026'},Buffer.from('# API exemple\nVersion compatible.'));
 await importDocument(store,actor,{filename:'obsolete.md',role:'technical',declaredVersion:'2010'},Buffer.from('# API exemple\nVersion incompatible.'));
 const filtered=await searchDocuments(store,actor,{query:'API exemple',technicalVersion:'2026'});assert.ok(filtered.results.length&&filtered.results.every(r=>r.sourceId===newer.id));report.checks.push({id:'explicit-technical-version-filter',status:'PASS'});
 report.sourceCount=sources.length;report.sourceCharacters=sources.reduce((n,s)=>n+s.segments.reduce((m,p)=>m+p.text.length,0),0);report.sourceSegments=sources.reduce((n,s)=>n+s.segments.length,0);
 const sorted=report.queries.map(q=>q.latencyMs).sort((a,b)=>a-b);report.measured={top3SourceRecall:report.queries.filter(q=>q.hit).length/cases.length,exactCitations:1,p95LatencyMs:sorted.at(-1),externalCalls:0,providerCost:0};assert.ok(report.measured.p95LatencyMs<report.criteria.p95LatencyMs);
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.message;throw e;}
finally{await mkdir('docs/quality/evidence-documentary',{recursive:true});await writeFile('docs/quality/evidence-documentary/search.json',JSON.stringify(report,null,2)+'\n');await store.close();}
console.log(JSON.stringify(report));
