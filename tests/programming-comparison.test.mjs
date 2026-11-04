import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {decodePackage,encodePackage} from '../server/lesson-package.mjs';
import {sha256} from '../server/content-snapshots.mjs';

const bytes=await readFile(new URL('./fixtures/programming/tableaux-source.zip',import.meta.url));
const original=await JSZip.loadAsync(bytes);
const manifestPath=Object.keys(original.files).find(path=>path.endsWith('00_MANIFEST/manifest.json'));
const prefix=manifestPath.slice(0,-'00_MANIFEST/manifest.json'.length);
const scriptPath='01_ELEVE/assets/lesson.js';
const script=await original.file(prefix+scriptPath).async('string');
const start=script.indexOf('function wireComparison');
const end=script.indexOf('function download',start);
const comparisonSource=script.slice(start,end);
assert.ok(start>=0&&end>start);
const baseline=(await decodePackage(bytes)).lessons[0].payload.spec.programming.comparisons;
const comparisonMutation=change=>script.slice(0,start)+change(comparisonSource)+script.slice(end);

async function archiveWith(changes,{refreshManifest=true}={}){
 const archive=await JSZip.loadAsync(bytes);
 const manifest=JSON.parse(await archive.file(manifestPath).async('string'));
 for(const [path,text] of Object.entries(changes)){
  const content=Buffer.from(text);archive.file(prefix+path,content);
  if(refreshManifest){const item=manifest.files.find(item=>item.path===path);assert.ok(item,path);item.bytes=content.length;item.sha256=sha256(content);}
 }
 archive.file(manifestPath,JSON.stringify(manifest));
 return archive.generateAsync({type:'nodebuffer'});
}
const imported=async text=>(await decodePackage(await archiveWith({[scriptPath]:text}))).lessons[0].payload.spec.programming.comparisons;
const comparisonFailure=error=>error.status===422&&error.details?.file===scriptPath&&error.details?.pointer==='/comparison';

test('unrelated UI changes and CRLF do not reject an unchanged literal comparison',async()=>{
 const variants=[
  script.replace('Enregistré sur cet appareil','Travail enregistré sur cet appareil')+'\n// Interface révisée, données pédagogiques inchangées.\n',
  script.replace(/\r?\n/g,'\r\n'),
  script+'\nexport default function () {}\n',
  comparisonMutation(source=>source.replace('const programs={','const /* données du comparatif */ programs = {\n').replace("invoke:'compter',args:","invoke: 'compter', /* exemples */ args: "))
 ];
 for(const variant of variants){assert.notEqual(sha256(variant),sha256(script));assert.deepEqual(await imported(variant),baseline);}
});

test('changed literal comparison code, invocation and arguments are preserved and roundtrip',async()=>{
 const changed=comparisonMutation(source=>source.replaceAll('function compter(', 'function compterAutrement(').replace("invoke:'compter'","invoke:'compterAutrement'").replace('args:[[35,80,20,65],50]','args:[[0,99,50],40]').replace('nombre++;','nombre += 2;'));
 const pack=await decodePackage(await archiveWith({[scriptPath]:changed}));
 const comparison=pack.lessons[0].payload.spec.programming.comparisons[0];
 assert.equal(comparison.invoke,'compterAutrement');assert.deepEqual(comparison.args,[[0,99,50],40]);
 assert.ok(comparison.programs.every(program=>program.code.startsWith('function compterAutrement(')));
 assert.ok(comparison.programs[0].code.includes('nombre += 2;'));
 const roundtrip=await decodePackage((await encodePackage(pack.lessons,pack.files)).bytes);
 assert.deepEqual(roundtrip.lessons[0].payload.spec.programming.comparisons,[comparison]);
});

