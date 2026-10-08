import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pedagogyFixture,pilotDefinitions,buildPilot} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';
import {runArchiveJob} from '../server/git-archive.mjs';
import {inspectCandidate} from '../server/pedagogy/browser-evidence.mjs';

const directory='docs/quality/evidence-documentary',temp=await mkdtemp(join(tmpdir(),'eden-browser-archive-'));
await mkdir(directory,{recursive:true});
const {store,actor}=await pedagogyFixture(),server=createApp(store).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
const base=`http://127.0.0.1:${server.address().port}`,options={headless:true},chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';if(existsSync(chrome))options.executablePath=chrome;
const browser=await chromium.launch(options),report={scope:'Real HTTP, Chromium, SQLite, Git; authored fixture AI responses, synthetic student publication only',checks:[],pilots:[]};
try{
 const teacher=await browser.newContext(),page=await teacher.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await teacher.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 for(const pilot of pilotDefinitions){const job=await buildPilot(store,actor,pilot,{inspect:inspectCandidate});report.pilots.push({id:pilot.id,status:job.status,stage:job.stage,calls:job.calls,sourceContext:job.documentContext.id,checks:job.checks.map(({id,status})=>({id,status}))});console.log(`Rendered ${pilot.id}: ${job.status}`);}
 const job=(await store.list('generation_jobs')).find(j=>j.entryId==='box');
 await page.goto(base+'/preparation.html?job='+job.id);await page.locator('.preparation-nav [data-view=library]').click();await expect(page.locator('#document-library')).toBeVisible();
 await page.locator('#document-search input').fill('modèle de boîte');await page.getByRole('button',{name:'Rechercher dans mes sources'}).click();await expect(page.locator('#document-results')).toContainText('border-box');
 await page.locator('#document-results [data-passage-id]').first().click();await expect(page.locator('dialog')).toContainText('SHA-256');await page.locator('dialog button').click();
 await page.getByText('Corriger le classement d’une source',{exact:true}).click();await page.locator('#source-classification [name=family]').selectOption('Design');await page.locator('#source-classification [name=topics]').fill('css.box, boîte et dimensions');await page.getByRole('button',{name:'Enregistrer le classement'}).click();
 await expect.poll(async()=> (await store.list('source_annotations')).length).toBe(1);
 await page.reload();await page.getByText('Corriger le classement d’une source',{exact:true}).click();await expect(page.locator('#source-classification [name=topics]')).toHaveValue('css.box, boîte et dimensions');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.locator('#document-library').screenshot({path:directory+'/document-library-mobile.png'});
 report.checks.push({id:'search-citation-classification-reload-mobile',status:'PASS'});
 console.log('Teacher document workflow: PASS');
 const lesson=await store.get('lessons',job.lessonId);lesson.status='published';lesson.runId='synthetic-storage-run';await store.put('lessons',lesson);
 await store.insert('learners',{id:'storage-student',classId:'A1',username:'student-storage',role:'student',displayName:'Élève de recette',passwordHash:passwordHash('student-storage-only')});
 await store.insert('assessment_attempts',{id:'storage-diagnostic',classId:'A1',learnerId:'storage-student',lessonId:lesson.id,lessonVersionId:lesson.versionId,submissionId:'synthetic-diagnostic-done',answers:{},history:[]});
 const student=await browser.newContext();await student.route('**/api/today',route=>route.continue({url:base+'/api/today?date='+lesson.date}));
 await student.request.post(base+'/api/login',{data:{role:'student',username:'student-storage',password:'student-storage-only'}});
 const sp=await student.newPage();sp.on('pageerror',e=>errors.push(e.message));await sp.goto(base+'/today');await sp.locator('.lesson-stage').waitFor();
 await sp.locator('.lesson-desktop-nav [data-action=student-step][data-id="4"]').click();await sp.locator('[data-answer=guided]').fill('.carte { box-sizing: border-box; padding: 20px; }');
 await sp.locator('.lesson-desktop-nav [data-action=student-step]').last().click();await sp.locator('[data-answer=exit]').fill('La bordure et le padding sont inclus.');
 let intercepted=0;const pattern='**/api/lessons/*/work/submit';await student.route(pattern,async route=>{intercepted++;await route.fetch();await route.abort();});
 await sp.getByRole('button',{name:'Remettre mon travail'}).click();await expect.poll(async()=> (await store.list('work_submissions')).length).toBe(1);
 await student.unroute(pattern);await sp.reload();await expect(sp.locator('[data-answer=exit]')).toHaveValue('La bordure et le padding sont inclus.');await sp.getByRole('button',{name:'Remettre mon travail'}).click();await expect(sp.getByText(/Travail remis le/)).toBeVisible();assert.equal(intercepted,1);assert.equal((await store.list('work_submissions')).length,1);
 const receipt=(await store.list('work_submissions'))[0],before=await store.get('content_snapshots',receipt.snapshotId);assert.ok(before.files.some(f=>f.content.includes('padding: 20px')));
 assert.equal((await student.request.get(base+'/api/preparation/search?q=corrige')).status(),403);
 assert.equal((await student.request.get(base+'/api/work-submissions/'+receipt.id)).status(),200);
 report.checks.push({id:'latest-browser-bytes-durable-receipt-lost-response-reload-single-adoption',status:'PASS'},{id:'student-retrieval-denied-receipt-readable',status:'PASS'});
 const receiptPage=await student.newPage();await receiptPage.goto(base+'/work-receipt.html?id='+receipt.id);await expect(receiptPage.locator('#receipt-status')).toContainText('Travail reçu le');await expect(receiptPage.locator('#receipt-files')).toContainText('padding: 20px');await receiptPage.close();report.checks.push({id:'student-readable-receipt-and-current-files',status:'PASS'});
 console.log('Student durable submission and readable receipt: PASS');
 const config={repository:join(temp,'private.git'),id:'browser-test'};while(await runArchiveJob(store,{config})){}
 const archive=await store.get('archive_outbox',receipt.snapshotId);assert.equal(archive.state,'confirmed');assert.equal((await store.get('content_snapshots',receipt.snapshotId)).sha256,before.sha256);report.checks.push({id:'real-git-archive-does-not-change-submission',status:'PASS',commit:archive.archive.commit});
 await sp.setViewportSize({width:390,height:844});await sp.screenshot({path:directory+'/student-receipt-mobile.png'});assert.deepEqual(errors,[]);
 report.checks.push({id:'browser-errors',status:'PASS'});
}catch(error){report.error=error.stack;throw error;}
finally{await writeFile(directory+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();await rm(temp,{recursive:true,force:true});}
console.log(JSON.stringify(report));
