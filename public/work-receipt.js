import {bindPrivateAccount,invalidatePrivateSession,announceAccountChange} from './private-session.js';
import {StudentHubLayout,StudentHubState} from './student-hub.js';
import {studentError} from './student-copy.js';
let session={};const urls=[];
const shell=content=>{document.querySelector('#app').innerHTML=StudentHubLayout({session,url:location.href,title:'Mon travail remis',content});};
async function load(){
try{
 for(const url of urls.splice(0))URL.revokeObjectURL(url);
 const auth=await fetch('/api/session');session=await auth.json();bindPrivateAccount(session.user);
 if(!session.user){location.replace('/today');return;}
 if(session.user.role!=='student'){location.replace('/suivi.html');return;}
 shell(StudentHubState({kind:'loading'}));

 const id=new URLSearchParams(location.search).get('id');if(!id)throw Object.assign(Error(),{status:404});
 const response=await fetch('/api/work-submissions/'+encodeURIComponent(id)),data=await response.json();if(!response.ok)throw Object.assign(Error(),{status:response.status});
 shell('<p id="receipt-status" role="status"></p><section id="receipt-files"></section>');
 const status=document.querySelector('#receipt-status'),container=document.querySelector('#receipt-files');
 status.textContent='Travail reçu le '+new Date(data.receipt.receivedAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})+'. Cet état reste conservé lorsque tu continues à travailler.';
 const activityName=path=>data.snapshot.manifest.versions.activities?.find(a=>path.startsWith(a.folder+'/'))?.title;
 for(const file of data.snapshot.files){
  if(file.path.endsWith('/lab-evidence.json'))continue;
  const article=document.createElement('article');article.className='card pad';const heading=document.createElement('h2');heading.textContent=file.path==='answers.json'?'Mes réponses':[activityName(file.path),file.path.split('/').at(-1)].filter(Boolean).join(' · ');article.append(heading);
  if(file.path==='answers.json'){
   for(const [activity,answer]of Object.entries(JSON.parse(file.content))){const title=document.createElement('h3'),text=document.createElement('pre');title.textContent=data.snapshot.manifest.versions.activities?.find(a=>a.id===activity)?.title||'Réponse';text.textContent=answer;article.append(title,text);}
  }else{const pre=document.createElement('pre');pre.textContent=file.content;article.append(pre);const link=document.createElement('a');link.textContent='Télécharger ce fichier';link.download=file.path.split('/').at(-1);link.className='btn';link.href=URL.createObjectURL(new Blob([file.content],{type:'text/plain;charset=utf-8'}));urls.push(link.href);article.append(link);}
  container.append(article);
 }
 for(const file of data.snapshot.manifest.external.filter(f=>!data.snapshot.files.some(t=>t.path===f.path))){const link=document.createElement('a');link.className='btn';link.textContent='Télécharger '+file.path.split('/').at(-1);link.href=`/api/work-submissions/${encodeURIComponent(id)}/file?path=${encodeURIComponent(file.path)}`;container.append(link);}
}catch(e){if(e.name==='AbortError')return;shell(StudentHubState({kind:e.status===403?'forbidden':'error',message:studentError(e),action:'<button class="btn" data-action="retry">Réessayer</button>'}));}
}
document.addEventListener('click',async e=>{const button=e.target.closest('[data-action]');if(!button)return;if(['retry','refresh-student'].includes(button.dataset.action))return load();if(button.dataset.action==='logout'){button.disabled=true;try{const r=await fetch('/api/logout',{method:'POST'});if(!r.ok)throw Error();invalidatePrivateSession();announceAccountChange();location.href='/today';}catch{button.disabled=false;shell(StudentHubState({kind:'error',message:'La déconnexion n’a pas pu être confirmée. Réessaie.'}));}}});
window.addEventListener('pagehide',()=>{for(const url of urls)URL.revokeObjectURL(url);});
load();
