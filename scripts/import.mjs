import {readFile,readdir} from 'node:fs/promises';
import {openStore} from '../server/store.mjs';
import {previewImport,applyImport} from '../server/importer.mjs';
const filename=process.argv.slice(2).find(a=>!a.startsWith('--'))||(await readdir('.')).find(n=>n.startsWith('Planification_A1_')&&n.endsWith('.xlsx'));
if(!filename)throw Error('Usage : npm run import -- fichier.xlsx [--apply]');
const store=await openStore(),actor={id:'cli-import',classId:'A1'},report=await previewImport(store,await readFile(filename),actor);
console.log(JSON.stringify({id:report.id,status:report.status,sha256:report.sha256,diff:report.diff,warnings:report.warnings,conflicts:report.conflicts},null,2));
if(process.argv.includes('--apply')){await applyImport(store,report.id,actor,{confirmed:true});console.log('Planification importée et versionnée.');}else console.log('Prévisualisation uniquement. Ajouter --apply pour appliquer.');
await store.close();
