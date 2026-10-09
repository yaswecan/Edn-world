import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {studentPreview} from './lib/student-preview.mjs';
import {explorationForMission} from '../server/game.mjs';
import {solutions,walkTo} from '../tests/fixtures/exploration.mjs';
const {values}=parseArgs({options:{source:{type:'string'},date:{type:'string'}}});
const f=await studentPreview({source:values.source,date:values.date}),directory='test-results/exploration/daily';await mkdir(directory,{recursive:true});
const spec=(await f.store.get('lesson_versions',f.lesson.versionId)).spec;
const m=await f.store.get('game_missions',spec.codeStation.missionId),def=explorationForMission(m);
const report={scope:values.source?'Read-only copy of the selected local lesson; synthetic accounts, in-memory writes':'Synthetic daily lesson',date:f.lesson.date,lesson:f.lesson.title,mission:m.title,map:def.map.id,checks:[]};
let browser,context,page;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 context=await browser.newContext({viewport:{width:1440,height:1050}});
 await context.request.post(f.base+'/api/login',{data:{username:'student-a',role:'student',classId:'A1',password:f.password}});
 page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Preserve evidence of the original daily launch without reverting work files.
 for(const name of ['index.html','runtime.js','style.css'])await page.route('**/game/'+name,route=>route.fulfill({body:execFileSync('git',['show','HEAD:public/game/'+name]),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'}));
 await page.goto(f.base+'/today?lesson='+encodeURIComponent(f.lesson.id));await page.getByRole('link',{name:'Mode arcade',exact:true}).click();await page.locator(`[data-game="${m.world}"]`).click();await page.locator('[data-action=play]').first().click();
 await expect(page.frameLocator('.game-frame').locator('#missionCode')).toBeVisible({timeout:20000});await page.screenshot({path:directory+'/before.png'});report.checks.push('original-daily-launch-is-flat-editor');
 await page.getByRole('button',{name:'Quitter le jeu',exact:true}).click();await page.unrouteAll({behavior:'wait'});
 await page.locator('.topbar .host-return').click();
 const index=spec.blocks.findIndex(b=>b.type==='CodeStationLauncher');
 // The assigned lesson uses the same context endpoint and game URL as the cabinet.
 if(index>=0){
  const diagnostic=spec.blocks.findIndex(b=>b.type==='Diagnostic');
  await page.locator(`[data-action="student-step"][data-id="${diagnostic}"]:visible`).click();
  await page.locator('[data-action="submit-answers"]').click();await page.locator('[data-action="confirm-submit"]').click();
  await expect(page.locator('#dialog')).not.toBeVisible();
  await page.locator(`[data-action="student-step"][data-id="${index}"]:visible`).click();await page.getByRole('button',{name:'Jouer',exact:true}).click();
 }
 else{await page.getByRole('link',{name:'Mode arcade',exact:true}).click();await page.locator(`[data-game="${m.world}"]`).click();await page.locator('[data-action=play]').first().click();}
 await page.frameLocator('.game-frame').locator('#startMission').click();const frame=page.frames().find(f=>f.url().includes('/game/index.html'));
 await page.screenshot({path:directory+'/world.png'});
 await walkTo(frame,def,def.map.objects.find(o=>o.id==='relay').nav);await frame.locator('#worldCanvas').press('e');
 await walkTo(frame,def,def.map.objects.find(o=>o.id==='workstation').nav,['access']);await frame.locator('#worldCanvas').press('e');
 await expect(frame.locator('#missionCode')).toBeVisible();await page.screenshot({path:directory+'/terminal.png'});
 for(const [file,code] of Object.entries(solutions[m.validator]||m.files)){await frame.locator(`[data-file="${file}"]`).click();await frame.locator('#missionCode').fill(code);}
 await frame.locator('#validateMission').click();await expect(frame.locator('#app')).toHaveAttribute('data-stage','finish');
 await frame.locator('#closeTerminal').click();await page.screenshot({path:directory+'/restored.png'});
 await walkTo(frame,def,def.map.objects.find(o=>o.id==='exit').nav,def.map.doors.map(d=>d.id));await frame.locator('#worldCanvas').press('e');await expect(frame.locator('#briefTitle')).toHaveText('Mission accomplie');await page.screenshot({path:directory+'/victory.png'});
 report.checks.push(index>=0?'lesson-launch-through-real-Jouer-button':'arcade-launch-through-daily-lesson','daily-mission-walked-to-victory');
 await frame.locator('#finishMission').click();await expect(page.locator('.game-frame')).toHaveCount(0);
 await page.getByRole('link',{name:'Mode arcade',exact:true}).click();await page.locator(`[data-game="${m.world}"]`).click();await page.locator('[data-action=play]').first().click();await expect(page.frameLocator('.game-frame').locator('#app')).toHaveAttribute('data-stage','won');report.checks.push('lesson-save-resumes-from-arcade');
 await page.getByRole('button',{name:'Quitter le jeu',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.locator('[data-action=play]').first().click();
 const mobile=page.frameLocator('.game-frame');await expect(mobile.locator('#worldCanvas')).toBeVisible();await page.screenshot({path:directory+'/mobile.png'});
 assert.equal(await mobile.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true);report.checks.push('mobile-world-without-horizontal-overflow');
 assert.deepEqual(errors,[]);report.status='PASS';console.log(JSON.stringify(report,null,2));
}catch(error){report.status='FAIL';report.error=error.stack;await page?.screenshot({path:directory+'/failure.png',fullPage:true});throw error;}
finally{await writeFile(directory+'/report.json',JSON.stringify(report,null,2));f.server.closeAllConnections();await f.close();await context?.close();await browser?.close();}
