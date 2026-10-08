import {createHash} from 'node:crypto';
import {openStore,TABLES} from '../../server/store.mjs';
import {passwordHash} from '../../server/auth.mjs';
import {seedCatalog} from '../../server/game.mjs';
import {encodeBackup} from '../../server/database-snapshot.mjs';

export const sourceTeacher={id:'local-teacher',classId:'A1',role:'teacher',username:'local-prof',displayName:'Professeur local',passwordHash:passwordHash('local-test-password')};
export const destinationTeacher={id:'remote-teacher',classId:'A1',role:'teacher',username:'remote-prof',displayName:'Professeur distant',passwordHash:passwordHash('remote-test-password')};
export const rawTables=async store=>Object.fromEntries(await Promise.all(TABLES.map(async t=>[t,(await store.readRows(t)).map(row=>({...row}))])));
export async function backupFixture(){
 const store=await openStore({path:':memory:',url:''});
 try{
  await store.insert('teachers',sourceTeacher);
  await store.insert('learners',{id:'learner',classId:'A1',role:'student',username:'student',displayName:'Élève test',passwordHash:passwordHash('local-student-password')});
  await store.insert('sessions',{id:'local-session',classId:'A1',role:'teacher',userId:sourceTeacher.id});
  await store.insert('plan_entries',{id:'entry',classId:'A1',date:'2026-10-05',skills:[]});
  await store.insert('plan_versions',{id:'plan',classId:'A1',version:2,entries:[]});
  await store.insert('lessons',{id:'lesson',classId:'A1',title:'Quatre cartes. À toi de les organiser.',date:'2026-10-05',status:'draft',version:4,versionId:'lesson:v4'});
  await store.insert('lesson_versions',{id:'lesson:v4',classId:'A1',version:4,spec:{lessonId:'lesson',classId:'A1'}});
  const bytes=Buffer.from('Document de la séance — contenu conservé.');
  await store.insert('corpus_packages',{id:'corpus',classId:'A1',lessonVersionId:'lesson:v4',complete:true,files:[{path:'documents/seance.txt',base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length}]});
  await seedCatalog(store);
  const tables=await rawTables(store);
  return {tables,...await encodeBackup({tables})};
 }finally{await store.close();}
}
export async function emptyDestination(){
 const store=await openStore({path:':memory:',url:''});
 await store.insert('teachers',destinationTeacher);
 await seedCatalog(store);
 return store;
}
export async function populatedDestination(){
 const store=await emptyDestination();
 await store.insert('learners',{id:'old-student',classId:'A1',role:'student',username:'old-student',displayName:'Ancien élève',passwordHash:passwordHash('old-student-password')});
 await store.insert('lessons',{id:'old-lesson',classId:'A1',title:'Ancienne séance',status:'draft',date:'2026-10-01',version:1});
 for(const table of ['submissions','work_submissions','evidence','game_runs','learning_progress'])await store.insert(table,{id:'old-'+table,classId:'A1',learnerId:'old-student',lessonId:'old-lesson'});
 return store;
}
