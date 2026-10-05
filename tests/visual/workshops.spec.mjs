import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function step(page,id){const nav=page.locator('.lesson-mobile-nav');if(await nav.isVisible())await nav.evaluate(el=>el.open=true);await page.locator(`[data-action="demo-step"][data-id="${id}"]:visible`).click();}

test('generated Flexbox: real code preview and tests, laboratory experiments, drawing and persisted answers',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/lesson-demo.html?lesson=flexbox');await page.locator('.lesson-stage').waitFor();
 await step(page,2);await page.getByRole('button',{name:'Agrandir : Le parent et ses enfants directs',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await step(page,3);await page.locator('[data-lab-setting="direction"]').selectOption('column');await page.locator('[data-lab-run]').click();await expect(page.locator('[data-lab-feedback]')).toContainText('Écris d’abord');
 await page.locator('[data-lab-prediction]').fill('Les cartes vont se placer verticalement.');await page.locator('[data-lab-run]').click();await expect(page.locator('[data-lab-count]')).toContainText('1 essai');await expect(page.locator('.lesson-lab-stage')).toHaveCSS('flex-direction','column');
 await step(page,4);const board=page.locator('.lesson-drawing-surface');await board.scrollIntoViewIfNeeded();const box=await board.boundingBox();await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+100,box.y+65,{steps:8});await page.mouse.up();await page.locator('[data-board-caption]').fill('Parent → enfants ; principal vertical, transversal horizontal.');await expect(page.locator('[data-strokes] path')).toHaveCount(1);
 await step(page,5);const code=page.locator('[data-answer="guided-0"]');await code.fill('.groupe { display: flex; gap: 12px; }');await page.locator('[data-workshop-preview]').click();await expect(page.frameLocator('[data-workshop-frame]').locator('.groupe')).toHaveCSS('display','flex');
 await page.getByRole('button',{name:'Vérifier mon code',exact:true}).click();await expect(page.locator('#console-guided-0')).toContainText('1 test réussi sur 1');
 await code.fill('.groupe { display: block; }');await page.getByRole('button',{name:'Vérifier mon code',exact:true}).click();await expect(page.locator('#console-guided-0')).toContainText('0 test réussi sur 1');
 await page.locator('[data-preview-width]').selectOption('900px');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await step(page,4);await expect(page.locator('[data-board-caption]')).toHaveValue('Parent → enfants ; principal vertical, transversal horizontal.');await expect(page.locator('[data-strokes] path')).toHaveCount(1);
 await page.getByRole('button',{name:'Annuler le trait'}).click();await expect(page.locator('[data-strokes] path')).toHaveCount(0);
 await step(page,3);await expect(page.locator('.lesson-lab-stage')).toHaveCSS('flex-direction','column');await expect(page.locator('[data-lab-prediction]')).toHaveValue('Les cartes vont se placer verticalement.');
 expect(errors).toEqual([]);
});

test('generated workshops remain readable at desktop and mobile sizes',async({page})=>{
 await page.goto('/lesson-demo.html?lesson=flexbox');await page.locator('.lesson-stage').waitFor();
 for(const [id,name] of [[2,'boards'],[3,'laboratory'],[4,'drawing'],[5,'editor'],[9,'production']]){
  await step(page,id);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name).toBe(true);
  if(await page.locator('[data-workshop-frame]').count())await expect(page.frameLocator('[data-workshop-frame]').locator('.groupe,.clubs')).toBeVisible();
  await expect(page.locator('.lesson-stage')).toHaveScreenshot(`workshop-${name}.png`);
 }
});

test('published lesson saves workshop answers and restores them after a submitted diagnostic and reload',async({page})=>{
 const spec=JSON.parse(await readFile('public/demo-flexbox.json','utf8'));
 const lesson={id:'flex-demo',versionId:'flex-demo:v1',status:'published',spec},attempt={id:'attempt',submissionId:'frozen',answers:{}},progress={stepId:'board-0',answers:{},completed:[]};
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let result={};
  if(path==='/api/session')result={setupRequired:false,user:{id:'learner',role:'student',classId:'DEMO',displayName:'Élève démo'}};
  else if(path==='/api/today')result={lesson,attempt,progress,events:[]};
  else if(path.endsWith('/start'))result=attempt;
  else if(path==='/api/events'){const event=route.request().postDataJSON();if(event.type==='answer_saved'){progress.answers[event.activityId]=event.payload.answer;progress.savedAt=new Date().toISOString();}}
  else throw Error('Unexpected route '+path);
  await route.fulfill({json:result});
 });
 await page.goto('/today');await page.locator('[data-board-caption]').fill('Le parent organise ses enfants directs.');
 await expect.poll(()=>JSON.parse(progress.answers['sketch-0']||'{}').caption).toBe('Le parent organise ses enfants directs.');
 await page.reload();await expect(page.locator('[data-board-caption]')).toHaveValue('Le parent organise ses enfants directs.');
 // A refresh before the debounce completes must also retain the last local edit.
 await page.locator('[data-board-caption]').fill('Dernier trait : axe principal vertical.');await page.reload();
 await expect(page.locator('[data-board-caption]')).toHaveValue('Dernier trait : axe principal vertical.');
});
