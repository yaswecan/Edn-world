import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pedagogyFixture} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {enqueueGeneration} from '../server/pedagogy/jobs.mjs';
import {importDocument} from '../server/pedagogy/documents.mjs';

// Real HTTP, browser and persistence. A simulated model catalog allows form
// submissions; no generation worker or provider transport runs in this check.
const {store,actor}=await pedagogyFixture(),directory='test-results/preparation';
await mkdir(directory,{recursive:true});
actor.aiPreferences={provider:'chatgpt_plan',connectionId:'ui-connection',model:'ui-model'};await store.put('teachers',actor);
const models=[{slug:'ui-model',displayName:'Modèle de test',reasoningEfforts:['high']}];
const chatgpt={list:async()=>[{id:'ui-connection',label:'Connexion simulée',state:'available',planAuthorized:true,models}],models:async()=>models};
const curriculum=await store.get('curriculum_versions','quality-curriculum');
for(const criterion of curriculum.criteria)await store.insert('competency_n3',{...criterion,id:criterion.n3_code,classId:actor.classId});
for(const entry of await store.list('plan_entries',actor.classId))await store.put('plan_entries',{...entry,module:'',duration:entry.id==='box'?175:110,durationConfirmed:entry.id!=='box'});
const source=await importDocument(store,actor,{filename:'boite.md',role:'reference'},Buffer.from('# Modèle de boîte\nLe padding et la bordure modifient les dimensions de la boîte.'));
const server=createApp(store,{chatgpt}).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
const base=`http://127.0.0.1:${server.address().port}`,options={headless:true};
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';if(existsSync(chrome))options.executablePath=chrome;
let browser;const report={scope:'Real browser, HTTP and SQLite; simulated model catalog; no AI calls',checks:[]};
try{
 browser=await chromium.launch(options);const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage(),errors=[];context.setDefaultTimeout(12000);
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());page.on('pageerror',error=>errors.push(error.message));
 await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 await page.goto(base+'/preparation.html?entry=box');
 const launch=page.getByRole('button',{name:'Lancer la préparation',exact:true}),hours=page.getByLabel('Heures',{exact:true}),minutes=page.getByLabel('Minutes',{exact:true});
 await expect(page.locator('#new-panel')).toBeVisible();await expect(page.locator('#history-panel')).toBeHidden();await expect(page.locator('#job')).toBeHidden();
 await expect(hours).toHaveValue('2');await expect(minutes).toHaveValue('55');await expect(page.locator('#duration-status')).toContainText('Durée à confirmer');
 await page.locator('#generate [name=intent]').fill('Conserver mon objectif pendant la navigation.');
 await page.getByText('Ajouter des documents',{exact:true}).click();await page.locator(`[name=source][value="${source.id}"]`).check();
 await page.locator('.preparation-nav [data-view=library]').click();await expect(page.locator('#document-library')).toBeVisible();
 await page.locator('#document-search input').fill('padding');await page.getByRole('button',{name:'Rechercher dans mes sources'}).click();await expect(page.locator('#document-results')).toContainText('bordure');
 await page.locator('.preparation-nav [data-view=new]').click();await expect(page.locator('#generate [name=intent]')).toHaveValue('Conserver mon objectif pendant la navigation.');await expect(page.locator(`[name=source][value="${source.id}"]`)).toBeChecked();
 report.checks.push('creation-library-navigation-preserves-consignes-and-documents');
 const versions=(await store.list('plan_versions',actor.classId)).length;
 for(const [h,m] of [['0','29'],['10','1'],['2','60'],['1.5','0'],['','30']]){await hours.fill(h);await minutes.fill(m);await launch.click();assert.ok(await page.locator('.session-duration :invalid').count());assert.equal((await store.list('plan_versions',actor.classId)).length,versions);}
 assert.equal((await store.list('generation_jobs',actor.classId)).length,0);
 await hours.fill('2');await minutes.fill('15');
 const pattern='**/api/preparation/jobs';let lost=0;
 await context.route(pattern,async route=>{if(route.request().method()==='POST'){lost++;await route.fetch();await route.abort();}else await route.continue();});
 await launch.click();await expect(page.locator('#message')).toHaveClass('error');await expect(launch).toBeEnabled();
 assert.equal((await store.list('generation_jobs',actor.classId)).length,1);await context.unroute(pattern);
 await launch.click();await expect(page.locator('#job')).toBeVisible();await expect(page.locator('#new-panel')).toBeHidden();
 const first=(await store.list('generation_jobs',actor.classId))[0];assert.equal(lost,1);assert.equal(first.brief.entry.duration,135);assert.equal(first.brief.entry.durationConfirmed,true);assert.equal((await store.list('generation_jobs',actor.classId)).length,1);assert.deepEqual(first.sourceIds,[source.id]);
 await expect(page.locator('.preparation-next')).toContainText('Votre demande est enregistrée');
 assert.ok((await page.locator('#job').boundingBox()).y<400);await expect(page.locator('.preparation-technical')).not.toHaveAttribute('open','');
 await page.reload();await expect(page.locator('#job')).toBeVisible();await expect(page.locator('#new-panel')).toBeHidden();
 report.checks.push('one-launch-saves-duration-and-documents','lost-response-retries-same-request-once','deep-link-opens-current-job-above-the-fold');
 await page.screenshot({path:directory+'/current-desktop.png',fullPage:true});
 // A distinct request waits behind an earlier preparation, and names that context.
 const running={...first,status:'running',stage:'design',leaseUntil:new Date(Date.now()+300000).toISOString()};await store.put('generation_jobs',running);
 const waiting=await enqueueGeneration(store,actor,{entryId:'logic',intent:'Seconde préparation en attente.'},{chatgpt});
 await page.goto(base+'/preparation.html?job='+waiting.id);await expect(page.locator('.preparation-next')).toContainText('attend son tour');
 await page.getByRole('button',{name:'Voir la préparation précédente'}).click();await expect(page.locator('.preparation-next')).toContainText('Conception du parcours');
 assert.equal(new URL(page.url()).searchParams.get('job'),first.id);
 report.checks.push('waiting-request-explains-previous-preparation-with-working-link');
 // Simulated stream metadata traverses the real database/API and is refreshed without navigating.
 const liveCall={id:'ui-live-call',classId:actor.classId,jobId:first.id,revision:1,stage:'design',role:'design',provider:'chatgpt_plan',profile:{model:'ui-model'},effectiveModel:'ui-model',outcome:'running',responseId:'ui-response',createdAt:new Date(Date.now()-20000).toISOString(),activity:{phase:'reasoning',lastSignalAt:new Date().toISOString(),outputCharacters:0,summary:'Je rapproche les objectifs des documents fournis.'}};
 await store.insert('generation_calls',liveCall);await store.put('generation_jobs',{...running,inflight:{id:liveCall.id},calls:1});
 const panel=page.locator('.preparation-activity');
 await expect(panel.locator('[data-activity=label]')).toHaveText('Préparation de la réponse');await expect(panel.locator('.activity-summary')).toContainText('objectifs');
 const duration=await panel.locator('[data-activity=duration]').textContent();await expect(panel.locator('[data-activity=duration]')).not.toHaveText(duration);
 await page.locator('.activity-summary>summary').click();await expect(page.locator('.activity-summary')).not.toHaveAttribute('open','');
 liveCall.activity={...liveCall.activity,phase:'writing',outputCharacters:1234,lastSignalAt:new Date().toISOString()};await store.put('generation_calls',liveCall);
 await expect(panel.locator('[data-activity=label]')).toHaveText('Réponse en cours');await expect(panel.locator('[data-activity=characters]')).toContainText(/1\s234/);await expect(page.locator('.activity-summary')).not.toHaveAttribute('open','');
 await page.locator('.activity-summary>summary').click();await page.screenshot({path:directory+'/activity-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:directory+'/activity-mobile.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await panel.locator('.activity-state').evaluate(node=>getComputedStyle(node,'::before').animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 liveCall.activity.lastSignalAt=new Date(Date.now()-70000).toISOString();await store.put('generation_calls',liveCall);
 await expect(panel.locator('[data-activity=label]')).toHaveText('En attente de signal');await expect(panel).toHaveAttribute('data-state','waiting');
 const trackingPattern='**/api/preparation/jobs/'+first.id;await context.route(trackingPattern,route=>route.abort());
 await expect(panel).toHaveAttribute('data-state','offline');await context.unroute(trackingPattern);
 liveCall.activity.lastSignalAt=new Date().toISOString();await store.put('generation_calls',liveCall);await expect(panel).toHaveAttribute('data-state','live');
 await expect(page.locator('#message')).toContainText('rétablie');
 await store.put('generation_jobs',{...running,status:'cancelled',finishedAt:new Date().toISOString()});await expect(panel.locator('[data-activity=label]')).toHaveText('Préparation annulée');
 const frozenDuration=await panel.locator('[data-activity=duration]').textContent();await page.getByRole('button',{name:'Actualiser l’état',exact:true}).click();await expect(panel.locator('[data-activity=duration]')).toHaveText(frozenDuration);
 await store.remove('generation_calls',liveCall.id);await page.setViewportSize({width:1280,height:960});
 report.checks.push('live-model-signals-summary-and-character-count-from-real-api','elapsed-clock-without-server-change','collapsed-summary-preserved-on-poll','stalled-provider-and-disconnected-tracking-distinguished','reconnection-restores-state','cancellation-stops-live-indicator','live-mobile-and-reduced-motion');
 // Frozen expired budgets do not become a hidden retry. The suggested action only fills the form.
 const blocked={...first,status:'blocked',stage:'design',reason:'Ordre incomplet.',startedAt:'2000-01-01T00:00:00.000Z'};await store.put('generation_jobs',blocked);
 await page.goto(base+'/preparation.html?job='+first.id);await expect(page.locator('.preparation-next')).toContainText('Le délai de cette préparation est dépassé');
 const before=JSON.stringify(await store.list('generation_jobs',actor.classId));
 await page.getByRole('button',{name:'Préparer à nouveau cette séance'}).click();await expect(page.locator('#new-panel')).toBeVisible();assert.equal(JSON.stringify(await store.list('generation_jobs',actor.classId)),before);
 await expect(page.locator('#generate [name=entryId]')).toHaveValue(first.entryId);await expect(page.locator('#generate [name=intent]')).toHaveValue(first.brief.intent);await expect(page.locator(`[name=source][value="${source.id}"]`)).toBeChecked();
 report.checks.push('expired-budget-action-preserves-old-job-and-prefills-without-new-call');
 // Save errors leave a retryable form; no preparation is created prematurely.
 const count=(await store.list('generation_jobs',actor.classId)).length;
 await context.route('**/changes/*/apply',route=>route.fulfill({status:409,json:{error:'Plan modifié : créez une nouvelle proposition.'}}));await hours.fill('4');await launch.click();
 await expect(page.locator('#message')).toHaveText('Plan modifié : créez une nouvelle proposition.');await expect(launch).toBeEnabled();assert.equal((await store.list('generation_jobs',actor.classId)).length,count);
 await context.unroute('**/changes/*/apply');await launch.click();await expect(page.locator('#job')).toBeVisible();assert.equal((await store.list('generation_jobs',actor.classId)).length,count+1);
 assert.equal((await store.get('generation_jobs',first.id)).startedAt,blocked.startedAt);
 report.checks.push('save-failure-blocks-generation-and-retry-preserves-old-version');
 // History, both views on mobile, and cancellation remain reachable.
 await page.locator('.preparation-nav [data-view=history]').click();await page.locator('#history-search').fill('Une carte');assert.ok(await page.locator('[data-job]').count());
 await page.locator(`[data-job="${first.id}"]`).click();await expect(page.locator('#job')).toBeVisible();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:directory+'/current-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Préparer à nouveau cette séance'}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:directory+'/form-mobile.png',fullPage:true});
 await page.locator('.preparation-nav [data-view=current]').click();await page.getByRole('button',{name:'Annuler la préparation',exact:true}).click();await expect(page.locator('.preparation-next')).toContainText('Cette préparation a été arrêtée');
 assert.equal((await store.get('generation_jobs',first.id)).status,'cancelled');assert.equal((await store.list('generation_calls')).length,0);assert.deepEqual(errors,[]);
 // Cancellation from history must address that row, not the selected preparation.
 const remaining=(await store.list('generation_jobs',actor.classId)).filter(j=>j.id!==first.id);
 for(const j of remaining)await store.put('generation_jobs',{...j,status:'blocked',reason:'Préparation à reprendre.'});
 const untouched=await store.get('generation_jobs',remaining[1].id),selected=await store.get('generation_jobs',first.id);
 await page.locator('.preparation-nav [data-view=history]').click();await page.locator('#history-search').fill('');
 await expect(page.locator(`[data-history-job="${first.id}"] [data-cancel-job]`)).toHaveCount(0);
 await page.screenshot({path:directory+'/history-cancel-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await page.locator(`[data-cancel-job="${remaining[0].id}"]`).click();
 await expect(page.locator(`[data-history-job="${remaining[0].id}"] .preparation-badge`)).toHaveText('Annulée');
 await expect(page.locator('#history-panel')).toBeVisible();assert.equal(new URL(page.url()).searchParams.get('job'),first.id);
 assert.deepEqual(await store.get('generation_jobs',untouched.id),untouched);assert.deepEqual(await store.get('generation_jobs',first.id),selected);
 await page.locator(`[data-cancel-job="${remaining[1].id}"]`).click();await expect(page.locator(`[data-history-job="${remaining[1].id}"] .preparation-badge`)).toHaveText('Annulée');
 await page.reload();await expect(page.locator('#history-panel')).toBeVisible();await expect(page.locator('#history-panel [data-cancel-job]')).toHaveCount(0);
 assert.equal((await store.list('generation_jobs',actor.classId)).length,3);assert.ok((await store.list('generation_jobs',actor.classId)).every(j=>j.status==='cancelled'));assert.deepEqual(errors,[]);
 report.checks.push('search-history-and-reopen','mobile-no-horizontal-overflow','cancel-preserves-draft','history-cancel-targets-only-its-row-and-persists-after-reload','zero-provider-calls-zero-browser-errors');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;throw error;}
finally{await writeFile(directory+'/interface.json',JSON.stringify(report,null,2)+'\n');await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();}
console.log(JSON.stringify(report,null,2));
