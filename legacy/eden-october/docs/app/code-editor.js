/** Lightweight accessible editor: native textarea, syntax overlay, gutter, indentation.
 * No downloaded editor runtime and no HTML from student source inserted unescaped.
 */
import {esc} from './utils.js';
export function highlight(source){
 const re=/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:function|return|const|let|var|if|else|true|false|undefined)\b|\b\d+(?:\.\d+)?\b)/g;
 let html='',last=0;for(const m of source.matchAll(re)){html+=esc(source.slice(last,m.index));const v=m[0],type=v.startsWith('//')||v.startsWith('/*')?'comment':/^["'`]/.test(v)?'string':/^\d/.test(v)?'number':'keyword';html+=`<span class="syntax-${type}">${esc(v)}</span>`;last=m.index+v.length;}
 return html+esc(source.slice(last))+'\n';
}
export function mountEditor(root=document){
 const textarea=root.querySelector('#code');if(!textarea)return;
 const wrapper=textarea.closest('[data-editor]');if(!wrapper)return;const syntax=wrapper.querySelector('.syntax-layer code'),gutter=wrapper.querySelector('.line-numbers');
 function paint(){syntax.innerHTML=highlight(textarea.value);gutter.textContent=Array.from({length:Math.max(1,textarea.value.split('\n').length)},(_,i)=>i+1).join('\n');scroll();}
 function scroll(){syntax.parentElement.style.transform=`translate(${-textarea.scrollLeft}px,${-textarea.scrollTop}px)`;gutter.style.transform=`translateY(${-textarea.scrollTop}px)`;}
 textarea.addEventListener('scroll',scroll);textarea.addEventListener('input',paint);
 textarea.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();root.querySelector('#run-function')?.click();return;}
  if(e.key!=='Tab'||textarea.disabled)return;e.preventDefault();const start=textarea.selectionStart,end=textarea.selectionEnd,val=textarea.value;
  if(e.shiftKey){const line=val.lastIndexOf('\n',start-1)+1;const count=val.slice(line).startsWith('  ')?2:val[line]===' '?1:0;if(count){textarea.setRangeText('',line,line+count,'preserve');textarea.selectionStart=Math.max(line,start-count);textarea.selectionEnd=Math.max(line,end-count);}}
  else if(start===end)textarea.setRangeText('  ',start,end,'end');
  else{const line=val.lastIndexOf('\n',start-1)+1,selected=val.slice(line,end),indented=selected.replace(/^/gm,'  ');textarea.setRangeText(indented,line,end,'select');}
  textarea.dispatchEvent(new Event('input',{bubbles:true}));
 });paint();
}
