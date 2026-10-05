// Interactive local preview of the real app, using only disposable test data.
// Run without --env-file: never open the configured application database.
import {arcadeFixture} from '../tests/fixtures/arcade.mjs';
import {demoLesson} from '../server/demo-lesson.mjs';
import {parisDate} from '../server/generator.mjs';

if(process.env.NODE_ENV==='production')throw new Error('Cet aperçu est réservé aux tests locaux.');
const port=Number(process.env.EDEN_ARCADE_PREVIEW_PORT||4179);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port de test invalide.');
process.env.EDEN_WORLD_ARCADE='1';
const fixture=await arcadeFixture({port});
const {store}=fixture;
const lesson=await store.get('lessons','arcade-lesson');
const version=await store.get('lesson_versions',lesson.versionId);
const spec=demoLesson();
Object.assign(spec,{lessonId:lesson.id,classId:'A1',date:parisDate(),codeStation:version.spec.codeStation});
await store.put('lesson_versions',{...version,spec});
await store.put('lessons',{...lesson,date:spec.date});
const learner=await store.get('learners','student-a');
await store.put('learners',{...learner,displayName:'Élève test',arcadeProfile:{publicId:'preview-student',handle:'Élève test',avatarId:'04',visibility:'private'}});

// A distinct loopback hostname keeps preview cookies apart from the usual app.
console.log(`Test élève prêt : http://arcade.localhost:${port}/arcade`);
console.log(`Séance élève : http://arcade.localhost:${port}/today`);
console.log('Compte de test : student-a · classe A1. SQLite en mémoire uniquement.');
console.log('Les modifications de test sont conservées jusqu’à l’arrêt de ce processus. Ctrl+C pour arrêter.');
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
  if(stopping)return;stopping=true;
  await fixture.close();process.exit(0);
});
