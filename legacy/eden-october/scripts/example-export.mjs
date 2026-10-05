// Synthetic example only: no database, no real student identity.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fresh} from '../docs/app/model.js';
import {STEPS} from '../docs/app/content.js';
import {recordPractice,observeDiagnostic} from '../docs/app/diagnostic.js';
import {gradeDiagnostic,correctionExample} from '../server/grade.mjs';
import {studentFiles,correctionWorkbook} from '../server/exports.mjs';
import {zipStore} from '../docs/app/zip.js';
const state=fresh('DEMO FONCTIONS'),now=Date.parse('2026-10-01T09:00:00Z');
for(const step of STEPS.filter(s=>s.block==='diagnostic'&&s.kind==='function-code')){
 const code=correctionExample[step.filename],rec={input:{code},done:true,hints:0,tries:1};state.responses[step.id]=rec;
 const first=step.id==='diag-doubler'?'function doubler(nombre) { console.log(nombre * 2); }\nconst scoreDouble = doubler(6);\nconsole.log(scoreDouble);':code;
 recordPractice(rec,'run',first,observeDiagnostic(step.id,first));
 if(step.id==='diag-doubler')rec.hints=1;
 recordPractice(rec,'test',code,observeDiagnostic(step.id,code));
}
state.responses['diag-remettre']={input:{submitted:'yes'},done:true,tries:1,hints:0};
const grade=gradeDiagnostic(state);grade.note='Exemple fictif : dernier code réussi aux contrôles. Le premier essai de doubler affiche au lieu de renvoyer. Un indice est consulté avant la correction. Pré-correction à relire ; aucune validation humaine prétendue.';
const id='d'.repeat(24),evaluation={id,kind:'diagnostic',created:now,attempt:1,review_version:0,grade,state,digest:createHash('sha256').update(JSON.stringify(state)).digest('hex')};
const learner={id:'a'.repeat(24),alias:state.alias,updated:now,summary:{state,receivedAt:now}};
await mkdir(new URL('../enseignant/',import.meta.url),{recursive:true});
await writeFile(new URL('../enseignant/exemple_correction_DEMO.xlsx',import.meta.url),await correctionWorkbook({alias:state.alias,evaluation,now}));
await writeFile(new URL('../enseignant/exemple_export_DEMO.zip',import.meta.url),zipStore(await studentFiles({learner,evaluation,history:[{id,kind:'diagnostic',created:now,attempt:1}],now})));
console.log('Exemple fictif V6 : 20/20 après reprise, premier essai conservé.');
