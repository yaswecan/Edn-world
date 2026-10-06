import assert from 'node:assert/strict';
import handler from '../../api/index.mjs';
import {openStore} from '../../server/store.mjs';
import {compileCorpus} from '../../server/corpus.mjs';
import JSZip from 'jszip';

// Import the complete API without tsx or module syntax detection, as on Lambda.
const response={setHeader(){},end(body){this.body=JSON.parse(body);}};
await handler({url:'/api/health'},response);
assert.equal(response.statusCode,503);
assert.match(response.body.error,/Initialisation indisponible/);

const store=await openStore({url:'',path:':memory:'});
try {
 const actor={id:'serverless-test',classId:'test',role:'teacher'};
 const spec={lessonId:'serverless-lesson',lessonVersion:1,title:'Compatible avec Vercel',
  sourceVersions:{curriculumVersion:'test'},planVersion:1,skills:[],objectives:['Exporter un support'],
  teacherGuide:'Guide de test',activities:[],blocks:[],diagnostic:{tasks:[],rubric:[]},
  slides:[{title:'Compatible avec Vercel',body:'Un vrai fichier PowerPoint.'}]};
 await store.insert('lessons',{id:spec.lessonId,classId:actor.classId,versionId:'serverless-version'});
 await store.insert('lesson_versions',{id:'serverless-version',classId:actor.classId,lessonId:spec.lessonId,spec});
 const corpus=await compileCorpus(store,spec.lessonId,actor);
 const file=corpus.files.find(f=>f.path==='04_PRESENTATION/presentation.pptx');
 assert.ok(file);
 const zip=await JSZip.loadAsync(Buffer.from(file.base64,'base64'));
 assert.ok(zip.file('[Content_Types].xml'));
 assert.match(await zip.file('ppt/slides/slide1.xml').async('string'),/Compatible avec Vercel/);
 console.log('Serverless startup and PPTX export passed.');
}finally{await store.close();}
