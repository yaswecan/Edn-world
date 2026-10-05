/** Neon HTTPS transport: no SQLite file, TCP pool, listen(), or background timer. */
import {MIGRATIONS} from './schema.mjs';
export function createDatabase(connectionString,{loadDriver=()=>import('@neondatabase/serverless')}={}) {
  let clientPromise, migrationPromise;
  async function client() {
    if(!clientPromise)clientPromise=loadDriver().then(({neon})=>neon(connectionString,{fullResults:true})).catch(e=>{clientPromise=null;throw e;});
    return clientPromise;
  }
  const options=()=>({fetchOptions:{signal:AbortSignal.timeout(12000)}});
  return {
    async query(text,params=[]) {const sql=await client();return sql.query(text,params,options());},
    async transaction(queries) {
      const sql=await client();
      return sql.transaction(queries.map(q=>sql.query(q.text,q.params||[])),{fullResults:true,...options()});
    },
    async migrate() {
      if(!migrationPromise)migrationPromise=this.transaction(MIGRATIONS.map(text=>({text}))).catch(e=>{migrationPromise=null;throw e;});
      await migrationPromise;
    }
  };
}
