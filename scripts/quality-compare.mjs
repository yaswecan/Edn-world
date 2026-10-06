// Small, explicitly invoked comparison; no API calls without --live.
import {mkdir,writeFile} from 'node:fs/promises';
import {pedagogyFixture,pilotDefinitions} from '../tests/fixtures/pedagogy.mjs';
import {generateLesson} from '../server/generator.mjs';
import {qualityConfig} from '../server/pedagogy/provider.mjs';
import {enqueueGeneration,runGenerationStep} from '../server/pedagogy/jobs.mjs';
import {importDocument} from '../server/pedagogy/documents.mjs';
import {inspectCandidate} from '../server/pedagogy/browser-evidence.mjs';
import {digest} from '../server/pedagogy/contracts.mjs';
const live=process.argv.includes('--live'),cap=Number(process.env.EDEN_COMPARISON_MAX_USD||6);
if(!Number.isFinite(cap)||cap<=0||cap>20)throw Error('EDEN_COMPARISON_MAX_USD doit être dans ]0,20].');
const current=process.env.OPENAI_MODEL,capable=process.env.EDEN_COMPARISON_MODEL||'gpt-6.1-sol';
const rows=[],{store,actor}=await pedagogyFixture();let reserved=0;
try{
 for(const [configuration,model,effort] of [['A',current,null],['B',current,'high'],['C',capable,'high'],['D',capable,'xhigh']])for(let repetition=1;repetition<=2;repetition++){
  const pilot=pilotDefinitions[1],brief={entryId:pilot.id,intent:'Concevoir une séance sur des conditions composées pour débutants. Prédire, diagnostiquer une erreur de regroupement et transférer à une livraison.'};
  const row={configuration,repetition,briefHash:digest(brief),sourceHash:digest(pilot.source),model:model||null,effort,status:'NOT RUN',costUSD:null,durationMs:null,quality:null};rows.push(row);
  if(!live||!process.env.OPENAI_API_KEY||!model){row.reason=!live?'Mode rapport : utiliser --live pour appeler le fournisseur.':'Clé ou modèle actuel absent.';continue;}
  const start=Date.now();try{
   if(configuration==='A'){
    // Freeze the old full response path, not the new review pipeline.
    // Its historical API lacks a cost cap; refuse paid execution in this bounded harness.
    row.reason='Référence historique sans plafond de sortie/coût : utiliser un export observé. Aucun appel non borné.';continue;
   }
   if(reserved>=cap){row.reason='Plafond global de comparaison atteint.';continue;}
   let config;try{config=qualityConfig({EDEN_AI_MODEL:model,EDEN_AI_EFFORT:effort,EDEN_AI_MAX_OUTPUT_TOKENS:'24000',EDEN_AI_MAX_SESSION_USD:String(Math.min(3,cap-reserved))});}catch(error){row.reason=error.message;continue;}
   const source=await importDocument(store,actor,{filename:'comparison.md',role:'technical'},Buffer.from(pilot.source));
   let job=await enqueueGeneration(store,actor,{...brief,sourceIds:[source.id]},{config});
   for(let steps=0;steps<40&&['queued','running'].includes(job.status);steps++){await runGenerationStep(store,{inspect:inspectCandidate});job=await store.get('generation_jobs',job.id);}
   reserved+=job.reservedUSD;row.status=job.status==='completed'?'PASS':'FAIL';row.reason=job.reason;row.quality=job.decision?{score:job.decision.score,blockers:job.decision.blockers}:null;row.costUSD=job.spentUSD;row.reservedUSD=job.reservedUSD;row.calls=job.calls;row.parameters=config.roles;
  }catch(error){row.status='FAIL';row.reason=error.message;}row.durationMs=Date.now()-start;
 }
 // Reproducible local baseline, explicitly separate from an API comparison.
 const baseline=await generateLesson(store,{intent:'Référence bibliothèque locale',mode:'prepare'},actor,{entryId:'logic',localOnly:true});
 await mkdir('docs/quality/evidence',{recursive:true});await writeFile('docs/quality/evidence/model-comparison.json',JSON.stringify({date:'2026-10-05',capUSD:cap,reservedUSD:reserved,rows,baseline:{provider:baseline.provider,contentHash:digest(baseline.spec),spec:baseline.spec},decision:'Aucun modèle retenu sur une qualité non mesurée. high/xhigh sont des paramètres API, pas une reproduction de ChatGPT Pro.'},null,2)+'\n');
 console.log(JSON.stringify(rows.map(({configuration,repetition,status,reason})=>({configuration,repetition,status,reason}))));
}finally{await store.close();}
