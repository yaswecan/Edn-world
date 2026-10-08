import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {arcadeFixture} from '../tests/fixtures/arcade.mjs';
import {enterAssignedTerminal} from '../tests/fixtures/exploration.mjs';
process.env.EDEN_WORLD_ARCADE='1';const f=await arcadeFixture(),directory='test-results/exploration/input';await mkdir(directory,{recursive:true});
let browser,page;const checks=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const context=await browser.newContext({viewport:{width:1440,height:1050}});
 await context.request.post(f.base+'/api/login',{data:{username:'student-a',role:'student',classId:'A1',password:f.password}});await context.request.put(f.base+'/api/arcade/profile',{data:{handle:'Input test',avatarId:'04',visibility:'private'}});
 page=await context.newPage();await page.goto(f.base+'/arcade#arcade');await page.locator('[data-game="code-station"]').click();await page.frameLocator('.game-frame').locator('#startMission').click();
 const frame=page.frames().find(f=>f.url().includes('/game/index.html')),canvas=frame.locator('#worldCanvas');
 await canvas.focus();await page.keyboard.down('ArrowUp');await page.waitForTimeout(800);await page.keyboard.up('ArrowUp');const wall=Number(await canvas.getAttribute('data-y'));assert.ok(wall>=478&&wall<500,'solid hall wall');checks.push('keyboard-collides-with-hall-wall');
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(150);await frame.evaluate(()=>dispatchEvent(new Event('blur')));const x=await canvas.getAttribute('data-x');await page.waitForTimeout(220);assert.equal(await canvas.getAttribute('data-x'),x);await page.keyboard.up('ArrowRight');checks.push('blur-clears-held-keys');
 await enterAssignedTerminal(page,f.mission);const original=await frame.locator('#missionCode').inputValue();
 await frame.locator('#missionCode').fill('self.postMessage({type:"result",value:80});return 80;');await frame.locator('#validateMission').click();await expect(frame.locator('#missionResult')).toContainText('Cette action');await expect(frame.locator('#app')).toHaveAttribute('data-stage','repair');checks.push('student-worker-cannot-forge-world-validation');
 await frame.locator('#missionCode').fill('while(true){}');await frame.locator('#validateMission').click();await frame.locator('#closeTerminal').click();await page.waitForTimeout(1700);await expect(frame.locator('#app')).toHaveAttribute('data-stage','repair');await expect(frame.locator('#terminal')).not.toBeVisible();checks.push('late-worker-result-cancelled-on-close');
 await canvas.press('e');await expect(frame.locator('#missionCode')).toBeVisible();await frame.locator('#missionCode').fill('while(true){}');await frame.locator('#validateMission').click();await frame.locator('#missionCode').fill('return 80;');await page.waitForTimeout(1700);await expect(frame.locator('#app')).toHaveAttribute('data-stage','repair');await expect(frame.locator('#validateMission')).toBeEnabled();checks.push('editing-invalidates-inflight-validation');
 await frame.locator('#missionCode').fill(original+'\n// latest unsaved edit');await page.getByRole('button',{name:'Quitter le jeu',exact:true}).click();await expect(page.locator('.game-frame')).toHaveCount(0);await page.locator('[data-game="code-station"]').click();const resumed=await enterAssignedTerminal(page,f.mission);await expect(resumed.locator('#missionCode')).toHaveValue(original+'\n// latest unsaved edit');checks.push('outer-close-flushes-latest-edit-and-removes-frame');
 console.log(JSON.stringify({status:'PASS',checks},null,2));await writeFile(directory+'/report.json',JSON.stringify({status:'PASS',checks},null,2));
}catch(error){await page?.screenshot({path:directory+'/failure.png'});await writeFile(directory+'/report.json',JSON.stringify({status:'FAIL',checks,error:error.stack},null,2));throw error;}
finally{await browser?.close();f.server.closeAllConnections();await f.close();}
