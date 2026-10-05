import {DatabaseSync} from 'node:sqlite';
process.once('message',data=>{try{
 const {query,tests}=data;
 if(typeof query!=='string'||query.length>10000||!/^\s*(select|with)\b/i.test(query)||/\b(attach|detach|pragma|load_extension|readfile|writefile)\b/i.test(query)||/;\s*\S/.test(query))throw Error('Seule une requête SELECT isolée est prise en charge.');
 const results=[];
 for(const test of tests){const db=new DatabaseSync(':memory:',{allowExtension:false});db.exec('PRAGMA hard_heap_limit=67108864');try{const fixture=JSON.parse(test.argsJSON);if(!Array.isArray(fixture.tables)||fixture.tables.length>10)throw Error('Fixture SQL invalide.');for(const table of fixture.tables){if(!/^[a-zA-Z_][\w]*$/.test(table.name)||!Array.isArray(table.columns)||table.columns.length>20||!table.columns.length||!table.columns.every(c=>/^[a-zA-Z_][\w]*$/.test(c))||!Array.isArray(table.rows)||table.rows.length>1000)throw Error('Table de test invalide.');db.exec(`CREATE TABLE "${table.name}" (${table.columns.map(c=>`"${c}"`).join(',')})`);const insert=db.prepare(`INSERT INTO "${table.name}" VALUES (${table.columns.map(()=>'?').join(',')})`);for(const row of table.rows){if(!Array.isArray(row)||row.length!==table.columns.length||row.some(v=>v!==null&&!['string','number'].includes(typeof v)))throw Error('Ligne invalide.');insert.run(...row);}}
 const stmt=db.prepare(query),rows=[];for(const row of stmt.iterate()){rows.push(row);if(rows.length>1000)throw Error('Résultat trop volumineux.');}const expected=JSON.parse(test.expectedJSON),canonical=rows=>JSON.stringify(rows.map(r=>Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b)))));results.push({label:test.invoke,ok:canonical(rows)===canonical(expected)});
 }finally{db.close();}}
 process.send({ratio:results.filter(r=>r.ok).length/results.length,confidence:1,status:'auto_corrected_to_review',feedback:'Résultats comparés sur une base SQLite éphémère, sans accès à la base EDEN.',observations:results});
}catch(e){process.send({ratio:null,confidence:0,status:'review_required',feedback:e.message,observations:[]});}
process.disconnect();});
