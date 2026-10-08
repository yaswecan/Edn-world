import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pedagogyFixture,pilotDefinitions,buildPilot} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {inspectCandidate} from '../server/pedagogy/browser-evidence.mjs';
import {jobSummary} from '../server/pedagogy/jobs.mjs';
import {studentSpec} from '../server/generator.mjs';
import {passwordHash} from '../server/auth.mjs';
const output=resolve(process.env.EDEN_QUALITY_REPORT_PATH||'docs/quality/evidence');await mkdir(output,{recursive:true});
const {store,actor}=await pedagogyFixture(),server=createApp(store).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
const base=`http://127.0.0.1:${server.address().port}`,options={headless:true};
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';if(existsSync(chrome))options.executablePath=chrome;
let browser;const report={date:'2026-10-07',ai:'NOT RUN',lab:'NOT RUN',browser:'NOT RUN',pilots:[],checks:[]};
try{
 browser=await chromium.launch(options);const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error:',e.message);});
 await page.goto(base);await page.locator('#password').fill('quality-preview-only');await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.locator('.nav').waitFor();
 await page.goto(base+'/preparation.html');await page.locator('#generate').waitFor();await page.locator('.preparation-nav [data-view=library]').click();
 await page.locator('#import input[type=file]').setInputFiles({name:'box.md',mimeType:'text/markdown',buffer:Buffer.from(pilotDefinitions[0].source)});await page.locator('#import select').selectOption('technical');await page.getByRole('button',{name:'Importer le document',exact:true}).click();await page.getByText('Document conservé et extraction terminée. Vérifiez les limites signalées.',{exact:true}).waitFor();
 report.checks.push({id:'browser-upload-original-structure',status:'PASS'});
 for(const pilot of pilotDefinitions){
  console.log(`Pilot ${pilot.id}: import → conception → rédaction → revue → correction → rendu`);
  const job=await buildPilot(store,actor,pilot,{inspect:(spec,job)=>inspectCandidate(spec,job,{directory:'test-results/quality-render'})});
  assert.equal(job.reports.length,2,job.reason);const lesson=await store.get('lessons',job.lessonId),version=await store.get('lesson_versions',lesson.versionId),directory=resolve(output,pilot.id);await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,'lesson.teacher.json'),JSON.stringify(version.spec,null,2)+'\n');await writeFile(resolve(directory,'lesson.student.json'),JSON.stringify(studentSpec(version.spec),null,2)+'\n');
  await writeFile(resolve(directory,'preparation.json'),JSON.stringify(jobSummary(job),null,2)+'\n');await writeFile(resolve(directory,'sources.json'),JSON.stringify(job.sources,null,2)+'\n');
  await writeFile(resolve(directory,'comparison.json'),JSON.stringify({kind:'authored-fixture-comparison-not-live-AI',before:(job.referenceBaseline||job.baseline).blocks.find(b=>b.type==='ConceptCard'),beforeActivity:(job.referenceBaseline||job.baseline).activities.find(a=>a.required&&a.type==='CodeEditor'),after:version.spec.blocks.find(b=>b.id==='concept'),activity:version.spec.activities.find(a=>a.id==='guided'),correction:version.spec.activities.find(a=>a.id==='guided')?.reference},null,2)+'\n');
  const render=job.checks.find(c=>c.id==='browser-render');if(render?.status==='PASS'){const proof=JSON.parse(render.evidence);for(const width of [1280,390])await copyFile(resolve(proof.directory,`2-${width}.png`),resolve(directory,`concept-${width}.png`));}
  report.pilots.push({id:pilot.id,version:lesson.version,jobStatus:job.status,ai:'NOT RUN',review:'SIMULATED',render:render?.status||'NOT RUN',referenceChecks:job.checks.filter(c=>c.id.startsWith('reference:')),blockers:job.decision?.blockers||[],contentHash:job.decision?.contentHash,files:`docs/quality/evidence/${pilot.id}`});
  await page.goto(base+'/preparation.html?job='+encodeURIComponent(job.id));await page.locator('#open-preview').click();await page.locator('#preview .lesson-stage').waitFor();
  await page.locator('#preview .lesson-desktop-nav [data-action=demo-step][data-id="2"]').click();assert.match(await page.locator('#preview .lesson-stage').innerText(),new RegExp(pilot.id==='box'?'344':pilot.id==='logic'?'prioritaire':'position courante'));
  if(pilot.id==='box'||pilot.id==='logic'){
   await page.locator('#preview .lesson-desktop-nav [data-action=demo-step][data-id="4"]').click();const a=version.spec.activities.find(a=>a.id==='guided');await page.locator('#preview textarea[data-answer=guided]').fill(a.reference);await page.locator('#preview [data-action=run-code][data-id=guided]').click();await page.locator('#console-guided').waitFor({state:'visible'});assert.match(await page.locator('#console-guided').innerText(),/✓/);
   if(pilot.id==='box'){await page.locator('[data-workshop-preview=guided]').click();const frame=page.frameLocator('[data-workshop-frame=guided]');await frame.locator('.carte').waitFor();assert.equal(await frame.locator('.carte').evaluate(el=>Math.round(el.getBoundingClientRect().width)),300);}
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(directory,'teacher-preview-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.setViewportSize({width:1280,height:900});
 }
 // Exercise real learner save/submit/remediation on a synthetic published fixture.
 const box=report.pilots.find(p=>p.id==='box');const job=(await store.list('generation_jobs',actor.classId)).find(j=>j.brief.entry.id==='box'),lesson=await store.get('lessons',job.lessonId);lesson.status='published';lesson.runId='synthetic-run';await store.put('lessons',lesson);
 await store.insert('learners',{id:'quality-student',classId:'A1',role:'student',username:'student-quality',displayName:'Élève test',passwordHash:passwordHash('quality-student-only')});
 const student=await browser.newContext();await student.route('**/api/today',route=>route.continue({url:base+'/api/today?date=2026-10-05'}));const sp=await student.newPage();sp.on('pageerror',e=>errors.push(e.message));await sp.goto(base+'/today');await sp.getByRole('button',{name:'Élève',exact:true}).click();await sp.locator('#username').fill('student-quality');await sp.locator('#password').fill('quality-student-only');await sp.getByRole('button',{name:'Se connecter',exact:true}).click();await sp.locator('.lesson-stage').waitFor();await sp.getByRole('button',{name:'Continuer',exact:true}).click();await sp.locator('[data-answer=diag-observe]').fill('Je vérifierais la largeur du contenant.');await sp.locator('[data-answer=diag-practice]').fill('.carte { color: blue; }');await sp.getByRole('button',{name:'Enregistrer',exact:true}).click();await sp.getByText(/Travail enregistré/).waitFor();
 const attempt=(await store.list('assessment_attempts',actor.classId)).find(a=>a.learnerId==='quality-student');assert.equal(attempt.firstAttempt['diag-practice'].payload.answer,'.carte { color: blue; }');
 await sp.getByRole('button',{name:'Rendre mon travail',exact:true}).click();await sp.getByRole('button',{name:'Confirmer l’envoi',exact:true}).click();await sp.locator('.lesson-receipt').waitFor();
 const response=await student.request.get(base+`/api/preparation/remediation/${encodeURIComponent(lesson.id)}`);assert.equal(response.status(),200);const support=await response.json();assert.ok(['insufficient_observation','partially_correct','incorrect','correct'].includes(support.observation));
 const forbidden=await student.request.get(base+'/api/preparation/sources');assert.equal(forbidden.status(),403);const today=(await (await student.request.get(base+'/api/today?date=2026-10-05')).json());assert.equal(today.lesson.pedagogicalValidation,undefined);
 report.checks.push({id:'student-diagnostic-save-first-attempt-submit',status:'PASS'},{id:'student-private-source-and-review-isolation',status:'PASS'},{id:'student-targeted-support-route',status:'PASS'});
 await page.goto(base+'/preparation.html?job='+encodeURIComponent(job.id));await page.getByRole('button',{name:'Diagnostic de début de séance',exact:true}).click();await page.locator('#preview').getByText('Élève test',{exact:true}).waitFor();report.checks.push({id:'teacher-diagnostic-summary',status:'PASS'});
 assert.deepEqual(errors,[]);report.browser='PASS';report.checks.push({id:'browser-errors',status:'PASS'});console.log(JSON.stringify(report));
}catch(error){report.browser='FAIL';report.error=error.stack;throw error;}
finally{await writeFile(resolve(output,'acceptance.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();}
