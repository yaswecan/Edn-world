import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {packageProgramming} from '../server/programming/authoring.mjs';
const [input,output,resourceManifest]=process.argv.slice(2);
if(!input||!output)throw Error('Usage : node --import tsx scripts/programming-package.mjs cours.lesson.json sortie.tweenteach.zip [resources.json]');
const spec=JSON.parse(await readFile(input,'utf8')),resources=[];
if(resourceManifest){const base=await realpath(dirname(resolve(resourceManifest)));for(const r of JSON.parse(await readFile(resourceManifest,'utf8'))){const file=await realpath(resolve(base,r.file));if(!file.startsWith(base+sep))throw Error('Ressource hors du dossier auteur.');resources.push({path:r.path,audience:r.audience,mimeType:r.mimeType,bytes:await readFile(file)});}}
const result=await packageProgramming(spec,resources);await writeFile(output,result.bytes);console.log(`Paquet validé : ${output} (${result.bytes.length} octets). Import en brouillon par l’interface professeur.`);
