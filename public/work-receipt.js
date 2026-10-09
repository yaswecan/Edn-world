import {bindPrivateAccount} from './private-session.js';
const status=document.querySelector('#receipt-status'),container=document.querySelector('#receipt-files');
try{
 const session=await (await fetch('/api/session')).json();bindPrivateAccount(session.user);
 const id=new URLSearchParams(location.search).get('id');if(!id)throw Error('Choisis un reçu depuis ta séance.');
 const response=await fetch('/api/work-submissions/'+encodeURIComponent(id)),data=await response.json();if(!response.ok)throw Error(data.error||'Connecte-toi pour consulter ton travail.');
 status.textContent='Travail reçu le '+new Date(data.receipt.receivedAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})+'. Cet état reste conservé lorsque tu continues à travailler.';
 const activityName=path=>data.snapshot.manifest.versions.activities?.find(a=>path.startsWith(a.folder+'/'))?.title;
 for(const file of data.snapshot.files){
  if(file.path.endsWith('/lab-evidence.json'))continue;
  const article=document.createElement('article');article.className='card pad';const heading=document.createElement('h2');heading.textContent=file.path==='answers.json'?'Mes réponses':[activityName(file.path),file.path.split('/').at(-1)].filter(Boolean).join(' · ');article.append(heading);
  if(file.path==='answers.json'){
   for(const [activity,answer]of Object.entries(JSON.parse(file.content))){const title=document.createElement('h3'),text=document.createElement('pre');title.textContent=data.snapshot.manifest.versions.activities?.find(a=>a.id===activity)?.title||'Réponse';text.textContent=answer;article.append(title,text);}
  }else{const pre=document.createElement('pre');pre.textContent=file.content;article.append(pre);const link=document.createElement('a');link.textContent='Télécharger ce fichier';link.download=file.path.split('/').at(-1);link.href=URL.createObjectURL(new Blob([file.content],{type:'text/plain;charset=utf-8'}));article.append(link);}
  container.append(article);
 }
 for(const file of data.snapshot.manifest.external.filter(f=>!data.snapshot.files.some(t=>t.path===f.path))){const link=document.createElement('a');link.className='btn';link.textContent='Télécharger '+file.path.split('/').at(-1);link.href=`/api/work-submissions/${encodeURIComponent(id)}/file?path=${encodeURIComponent(file.path)}`;container.append(link);}
}catch(e){status.textContent=e.message;}
