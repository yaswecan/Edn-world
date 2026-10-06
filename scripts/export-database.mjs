import {parseArgs} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {prepareSnapshot,MigrationError} from './lib/database-migration.mjs';
import {encodeBackup} from '../server/database-snapshot.mjs';

async function main(){
 const {values}=parseArgs({options:{source:{type:'string'},'artifact-dir':{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
 if(values.help){console.log('npm run db:export -- [--source .data/eden.sqlite] [--artifact-dir .data/artifacts] [--output fichier.eden-db.gz]');return;}
 const snapshot=await prepareSnapshot({source:values.source,artifactDirectory:values['artifact-dir']||process.env.EDEN_ARTIFACT_PATH});
 const {buffer,report}=await encodeBackup(snapshot);
 const output=resolve(values.output||`.data/exports/eden-base-${new Date().toISOString().replace(/[:.]/g,'-')}.eden-db.gz`);
 await mkdir(dirname(output),{recursive:true,mode:0o700});
 await writeFile(output,buffer,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({output,bytes:buffer.length,learners:report.learners,lessons:report.lessons,documents:report.documents,fingerprint:report.fingerprint},null,2));
 console.log('Base exportée avec ses documents. Sessions de connexion exclues. Dans Tween Teach : Ma classe & réglages → Importer ma base locale.');
}
main().catch(error=>{console.error(error instanceof MigrationError||error.status===400?error.message:error.code==='EEXIST'?'Le fichier existe déjà : choisissez un autre nom.':'Export interrompu. Vérifiez le chemin de la base et les droits du dossier.');process.exitCode=1;});
