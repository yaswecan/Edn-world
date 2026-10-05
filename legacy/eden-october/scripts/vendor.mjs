import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('docs/vendor',{recursive:true});
try {
 await copyFile('node_modules/acorn/dist/acorn.mjs','docs/vendor/acorn.mjs');
 await copyFile('node_modules/acorn/LICENSE','docs/vendor/acorn-LICENSE.txt');
 console.log('Analyseur installé copié avec sa licence.');
} catch(e) {
 if(e.code!=='ENOENT')throw e;
 const data=await readFile('docs/vendor/acorn.mjs');
 if(createHash('sha256').update(data).digest('hex')!=='b4c8c70200e72bae33cf1085e0ecb1e792c1b6924ed50cab817caf14f51bb249')throw Error('Analyseur embarqué invalide : lancer npm ci.');
 console.log('Analyseur embarqué vérifié (mode local hors ligne). npm ci reste requis sur Vercel pour Neon.');
}
