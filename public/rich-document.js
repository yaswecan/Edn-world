// Shared, deterministic rich document contract. Never interpret lesson prose as HTML.
export const escapeRich=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeLink=url=>typeof url==='string'&&/^(https?:\/\/|mailto:)/i.test(url)&&!/[\u0000-\u0020]/.test(url);
export const safeImage=url=>typeof url==='string'&&(/^(?:\/api\/(?:lesson-assets|lesson-transfer-files)\/[a-f0-9]{64}|\/assets\/[\w./-]+)$/.test(url)||/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url)||/^tweenteach-file:[a-f0-9]{64}:image\/(png|jpeg|webp|gif)$/.test(url));
export function textDocument(text='',code=false){return {type:'doc',content:code?[{type:'codeBlock',content:text?[{type:'text',text}]:[]}]:String(text).split('\n\n').map(p=>({type:'paragraph',content:p.split('\n').flatMap((line,i)=>[...(i?[{type:'hardBreak'}]:[]),...(line?[{type:'text',text:line}]:[])])}))};}
export function richText(doc){if(!doc)return '';if(doc.type==='text')return doc.text;if(doc.type==='hardBreak')return '\n';if(doc.type==='image')return doc.attrs?.title||doc.attrs?.alt||'';return (doc.content||[]).map(richText).join(doc.type==='doc'?'\n\n':doc.type==='tableRow'?'\t':['bulletList','orderedList','table'].includes(doc.type)?'\n':'');}
const tags={paragraph:'p',blockquote:'blockquote',bulletList:'ul',orderedList:'ol',listItem:'li',codeBlock:'pre',table:'table',tableRow:'tr',tableHeader:'th',tableCell:'td'};
export function renderRich(doc){
 if(!doc)return '';const a=doc.attrs||{},inner=(doc.content||[]).map(renderRich).join('');
 if(doc.type==='text'){let t=escapeRich(doc.text);for(const m of doc.marks||[]){const tag={bold:'strong',italic:'em',underline:'u',strike:'s',code:'code'}[m.type];if(tag)t=`<${tag}>${t}</${tag}>`;else if(m.type==='link'&&safeLink(m.attrs?.href))t=`<a href="${escapeRich(m.attrs.href)}" target="_blank" rel="noopener noreferrer">${t}</a>`;}return t;}
 if(doc.type==='doc')return inner;if(doc.type==='hardBreak')return '<br>';if(doc.type==='horizontalRule')return '<hr>';
 if(doc.type==='image')return safeImage(a.src)?`<figure><img src="${escapeRich(a.src)}" alt="${escapeRich(a.alt||'')}" loading="lazy">${a.title?`<figcaption>${escapeRich(a.title)}</figcaption>`:''}</figure>`:'';
 const tag=doc.type==='heading'?`h${[2,3,4].includes(a.level)?a.level:2}`:tags[doc.type];if(!tag)return '';
 const attrs=['tableHeader','tableCell'].includes(doc.type)?` colspan="${Number(a.colspan)||1}" rowspan="${Number(a.rowspan)||1}"`:doc.type==='orderedList'?` start="${Number(a.start)||1}"`:'';
 return `<${tag}${attrs}>${doc.type==='codeBlock'?`<code>${inner}</code>`:inner}</${tag}>`;
}
export function validateRich(doc){
 let count=0;const check=(ok,msg)=>{if(!ok)throw Error(msg);};
 const visit=(n,depth=0)=>{check(n&&typeof n==='object'&&!Array.isArray(n)&&++count<20000&&depth<40,'Document riche trop complexe.');check(Object.keys(n).every(k=>['type','text','attrs','content','marks'].includes(k)),'Champ riche inconnu.');check(['doc','text','heading','hardBreak','horizontalRule','image',...Object.keys(tags)].includes(n.type),'Type de contenu riche inconnu : '+n.type);
 if(n.type==='text')check(typeof n.text==='string'&&n.text.length>0,'Texte riche invalide.');
 if(n.content){check(Array.isArray(n.content),'Contenu riche invalide.');n.content.forEach(c=>visit(c,depth+1));}
 const keys={heading:['level'],orderedList:['start','type'],image:['src','alt','title','width','height'],codeBlock:['language'],tableCell:['colspan','rowspan','colwidth','align'],tableHeader:['colspan','rowspan','colwidth','align'],paragraph:['textAlign']};
 if(n.attrs){check(typeof n.attrs==='object'&&Object.keys(n.attrs).every(k=>(keys[n.type]||[]).includes(k)),'Attribut riche inconnu.');for(const v of Object.values(n.attrs))check(v===null||typeof v==='string'||typeof v==='number'||Array.isArray(v)&&v.every(x=>Number.isFinite(x)),'Attribut riche invalide.');}
 if(['tableCell','tableHeader'].includes(n.type)){for(const key of ['colspan','rowspan'])if(n.attrs?.[key]!=null)check(Number.isInteger(n.attrs[key])&&n.attrs[key]>=1&&n.attrs[key]<=20,'Cellule de tableau trop grande.');if(n.attrs?.colwidth)check(n.attrs.colwidth.length<=20&&n.attrs.colwidth.every(v=>Number.isFinite(v)&&v>=0&&v<=2000),'Largeur de colonne invalide.');}
 if(n.type==='table')check((n.content?.length||0)<=100,'Tableau limité à 100 lignes.');
 if(n.type==='tableRow')check((n.content?.length||0)<=20,'Tableau limité à 20 colonnes.');
 if(n.type==='image')check(safeImage(n.attrs?.src),'Importez une image PNG, JPEG, WebP ou GIF dans la séance.');
 if(n.type==='heading')check([2,3,4].includes(n.attrs?.level),'Niveau de titre invalide.');
 if(n.marks){check(Array.isArray(n.marks),'Mise en forme invalide.');for(const m of n.marks){check(m&&Object.keys(m).every(k=>['type','attrs'].includes(k))&&['bold','italic','underline','strike','code','link'].includes(m.type),'Mise en forme inconnue.');if(m.type==='link')check(safeLink(m.attrs?.href)&&Object.keys(m.attrs).every(k=>['href','target','rel','class','title'].includes(k)),'Lien invalide.');else check(!m.attrs||Object.keys(m.attrs).length===0,'Attribut de mise en forme invalide.');}}
 };check(doc?.type==='doc','Document riche attendu.');visit(doc);return doc;
}
