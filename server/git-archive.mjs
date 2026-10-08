import {spawn} from 'node:child_process';
import {mkdir,realpath,lstat,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import lockfile from 'proper-lockfile';
import {now,uid,requireValue,fail} from './store.mjs';
import {canonical,sha256,safeContentPath} from './content-snapshots.mjs';

const controls=['-c','core.hooksPath=/dev/null','-c','core.attributesFile=/dev/null','-c','core.fsmonitor=false','-c','commit.gpgSign=false','-c','protocol.ext.allow=never'];
export function archiveConfig(env=process.env){return env.EDEN_ARCHIVE_REPOSITORY?{repository:resolve(env.EDEN_ARCHIVE_REPOSITORY),id:env.EDEN_ARCHIVE_ID||'private-pedagogy',remote:env.EDEN_ARCHIVE_REMOTE||null}:null;}
export async function gitCommand(repository,args,input='',extra={}){
 return new Promise((resolve,reject)=>{
  const env={PATH:process.env.PATH,LANG:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_AUTHOR_NAME:'EDEN automated archive',GIT_AUTHOR_EMAIL:'archive@example.invalid',GIT_COMMITTER_NAME:'EDEN automated archive',GIT_COMMITTER_EMAIL:'archive@example.invalid',...extra};
  const child=spawn('git',[...controls,...(repository?['--git-dir',repository]:[]),...args],{env,stdio:['pipe','pipe','pipe']});
  const out=[];let size=0,error='';const timer=setTimeout(()=>child.kill('SIGKILL'),30000);
  child.stdout.on('data',b=>{size+=b.length;if(size>8000000)child.kill('SIGKILL');else out.push(b);});
  child.stderr.on('data',b=>{error+=b.toString().slice(0,1000);});
  child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve(Buffer.concat(out).toString('utf8')):reject(Object.assign(Error('Archivage Git interrompu ; contenu durable conservé.'),{gitCode:code,diagnostic:error.slice(0,1000)}));});
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
async function resolveRef(repo,ref){try{return (await gitCommand(repo,['rev-parse','--verify',ref])).trim();}catch(e){if(e.gitCode===128)return null;throw e;}}
async function treeFor(repo,files){
 const root=new Map();for(const f of files){const parts=safeContentPath(f.path).split('/');let tree=root;for(const part of parts.slice(0,-1)){if(!tree.has(part))tree.set(part,new Map());requireValue(tree.get(part) instanceof Map,'Collision de chemins.');tree=tree.get(part);}requireValue(!tree.has(parts.at(-1)),'Collision de chemins.');tree.set(parts.at(-1),f.content);}
 const write=async tree=>{const entries=[];for(const [name,value]of [...tree].sort(([a],[b])=>a.localeCompare(b))){const directory=value instanceof Map,hash=directory?await write(value):(await gitCommand(repo,['hash-object','-w','--stdin'],value)).trim();entries.push(`${directory?'040000 tree':'100644 blob'} ${hash}\t${name}\0`);}return (await gitCommand(repo,['mktree','-z'],entries.join(''))).trim();};
 return write(root);
}
export async function archiveSnapshot(snapshot,config,{afterPush}={}){
 requireValue(config?.repository,'Dépôt d’archivage non configuré.');
 const requested=resolve(config.repository);await mkdir(requested,{recursive:true,mode:0o700});
 requireValue(!(await lstat(requested)).isSymbolicLink(),'Le dépôt d’archivage doit être un chemin réel dédié.');const repo=await realpath(requested);
 const release=await lockfile.lock(repo,{realpath:false,stale:180000,update:10000,retries:0});
 try{
  // Only a dedicated bare repository is accepted, never the application checkout.
  try{requireValue((await gitCommand(repo,['rev-parse','--is-bare-repository'])).trim()==='true','Un dépôt Git bare dédié est requis.');}
  catch(e){if(!e.gitCode)throw e;requireValue((await readdir(repo)).length===0,'Le nouveau dépôt doit être un dossier dédié vide.');await gitCommand(null,['init','--bare','--template=',repo]);}
  const subject=snapshot.manifest.subject;
  const ref='refs/heads/eden/'+sha256(canonical({classId:snapshot.classId,kind:subject.kind,lessonId:subject.lessonId,learnerId:subject.learnerId||null}));
  if(config.remote){
   requireValue(!config.remote.startsWith('-')&&!config.remote.includes('::')&&(/^(https:\/\/|ssh:\/\/|\/)/.test(config.remote)),'Destination Git non autorisée.');
   const remoteHead=(await gitCommand(repo,['ls-remote',config.remote,ref])).trim().split(/\s+/)[0];
   if(remoteHead){await gitCommand(repo,['fetch','--no-tags',config.remote,ref]);const local=await resolveRef(repo,ref);if(!local)await gitCommand(repo,['update-ref',ref,remoteHead,'0'.repeat(40)]);else if(local!==remoteHead){try{await gitCommand(repo,['merge-base','--is-ancestor',local,remoteHead]);await gitCommand(repo,['update-ref',ref,remoteHead,local]);}catch{await gitCommand(repo,['merge-base','--is-ancestor',remoteHead,local]);}}}
  }
  let head=await resolveRef(repo,ref),commit=null;
  if(head){const history=(await gitCommand(repo,['log',ref,'--format=%H','--fixed-strings','--grep',`EDEN-Snapshot: ${snapshot.id}`])).trim().split('\n').filter(Boolean);
   for(const candidate of history){const recorded=await gitCommand(repo,['show',`${candidate}:manifest.json`]);if(recorded===canonical({...snapshot.manifest,sha256:snapshot.sha256})){commit=candidate;break;}}
  }
  if(!commit){
   const tree=await treeFor(repo,[{path:'manifest.json',content:canonical({...snapshot.manifest,sha256:snapshot.sha256})},...snapshot.files.map(f=>({path:`content/${f.path}`,content:f.content}))]);
   commit=(await gitCommand(repo,['commit-tree',tree,...(head?['-p',head]:[])],`${snapshot.manifest.event}\n\nEDEN-Snapshot: ${snapshot.id}\nAutomated archive; not evidence of learner Git proficiency.\n`,{GIT_AUTHOR_DATE:snapshot.manifest.acceptedAt,GIT_COMMITTER_DATE:snapshot.manifest.acceptedAt})).trim();
   await gitCommand(repo,['update-ref',ref,commit,head||'0'.repeat(40)]);head=commit;
  }
  for(const file of snapshot.files)requireValue(sha256(await gitCommand(repo,['show',`${commit}:content/${file.path}`]))===file.sha256,'Projection Git différente de l’instantané.');
  if(config.remote)await gitCommand(repo,['push',config.remote,`${ref}:${ref}`]);
  await afterPush?.();
  return {repositoryId:config.id,commit,ref,paths:['manifest.json',...snapshot.files.map(f=>'content/'+f.path)],confirmedAt:now(),remote:!!config.remote};
 }finally{await release();}
}
export async function runArchiveJob(store,{config=archiveConfig(),project=archiveSnapshot}={}){
 if(!config)return null;
 const job=await store.transaction(async tx=>{
  const next=(await tx.list('archive_outbox')).find(x=>x.attempts<5&&(['pending','retry'].includes(x.state)&&x.availableAt<=now()||x.state==='running'&&x.leaseUntil<=now()));if(!next)return null;
  next.state='running';next.attempts++;next.lease=uid('archivelease');next.leaseUntil=new Date(Date.now()+300000).toISOString();await tx.put('archive_outbox',next);return next;
 });if(!job)return null;
 try{const snapshot=await store.get('content_snapshots',job.snapshotId);requireValue(snapshot&&snapshot.sha256===sha256(canonical(snapshot.manifest)),'Instantané absent ou corrompu.');for(const f of snapshot.files)requireValue(sha256(f.content)===f.sha256,'Fichier durable corrompu.');const result=await project(snapshot,config);
  return store.transaction(async tx=>{const current=await tx.get('archive_outbox',job.id);if(current.lease!==job.lease)return current;Object.assign(current,{state:'confirmed',archive:result,lastError:null,lease:null});return tx.put('archive_outbox',current);});
 }catch(e){return store.transaction(async tx=>{const current=await tx.get('archive_outbox',job.id);if(current.lease!==job.lease)return current;Object.assign(current,{state:current.attempts>=5?'failed':'retry',lastError:e.message,availableAt:new Date(Date.now()+Math.min(3600000,1000*2**current.attempts)).toISOString(),lease:null});return tx.put('archive_outbox',current);});}
}
export async function readArchiveFile(config,commit,path){
 requireValue(config&&/^[a-f0-9]{40}$/.test(commit),'Dépôt autorisé et commit SHA complet requis.');safeContentPath(path);
 const resolved=(await gitCommand(config.repository,['rev-parse','--verify',`${commit}^{commit}`])).trim();requireValue(resolved===commit,'Commit non résolu.');
 const tree=await gitCommand(config.repository,['ls-tree',commit,'--',path]);requireValue(tree.startsWith('100644 blob '),'Seuls les fichiers texte ordinaires sont importables.');
 const text=await gitCommand(config.repository,['show',`${commit}:${path}`]);requireValue(Buffer.byteLength(text)<=1000000,'Fichier importé trop volumineux.');return {text,repositoryId:config.id,commit,path,sha256:sha256(text)};
}
export async function readAuthorizedArchiveFile(store,actor,config,commit,path){
 const manifest=JSON.parse((await readArchiveFile(config,commit,'manifest.json')).text);
 requireValue(typeof manifest.id==='string','Manifeste applicatif absent.');
 const snapshot=await store.get('content_snapshots',manifest.id),archive=await store.get('archive_outbox',manifest.id);
 if(!snapshot||snapshot.classId!==actor.classId||actor.role!=='teacher')fail(404,'Version Git hors du périmètre autorisé.');
 requireValue(archive?.state==='confirmed'&&archive.archive.repositoryId===config.id,'Projection Git non confirmée pour cette version.');
 await gitCommand(config.repository,['merge-base','--is-ancestor',archive.archive.commit,commit]);
 requireValue(snapshot.files.some(f=>`content/${f.path}`===path),'Fichier absent de la liste autorisée.');
 return readArchiveFile(config,commit,path);
}
