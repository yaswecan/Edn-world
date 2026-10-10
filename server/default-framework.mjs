import {readFileSync} from 'node:fs';
import {currentActor,digest,importFramework,validateFramework} from './competency-service.mjs';

// Versioned reference content supplied by the teacher, independent of Downloads
// and of any previously imported planning workbook. Never replaces an old grid.
const content=validateFramework(JSON.parse(readFileSync(new URL('./data/default-framework-a1.json',import.meta.url),'utf8')));
export const defaultFrameworkId=classId=>'framework_'+digest([classId,content.frameworkKey,content.sourceVersion]);
export async function ensureDefaultFramework(store,actor){
 const id=defaultFrameworkId(actor.classId);
 if(await store.get('framework_versions',id))return id;
 await store.transaction(async tx=>{
  await currentActor(tx,actor);
  const exists=await tx.get('framework_versions',id);
  if(exists)return;
  await importFramework(tx,actor,{...content,confirmed:true});
  await tx.audit(actor,'framework.default_installed',id,{document:content.source.document,location:content.source.location,sha256:content.source.sha256});
 });
 return id;
}
