import express from 'express';
import {mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderLessonPage} from '../../public/lesson-renderer.js';
import {studentSpec} from '../generator.mjs';
import {candidateHash} from './quality.mjs';

// A separate local origin, no account cookies, no database, no API routes.
// User HTML remains in the existing opaque, script-free workshop iframe.
export async function inspectCandidate(spec,job,{directory=process.env.EDEN_QUALITY_EVIDENCE_PATH||'.data/quality-evidence'}={}){
 if(process.env.VERCEL)return {status:'NOT RUN',evidence:'Inspection navigateur requiert le worker local dédié.'};
 let browser,server;
 try{
  const {chromium}=await import('@playwright/test');
  const options={headless:true},chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)options.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;else if(existsSync(chrome))options.executablePath=chrome;
  browser=await chromium.launch(options);const app=express(),safe=studentSpec(spec);
  app.get('/candidate',(req,res)=>{const i=Number(req.query.block)||0;res.type('html').send(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette de séance</title><link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/lesson.css"><link rel="stylesheet" href="/workshops.css"><body>${renderLessonPage(safe,i,{demo:true})}</body></html>`);});
  app.use(express.static(resolve('public')));server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
  const hash=candidateHash(spec,job.sources),destination=resolve(directory,hash);await mkdir(destination,{recursive:true});const errors=[],captures=[];
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1280,390]){await page.setViewportSize({width,height:900});for(let i=0;i<spec.blocks.length;i++){
   await page.goto(`http://127.0.0.1:${server.address().port}/candidate?block=${i}`);await page.locator('.lesson-stage').waitFor();await page.evaluate(()=>document.fonts.ready);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))errors.push(`Débordement à ${width}px : ${spec.blocks[i].id}`);
   const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).length);if(broken)errors.push(`Image manquante : ${spec.blocks[i].id}`);
   const file=`${i}-${width}.png`;await page.screenshot({path:resolve(destination,file),fullPage:true});captures.push(file);
  }}
  return {status:errors.length?'FAIL':'PASS',evidence:JSON.stringify({hash,scope:'Rendu Chrome à 1280 et 390 px : blocs, images et débordements. Inspection pédagogique humaine des captures distincte.',captures,directory:destination,errors})};
 }catch(error){return {status:'NOT RUN',evidence:`Navigateur indisponible : ${error.message}`};}
 finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
}