test('source scripts are never executed while extracting comparison data',async()=>{
 const key='__tweenteachComparisonImportExecuted';
 assert.equal(Object.hasOwn(globalThis,key),false);
 try{
  const changed=script+`\nglobalThis.${key} = true; throw new Error('NEVER EXECUTE AN ARCHIVE');\n`;
  assert.deepEqual(await imported(changed),baseline);
  assert.equal(Object.hasOwn(globalThis,key),false);
 }finally{delete globalThis[key];}
});

test('comparison-shaped comments and strings cannot replace an actual declaration',async()=>{
 const renamed=script.replace('function wireComparison','function oldWireComparison');
 for(const decoy of [`\n/* ${comparisonSource} */\n`,`\nconst comparisonDecoy = ${JSON.stringify(comparisonSource)};\n`]){
  await assert.rejects(imported(renamed+decoy),comparisonFailure);
 }
});

test('ambiguous or shadowed comparison declarations are refused',async()=>{
 const duplicateFunction=script+'\n'+comparisonSource;
 const duplicatePrograms=comparisonMutation(source=>source.replace('let selected=',"const programs = {}; let selected="));
 const shadowedPrograms=comparisonMutation(source=>source.replace('const build=()=>{',"const build=()=>{const programs={for:'changed',while:'changed',forEach:'changed'};"));
 for(const variant of [duplicateFunction,duplicatePrograms,shadowedPrograms])await assert.rejects(imported(variant),comparisonFailure);
});

test('dynamic, getter, computed and duplicate comparison values are refused without executing them',async()=>{
 const key='__tweenteachComparisonLiteralExecuted';
 const variants=[
  comparisonMutation(source=>source.replace('args:[[35,80,20,65],50]',`args:(globalThis.${key}=true, [[35,80,20,65],50])`)),
  comparisonMutation(source=>source.replace("invoke:'compter'","invoke:resolveFunction()")),
  comparisonMutation(source=>source.replace("{for:'function","{get for(){throw new Error('not data')},forUnused:'function")),
  comparisonMutation(source=>source.replace("{for:'function","{['for']:'function")),
  comparisonMutation(source=>source.replace("{for:'function","{for:'unexpected',for:'function")),
  comparisonMutation(source=>source.replace('args:[[35,80,20,65],50]','args:[...[35,80,20,65],50]')),
  comparisonMutation(source=>source.replace('let selected=',"Object.assign(programs, {for:'changed'}); let selected=")),
 ];
 assert.equal(Object.hasOwn(globalThis,key),false);
 try{for(const variant of variants)await assert.rejects(imported(variant),comparisonFailure);assert.equal(Object.hasOwn(globalThis,key),false);}finally{delete globalThis[key];}
});

test('manifest checksums remain mandatory for an otherwise recognizable comparison',async()=>{
 const changed=script+'\n// new appearance\n';
 await assert.rejects(decodePackage(await archiveWith({[scriptPath]:changed},{refreshManifest:false})),error=>error.status===422&&error.details?.file==='00_MANIFEST/manifest.json');
});

test('explicit declarative comparisons take precedence over unsupported archived UI code',async()=>{
 const sourceLesson=JSON.parse(await original.file(prefix+'07_SOURCES_EDEN/lesson.json').async('string'));
 const comparisons=structuredClone(baseline);comparisons[0].args=[[1,2,3],2];
 sourceLesson.programming={comparisons};
 const key='__tweenteachExplicitComparisonExecuted';
 try{
  const pack=await decodePackage(await archiveWith({[scriptPath]:`globalThis.${key}=true; throw new Error('never run');`,'07_SOURCES_EDEN/lesson.json':JSON.stringify(sourceLesson)}));
  assert.deepEqual(pack.lessons[0].payload.spec.programming.comparisons,comparisons);
  assert.equal(Object.hasOwn(globalThis,key),false);
 }finally{delete globalThis[key];}
});

