import {chooseLatest} from './state-choice.mjs';
/** Fills the OOXML template created with artifact_tool. No external spreadsheet engine.
 * Formulas are kept and their caches updated; untrusted text is always a string, never a formula.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zipStore} from '../docs/app/zip.js';
import {reportHTML} from '../docs/app/views.js';
import {fresh} from '../docs/app/model.js';
import {ITEMS,aggregate} from './rubric.mjs';
import {examplesFor} from './grade.mjs';
import {practiceReviewHTML} from '../docs/app/practice-review.js';
const utf=s=>new TextEncoder().encode(s);
const x=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const short=(s,max=420)=>String(s||'').length>max?String(s).slice(0,max)+'… (texte intégral dans correction.json)':String(s||'');
const partsPromises=new Map();
function setCell(xml,address,value,keepFormula=false){
 const rx=new RegExp(`<x:c\\b([^>]*\\br="${address}"[^>]*)(?:\\s*/>|>([\\s\\S]*?)</x:c>)`);
 if(!rx.test(xml))throw Error('Cellule absente du modèle : '+address);
 return xml.replace(rx,(all,attrs,inner='')=>{attrs=attrs.replace(/\s+t="[^"]*"/,'').replace(/\s*\/\s*$/,'');const formula=keepFormula?(inner.match(/<x:f(?:\s[^>]*)?>[\s\S]*?<\/x:f>/)?.[0]||''):'';const isNumber=typeof value==='number'&&Number.isFinite(value);const type=isNumber?'':' t="str"';return `<x:c${attrs}${type}>${formula}${value===null?'':`<x:v>${isNumber?value:x(value)}</x:v>`}</x:c>`;});
}
export async function correctionWorkbook({alias,evaluation,now}){
 const grade=evaluation?(evaluation.review||evaluation.grade):null;
 const template=grade?.version==='fonctions-261001-v1'?'grille-parts-legacy.json':'grille-parts.json';
 if(!partsPromises.has(template))partsPromises.set(template,readFile(new URL('./templates/'+template,import.meta.url),'utf8').then(JSON.parse));
 const source=await partsPromises.get(template),parts=Object.fromEntries(Object.entries(source).map(([k,v])=>[k,Buffer.from(v,'base64')]));
 const items=grade?.items||ITEMS.map(i=>({...i,point:null,comment:'Aucun diagnostic remis.',source:i.step,evidence:''}));const stats=aggregate(items);
 const status=!evaluation?'NE — non remis':grade.status==='valide'?'Validé':grade.status==='a-revoir'?'À revoir':'À relire';
 const markers={ALIAS:alias,STATUS:status,NOTE:!evaluation?'Pas de note ni de zéro : aucun diagnostic remis.':stats.pending?`Pré-correction incomplète : ${stats.pending} indicateur(s) à relire. Points observés : ${stats.earned}/20.`:grade.status==='valide'?'Correction validée par le professeur.':'Pré-correction disponible. Relire les constats avant de valider.',ADVICE:grade?.note||'À compléter après lecture du rendu.',PROVENANCE:evaluation?`Rendu ${evaluation.id} · version ${evaluation.attempt} · reçu le ${new Date(Number(evaluation.created)).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}\nSHA-256 : ${evaluation.digest}\nGrille ${grade.version} · relecture ${evaluation.review_version} · export ${new Date(now).toISOString()}`:'Aucune remise du diagnostic. Export du dossier de progression seulement.'};
 items.forEach((it,i)=>{markers['COMMENT_'+i]=short(`${it.comment||''} ${it.evidence||''}`);markers['TRACE_'+i]=short(it.source||it.step,120);});

 const initial=evaluation?.grade?.initial;
 markers.FIRST_NOTE=initial?`Premier code exécuté : ${initial.total==null?initial.earned+' points observés ; '+initial.pending+' indicateurs à relire':initial.total+'/20'}. Dernier code : ${stats.total==null?'à relire':stats.total+'/20'}. La note porte sur le dernier code remis. Les aides restent informatives.`:'Pas de journal de pratique pour cette copie (ancienne version ou aucune remise).';
 const practice=evaluation?.grade?.practice||[];
 for(let i=0;i<4;i++){const p=practice[i];markers['STEP_'+i]=p?.id||'—';markers['FINAL_STATE_'+i]=p?(p.verified?'Contrôles réussis':p.skipped?'À reprendre':'À vérifier'):'Non disponible';markers['FIRST_'+i]=p?.firstAttemptAvailable?`${p.firstPassed}/${p.firstTotal} contrôles`:'Non transmis';markers['LAST_'+i]=p?`${p.finalPassed}/${p.finalTotal} contrôles`:'—';markers['RUNS_'+i]=p?.executions??'—';markers['TESTS_'+i]=p?.validations??'—';markers['HINTS_'+i]=p?.hints??'—';}
 stats.criteria.forEach((c,i)=>{const steps=new Set(items.filter(it=>it.criterion===c.id).map(it=>it.step));markers['AID_'+i]=practice.length?[...steps].reduce((n,id)=>n+(practice.find(p=>p.id===id)?.hints||0),0)+' indice(s) consulté(s)':'Non renseignée';});
 for(const [name,data] of Object.entries(parts)){if(!/\.xml$/.test(name))continue;parts[name]=utf(data.toString('utf8').replace(/\{\{([A-Z_0-9]+)\}\}/g,(m,k)=>Object.hasOwn(markers,k)?x(markers[k]):''));}
 let xml=new TextDecoder().decode(parts['xl/worksheets/sheet1.xml']);
 items.forEach((it,i)=>{xml=setCell(xml,'B'+(21+i),it.label);xml=setCell(xml,'C'+(21+i),it.point);const rows=Math.ceil(markers['COMMENT_'+i].length/65);const height=Math.min(150,Math.max(58,rows*14));xml=xml.replace(new RegExp(`<x:row\\b([^>]*\\br="${21+i}"[^>]*)>`),(m,a)=>`<x:row${a.replace(/\s+(ht|customHeight)="[^"]*"/g,'')} ht="${height}" customHeight="1">`);});
 xml=setCell(xml,'A6',stats.total===null?'':stats.total,true);xml=setCell(xml,'C6',stats.level,true);
 stats.criteria.forEach((c,i)=>{xml=setCell(xml,'B'+(13+i),grade?.criteria?.[i]?.label||c.label);xml=setCell(xml,'C'+(13+i),c.points===null?'':c.points,true);xml=setCell(xml,'D'+(13+i),c.level,true);});
 parts['xl/worksheets/sheet1.xml']=utf(xml);
 return zipStore(parts);
}
export async function studentFiles({learner,evaluation,course,history,now=Date.now()}){
 const id=learner.id,name=(learner.alias||'eleve').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,55)||'eleve';const folder=`${name}_${id.slice(0,8)}/`;
 const state=chooseLatest(learner.summary?.state,learner.summary?.receivedAt||learner.updated,course)||fresh(learner.alias);
 const grade=evaluation?(evaluation.review||evaluation.grade):null;
 const files={};const add=(path,text)=>files[folder+path]=typeof text==='string'?utf(text):text;
 add('rendu/ensemble_des_reponses.json',JSON.stringify(state,null,2));
 add('rendu/bilan.html',reportHTML(state,true));
 for(const [step,r] of Object.entries(state.responses||{}))if(typeof r.input?.code==='string')add(`rendu/code/${step}.js`,r.input.code);
 if(evaluation){add('evaluation/rendu_original.json',JSON.stringify(evaluation.state,null,2));for(const [step,r] of Object.entries(evaluation.state.responses||{}))if(typeof r.input?.code==='string')add(`evaluation/${step}.js`,r.input.code);
 add('evaluation/correction.json',JSON.stringify({submissionId:evaluation.id,automatic:evaluation.grade,review:evaluation.review,reviewVersion:evaluation.review_version},null,2));
 add('evaluation/correction.html',`<!doctype html><html lang="fr"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Correction ${x(learner.alias)}</title><style>body{font:16px/1.5 Inter,Arial;max-width:1000px;margin:30px auto;padding:20px;color:#142c34}table{width:100%;border-collapse:collapse}td,th{padding:10px;border:1px solid #ccd9dd;text-align:left}pre{white-space:pre-wrap}</style><h1>Diagnostic fonctions · ${x(learner.alias)}</h1><p>${x(grade.status)} · ${grade.total==null?'NE — à relire':grade.total+'/20'} · ${x(grade.level)}</p><p>${x(grade.note)}</p><table><tr><th>Item</th><th>Observation</th><th>Point</th><th>Constat</th></tr>${grade.items.map(i=>`<tr><td>${x(i.id)}</td><td>${x(i.label)}</td><td>${i.point??'À relire'}</td><td>${x(i.comment)}<br>${x(i.evidence)}</td></tr>`).join('')}</table></html>`);
 for(const [step,rec] of Object.entries(evaluation.state.responses||{}))if(rec.practice?.firstAttempt)add(`evaluation/premiers_essais/${step}.js`,rec.practice.firstAttempt.code);
 add('evaluation/essais_et_tests.json',JSON.stringify({note:'Historique déclaré par le navigateur. Tests recalculés au serveur.',initial:evaluation.grade.initial||null,exercises:evaluation.grade.practice||[]},null,2));
 add('evaluation/progression.html',`<!doctype html><html lang="fr"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Essais ${x(learner.alias)}</title><style>body{font:15px/1.6 Inter,Arial,sans-serif;max-width:1000px;margin:30px auto;padding:20px}pre{white-space:pre-wrap;background:#f4f8f9;padding:12px}.test-row{border-bottom:1px solid #ccc;padding:10px}.expected-actual{display:flex;gap:25px}details{margin:15px 0}summary{cursor:pointer;font-weight:bold}</style>${practiceReviewHTML(evaluation)}</html>`);
 for(const [path,code] of Object.entries(examplesFor(grade.version)))add('evaluation/exemple_corrige/'+path,code);
 }
 add('feuille_correction.xlsx',await correctionWorkbook({alias:learner.alias,evaluation,now}));
 add('LIRE.txt',`Dossier de ${learner.alias}\nSéance du 1er octobre 2026.\nLa feuille Excel reprend le format de la grille fournie, avec des critères adaptés aux fonctions.\nLe rendu original du diagnostic est figé lors de sa remise.\nLes réponses du cours peuvent évoluer : vérifier la date et la révision ci-dessous.\n${evaluation?'Diagnostic reçu : '+evaluation.id:'Aucun diagnostic remis : NE sans note.'}\nStatut : ${grade?.status||'non remis'}\nLes validations automatiques ne certifient pas l’autonomie.\nUne modification de l’Excel téléchargé ne change pas la base : utiliser l’espace professeur pour valider.\n`);
 const manifest={lesson:'R-261001',learnerId:id,alias:learner.alias,exportedAt:new Date(now).toISOString(),diagnosticReceipt:evaluation?.id||null,courseRevision:state.revision,latestExplicitSave:course?.id||null,versions:history.map(({id,kind,created,attempt})=>({id,kind,created,attempt})),files:Object.entries(files).map(([path,bytes])=>({path,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))};
 add('manifest.json',JSON.stringify(manifest,null,2));return files;
}
