import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {diagnosticRevisionFixture} from '../tests/fixtures/diagnostic-revision.mjs';
import {pilotDefinitions} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';

const directory='test-results/diagnostic-practice';await mkdir(directory,{recursive:true});
const chrome=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}}),report={scope:'Isolated legacy drafts; real browser, HTTP and code tests; no AI calls',checks:[]};
try{
 for(const pilot of pilotDefinitions){
  const {store,actor,lesson,spec}=await diagnosticRevisionFixture(pilot),errors=[];
  await store.insert('learners',{id:'student',classId:actor.classId,role:'student',username:'student',passwordHash:passwordHash('student-check-only')});
  const server=createApp(store).listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();
  try{
   await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());page.on('pageerror',e=>errors.push(e.message));
   const endpoint=base+`/api/lessons/${lesson.id}/diagnostic/revise`;
   assert.equal((await context.request.post(endpoint,{data:{version:1}})).status(),401);
   await context.request.post(base+'/api/login',{data:{role:'student',username:'student',password:'student-check-only'}});
   assert.equal((await context.request.post(endpoint,{data:{version:1}})).status(),403);
   await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
   await page.goto(base);await page.locator('.nav [data-id=lessons]').click();await page.locator(`[data-action=open-lesson][data-id="${lesson.id}"]`).click();
   await page.getByRole('button',{name:'Renforcer le diagnostic',exact:true}).click();
   const intro=page.locator('#preview-body [data-component=DiagnosticIntro]');await expect(intro).toBeVisible();await expect(intro).toContainText('4 exercices');await expect(intro).toContainText('A2 · Autonomie et vérification');
   await expect(page.locator('#preview-body .diagnostic-observation').first()).toBeVisible();
   await expect(page.locator('#preview-body textarea[data-answer]')).toHaveCount(3);
   const updated=await store.get('lessons',lesson.id),version=await store.get('lesson_versions',updated.versionId),tasks=version.spec.diagnostic.tasks;
   assert.equal(updated.version,2);assert.equal(updated.status,'draft');assert.deepEqual((await store.get('lesson_versions',lesson.versionId)).spec,spec);
   await page.screenshot({path:`${directory}/${pilot.id}-overview.png`});
   for(const task of tasks.filter(t=>t.type==='CodeEditor')){
    const editor=page.locator(`#preview-body [data-answer="${task.id}"]`);await expect(editor).toBeEnabled();await editor.fill(task.reference);
    if(['html','css','javascript'].includes(task.correctionMode)){
     await page.locator(`#preview-body [data-activity="${task.id}"]`).getByRole('button',{name:'Vérifier mon code'}).click();
     await expect(page.locator(`#console-${task.id}`)).toContainText('Exécution terminée');
    }else await expect(page.locator(`#preview-body [data-activity="${task.id}"] [data-action=preview-run-code]`)).toHaveCount(0);
   }
   if(pilot.id==='box'){
    await page.locator('#preview-body [data-workshop-preview=baseline-css]').click();
    await expect(page.frameLocator('#preview-body [data-workshop-frame=baseline-css]').locator('.carte a')).toHaveCSS('color','rgb(0, 128, 0)');
   }
   const firstEditor=page.locator('#preview-body textarea[data-answer]').first();await firstEditor.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/${pilot.id}-editor-desktop.png`});
   await page.setViewportSize({width:390,height:844});await firstEditor.scrollIntoViewIfNeeded();await expect(firstEditor).toBeInViewport();
   assert.equal(await page.locator('#dialog').evaluate(node=>node.scrollWidth>node.clientWidth+2),false);await expect(page.getByRole('button',{name:'Fermer',exact:true})).toBeInViewport();await page.screenshot({path:`${directory}/${pilot.id}-editor-mobile.png`});
   await expect(page.locator('#preview-body [data-action=submit-answers]')).toHaveCount(0);
   assert.deepEqual(errors,[]);assert.equal((await store.list('generation_calls')).length,0);assert.equal((await store.list('assessment_attempts')).length,0);assert.equal((await store.list('submissions')).length,0);
   report.checks.push(`${pilot.id}: teacher-only upgrade, retained original, observation screen, two editable code tasks, real supported tests, desktop/mobile, no learner writes`);
  }catch(error){await page.screenshot({path:`${directory}/${pilot.id}-failure.png`});throw error;}
  finally{await context.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();}
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;throw error;}
finally{await browser.close();await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
