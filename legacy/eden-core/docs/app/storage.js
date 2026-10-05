import {createState,parseState} from './model.js';
import {SESSION} from './content.js';
// Le chemin distingue deux cours hébergés sous le même github.io.
export const storageKey = `eden:${SESSION.id}:${new URL('../',import.meta.url).pathname}`;
export function load(){
 try{const raw=localStorage.getItem(storageKey);return {state:raw?parseState(raw):null,error:null};}
 catch(e){return {state:null,error:'La sauvegarde locale ne peut pas être relue. Tu peux importer un export JSON ou recommencer.'};}
}
export function save(state){
 try{state.updatedAt=Date.now();localStorage.setItem(storageKey,JSON.stringify(state));return true;}catch{return false;}
}
export function clear(){try{localStorage.removeItem(storageKey);}catch{/* Mode sans stockage : rien à effacer. */}}
