import {build} from 'esbuild';
await build({entryPoints:['editor/lesson-editor-entry.js'],outfile:'public/lesson-editor.bundle.js',bundle:true,format:'esm',target:['es2022'],minify:true,legalComments:'linked'});
console.log('Éditeur professeur compilé.');
