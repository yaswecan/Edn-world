import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {pedagogyFixture,pilotDefinitions,buildPilot} from '../tests/fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
const config=JSON.parse(await readFile('.data/quality-v2/lab.json','utf8'));Object.assign(process.env,config);
const {store,actor}=await pedagogyFixture(),job=await buildPilot(store,actor,pilotDefinitions[2]);
const server=createApp(store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={simulation:'Course authored as fixture; real authenticated app, Chromium, PTY and Docker',checks:[]},directory='docs/quality/evidence-v2/lab-preview';
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 await page.goto(base+'/preparation.html?job='+job.id);await page.getByRole('button',{name:'Aperçu élève du brouillon',exact:true}).click();
 await page.locator('#preview .lesson-desktop-nav [data-action=demo-step][data-id="4"]').click();
 await page.setViewportSize({width:390,height:844});const root=page.locator('[data-real-lab=guided]');await root.getByRole('button',{name:'Connecter le terminal',exact:true}).click();await expect(root.locator('[role=status]')).toContainText('Connecté',{timeout:30000});
 await root.locator('[data-lab-check]').click();await expect(root.locator('[role=status]')).toContainText('À reprendre');
 const session=(await store.list('lab_sessions',actor.classId))[0];assert.equal(session.preview,true);
 const wrong=await context.request.post(base+'/api/preparation/jobs/'+job.id+'/lab',{data:{activityId:'guided',lessonVersionId:'obsolete'}});assert.equal(wrong.status(),400);
 const io=await context.request.post(base+'/api/labs/'+session.id+'/io',{data:{cursor:0,input:'mkdir -p projet\ncp brouillon/notes.txt projet/notes.txt\nrm brouillon/notes.txt\n',cols:40,rows:20}});assert.equal(io.status(),200);
 await expect(async()=>{const check=await context.request.post(base+'/api/labs/'+session.id+'/check',{data:{}});assert.equal((await check.json()).ok,true);}).toPass({timeout:10000});
 await root.locator('[data-lab-check]').click();await expect(root.locator('[role=status]')).toContainText('✓');
 await root.getByText('Fichiers du laboratoire',{exact:true}).click();await root.locator('[data-lab-files]').click();await root.getByRole('button',{name:'projet/notes.txt',exact:true}).click();await expect(root.locator('[data-file-content]')).toHaveValue('réunion jeudi\n');
 assert.equal((await store.list('learning_events',actor.classId)).length,0);assert.equal((await store.list('assessment_attempts',actor.classId)).length,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await mkdir(directory,{recursive:true});await page.screenshot({path:directory+'/terminal-mobile.png',fullPage:true});
 report.checks.push(...['authenticated-real-terminal','wrong-state-and-alternative-method','editor-and-shell-share-files','stale-version-rejected','teacher-preview-without-student-progress','mobile-no-overflow'].map(id=>({id,status:'PASS'})));
}catch(error){report.error=error.stack;throw error;}
finally{await mkdir(directory,{recursive:true});await writeFile(directory+'/acceptance.json',JSON.stringify(report,null,2)+'\n');await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();}
console.log(JSON.stringify(report));
