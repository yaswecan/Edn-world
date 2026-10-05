import {readFile,readdir,stat} from 'node:fs/promises';
import {dirname,resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LESSON,STEPS,BLOCKS} from '../docs/app/content.js';
const root=fileURLToPath(new URL('../',import.meta.url)),errors=[];
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const f=resolve(dir,e.name);if(e.isDirectory())out.push(...await walk(f));else out.push(f);}return out;}
const files=await walk(resolve(root,'docs'));
for(const f of files){const ext=extname(f);if(/\.(ttf|otf|woff2?)$/.test(f))errors.push('Aucun fichier de police ne doit être distribué.');if(!['.html','.js','.css'].includes(ext))continue;const text=await readFile(f,'utf8');
 if(ext==='.js'){try{execFileSync(process.execPath,['--check',f]);}catch{errors.push('Syntaxe invalide : '+f);}}
 let links=[];if(ext==='.html')links=[...text.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]);
 if(ext==='.js')links.push(...[...text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)].map(m=>m[1]));
 for(const ref of links){if(/^(https?:|data:|#|mailto:)/.test(ref)||ref.includes('${'))continue;const clean=ref.split(/[?#]/)[0];if(!clean)continue;const target=resolve(ref.startsWith('/')?resolve(root,'docs'):dirname(f),ref.startsWith('/')?'.'+clean:clean);try{await stat(target);}catch{errors.push(`Lien manquant : ${f.replace(root,'')} → ${ref}`);}}
}
const practice=STEPS.filter(s=>s.block==='diagnostic'&&s.kind==='function-code');
if(practice.length!==4||practice.reduce((n,s)=>n+s.minutes,0)+2!==20||STEPS.some(s=>s.block==='diagnostic'&&s.kind==='quiz'))errors.push('Diagnostic V6 : quatre programmes à écrire en 18 min + remise 2 min.');
if(new Set(STEPS.map(s=>s.id)).size!==STEPS.length)errors.push('Identifiants étapes dupliqués.');
if(LESSON.date!=='2026-10-01')errors.push('Date incohérente.');
if(BLOCKS.reduce((a,b)=>a+b.minutes,0)!==175)errors.push('Le planning proposé doit totaliser 175 min.');
if(STEPS[0].block!=='diagnostic'||!STEPS.at(-1).optional)errors.push('Diagnostic premier et bonus dernier obligatoires.');
for(const s of STEPS){if(s.diagram)try{await stat(resolve(root,`docs/assets/schemas/${s.diagram}.svg`));}catch{errors.push('Schéma manquant : '+s.diagram);}if(!s.diagnostic&&s.questions?.some(q=>!q.choices.includes(q.answer)))errors.push('QCM incohérent : '+s.id);}
for(const file of ['presentation.pptx','presentation.pdf','trame-professeur.pdf','memo-professeur.pdf','carnet-eleve.pdf','fiche-recap.pdf'])try{await stat(resolve(root,'docs/resources',file));}catch{errors.push('Support manquant : '+file);}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`OK : ${files.length} fichiers publics, ${STEPS.length} écrans, ${LESSON.slides.length} diapositives, planning proposé 175 min, liens et syntaxe vérifiés.`);
