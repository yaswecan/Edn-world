// Trusted inspector in a separate opaque frame. User HTML remains inert and
// network access is denied by the game CSP. No player script is executed here.
(()=>{
 const clean=html=>{const doc=new DOMParser().parseFromString(html,'text/html');for(const el of doc.querySelectorAll('script,iframe,object,embed,link,meta,base,form,svg,math'))el.remove();for(const el of doc.querySelectorAll('*'))for(const a of [...el.attributes])if(/^on/i.test(a.name)||['src','srcset','href','action','formaction'].includes(a.name))el.removeAttribute(a.name);return doc.body.innerHTML;};
 addEventListener('message',async event=>{
  if(event.source!==parent||event.data?.type!=='layout')return;
  const {files,token}=event.data;
  document.body.innerHTML=clean(files['index.html']||'');
  const style=document.createElement('style');style.textContent='body{margin:12px;font:16px system-ui;color:#173044;background:#eff4f5}'+(files['style.css']||'');document.head.replaceChildren(style);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0;};
  const title=[...document.querySelectorAll('h1,h2,h3')].find(e=>e.textContent.trim()==='NOVA'),actions=document.querySelector('.actions'),buttons=[...document.querySelectorAll('.actions button')];
  const errors=[];if(!visible(title))errors.push('Affiche un titre NOVA.');if(![...document.querySelectorAll('p')].some(e=>visible(e)&&e.textContent.trim()))errors.push('Affiche le rôle sous l’identité.');
  if(!visible(actions)||buttons.length<2||!buttons.every(b=>visible(b)&&b.textContent.trim()))errors.push('Affiche deux boutons nommés dans .actions.');
  if(buttons.length>=2){const a=buttons[0].getBoundingClientRect(),b=buttons[1].getBoundingClientRect();if(Math.max(b.left-a.right,a.left-b.right,b.top-a.bottom,a.top-b.bottom)<7.5)errors.push('Espace les deux actions d’au moins 8 px.');}
  if(document.documentElement.scrollWidth>innerWidth+1)errors.push('La carte déborde de l’écran.');
  parent.postMessage({type:'layout-result',token,pass:errors.length===0,message:errors.join(' ')||'Carte lisible et actions accessibles.'},'*');
 });
 parent.postMessage({type:'layout-ready'},'*');
})();
