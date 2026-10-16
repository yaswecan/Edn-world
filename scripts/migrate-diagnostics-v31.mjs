// Inventory only: V3.1 is an additive JSON contract, with no DDL/backfill.
// A draft is upgraded through the source/task preview, never by fabricating work.
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function inspectDiagnosticsV31(path){
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  const rows=table=>tables.has(table)?db.prepare(`SELECT data FROM ${table}`).all().map(r=>JSON.parse(r.data)):[];
  const versions=rows('lesson_versions'),attempts=rows('assessment_attempts'),lessons=rows('lessons'),counts={historicalVersions:0,v31Versions:0,draftsForPreview:0,startedVersionsPreserved:0};
  for(const v of versions){if(v.spec?.diagnostic?.contract?.version==='diagnostic-3.1')counts.v31Versions++;else counts.historicalVersions++;if(attempts.some(a=>a.lessonVersionId===v.id))counts.startedVersionsPreserved++;}
  counts.draftsForPreview=lessons.filter(l=>l.status==='draft'&&!attempts.some(a=>a.lessonVersionId===l.versionId)).length;
  return {mode:'read-only',schemaChanges:0,backfilledComments:0,counts,nextAction:'Source et gabarit à relire dans Préparer le diagnostic V3.1. Aucune copie ni version modifiée.'};
 }finally{db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),index=args.indexOf('--db');if(index<0||!args[index+1]||args.includes('--apply'))throw Error('Usage : node scripts/migrate-diagnostics-v31.mjs --db /copie-isolee.sqlite ; migration des brouillons par aperçu dans l’interface.');
 console.log(JSON.stringify(inspectDiagnosticsV31(resolve(args[index+1])),null,2));
}
