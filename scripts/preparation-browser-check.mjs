import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pedagogyFixture} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';

// Isolated plan and HTTP server; no worker or real AI calls.
const {store,actor}=await pedagogyFixture();
const curriculum=await store.get('curriculum_versions','quality-curriculum');
for(const criterion of curriculum.criteria)await store.insert('competency_n3',{...criterion,id:criterion.n3_code,classId:actor.classId});
for(const entry of await store.list('plan_entries',actor.classId))await store.put('plan_entries',{...entry,module:'',duration:entry.id==='box'?175:110,durationConfirmed:entry.id!=='box'});
const server=createApp(store).listen(0,'127.0.0.1');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const base=`http://127.0.0.1:${server.address().port}`,options={headless:true};
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if(existsSync(chrome))options.executablePath=chrome;
let browser;
try{
 browser=await chromium.launch(options);
 const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage(),errors=[];
 context.setDefaultTimeout(10000);
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 page.on('pageerror',error=>errors.push(error.message));
 const login=await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});assert.equal(login.status(),200);
 await page.goto(base+'/preparation.html?entry=box');
 const hours=page.getByLabel('Heures',{exact:true}),minutes=page.getByLabel('Minutes',{exact:true}),confirm=page.getByRole('button',{name:'Confirmer la durée',exact:true}),launch=page.getByRole('button',{name:'Préparer la séance complète',exact:true}),entry=page.locator('#generate [name=entryId]');
 await expect(hours).toHaveValue('2');await expect(minutes).toHaveValue('55');
 await expect(page.locator('#duration-status')).toContainText('Durée à confirmer');
 // Confirmation works before AI configuration and survives a reload.
 await hours.fill('3');await minutes.fill('30');await confirm.click();
 await expect(page.locator('#duration-status')).toHaveText('Durée confirmée dans la planification.');
 assert.equal((await store.get('plan_entries','box')).duration,210);
 assert.equal((await store.get('plan_entries','box')).durationConfirmed,true);
 assert.equal((await store.list('generation_jobs',actor.classId)).length,0);
 await page.reload();await expect(hours).toHaveValue('3');await expect(minutes).toHaveValue('30');
 await entry.selectOption('logic');await expect(hours).toHaveValue('1');await expect(minutes).toHaveValue('50');
 await entry.selectOption('box');await expect(hours).toHaveValue('3');await expect(minutes).toHaveValue('30');
 // Invalid and incomplete values cannot create a plan change.
 const versions=(await store.list('plan_versions',actor.classId)).length;
 for(const [h,m] of [['0','29'],['10','1'],['2','60'],['1.5','0'],['','30']]){
  await hours.fill(h);await minutes.fill(m);await confirm.click();
  assert.equal(await page.locator('.session-duration :invalid').count()>0,true);
  assert.equal((await store.list('plan_versions',actor.classId)).length,versions);
 }
 // Enable only the launch control. Jobs use the real endpoint without a worker.
 await context.route('**/api/preparation/config',async route=>{
  const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),configured:true}});
 });
 await page.reload();await expect(launch).toBeEnabled();
 const launchJob=async()=>{
  const response=page.waitForResponse(response=>response.url()===base+'/api/preparation/jobs'&&response.request().method()==='POST');
  await launch.click();const result=await response;assert.equal(result.status(),202);
  await expect(launch).toBeEnabled();return result.json();
 };
 // A new duration is persisted before generation; repeating the action is idempotent.
 await hours.fill('2');await minutes.fill('15');const first=await launchJob();
 assert.equal(first.brief.entry.duration,135);assert.equal(first.brief.entry.durationConfirmed,true);
 assert.equal((await launchJob()).id,first.id);
 await minutes.fill('45');const second=await launchJob();
 assert.notEqual(second.id,first.id);assert.equal(second.brief.entry.duration,165);
 assert.equal((await store.get('generation_jobs',first.id)).brief.entry.duration,135);
 // A failed save must stop generation and leave the inputs available for a retry.
 const beforeFailure=(await store.list('generation_jobs',actor.classId)).length;
 await context.route('**/changes/*/apply',route=>route.fulfill({status:409,json:{error:'Plan modifié : créez une nouvelle proposition.'}}));
 await hours.fill('4');await launch.click();
 await expect(page.locator('#message')).toHaveText('Plan modifié : créez une nouvelle proposition.');
 await expect(launch).toBeEnabled();await expect(hours).toHaveValue('4');
 assert.equal((await store.list('generation_jobs',actor.classId)).length,beforeFailure);
 assert.equal((await store.get('plan_entries','box')).duration,165);
 await context.unroute('**/changes/*/apply');
 const retried=await launchJob();assert.equal(retried.brief.entry.duration,285);
 // An imported, unconfirmed entry can also be launched without a separate save.
 await store.put('plan_entries',{...await store.get('plan_entries','logic'),durationConfirmed:false});
 await page.goto(base+'/preparation.html?entry=logic');await expect(launch).toBeEnabled();
 const unconfirmed=await launchJob();assert.equal(unconfirmed.brief.entry.durationConfirmed,true);assert.equal(unconfirmed.brief.entry.duration,110);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Mobile horizontal overflow');
 await mkdir('test-results/preparation',{recursive:true});
 await page.screenshot({path:'test-results/preparation/duration-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: duration confirmation, persistence, entry selection, validation, launch, idempotency, failure/retry and mobile layout. No AI calls.');
}finally{
 await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();
}
