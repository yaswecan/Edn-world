import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../server/database.mjs';
import {createStore} from '../server/store.mjs';
import {MIGRATIONS} from '../server/schema.mjs';
test('Neon transport : pilote chargé une fois, options fullResults',async()=>{
 let loaded=0,options,seen;
 const sql={query:(text,params,opt)=>{seen={text,params,opt};return {rows:[],rowCount:0};},transaction:()=>[]};
 const db=createDatabase('postgres://unused',{loadDriver:async()=>{loaded++;return {neon:(url,opt)=>{options=opt;return sql;}};}});
 await db.query('SELECT $1',[5]);await db.query('SELECT $1',[6]);
 assert.equal(loaded,1);assert.equal(options.fullResults,true);assert.deepEqual(seen.params,[6]);assert(seen.opt.fetchOptions.signal);
});
test('Neon migration : transaction unique + verrou + retry après erreur',async()=>{
 let batches=0;
 const sql={query:(text,params)=>({text,params}),transaction:async queries=>{batches++;assert.equal(queries[0].text,MIGRATIONS[0]);if(batches===1)throw Error('cold start');return queries.map(()=>({rows:[],rowCount:0}));}};
 const db=createDatabase('unused',{loadDriver:async()=>({neon:()=>sql})});
 await assert.rejects(db.migrate());await Promise.all([db.migrate(),db.migrate(),db.migrate()]);assert.equal(batches,2);
});
test('Repository SQL : ingest transaction verrouillée et paramétrée',async()=>{
 let calls;
 const store=createStore({transaction:async q=>{calls=q;return [{rowCount:1},{rowCount:2},{rowCount:1},{rowCount:0}];}});
 const r=await store.ingest({id:'student',scope:'production:a',credentialVersion:'v',now:20,order:3,summary:{explanation:"'; DROP TABLE x;--"},coreCompleted:12,events:[]});
 assert(calls[0].text.includes('FOR UPDATE'));assert(calls[1].text.includes('ON CONFLICT DO NOTHING'));assert(calls[2].text.includes('last_order<$6'));
 assert(!calls.some(c=>c.text.includes('DROP TABLE')));assert(calls[2].params[4].includes('DROP TABLE'));assert.equal(r.acceptedEvents,2);
});
test('Repository SQL : chiffres BIGINT normalisés pour le navigateur',async()=>{
 const store=createStore({query:async()=>({rows:[{id:'x',updated:'1776434464953',validated_at:null}],rowCount:1})});
 const l=(await store.list('a',0))[0];assert.equal(typeof l.updated,'number');assert.equal(l.validated_at,null);
});
test('Repository SQL : contrôle optimiste de validation',async()=>{
 let call;const store=createStore({query:async(text,params)=>{call={text,params};return {rowCount:0};}});
 assert.equal(await store.validate({id:'x',scope:'a',validation:'valide',note:'ok',now:1,expectedRevision:7,expectedRunId:'r'}),false);
 assert(call.text.includes('IS NOT DISTINCT FROM'));assert.equal(call.params[5],'7');
});
test('Repository SQL : purge explicite, limitée au scope et avec cascade événements',async()=>{
 let calls;const store=createStore({transaction:async q=>{calls=q;return q.map(()=>({rowCount:2}));}});
 assert.equal((await store.cleanup('preview:a',4,5)).deletedLearners,2);assert.deepEqual(calls[0].params,['preview:a',4]);assert(MIGRATIONS.some(s=>s.includes('ON DELETE CASCADE')));
});
