import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {arcadeFixture} from '../tests/fixtures/arcade.mjs';
import {catalog,explorationForMission} from '../server/game.mjs';
import {solutions,walkTo} from '../tests/fixtures/exploration.mjs';

process.env.EDEN_WORLD_ARCADE='1';
const fixture=await arcadeFixture(),directory=process.env.EXPLORATION_REPORT_DIRECTORY||'test-results/exploration';await mkdir(directory,{recursive:true});
const report={scope:'Real app, disposable database, browser keyboard traversal; no production changes',games:[],checks:[]},errors=[];
let browser,context,page;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 context=await browser.newContext({viewport:{width:1440,height:1050}});
 await context.request.post(fixture.base+'/api/login',{data:{role:'student',classId:'A1',username:'student-a',password:fixture.password}});
 await context.request.put(fixture.base+'/api/arcade/profile',{data:{handle:'Exploration test',avatarId:'04',visibility:'private'}});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER:',msg.text().slice(0,400));});
 page.on('response',async response=>{if(response.status()>=400&&response.url().includes('/api/'))console.log('API:',response.status(),response.url(),await response.text());});
 const all=(await fixture.store.list('game_missions','A1'));
 const ordered=['code-station','assault','bunker','rocket','infiltration'].flatMap(world=>catalog[world].missions.map(m=>all.find(x=>x.world===world&&x.localId===m.id)));
 for(const m of ordered){
  if(process.env.EXPLORATION_FILTER&&!`${m.world}/${m.localId}`.includes(process.env.EXPLORATION_FILTER))continue;
  const def=explorationForMission(m),entry={world:m.world,mission:m.localId,name:m.title,map:def.map.id,engine:'StationRenderer / Expedition',objective:def.title,victory:def.steps.at(-1).objective,status:'NOT RUN'};report.games.push(entry);
  const version=await fixture.store.get('lesson_versions','arcade-lesson:v1');await fixture.store.put('lesson_versions',{...version,spec:{...version.spec,codeStation:{missionId:m.id,worldId:m.world}}});
  await fixture.store.remove('player_progression',`student-a:${m.world}`);
  await page.goto(fixture.base+'/arcade#arcade');await page.reload();await expect(page.locator('.cabinet-keys').first()).toHaveText(m.title);await page.locator('[data-game="code-station"]').click();
  let frame=page.frames().find(f=>f.url().includes('/game/index.html'));if(!frame){await page.frameLocator('.game-frame').locator('#startMission').waitFor();frame=page.frames().find(f=>f.url().includes('/game/index.html'));}
  await frame.locator('#startMission').click();await expect(frame.locator('#app')).toHaveAttribute('data-stage','relay');
  if(m.localId==='battery'||m.world==='assault')await page.screenshot({path:`${directory}/${m.world}-${m.localId}-world.png`});
  await frame.locator('#worldCanvas').press('e');await expect(frame.locator('#terminal')).not.toBeVisible();
  await walkTo(frame,def,def.map.objects.find(o=>o.id==='relay').nav);
  await frame.locator('#worldCanvas').press('e');await expect(frame.locator('#app')).toHaveAttribute('data-stage','repair');
  await walkTo(frame,def,def.map.objects.find(o=>o.id==='workstation').nav,['access']);
  await frame.locator('#worldCanvas').press('e');await expect(frame.locator('#missionCode')).toBeVisible();
  const position=await frame.locator('#worldCanvas').getAttribute('data-x');await frame.locator('#missionCode').press('ArrowRight');assert.equal(await frame.locator('#worldCanvas').getAttribute('data-x'),position);
  const original=await frame.locator('#missionCode').inputValue();
  await frame.locator('#missionCode').fill(m.validator==='card'?'<p>Incomplet</p>':m.files['commande.txt']||m.files['answer.txt']?'incorrect':'console.log("OK"); return null;');
  await frame.locator('#validateMission').click();await expect(frame.locator('#validateMission')).toBeEnabled();await expect(frame.locator('#app')).toHaveAttribute('data-stage','repair');
  await frame.locator('#missionCode').fill(original);
  if(m.localId==='battery'){
   await frame.locator('#missionCode').fill('while(true) {}');await frame.locator('#runCode').click();await expect(frame.locator('#missionResult')).toContainText('Temps maximal dépassé');
   await frame.locator('#missionCode').fill('for(let i=0;i<1000;i++) console.log(i);return 80;');await frame.locator('#runCode').click();await expect(frame.locator('#missionResult')).toContainText('Trop de messages');
   report.checks.push('infinite-loop-terminated','logs-bounded','editor-keyboard-does-not-move-player');
  }
  for(const [file,code] of Object.entries(solutions[m.validator]||m.files)){
   if(await frame.locator(`[data-file="${file}"]`).count())await frame.locator(`[data-file="${file}"]`).click();await frame.locator('#missionCode').fill(code);
  }
  await frame.locator('#runCode').click();await expect(frame.locator('#runCode')).toBeEnabled();await expect(frame.locator('#app')).toHaveAttribute('data-stage','repair');
  if(m.localId==='battery')await expect(frame.locator('#codeConsole')).toContainText('Réserve 80');
  if(m.localId==='battery'||m.world==='assault')await page.screenshot({path:`${directory}/${m.world}-${m.localId}-terminal.png`});
  await frame.locator('#validateMission').click();await expect(frame.locator('#app')).toHaveAttribute('data-stage','finish',{timeout:10000});
  await frame.locator('#validateMission').click();await expect(frame.locator('#validateMission')).toBeEnabled();
  await frame.locator('#closeTerminal').click();await expect(frame.locator('#terminal')).not.toBeVisible();await page.waitForTimeout(100);await expect(frame.locator('#terminal')).not.toBeVisible();
  if(m.localId==='battery'||m.world==='assault')await page.screenshot({path:`${directory}/${m.world}-${m.localId}-restored.png`});
  if(m.localId==='assault-final'){
   await expect(page.locator('#game-save')).toHaveText('Partie enregistrée.');const url=page.url();await page.reload();await page.frameLocator('.game-frame').locator('#worldCanvas').waitFor();frame=page.frames().find(f=>f.url().includes('/game/index.html'));await expect(frame.locator('#app')).toHaveAttribute('data-stage','finish');assert.equal(page.url(),url);report.checks.push('direct-link-and-refresh-restore-mission-and-open-doors');
  }
  await walkTo(frame,def,def.map.objects.find(o=>o.id==='exit').nav,def.map.doors.map(d=>d.id));await frame.locator('#worldCanvas').press('e');await expect(frame.locator('#app')).toHaveAttribute('data-stage','won');await expect(frame.locator('#briefTitle')).toHaveText('Mission accomplie');
  await expect(page.locator('#game-save')).toHaveText('Partie enregistrée.');
  const events=(await fixture.store.list('game_events','A1')).filter(e=>e.payload?.mission===m.id&&e.type==='mission_completed');assert.equal(events.length,1);
  entry.status='PASS';console.log('PASS',m.world,m.localId);await frame.locator('#finishMission').click();await expect(page.locator('.game-frame')).toHaveCount(0);
 }
 assert.deepEqual(errors,[]);report.status='PASS';report.checks.push(...process.env.EXPLORATION_FILTER?['selected-variants-open-from-cabinet','selected-variants-walked-to-victory']:['all-worlds-open-from-cabinet','all-variants-walked-to-victory'],'failure-does-not-unlock','run-is-not-validation','repeated-validation-is-idempotent','no-automatic-reopen','no-browser-errors');
}catch(error){report.status='FAIL';report.error=error.stack;if(report.games.at(-1))report.games.at(-1).status='FAIL';await page?.screenshot({path:directory+'/failure.png',fullPage:true});throw error;}
finally{await writeFile(directory+'/report.json',JSON.stringify(report,null,2));fixture.server.closeAllConnections();await fixture.close();await context?.close();await browser?.close();}
