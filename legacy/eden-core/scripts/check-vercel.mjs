import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {MIGRATIONS} from '../server/schema.mjs';
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const config=await read('vercel.json'),pkg=await read('package.json'),lock=await read('package-lock.json');
const errors=[];
if(config.outputDirectory!=='docs'||config.framework!==null)errors.push('Sortie Vercel invalide.');
if(pkg.engines.node!=='22.x')errors.push('Node 22.x attendu.');
if(JSON.stringify(pkg.dependencies)!==JSON.stringify(lock.packages[''].dependencies))errors.push('Lockfile désynchronisé.');
if(config.installCommand!=='npm ci')errors.push('Installation reproductible attendue.');
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return(await Promise.all(entries.map(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]))).flat();}
const files=[...await walk('server'),...await walk('api'),...await walk('scripts')];
for(const f of files.filter(f=>/\.m?js$/.test(f))){
 try{execFileSync(process.execPath,['--check',f],{stdio:'pipe'});}catch{errors.push(`Syntaxe : ${f}`);}
 const text=await readFile(f,'utf8');
 if(f.startsWith('api/')){
  if(!text.includes('export default'))errors.push(`Handler manquant : ${f}`);
  const imp=text.match(/from '([^']+)'/);if(imp)try{await stat(new URL(imp[1],new URL(f,`file://${process.cwd()}/`)));}catch{errors.push(`Import API cassé : ${f}`);}
 }
 if(f.startsWith('server/')&&(/node:sqlite|\.listen\(|setInterval\(/.test(text)))errors.push(`Dépendance non serverless : ${f}`);
}
const sql=await readFile('database/schema.sql','utf8');
for(const query of MIGRATIONS)if(!sql.includes(query+';'))errors.push('SQL Editor et migration JS non synchronisés.');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`OK Vercel : ${files.filter(f=>f.startsWith('api/')).length} handlers, Node 22, migration SQL et lockfile cohérents. Aucun secret généré au build.`);
