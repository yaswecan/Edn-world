import {readFileSync} from 'node:fs';
import {localContent} from './lesson-content.mjs';
import {demoLesson} from './demo-lesson.mjs';
import {orderAndTime} from './lesson-structure.mjs';
import {buildDiagnostic} from './diagnostic.mjs';

// Uses the real generator, not a separate authored showcase.
export function demoFlexbox(){
 const library=JSON.parse(readFileSync(new URL('../legacy/pedagolab/public/data/resources.json',import.meta.url))).units;
 const r=library.find(r=>r.code==='BC04-C2-2');
 const entry={date:'2026-10-05',duration:180,objective:'Organiser quatre cartes avec Flexbox',activity:r.task,skills:[r.code]};
 const node={n3_code:r.code,n3_label:r.skillLabel,observable_criterion:r.proof,expected_trace:r.proof,notions_tools:r.lesson,scaffolding_rule:r.questions[0].feedback};
 const diagnostic=buildDiagnostic(null,null,[node],'DEMO-FLEXBOX',library);
 const content=localContent(entry,[node],library);orderAndTime(content,180,diagnostic.duration);
 const original=demoLesson();
 return {...original,...content,lessonId:'DEMO-FLEXBOX',date:entry.date,planEntryId:'demo-flexbox',sequence:'S03 · HTML / CSS · Flexbox',skills:entry.skills,prerequisites:[],reactivation:[],resources:[r.code],diagnostic,timeline:content.blocks.map(b=>({blockId:b.id,minutes:b.minutes})),studentFlow:content.blocks.map(b=>b.id),slides:content.blocks.map(b=>({title:b.title,body:b.content}))};
}
