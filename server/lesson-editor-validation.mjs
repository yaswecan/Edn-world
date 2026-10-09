import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {TableKit} from '@tiptap/extension-table';
import {validateRich,safeImage} from '../public/rich-document.js';
import {fail,requireValue,scoped} from './store.mjs';
import {synchronizeSpec} from '../public/lesson-editor-model.js';
const richSchema=getSchema([StarterKit.configure({heading:{levels:[2,3,4]}}),Image,TableKit]);
const validateDocument=doc=>{validateRich(doc);richSchema.nodeFromJSON(doc).check();};
export function validateEditorContent(spec){
 try{
 const rich=[];
 for(const b of spec.blocks)if(b.editor){
  const ids=new Set();for(const i of b.editor.items){requireValue(!ids.has(i.id),'Identifiant de bloc interne dupliqué.');ids.add(i.id);
   if(i.kind==='rich'){validateDocument(i.doc);requireValue(i.role,'Rôle textuel manquant.');rich.push(i.doc);}
   if(['activity','diagnosticActivity'].includes(i.kind))requireValue((i.kind==='activity'?spec.activities:spec.diagnostic.tasks).some(a=>a.id===i.activityId),'Activité référencée absente.');
   if(i.kind==='board')requireValue(['01-parent','02-axes','03-espace-libre','04-aligner','05-espaces','06-une-regle','07-deboguer','08-refaire'].includes(i.board),'Tableau inconnu.');
  }
  requireValue(JSON.stringify(b.activityIds)===JSON.stringify(b.editor.items.filter(i=>i.kind==='activity').map(i=>i.activityId)),'Ordre des activités incohérent.');
 }
 for(const a of [...spec.activities,...spec.diagnostic.tasks])for(const doc of Object.values(a.richText||{})){validateDocument(doc);rich.push(doc);}
 // Prevent stale legacy fields from becoming an alternative source of truth.
 const derived=synchronizeSpec(structuredClone(spec));
 for(const [i,b] of spec.blocks.entries())if(b.editor)for(const key of ['content','teaching','boards'])requireValue(JSON.stringify(b[key])===JSON.stringify(derived.blocks[i][key]),'Projection du contenu riche incohérente.');
 return rich;
 }catch(e){if(e.status)throw e;fail(422,e.message);}
}
export async function validateEditorAssets(store,spec,actor){
 const docs=validateEditorContent(spec);
 async function walk(node){if(node.type==='image'){const src=node.attrs.src;requireValue(safeImage(src),'Image invalide.');if(src.startsWith('/api/')){const asset=await scoped(store,'lesson_assets',src.split('/').at(-1),actor);requireValue(['image/png','image/jpeg','image/webp','image/gif'].includes(asset.mimeType),'Image non prise en charge.');}}for(const c of node.content||[])await walk(c);}
 for(const doc of docs)await walk(doc);
 for(const a of [...spec.activities,...spec.diagnostic.tasks])if(a.workshop?.visual)await scoped(store,'lesson_assets',a.workshop.visual.id,actor);
 if(spec.codeStation)await scoped(store,'game_missions',spec.codeStation.missionId,actor);
}
