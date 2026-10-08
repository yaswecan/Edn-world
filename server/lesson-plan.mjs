import {canonical} from './content-snapshots.mjs';

// Changes elsewhere, or a duration adjustment already reflected in the lesson,
// do not invalidate its pedagogical sources. Other entry changes still do.
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
 const before=content(previous),after=content(entry);
 if(canonical(before)===canonical(after))return true;
 const {duration:oldDuration,...oldFields}=before,{duration,...fields}=after;
 const blocks=spec.blocks,timeline=spec.timeline;
 return oldDuration!==duration&&entry.durationConfirmed===true&&
  canonical(oldFields)===canonical(fields)&&Array.isArray(blocks)&&blocks.length>0&&
  blocks.every(b=>Number.isInteger(b.minutes)&&b.minutes>0)&&
  blocks.reduce((sum,b)=>sum+b.minutes,0)===duration&&
  Array.isArray(timeline)&&timeline.length===blocks.length&&
  timeline.every((t,i)=>t.blockId===blocks[i].id&&t.minutes===blocks[i].minutes);
}
