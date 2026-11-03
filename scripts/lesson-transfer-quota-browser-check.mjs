import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {transferFixture} from '../tests/fixtures/lesson-transfer.mjs';
import {createApp} from '../server/app.mjs';
import {beginUpload,exportLessons,readTransfer} from '../server/lesson-transfer.mjs';
const f=await transferFixture();
let browser,server;
try{
 const e=await exportLessons(f.store,[f.lesson.id],f.actor),{bytes}=await readTransfer(f.store,e.id,f.actor);
 for(let i=1;i<10;i++)await beginUpload(f.store,{bytes:1,sha256:'a'.repeat(64)},f.actor);
 server=createApp(f.store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port,chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 browser=await chromium.launch({headless:true,...existsSync(chrome)?{executablePath:chrome}:{}});
 const context=await browser.newContext(),page=await context.newPage();
 await context.request.post(base+'/api/login',{data:{role:'teacher',username:'professeur',password:'quality-preview-only'}});
 await page.goto(base);await page.locator('.nav [data-id="lessons"]').click();
 await page.getByRole('button',{name:'Importer des séances',exact:true}).click();
 await page.getByRole('button',{name:'Mes transferts',exact:true}).click();
 await expect(page.getByRole('button',{name:'Fermer ce transfert',exact:true})).toHaveCount(10);
 await page.getByRole('button',{name:'Fermer ce transfert',exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Fermer ce transfert',exact:true})).toHaveCount(9);
 assert.equal((await f.store.list('lesson_transfers')).length,9);
 await page.getByRole('button',{name:'Importer un fichier',exact:true}).click();
 await page.locator('#lesson-package-file').setInputFiles({name:'quota.tweenteach.zip',mimeType:'application/zip',buffer:bytes});
 await page.getByRole('button',{name:'Analyser le fichier',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Vérifier les séances à importer'})).toBeVisible();
 assert.equal((await f.store.list('lesson_transfers')).length,10);
 await page.getByRole('button',{name:'Annuler ce transfert',exact:true}).click();
 await expect(page.getByRole('button',{name:'Fermer ce transfert',exact:true})).toHaveCount(9);
 console.log('PASS: 10 transferts → clôture → nouvel import → annulation');
}finally{
 await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await f.store.close();
}