test('invalid explicit comparison references are still rejected by the native contract',async()=>{
 const sourceLesson=JSON.parse(await original.file(prefix+'07_SOURCES_EDEN/lesson.json').async('string'));
 const comparisons=structuredClone(baseline);comparisons[0].blockId='missing-block';sourceLesson.programming={comparisons};
 await assert.rejects(decodePackage(await archiveWith({'07_SOURCES_EDEN/lesson.json':JSON.stringify(sourceLesson)})),error=>error.status===422&&/comparison/i.test(error.message));
});

const withProgramLiterals=makeLiteral=>comparisonMutation(source=>{
 const from=source.indexOf('const programs=')+'const programs='.length,to=source.indexOf(';let selected=');
 assert.ok(to>from);
 const literal='{'+baseline[0].programs.map(program=>JSON.stringify(program.id)+':'+makeLiteral(program)).join(',')+'}';
 return source.slice(0,from)+literal+source.slice(to);
});

test('pure template literals are data, while interpolations are never evaluated',async()=>{
 const templateSource=withProgramLiterals(program=>'`'+program.code.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'`');
 assert.deepEqual(await imported(templateSource),baseline);
 const key='__tweenteachTemplateInterpolationExecuted';assert.equal(Object.hasOwn(globalThis,key),false);
 const interpolated=withProgramLiterals(program=>'`'+program.code+'${globalThis.'+key+' = true}`');
 try{await assert.rejects(imported(interpolated),comparisonFailure);assert.equal(Object.hasOwn(globalThis,key),false);}finally{delete globalThis[key];}
});

test('JavaScript literal escapes preserve program strings without evaluation',async()=>{
 const suffix='\n// café 🚀 "quote" \\ slash\tfin';
 const escapedSource=withProgramLiterals(program=>JSON.stringify(program.code+suffix).replace('function','\\x66unction').replace('é','\\u00e9').replace('🚀','\\u{1F680}'));
 const comparison=(await imported(escapedSource))[0];
 for(const program of comparison.programs)assert.equal(program.code,baseline[0].programs.find(original=>original.id===program.id).code+suffix);
 const continued=withProgramLiterals(program=>JSON.stringify(program.code).replace('function','func\\\ntion'));
 assert.deepEqual(await imported(continued),baseline);
 const badEscape=withProgramLiterals(program=>JSON.stringify(program.code).replace('function','func\\1tion'));
 await assert.rejects(imported(badEscape),comparisonFailure);
});

test('explicit null comparisons are invalid rather than falling back to legacy source',async()=>{
 const sourceLesson=JSON.parse(await original.file(prefix+'07_SOURCES_EDEN/lesson.json').async('string'));
 sourceLesson.programming={comparisons:null};
 await assert.rejects(decodePackage(await archiveWith({'07_SOURCES_EDEN/lesson.json':JSON.stringify(sourceLesson)})),error=>error.status===422&&error.details?.file==='07_SOURCES_EDEN/lesson.json'&&error.details?.pointer==='/programming/comparisons');
});

test('empty and differently identified explicit comparisons have no stale presentation references',async()=>{
 const custom=structuredClone(baseline);custom[0].id='compter-autrement';custom[0].programs.forEach(program=>{program.id='custom-'+program.id;});
 for(const comparisons of [[],custom]){
  const sourceLesson=JSON.parse(await original.file(prefix+'07_SOURCES_EDEN/lesson.json').async('string'));sourceLesson.programming={comparisons};
  const pack=await decodePackage(await archiveWith({'07_SOURCES_EDEN/lesson.json':JSON.stringify(sourceLesson),[scriptPath]:'throw new Error("not executed");'}));
  const programming=pack.lessons[0].payload.spec.programming;
  assert.deepEqual(programming.comparisons,comparisons);assert.deepEqual(programming.presentation.comparisons,[]);
  const roundtrip=await decodePackage((await encodePackage(pack.lessons,pack.files)).bytes);
  assert.deepEqual(roundtrip.lessons[0].payload.spec.programming.comparisons,comparisons);
 }
});
