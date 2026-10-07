import {mkdir,open,readFile,rename,lstat,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import lockfile from 'proper-lockfile';

// Separate from the business database and all exports. Never serve this directory.
export function credentialVault(directory) {
 const root=resolve(directory),file=resolve(root,'connections.json');
 async function check(path,directory=false) {
  const stat=await lstat(path);
  if(stat.isSymbolicLink()|| (directory?!stat.isDirectory():!stat.isFile()) || (stat.mode&0o077) || (process.getuid&&stat.uid!==process.getuid()))throw Error('Stockage ChatGPT non protégé : répertoire 0700 et fichiers 0600 requis.');
 }
 async function init() {
  await mkdir(root,{recursive:true,mode:0o700});await check(root,true);
 }
 async function locked(fn) {
  await init();let compromised=false;
  const release=await lockfile.lock(root,{realpath:false,lockfilePath:resolve(root,'vault.lock'),stale:120000,update:10000,retries:{retries:80,minTimeout:100,maxTimeout:500},onCompromised:()=>{compromised=true;}});
  try{
   let data;try{await check(file);data=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;data={version:1,hostId:`urn:uuid:${randomUUID()}`,profiles:[],attempts:[]};}
   if(data.version!==1||!Array.isArray(data.profiles)||!Array.isArray(data.attempts))throw Error('Coffre ChatGPT incompatible.');
   async function save(){
    if(compromised)throw Error('Verrou du coffre perdu. Reconnexion nécessaire.');
    const temporary=file+'.'+randomUUID()+'.tmp',handle=await open(temporary,'wx',0o600);
    try{await handle.writeFile(JSON.stringify(data));await handle.sync();}finally{await handle.close();}
    try{if(compromised)throw Error('Verrou du coffre perdu.');await rename(temporary,file);const dir=await open(dirname(file),'r');try{await dir.sync();}finally{await dir.close();}}
    finally{await unlink(temporary).catch(()=>{});}
   }
   await save();return await fn(data,save);
  }finally{await release().catch(()=>{});}
 }
 return {locked};
}
