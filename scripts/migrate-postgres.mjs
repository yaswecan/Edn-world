import {parseArgs} from 'node:util';
import {Client} from 'pg';
import {MigrationError,prepareSnapshot,inspectTarget,applySnapshot} from './lib/database-migration.mjs';

async function main(){
 const {values}=parseArgs({options:{source:{type:'string'},'artifact-dir':{type:'string'},apply:{type:'boolean'},'check-target':{type:'boolean'},help:{type:'boolean'}}});
 if(values.help){
  console.log('npm run db:migrate -- [--source .data/eden.sqlite] [--artifact-dir .data/artifacts] [--check-target | --apply]\nSans option : contrôle local uniquement. Connexion distante : EDEN_MIGRATION_DATABASE_URL dans .env.migration.local.');
  return;
 }
 if(values.apply&&values['check-target'])throw new MigrationError('Choisir --check-target ou --apply.');
 const snapshot=await prepareSnapshot({source:values.source,artifactDirectory:values['artifact-dir']||process.env.EDEN_ARTIFACT_PATH});
 console.log(JSON.stringify({mode:values.apply?'apply':values['check-target']?'check_target':'local_check',...snapshot.report},null,2));
 if(!values.apply&&!values['check-target']){
  console.log('Contrôle local terminé. Aucune donnée écrite ; aucun appel à PostgreSQL.');
  return;
 }
 const url=process.env.EDEN_MIGRATION_DATABASE_URL;
 if(!url)throw new MigrationError('Renseigner EDEN_MIGRATION_DATABASE_URL dans .env.migration.local. Ne pas coller le secret dans le chat.');
 let parsed;
 try{parsed=new URL(url);}catch{throw new MigrationError('URL PostgreSQL invalide.');}
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.hostname)throw new MigrationError('URL PostgreSQL invalide.');
 if(values.apply&&snapshot.report.artifacts.externalS3Files)throw new MigrationError('La source référence des documents S3 : leur stockage distant doit être vérifié avant une migration.');
 const client=new Client({connectionString:url,connectionTimeoutMillis:10000,statement_timeout:120000,application_name:'eden-data-migration'});
 try{
  await client.connect();
  const result=values.apply?await applySnapshot(client,snapshot):await inspectTarget(client,snapshot);
  console.log(JSON.stringify(result,null,2));
  if(result.status==='conflict')throw new MigrationError('La base cible contient déjà des données différentes ; aucune donnée modifiée.');
 }finally{await client.end();}
}

main().catch(error=>{
 // PostgreSQL errors may contain connection strings or bound student data.
 const code=/^[A-Z0-9_]{2,30}$/.test(error.code||'')?` (${error.code})`:'';
 console.error(error instanceof MigrationError?error.message:`Migration interrompue${code}. Vérifier la connexion et les droits PostgreSQL ; détails sensibles masqués. Une relance vérifie les données avant toute écriture.`);
 process.exitCode=1;
});
