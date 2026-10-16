// Materialize a pre-3.1 diagnostic in an isolated fixture to exercise historical
// publication/adaptation contracts. Production generation never calls this.
import {diagnosticFrom,previousCompleted} from '../../server/generator.mjs';
import {orderAndTime} from '../../server/lesson-structure.mjs';
export async function legacyDiagnosticFixture(store,lesson,actor){
 const v=await store.get('lesson_versions',lesson.versionId),spec=v.spec,cv=await store.get('curriculum_versions',spec.sourceVersions.curriculumVersion),nodes=spec.skills.map(code=>cv.criteria.find(c=>c.n3_code===code)).filter(Boolean),previous=previousCompleted(await store.list('lesson_runs',actor.classId),spec.date),source=previous?await store.get('lesson_versions',previous.lessonVersionId):null;
 spec.diagnostic=diagnosticFrom(previous,source?.spec,nodes,spec.lessonId);
 orderAndTime(spec,spec.blocks.reduce((n,b)=>n+b.minutes,0),spec.diagnostic.duration);spec.timeline=spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));
 await store.put('lesson_versions',v);return {...lesson,spec};
}
