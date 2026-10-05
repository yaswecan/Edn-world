import {storeArtifact} from './artifacts.mjs';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';
import archiver from 'archiver';
import {PassThrough} from 'node:stream';
import {hash} from './importer.mjs';
import {uid,now,scoped,fail} from './store.mjs';
import {studentFeedback,studentResultStatus} from '../public/student-copy.js';
import {studentSpec} from './generator.mjs';
import {readFile} from 'node:fs/promises';
const edenLogo=await readFile(new URL('../public/assets/eden-logo.png',import.meta.url));
const edenLogoData='data:image/png;base64,'+edenLogo.toString('base64');
const json=v=>Buffer.from(JSON.stringify(v,null,2));
export function pdf(title,sections){return new Promise((resolve,reject)=>{const doc=new PDFDocument({margin:45,info:{Title:title,Author:'EDEN School'}}),chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);doc.image(edenLogo,45,32,{width:140});doc.y=90;doc.fillColor('#162b32').fontSize(23).text(title).moveDown();for(const s of sections){doc.fillColor('#246165').fontSize(13).text(s.title||'').moveDown(.4);doc.fillColor('#162b32').fontSize(10).text(String(s.body||''),{lineGap:4}).moveDown();}doc.end();});}
export async function workbook(sheets){const book=new ExcelJS.Workbook();book.creator='EDEN';for(const [name,rows]of Object.entries(sheets)){const s=book.addWorksheet(name);rows.forEach(r=>s.addRow(r));s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF162B32'}};s.columns.forEach(c=>{c.width=28;});s.views=[{state:'frozen',ySplit:1}];s.eachRow(r=>{r.alignment={vertical:'top',wrapText:true};});}return Buffer.from(await book.xlsx.writeBuffer());}
export async function zipFiles(files){return new Promise((resolve,reject)=>{const output=new PassThrough(),chunks=[],archive=archiver('zip',{zlib:{level:6}});output.on('data',c=>chunks.push(c));output.on('end',()=>resolve(Buffer.concat(chunks)));output.on('error',reject);archive.on('error',reject);archive.pipe(output);for(const f of files)archive.append(f.buffer,{name:f.path});archive.finalize();});}
const mime=path=>path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.pdf')?'application/pdf':path.endsWith('.pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':path.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':path.endsWith('.json')?'application/json':'text/plain';
export async function compileCorpus(store,lessonId,actor,{candidateVersionId}={}) {
 const lesson=await scoped(store,'lessons',lessonId,actor),version=await scoped(store,'lesson_versions',candidateVersionId||lesson.versionId,actor),s=version.spec;
 if(candidateVersionId&&version.lessonId!==lessonId)fail(400,'Version candidate liée à une autre séance.');
 const existing=(await store.list('corpus_packages',actor.classId)).find(c=>c.lessonVersionId===version.id);if(existing)return existing;
 const files=[];const add=(path,buffer,audience='teacher')=>files.push({path,buffer,audience});
 const student=studentSpec(s),activities=s.activities.map(a=>({title:a.title,body:a.instruction+'\nÀ rendre : '+a.expectedEvidence})),guide=[{title:'Objectifs',body:s.objectives.join('\n')},{title:'Animation',body:s.teacherGuide},...s.blocks.map(b=>({title:`${b.minutes} min · ${b.title}`,body:b.content}))];
 add('01_ELEVE/carnet-eleve.pdf',await pdf(s.title,activities),'student');
 add('01_ELEVE/fiche-recap.pdf',await pdf('Repères · '+s.title,s.blocks.filter(b=>['ConceptCard','LiveCode'].includes(b.type)).map(b=>({title:b.title,body:b.content}))),'student');
 add('01_ELEVE/exercices.pdf',await pdf('Exercices',activities),'student');
 for(const a of s.activities)if(a.starter)add(`01_ELEVE/fichiers-depart/${a.id}.txt`,Buffer.from(a.starter),'student');
 for(const a of s.activities.filter(a=>a.type==='CodeEditor'&&a.workshop?.language)){
  const w=a.workshop,folder=`01_ELEVE/ateliers/${a.id}`;
  if(w.language==='css'){
   add(`${folder}/index.html`,Buffer.from(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atelier EDEN</title><link rel="stylesheet" href="support.css"><link rel="stylesheet" href="style.css">${w.document||''}</html>`),'student');
   add(`${folder}/support.css`,Buffer.from(w.style||''),'student');
  }
  add(`${folder}/${{css:'style.css',html:'index.html',javascript:'main.js',sql:'requete.sql',text:'production.txt'}[w.language]}`,Buffer.from(a.starter),'student');
  add(`${folder}/consigne.txt`,Buffer.from(a.instruction+'\n\nÀ vérifier :\n'+(w.checks||[]).join('\n')),'student');
 }
 const boardIds=new Set([...s.blocks.flatMap(b=>b.boards||[]),...s.activities.map(a=>a.workshop?.board).filter(Boolean)]);
 for(const id of boardIds)for(const suffix of ['', '-a-completer'])add(`01_ELEVE/tableaux/${id}${suffix}.svg`,await readFile(new URL(`../public/assets/boards/${id}${suffix}.svg`,import.meta.url)),'student');
 add('02_DIAGNOSTIC/diagnostic-eleve.pdf',await pdf('Évaluation · Note sur 20',s.diagnostic.tasks.map(a=>({title:a.title,body:a.instruction}))),'student');
 add('02_DIAGNOSTIC/diagnostic-spec.json',json(s.diagnostic));add('02_DIAGNOSTIC/grille.json',json(s.diagnostic.rubric));
 add('02_DIAGNOSTIC/correction-reference.pdf',await pdf('Correction de référence',s.diagnostic.tasks.map(a=>({title:a.title,body:a.reference+'\n'+a.expectedAnswer}))));
 for(const a of s.diagnostic.tasks)add(`02_DIAGNOSTIC/fichiers-reference/${a.id}.txt`,Buffer.from(a.reference+'\n'+a.expectedAnswer));
 for(const name of ['trame-professeur','memo-professeur','guide-animation'])add(`03_PROFESSEUR/${name}.pdf`,await pdf(name,guide));
 const groups=(await store.list('remediation_snapshots',actor.classId)).at(-1)?.groups||[];
 add('03_PROFESSEUR/groupes-remediation.xlsx',await workbook({Groupes:[['Groupe','Élève','Critères','Statut'],...groups.flatMap(g=>g.members.map(m=>[g.title,m.learnerId,m.criteria.join(', '),m.reason]))]}));
 const Pptx=pptxgen.default||pptxgen;const ppt=new Pptx();ppt.author='EDEN';ppt.subject=s.title;ppt.title=s.title;ppt.layout='LAYOUT_WIDE';
 for(const slide of s.slides){const p=ppt.addSlide();p.background={color:'F4F7F7'};p.addImage({data:edenLogoData,x:11.5,y:.5,w:1.3,h:1.3*260/900});p.addText(slide.title,{x:.6,y:.5,w:10.5,h:1,fontSize:26,bold:true,color:'162B32',breakLine:false});p.addText(slide.body,{x:.6,y:1.8,w:12,h:4.8,fontSize:18,color:'162B32',fit:'shrink'});p.addText('EDEN · '+s.lessonId,{x:.6,y:7,w:12,h:.3,fontSize:10,color:'53676D'});}
 add('04_PRESENTATION/presentation.pptx',Buffer.from(await ppt.write({outputType:'nodebuffer'})));
 add('04_PRESENTATION/presentation.pdf',await pdf(s.title,s.slides));
 const rubricRows=[['Item','Critère','Indicateur','Max','Seuil A1','Seuil A2'],...s.diagnostic.rubric.map(i=>[i.id,i.criterion,i.label,i.max,i.a1,i.a2])];
 add('05_CORRECTION/modele-feuille-correction.xlsx',await workbook({Correction:[['Élève','Note /20','Niveau','Statut','Justification']],Barème:rubricRows,Repères:[['Niveau','Seuil'],['NA','0–4'],['EC','5–9'],['A1','10–14'],['A2','15–20'],['NE','Non remis ou à relire']],Essais:[['Élève','Premier essai','Dernier essai','Exécutions','Indices']]}));
 add('05_CORRECTION/bareme.pdf',await pdf('Barème /20',s.diagnostic.rubric.map(i=>({title:`${i.criterion} · ${i.max} points`,body:i.label+`\nA1 : ${i.a1} · A2 : ${i.a2}`}))));
 add('05_CORRECTION/reperes.pdf',await pdf('Repères de correction',[{title:'Une note n’est pas une maîtrise',body:'NA : 0–4 ; EC : 5–9 ; A1 : 10–14 ; A2 : 15–20. NE : non remis ou relecture obligatoire. Deux preuves autonomes espacées dont une en transfert sont nécessaires à la maîtrise durable.'}]));
 const mission=s.codeStation?await store.get('game_missions',s.codeStation.missionId):null;
 add('06_CODESTATION/mission.json',json(mission||{status:'not_applicable',reason:'Aucune mission compatible avec tous les critères du créneau.'}));
 add('06_CODESTATION/correction-mission.json',json(mission?{validator:mission.validator,scenarios:mission.scenarios,rule:s.codeStation.completionRule}:{status:'not_applicable'}));
 add('07_SOURCES_EDEN/lesson.json',json(s));add('07_SOURCES_EDEN/teacher-guide.json',json({guide:s.teacherGuide}));add('07_SOURCES_EDEN/activity-specs.json',json(s.activities));add('07_SOURCES_EDEN/rubric.json',json(s.diagnostic.rubric));
 add('00_MANIFEST/sources.json',json(s.sourceVersions));add('00_MANIFEST/README.txt',Buffer.from('Export EDEN. Le corpus complet contient les corrections et reste réservé au professeur. Distribuer uniquement les artefacts audience=student. EDEN conserve la source de vérité.'));
 const manifest={lessonId:s.lessonId,lessonVersion:s.lessonVersion,classId:actor.classId,generatedAt:now(),planVersion:s.planVersion,curriculumVersion:s.sourceVersions.curriculumVersion,skills:s.skills,duration:s.blocks.reduce((a,b)=>a+b.minutes,0),status:'draft',files:files.map(f=>({path:f.path,sha256:hash(f.buffer),bytes:f.buffer.length,audience:f.audience,mimeType:mime(f.path)}))};
 add('00_MANIFEST/manifest.json',json(manifest));
 const pack={id:uid('corpus'),classId:actor.classId,lessonId,lessonVersionId:version.id,version:s.lessonVersion,manifest,files:await Promise.all(files.map(async f=>({path:f.path,audience:f.audience,mimeType:mime(f.path),...await storeArtifact(f.buffer,{inline:store.inlineArtifacts})}))),complete:true};
 return store.transaction(async tx=>{const current=await tx.get('lessons',lessonId);if(current.versionId!==version.id&&(!candidateVersionId||current.versionId!==version.baseVersionId))fail(409,'Séance modifiée pendant la compilation. Recompilez.');const duplicate=(await tx.list('corpus_packages',actor.classId)).find(c=>c.lessonVersionId===version.id);if(duplicate)return duplicate;await tx.insert('corpus_packages',pack);await tx.audit(actor,'corpus.compiled',pack.id,{lessonVersionId:version.id});return pack;});
}
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=(title,body)=>Buffer.from(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${escapeHTML(title)}</title><style>body{font:16px/1.65 Inter,Arial,sans-serif;max-width:900px;margin:40px auto;padding:20px;color:#162b32}pre{white-space:pre-wrap;background:#eaf7f7;padding:16px}article{border-top:1px solid #cfdddd;padding:16px 0}</style><img src="${edenLogoData}" width="144" height="42" alt="EDEN School"><h1>${escapeHTML(title)}</h1>${body}</html>`);
export async function individualExport(store,id,actor){
 const submission=await scoped(store,'submissions',id,actor),correction=await scoped(store,'corrections',id,actor),learner=await scoped(store,'learners',submission.learnerId,actor),attempt=await scoped(store,'assessment_attempts',submission.attemptId,actor);
 const files=[{path:'rendu/ensemble_des_reponses.json',buffer:json(submission.answers)},{path:'evaluation/rendu_original.json',buffer:json(submission)},{path:'evaluation/essais_et_tests.json',buffer:json(submission.history)},{path:'evaluation/correction.json',buffer:json(correction)}];
 const add=(path,buffer)=>files.push({path,buffer});
 add('rendu/bilan.html',html('Production remise',`<p>${escapeHTML(learner.displayName)} · ${escapeHTML(submission.submittedAt)}</p>`+Object.entries(submission.answers).map(([task,answer])=>`<article><h2>${escapeHTML(submission.diagnostic.tasks.find(t=>t.id===task)?.title||'Réponse')}</h2><pre>${escapeHTML(typeof answer==='string'?answer:JSON.stringify(answer))}</pre></article>`).join('')));
 const feedback=correction.items.map(i=>`<article><h2>${escapeHTML(i.label)} · ${i.points==null?'Non évalué':`${i.points} / ${i.max}`}</h2><p>${escapeHTML(studentFeedback(i.feedback))}</p></article>`).join('');
 add('evaluation/correction.html',html('Correction individuelle',`<p>${correction.score==null?'Non évalué':`${correction.score} /20 · ${correction.level}`}</p><p>${escapeHTML(studentResultStatus(correction))}</p><p>${escapeHTML(studentFeedback(correction.feedback))}</p>`+feedback));
 add('evaluation/progression.html',html('Historique des essais',`<p>${attempt.executions||0} exécution(s) · ${attempt.hints||0} indice(s).</p>`+submission.history.filter(h=>h.type==='code_run').map((h,i)=>`<article><h2>Essai ${i+1}</h2><pre>${escapeHTML(h.payload.code)}</pre><pre>${escapeHTML([...(h.payload.result?.logs||[]),h.payload.result?.error].filter(Boolean).join('\n'))}</pre></article>`).join('')));
 for(const task of submission.diagnostic.tasks){const safe=task.id.replace(/[^a-zA-Z0-9_-]/g,'_');if(['CodeEditor','TestRunner','Preview','Terminal'].includes(task.type))add(`rendu/code/${safe}.txt`,Buffer.from(String(submission.answers[task.id]||'')));const first=attempt.firstAttempt?.[task.id];if(first)add(`evaluation/premiers_essais/${safe}.json`,json(first));add(`evaluation/exemple_corrige/${safe}.txt`,Buffer.from(task.reference+'\n'+task.expectedAnswer));}
 add('evaluation/correction.pdf',await pdf('Correction individuelle',[{title:correction.score==null?'Non évalué':`${correction.score} / 20 · ${correction.level}`,body:[studentResultStatus(correction),studentFeedback(correction.feedback)].filter(Boolean).join('\n')},...correction.items.map(i=>({title:i.label,body:`${i.points==null?'Non évalué':`${i.points} / ${i.max}`}\n${studentFeedback(i.feedback)}`}))]));
 add('feuille_correction.xlsx',await workbook({Correction:[['Critère','Points','Max','Feedback'],...correction.items.map(i=>[i.criterion,i.points??'NE',i.max,i.feedback])],Barème:[['Item','Max','A1','A2'],...submission.diagnostic.rubric.map(i=>[i.label,i.max,i.a1,i.a2])],Repères:[['Note','Niveau','Statut'],[correction.score??'NE',correction.level,correction.status]],Essais:[['Horodatage','Action','Données'],...submission.history.map(h=>[h.timestamp,h.type,JSON.stringify(h.payload)])]}));
 add('LIRE.txt',Buffer.from('Dossier individuel EDEN. La copie originale est figée ; les essais sont conservés séparément. La correction indiquée porte son statut et sa version. Une note ne prouve pas une maîtrise durable.'));
 add('manifest.json',json({submissionId:id,learnerId:learner.id,lessonVersionId:submission.lessonVersionId,correctionVersion:correction.version,sha256:submission.sha256,files:files.map(f=>({path:f.path,sha256:hash(f.buffer),bytes:f.buffer.length}))}));
 return zipFiles(files.map(f=>({...f,path:`${learner.id.replace(/[^a-zA-Z0-9_-]/g,'_')}/${f.path}`})));
}
