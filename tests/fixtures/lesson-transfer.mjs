import {diagnosticRevisionFixture} from './diagnostic-revision.mjs';
import {compileCorpus} from '../../server/corpus.mjs';
import {sha256} from '../../server/content-snapshots.mjs';
import {importDocument} from '../../server/pedagogy/documents.mjs';
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGZcAAAAASUVORK5CYII=','base64');
export async function transferFixture({rich=false}={}){
 const f=await diagnosticRevisionFixture();
 if(rich){
  const v=await f.store.get('lesson_versions',f.lesson.versionId),hash=sha256(png);await f.store.insert('lesson_assets',{id:hash,classId:f.actor.classId,kind:'reference-render',mimeType:'image/png',sha256:hash,base64:png.toString('base64'),width:1,height:1});v.spec.activities.find(a=>a.id==='guided').workshop.visual={id:hash,alt:'Illustration portable',width:1,height:1};
  v.spec.activities.find(a=>a.workshop?.document).workshop.document+='<img alt="Support local" src="http://localhost:4181/assets/eden-logo.png">';
  const doc=await importDocument(f.store,f.actor,{filename:'source.txt',title:'Source transportée',role:'technical'},Buffer.from('# Modèle de boîte\nLe padding fait partie de la boîte.'));
  const b=v.spec.blocks.find(b=>b.phase==='understand');b.depth={question:'Quelle largeur ?',prerequisiteReminder:'Une boîte',mechanism:'Mesurer la boîte',workedExample:'300 pixels',misconception:'Confondre les espaces',transfer:'Changer de largeur',remediation:'Mesurer de nouveau',citations:[]};b.depth.citations=[{sourceId:doc.id,segmentId:doc.segments[0].id,claim:'Le padding fait partie de la boîte.',kind:'explicit'}];await f.store.put('lesson_versions',v);
 }
 await compileCorpus(f.store,f.lesson.id,f.actor);return f;
}
