import {fail,now,requireValue,scoped} from './store.mjs';
import {parisDate} from './generator.mjs';

export function publishedLessons(lessons){
 return lessons.filter(l=>l.status==='published').sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}

export async function todayLesson(store,classId,lessons,date=parisDate()){
 const selection=(await store.get('classes',classId))?.todayLesson;
 const selected=selection?.date===date?lessons.find(l=>l.id===selection.lessonId&&l.status==='published'):null;
 const lesson=selected||lessons.find(l=>l.status==='published'&&l.date===date);
 return {date,lessonId:lesson?.id||null,selected:!!selected};
}

export async function chooseTodayLesson(store,actor,input={}){
 return store.transaction(async tx=>{
  const date=parisDate();
  // A page left open overnight must not select a lesson for a different day.
  if(input.date!==date)fail(409,'Le jour a changé. Actualisez la page avant de choisir votre séance.');
  requireValue(input.lessonId===null||(typeof input.lessonId==='string'&&input.lessonId.length>0),'Choisissez une séance.');
  if(input.lessonId!==null){
   const lesson=await scoped(tx,'lessons',input.lessonId,actor);
   if(lesson.status!=='published')fail(409,'Publiez cette séance avant de la choisir pour aujourd’hui.');
  }
  const existing=await tx.get('classes',actor.classId);
  const classroom=existing||{id:actor.classId,classId:actor.classId};
  classroom.todayLesson=input.lessonId===null?null:{date,lessonId:input.lessonId,selectedBy:actor.id,selectedAt:now()};
  if(existing)await tx.put('classes',classroom);else await tx.insert('classes',classroom);
  await tx.audit(actor,'lesson.today_selected',input.lessonId||actor.classId,{date,lessonId:input.lessonId});
  return todayLesson(tx,actor.classId,publishedLessons(await tx.list('lessons',actor.classId)),date);
 });
}
