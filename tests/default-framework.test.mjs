import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {trackingFixture} from './fixtures/student-tracking.mjs';
import {competencyFixture,gridInput} from './fixtures/competency-v2.mjs';
import {validateFramework,digest} from '../server/competency-service.mjs';
import {exportPedagogy,validatePortablePedagogy} from '../server/competency-transfer.mjs';

test('default reference preserves the supplied sheet, exact labels, hierarchy and pedagogical indications',async()=>{
 const f=JSON.parse(await readFile(new URL('../server/data/default-framework-a1.json',import.meta.url),'utf8'));
 assert.deepEqual(validateFramework(f),f);
 assert.equal(f.source.document,'Planification_A1_2026-2027_Yacine_FULL_DejeunersPro.xlsx');
 assert.equal(f.source.location,'02 Référentiel A1');
 assert.equal(f.source.sha256,'f2db14a110b726eb8b75adb20f1f8f8be39973b6aaec83f3e25bd35b54e6a880');
 assert.equal(f.nodes.filter(n=>n.kind==='block').length,48);
 const nodes=f.nodes.filter(n=>n.kind==='competency');assert.equal(nodes.length,105);
 assert.equal(nodes.filter(n=>n.pedagogy.status==='A1 · positionnée').length,101);
 assert.equal(nodes.filter(n=>n.pedagogy.status==='Préfiguration A2').length,4);
 assert.ok(nodes.every(n=>n.expectedLevel===null&&n.criterionSet===null&&n.criteria.length===1&&n.criteria[0].origin==='source'));
 assert.equal(nodes[0].title,"Connaître les grandes étapes de l'histoire de l'informatique ");
 assert.equal(nodes[0].parentId,'BC01-C1');assert.equal(nodes[0].criteria[0].location,'02 Référentiel A1!L5');
 assert.equal(nodes[0].pedagogy.masteryRule,'2 preuves autonomes espacées, dont une en transfert.');
 assert.match(f.source.note,/sans exigence de maîtrise A2/);
});

test('default is installed once per class on teacher access, without importing planning, learners or results',async t=>{
 const f=await trackingFixture();t.after(()=>f.close());
 assert.equal((await f.call('/api/competencies/config',{as:'alice'})).status,403);
 assert.equal((await f.store.list('framework_versions')).length,0);
 const before={};for(const table of ['learners','curriculum_versions','plan_entries','competency_grids','competency_observations','mastery_rules'])before[table]=await f.store.list(table);
 const responses=await Promise.all(Array.from({length:4},()=>f.call('/api/competencies/config')));
 for(const {status,data} of responses){assert.equal(status,200);assert.equal(data.frameworks.length,1);assert.equal(data.defaultFrameworkId,data.frameworks[0].id);}
 const first=responses[0].data.frameworks[0];assert.equal(first.fingerprint,digest(validateFramework(first)));
 assert.equal((await f.store.list('audit_log')).filter(e=>e.action==='framework.default_installed').length,1);
 const other=(await f.call('/api/competencies/config',{as:'outsider'})).data;
 assert.notEqual(other.defaultFrameworkId,first.id);assert.equal(other.frameworks[0].classId,'A2');
 for(const table of Object.keys(before))assert.deepEqual(await f.store.list(table),before[table]);
 assert.deepEqual((await f.call('/api/competencies/mine',{as:'alice'})).data.competencies,[]);
});

test('default coexists with configured grids and retains reference metadata in portable content',async t=>{
 const f=await competencyFixture(t),before=await f.store.get('competency_grids',f.grid.id);
 const {data:config}=await f.call('/api/competencies/config'),reference=config.frameworks[0];
 assert.equal(reference.id,config.defaultFrameworkId);assert.ok(config.frameworks.some(r=>r.id===f.framework.id));
 assert.deepEqual(await f.store.get('competency_grids',f.grid.id),before);
 const input=gridInput(reference.id);input.version=before.version;
 input.competencies=[{...input.competencies[0],competencyId:'BC01-C1-1',criteria:[{...input.competencies[0].criteria[0],criterionId:'observable'}]}];
 await f.ok('/api/competencies/grids',input);
 const portable=await exportPedagogy(f.store,f.teacher,await f.store.get('lesson_versions','lesson:v1'));
 validatePortablePedagogy(portable);
 assert.deepEqual(portable.frameworks[0].content,validateFramework(reference));
 assert.equal(portable.frameworks[0].content.nodes.find(n=>n.id==='BC01-C1-1').pedagogy.status,'A1 · positionnée');
});
