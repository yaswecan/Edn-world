import {chromium} from '@playwright/test';
import {arcadeFixture} from '../tests/fixtures/arcade.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
process.env.EDEN_WORLD_ARCADE='1';
const f=await arcadeFixture();
const b=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={};
try{
 const p=await b.newPage({viewport:{width:1440,height:1000}});await mkdir('test-results/exploration/before',{recursive:true});
 await p.goto(pathToFileURL(resolve('legacy/pedagolab/public/legacy/code-station-v6.html')).href);
 const salt=randomBytes(8).toString('hex'),pin='audit-only';
 await p.evaluate(({salt,pinHash})=>localStorage.setItem('pedagolab:code-station:accounts:v1',JSON.stringify({version:1,students:[{id:'audit',username:'audit',displayName:'Audit local',salt,pinHash}]})),{salt,pinHash:createHash('sha256').update(salt+'|'+pin).digest('hex')});
 await p.locator('#student-user').fill('audit');await p.locator('#student-pin').fill(pin);await p.locator('#student-login button').click();
 await p.waitForFunction(()=>!!globalThis.CS?.game);
 const before=await p.evaluate(()=>({...CS.game.player}));await p.locator('#game').focus();await p.keyboard.down('ArrowRight');await p.waitForTimeout(500);await p.keyboard.up('ArrowRight');
 report.reference=await p.evaluate(()=>({text:document.body.innerText.slice(-1400),game:!!globalThis.CS?.game,player:globalThis.CS?.game?.player}));
 report.reference.movement=report.reference.player.x-before.x;
 await p.evaluate(()=>CS.game.navigate('battery'));
 await p.waitForFunction(()=>CS.game.near==='battery',{},{timeout:20000});
 if(await p.evaluate(()=>!CS.game.modal))await p.keyboard.press('e');
 report.reference.terminal=await p.evaluate(()=>({near:CS.game.near,modal:CS.game.modal}));
 await p.screenshot({path:'test-results/exploration/before/reference-terminal.png'});
 await p.keyboard.press('Escape');
 await p.screenshot({path:'test-results/exploration/before/reference.png'});
 const c=await b.newContext();await c.request.post(f.base+'/api/login',{data:{role:'student',classId:'A1',username:'student-a',password:f.password}});await c.request.post(f.base+'/api/arcade/profile/ensure',{data:{}});
 const page=await c.newPage();await page.setViewportSize({width:1440,height:1000});
 for(const name of ['index.html','runtime.js','style.css'])await page.route('**/game/'+name,route=>route.fulfill({body:execFileSync('git',['show','HEAD:public/game/'+name]),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'}));
 for(const world of ['code-station','assault']){
  const m=(await f.store.list('game_missions','A1')).find(m=>m.world===world&&m.localId===(world==='code-station'?'battery':'array'));const v=await f.store.get('lesson_versions','arcade-lesson:v1');await f.store.put('lesson_versions',{...v,spec:{...v.spec,codeStation:{missionId:m.id,worldId:world}}});
  const launch=await c.request.post(f.base+'/api/arcade/launch',{data:{gameId:m.world,missionId:m.id,lessonId:'arcade-lesson'}});
  const run=await launch.json();await page.goto(f.base+'/arcade#jeu/'+encodeURIComponent(run.runId));
  await page.frameLocator('.game-frame').locator('#missionCode').waitFor();
  report[world]=await page.frameLocator('.game-frame').locator('body').innerText();await page.screenshot({path:`test-results/exploration/before/${world}.png`});
 }
 await writeFile('test-results/exploration/before/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await b.close();f.server.closeAllConnections();await f.close();}
