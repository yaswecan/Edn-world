import {canonical} from './content-snapshots.mjs';

// Changes elsewhere in the timetable do not invalidate this lesson's dependencies.
export function lessonPlanUnchanged(spec,entry,plans){
 const current=plans.at(-1);
 if(!current||current.curriculumVersion!==spec.sourceVersions.curriculumVersion)return false;
 if(current.version===spec.planVersion)return true;
 const original=plans.find(p=>p.version===spec.planVersion);
 const previous=original?.entries?.find(e=>e.id===spec.planEntryId||`${spec.classId}:${e.id}`===spec.planEntryId);
 if(!previous||!entry)return false;
 const content=value=>{
  const {id,classId,version,createdAt,editedBy,updatedAt,authorId,...fields}=value;
  return fields;
 };
 return canonical(content(previous))===canonical(content(entry));
}
