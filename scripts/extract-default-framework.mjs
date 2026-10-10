// Only the reference sheet is written: no learners, results or other sheets.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {parseWorkbook} from '../server/importer.mjs';
import {validateFramework} from '../server/competency-service.mjs';

const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/extract-default-framework.mjs <classeur.xlsx>');
const parsed=await parseWorkbook(await readFile(file));
const sheet=parsed.sheets.find(s=>s.name==='02 Référentiel A1');
if(!sheet||!parsed.criteria.length)throw Error('Onglet 02 Référentiel A1 vide ou absent.');
const nodes=[];
for(const c of parsed.criteria){
 if(c.n2_code&&!nodes.some(n=>n.id===c.n2_code))nodes.push({id:c.n2_code,code:c.n2_code,title:c.n2_label,kind:'block',location:`${sheet.name}!A${c.sourceRow}:B${c.sourceRow}`,criteria:[]});
 nodes.push({id:c.n3_code,code:c.n3_code,title:c.n3_label,kind:'competency',parentId:c.n2_code||null,location:`${sheet.name}!C${c.sourceRow}:O${c.sourceRow}`,expectedLevel:null,
  criteria:c.observable_criterion?[{id:'observable',code:null,title:c.observable_criterion,origin:'source',location:`${sheet.name}!L${c.sourceRow}`}]:[],
  pedagogy:{typology:c.typology,notionsTools:c.notions_tools,sequence:c.sequence_id,plannedDates:c.planned_dates,expectedTrace:c.expected_trace,status:c.status,prerequisites:c.prerequisites,masteryRule:c.mastery_rule,scaffolding:c.scaffolding_rule}});
}
const content=validateFramework({frameworkKey:'tweenteach:referentiel-a1',sourceVersion:`2026-2027-${parsed.sha256.slice(0,12)}`,title:sheet.name,source:{document:basename(file),location:sheet.name,sha256:parsed.sha256,note:sheet.rows[1][0]},nodes});
await mkdir(new URL('../server/data/',import.meta.url),{recursive:true});
await writeFile(new URL('../server/data/default-framework-a1.json',import.meta.url),JSON.stringify(content,null,2)+'\n');
console.log(`${sheet.name} : ${parsed.criteria.length} sous-compétences extraites ; SHA-256 ${parsed.sha256}`);
