import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {inspectCleanup,applyCleanup} from './lib/lesson-cleanup.mjs';

const {values}=parseArgs({options:{database:{type:'string'},class:{type:'string'},keep:{type:'string',multiple:true},plan:{type:'string'},apply:{type:'boolean'},backup:{type:'string'}}});
if(!values.database||!values.plan)throw Error('Usage : node scripts/clean-local-lessons.mjs --database fichier.sqlite --plan plan.json --class A1 --keep versionId [--keep versionId] ; puis --apply --backup sauvegarde.sqlite');
if(process.env.NODE_ENV==='production'||process.env.VERCEL)throw Error('Nettoyage réservé à une base SQLite locale.');
const source=resolve(values.database),path=resolve(values.plan);
if(source===path)throw Error('Le plan doit être distinct de la base.');
if(values.apply){
 const plan=JSON.parse(await readFile(path,'utf8'));
 if(plan.source!==source)throw Error('Le plan appartient à une autre base.');
 if(!values.backup)throw Error('--backup requis.');
 const backupPath=resolve(values.backup);await mkdir(dirname(backupPath),{recursive:true});
 console.log(JSON.stringify(applyCleanup(source,plan,{backupPath}),null,2));
}else{
 const plan={source,...inspectCleanup(source,{classId:values.class,keepVersions:values.keep})};
 await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(plan,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({status:'preview',source,keep:plan.keep,counts:plan.counts,plan:path},null,2));
}
