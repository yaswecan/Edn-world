import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function step(page,id){
 const nav=page.locator('.lesson-mobile-nav');if(await nav.isVisible())await nav.evaluate(el=>el.open=true);
 await page.locator(`[data-action="demo-step"][data-id="${id}"]:visible`).click();
 await page.evaluate(()=>window.scrollTo(0,0));
}
test('all lesson phases have stable desktop and mobile rendering',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/lesson-demo.html');await expect(page.getByRole('heading',{name:'Deux règles. Une décision.'})).toBeVisible();
 for(const [i,name] of ['hero','diagnostic','concept','observation','guided','autonomy','extension','summary'].entries()){
  if(i)await step(page,i);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: no page overflow`).toBe(true);
  await expect(page).toHaveScreenshot(`lesson-${name}.png`,{fullPage:true});
 }
 expect(errors).toEqual([]);
});
test('answers persist between steps, hints work by keyboard, progress reflects completion',async({page})=>{
 await page.goto('/lesson-demo.html');await page.locator('.lesson-stage').waitFor();
 await step(page,4);const radio=page.getByRole('radio').nth(1);await radio.check();
 await page.locator('[data-answer="guided-code"]').fill('function peutEntrer(a, b) { return a && b; }');
 const hint=page.locator('.lesson-hint summary');await hint.focus();await page.keyboard.press('Enter');await expect(page.locator('.lesson-hint')).toHaveAttribute('open','');
 await step(page,5);await step(page,4);await expect(page.getByRole('radio').nth(1)).toBeChecked();
 await expect(page.locator('[data-answer="guided-code"]')).toHaveValue('function peutEntrer(a, b) { return a && b; }');
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
 await page.getByRole('button',{name:'Continuer',exact:true}).click();await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
});
test('key components have visual snapshots and controls have accessible names',async({page})=>{
 await page.goto('/lesson-demo.html');await page.locator('.lesson-stage').waitFor();
 await expect(page.locator('[data-component="ObjectiveCard"]')).toHaveScreenshot('component-objectives.png');
 await step(page,2);await expect(page.locator('[data-component="BlackboardSchema"]')).toHaveScreenshot('component-blackboard.png');
 await step(page,4);await expect(page.locator('[data-component="QuizBlock"]')).toHaveScreenshot('component-quiz.png');
 await expect(page.locator('[data-component="FillBlankBlock"]')).toHaveScreenshot('component-fillblank.png');
 const unnamed=await page.locator('.lesson-stage input,.lesson-stage textarea,.lesson-stage select').evaluateAll(nodes=>nodes.filter(n=>!n.labels?.length&&!n.getAttribute('aria-label')).map(n=>n.outerHTML));expect(unnamed).toEqual([]);
});

test('Today uses the production renderer, gates the diagnostic, saves and resumes',async({page})=>{
 const spec=JSON.parse(await readFile('public/demo-lesson.json','utf8'));
 const lesson={id:'demo',versionId:'demo:v1',date:spec.date,status:'published',spec};
 const attempt={id:'demo-attempt',answers:{},submissionId:null},events=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let result={};
  if(path==='/api/session')result={setupRequired:false,user:{id:'demo-student',role:'student',classId:'DEMO',displayName:'Élève démo'}};
  else if(path==='/api/today')result={lesson,attempt,progress:{stepId:'opening',answers:{},completed:[]},events:[]};
  else if(path.endsWith('/start'))result=attempt;
  else if(path.endsWith('/save')){attempt.answers=route.request().postDataJSON().answers;result={receivedAt:'2026-10-04T08:00:00Z'};}
  else if(path.endsWith('/submit')){attempt.submissionId='submitted';result={submissionId:'submitted',sha256:'0123456789abcdef'};}
  else if(path==='/api/events')events.push(route.request().postDataJSON());
  else throw Error(`Unexpected API call ${path}`);
  await route.fulfill({json:result});
 });
 await page.goto('/today');await expect(page.locator('[data-component="LessonHero"]')).toBeVisible();
 await expect(page).toHaveScreenshot('today-hero.png',{fullPage:true});
 await page.getByRole('button',{name:'Continuer',exact:true}).click();
 await expect(page.locator('[data-component="DiagnosticIntro"]')).toBeVisible();
 await page.getByRole('button',{name:'Continuer',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Rends ton travail');
 await page.getByRole('button',{name:'Compris',exact:true}).click();
 await page.locator('[data-answer="demo-diag"]').fill('Non, la réservation manque.');
 await page.getByRole('button',{name:'Enregistrer'}).click();
 await expect(page.locator('#save-status')).toContainText('Travail enregistré.');
 expect(attempt.answers['demo-diag']).toEqual('Non, la réservation manque.');
 await page.getByRole('button',{name:'Rendre mon travail'}).click();await page.getByRole('button',{name:'Confirmer l’envoi'}).click();
 await expect(page.locator('.lesson-receipt')).toBeVisible();
 await page.getByRole('button',{name:'Continuer',exact:true}).click();
 await expect(page.locator('[data-component="BlackboardSchema"]')).toBeVisible();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','2');
 expect(events.filter(e=>e.type==='step_completed').map(e=>e.activityId)).toEqual(['opening','diagnostic']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
  await expect(page).toHaveScreenshot('today-concept.png',{fullPage:true,style:'#toast { visibility: hidden !important; }'});
 // A reopened attempt must not skip the diagnostic using a saved later step.
 attempt.submissionId=null;
 await page.reload();
 await expect(page.locator('[data-component="DiagnosticIntro"]')).toBeVisible();
});

test('Flexbox diagnostic offers working HTML/CSS exercises on desktop and mobile',async({page})=>{
 await page.goto('/lesson-demo.html?lesson=flexbox');
 await page.locator('.lesson-stage').waitFor();await step(page,1);
 await expect(page.locator('[data-component="DiagnosticIntro"]')).toContainText('Note sur 20');
 await expect(page.locator('[data-component="DiagnosticIntro"]')).toContainText('4 exercices');
 await expect(page.locator('.diagnostic-observation').first()).toBeVisible();
 await page.locator('[data-answer="baseline-html"]').fill('<article class="carte"><h1>Mon projet</h1><p>Première version</p><a href="/projet.html">Lire le projet</a></article>');
 await page.locator('[data-action="run-code"][data-id="baseline-html"]').click();
 await expect(page.locator('#console-baseline-html')).toContainText('3 tests réussis sur 3');
 await page.locator('[data-answer="baseline-css"]').fill('.carte { color: blue; width: 100%; } .carte a { color: green; }');
 await page.locator('[data-action="run-code"][data-id="baseline-css"]').click();
 await expect(page.locator('#console-baseline-css')).toContainText('3 tests réussis sur 3');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/diagnostic-flexbox-${test.info().project.name}.png`,fullPage:true});
});
