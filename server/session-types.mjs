import {requireValue} from './store.mjs';
import {SESSION_TYPES,PROGRAMMING_TEMPLATES} from '../public/session-types.js';
export function sessionType(input,entry={}){
 const value=input?.sessionType??entry.sessionType;
 requireValue(value===undefined||SESSION_TYPES.some(t=>t.id===value),'Type de séance invalide : Conception web ou Programmation.');
 return value;
}
export function programmingTemplate(input,entry={}){
 const value=input?.programmingTemplate??entry.programmingTemplate??'tableaux-complet';
 const template=PROGRAMMING_TEMPLATES.find(t=>t.id===value);
 requireValue(template,'Choisissez un parcours de programmation disponible.');
 return template;
}
