import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
// Evaluate only the trusted, archived object literal during migration, never learner input.
const source=readFileSync('legacy/pedagolab/public/app.js','utf8');
const start=source.indexOf('const WORLDS=')+'const WORLDS='.length;
const end=source.indexOf('\nfunction defaultPlatform',start);
const literal=source.slice(start,end).trim().replace(/;\s*$/,'');
const worlds=vm.runInNewContext(`(${literal})`,Object.create(null),{timeout:1000});
writeFileSync('data/game-catalog.json',JSON.stringify(worlds,null,2));
console.log(`${Object.keys(worlds).length} worlds / ${Object.values(worlds).reduce((s,w)=>s+w.missions.length,0)} preserved missions`);
