import {readdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {schemaSQL} from '../server/store.mjs';
import {lessonSchema,diagnosticSchema,intentSchema,contentSchema,activitySchema} from '../server/contracts.mjs';
import {planSchema,planReviewSchema,reviewSchema,unitSchema,documentarySchema,designContractSchema} from '../server/pedagogy/contracts.mjs';
async function walk(path){const entries=await readdir(path,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(`${path}/${e.name}`):`${path}/${e.name}`))).flat();}
for(const file of [...await walk('api'),...await walk('server'),...await walk('public'),...await walk('scripts'),...await walk('tests'),...await walk('labs')].filter(f=>/\.(mjs|js)$/.test(f))){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw Error(file+'\n'+r.stderr);}
for(const [name,schema]of Object.entries({DailyLessonSpec:lessonSchema,DiagnosticSpec:diagnosticSchema,TeacherIntent:intentSchema,LessonContent:contentSchema,LessonContentSpec:contentSchema,ActivitySpec:activitySchema,PedagogicalPlan:planSchema,PedagogicalPlanReview:planReviewSchema,PedagogicalReview:reviewSchema,PedagogicalUnit:unitSchema,DocumentaryAnalysis:documentarySchema,DesignContract:designContractSchema}))await writeFile(`schemas/${name}.json`,JSON.stringify(schema,null,2)+'\n');
await writeFile('database/schema.sql','-- Shared PostgreSQL / SQLite aggregate schema. Executed idempotently by server/store.mjs.\n'+schemaSQL+'\n');
for(const file of ['google-drive.ts','path-utils.mjs']){const original=await readFile(`legacy/drive/lib/${file}`),reused=await readFile(`server/integrations/${file}`);if(!original.equals(reused))throw Error(`Drive primitive changed without migration review: ${file}`);}
console.log('Syntax checks, strict schema exports, database DDL, and Drive primitive preservation passed.');
