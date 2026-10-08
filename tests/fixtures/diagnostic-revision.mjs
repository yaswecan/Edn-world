import {pedagogyFixture,pilotSpec,pilotDefinitions} from './pedagogy.mjs';

export async function diagnosticRevisionFixture(pilot=pilotDefinitions[0]){
 const {store,actor}=await pedagogyFixture(),spec=pilotSpec(pilot),id=`diagnostic-${pilot.id}`;
 Object.assign(spec,{lessonId:id,classId:actor.classId,planEntryId:pilot.id,date:(await store.get('plan_entries',pilot.id)).date,sourceVersions:{curriculumVersion:'quality-curriculum',planVersion:1,previousLessonRunId:null}});
 delete spec.diagnostic.policyVersion;delete spec.diagnostic.expectations;
 spec.diagnostic.id=`${id}:diagnostic`;
 const lesson=await store.insert('lessons',{id,classId:actor.classId,status:'draft',date:spec.date,title:spec.title,version:1,versionId:`${id}:v1`,quality:{publishable:false,checks:[]}});
 await store.insert('lesson_versions',{id:lesson.versionId,classId:actor.classId,lessonId:id,version:1,spec});
 return {store,actor,lesson,spec};
}
