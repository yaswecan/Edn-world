import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {CHAPTERS,STEPS,SCHEMAS} from '../docs/app/content.js';
import {minutes} from '../docs/app/model.js';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
async function all(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?all(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat();}
const files=await all(root),errors=[];let links=0,imports=0;
for(const f of files){
 if(f.endsWith('.js')){
  const text=await readFile(f,'utf8');
  for(const [,url]of text.matchAll(/^import\s+.*?from\s+['"]([^'"]+)['"]/gm)){
   if(!url.startsWith('.'))continue;imports++;try{await stat(resolve(f,'..',url));}catch{errors.push(`Import introuvable : ${f} → ${url}`);}
  }
  try{execFileSync(process.execPath,['--check',f],{stdio:'pipe'});}catch(err){errors.push(`${f}: ${err.stderr}`);}}
 if(/\.(ttf|otf|woff2?)$/.test(f))errors.push(`Fichier de police non autorisé dans le livrable : ${f}`);
 if(f.endsWith('.html')){
  const text=await readFile(f,'utf8');
  for(const [,url] of text.matchAll(/(?:src|href)="([^"#]+)"/g)){
   if(/^(https?:|data:|mailto:)/.test(url)||url.includes('${'))continue;
   const path=resolve(f,'..',url.split(/[?#]/)[0]);links++;
   try{await stat(path);}catch{errors.push(`Lien manquant : ${f} → ${url}`);}
  }
 }
}
if(new Set(STEPS.map(s=>s.id)).size!==STEPS.length)errors.push('Identifiants d’étapes dupliqués.');
for(const s of STEPS)if(!CHAPTERS.some(c=>c.id===s.chapter))errors.push('Chapitre inconnu : '+s.id);
for(const sc of SCHEMAS)try{await stat(resolve(root,`assets/schemas/${sc.id}.webp`));}catch{errors.push('Schéma manquant : '+sc.id);}
for(let i=1;i<CHAPTERS.length;i++)if(CHAPTERS[i-1].end!==CHAPTERS[i].start)errors.push('Discontinuité horaire : '+CHAPTERS[i].id);
const duration=CHAPTERS.reduce((n,c)=>n+minutes(c.end)-minutes(c.start),0);
if(duration!==175)errors.push('Le planning ne couvre pas exactement 175 minutes.');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`OK : ${files.length} fichiers publics, ${STEPS.length} écrans, ${SCHEMAS.length} schémas, ${links} liens HTML, ${imports} imports locaux, planning 175 min (pause 15 min incluse).`);
