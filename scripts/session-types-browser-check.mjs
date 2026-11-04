import {closeOwnedBrowser} from './browser-cleanup.mjs';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:20000});
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pedagogyFixture} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
const f=await pedagogyFixture(),directory='test-results/session-types';await mkdir(directory,{recursive:true});
for(const entry of await f.store.list('plan_entries')){entry.module='Web';await f.store.put('plan_entries',entry);}
const curriculum=await f.store.get('curriculum_versions','quality-curriculum');
for(const criterion of curriculum.criteria)await f.store.insert('competency_n3',{...criterion,id:criterion.n3_code,classId:f.actor.classId});
const server=createApp(f.store).listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const base='http://127.0.0.1:'+server.address().port,checks=[],errors=[];let browser,browserServer;
try{
 const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 browserServer=await chromium.launchServer({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});browser=await chromium.connect(browserServer.wsEndpoint());
 const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
 assert.ok((await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}})).ok());
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
 await page.locator('.nav [data-id="plan"]').click();await page.locator('[data-action="edit-plan"][data-id="box"]').click();
 await expect(page.getByLabel('Type de séance')).toBeVisible();await page.getByLabel('Type de séance').selectOption('programming');await page.getByLabel('Justification').fill('Préparer une séance de programmation');
 await page.getByRole('button',{name:/Analyser la modification/}).click();await page.getByRole('button',{name:'Valider cette modification',exact:true}).click();
 await expect(page.locator('[data-plan-entry="box"]')).toContainText('Programmation');checks.push('planning-type-selected-reviewed-and-persisted');
 await page.locator('.nav [data-id="lessons"]').click();await page.getByRole('button',{name:'Préparer une séance',exact:true}).click();
 await page.getByLabel('Créneau à préparer').selectOption('box');await expect(page.getByLabel('Type de séance')).toHaveValue('programming');
 await page.getByLabel('Parcours de programmation').selectOption('tableaux-s1');await page.getByLabel('Durée du créneau (minutes)').fill('180');
 await page.screenshot({path:directory+'/creation-choice.png'});await page.getByRole('button',{name:'Préparer la séance',exact:true}).click();
 await expect(page.getByRole('button',{name:'Aperçu élève',exact:true})).toBeVisible();
 const first=(await f.store.list('lessons')).find(lesson=>lesson.programmingTemplate==='tableaux-s1');assert.ok(first);assert.equal(first.status,'draft');
 const firstSpec=(await f.store.get('lesson_versions',first.versionId)).spec;assert.equal(firstSpec.activities.length,13);assert.equal(firstSpec.sessionType,'programming');
 await page.getByRole('button',{name:'Aperçu élève',exact:true}).click();await expect(page.locator('programming-lesson')).toBeVisible();await page.screenshot({path:directory+'/created-preview.png'});checks.push('main-creation-retains-selected-template-and-opens-rich-preview');
 await page.goto(base+'/preparation.html?entry=logic');await expect(page.getByLabel('Type de séance')).toBeVisible();
 await page.getByLabel('Type de séance').selectOption('programming');await page.getByLabel('Parcours de programmation').selectOption('tableaux-s2');
 await page.getByLabel('Heures',{exact:true}).fill('3');await page.getByLabel('Minutes',{exact:true}).fill('0');
 await expect(page.getByRole('button',{name:'Créer le brouillon de programmation',exact:true})).toBeEnabled();
 await page.screenshot({path:directory+'/preparation-choice.png'});await page.getByRole('button',{name:'Créer le brouillon de programmation',exact:true}).click();
 await expect(page).toHaveURL(/editLesson=/);await expect(page.getByRole('button',{name:'Aperçu élève',exact:true})).toBeVisible();
 const second=(await f.store.list('lessons')).find(lesson=>lesson.programmingTemplate==='tableaux-s2');assert.ok(second);assert.equal((await f.store.get('lesson_versions',second.versionId)).spec.activities.length,15);
 assert.equal((await f.store.get('plan_entries','logic')).sessionType,'programming');assert.equal((await f.store.get('plan_entries','logic')).duration,180);assert.equal((await f.store.list('generation_jobs')).length,0);
 checks.push('preparation-page-creates-native-template-without-ai','selected-duration-and-type-persisted-in-plan');
 assert.deepEqual(errors,[]);checks.push('no-browser-errors');await writeFile(directory+'/report.json',JSON.stringify({checks},null,2));console.log(JSON.stringify({status:'passed',checks}));
}catch(error){
 if(browser){const page=browser.contexts()[0]?.pages()[0];if(page){await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});await writeFile(directory+'/failure.json',JSON.stringify({error:error.message,errors,page:await page.locator('body').innerText().catch(()=>''),url:page.url()},null,2));}}
 throw error;
}finally{
 await closeOwnedBrowser(browser,browserServer);
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.store.close();
}
