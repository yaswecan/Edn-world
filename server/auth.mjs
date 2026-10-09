import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {hash} from './importer.mjs';
import {fail,now,uid} from './store.mjs';
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function passwordMatches(password,stored){if(!stored||typeof password!=='string'||password.length>1024)return false;const [salt,key]=stored.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(key,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected);}
export function safeUser(u){return {id:u.id,classId:u.classId,role:u.role,displayName:u.displayName,username:u.username};}
export function cookie(res,token){res.setHeader('Set-Cookie',`eden_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?43200:0}${process.env.NODE_ENV==='production'?'; Secure':''}`);}
export async function createSession(store,user,res){const token=randomBytes(32).toString('hex');await store.insert('sessions',{id:hash(token),classId:user.classId,userId:user.id,role:user.role,authVersion:user.authVersion||0,expiresAt:new Date(Date.now()+43200000).toISOString()});cookie(res,token);return safeUser(user);}
export function authentication(store){return async(req,res,next)=>{
 const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('eden_session='))?.slice(13);
 if(token){const session=await store.get('sessions',hash(token));if(session&&session.expiresAt>now()){const u=await store.get(session.role==='teacher'?'teachers':'learners',session.userId);if(u&&!u.suspended&&u.classId===session.classId&&(u.authVersion||0)===(session.authVersion||0)){req.user={...u,role:session.role};req.sessionId=session.id;}}}
 if(req.user)res.setHeader('X-Eden-Actor',req.user.id);
 if(req.headers['x-eden-actor']&&req.headers['x-eden-actor']!==req.user?.id)fail(401,'Le compte connecté a changé. Reconnectez-vous.');
 next();
 };}
export const loggedIn=(req,res,next)=>{if(!req.user)fail(401,'Connectez-vous pour continuer.');next();};
export const teacher=(req,res,next)=>{if(!req.user)fail(401,'Connexion professeur requise.');if(req.user.role!=='teacher')fail(403,'Action réservée au professeur.');next();};
export const student=(req,res,next)=>{if(!req.user)fail(401,'Connexion élève requise.');if(req.user.role!=='student')fail(403,'Action réservée à un compte élève.');next();};
export function protectOrigin(req,res,next){if(['POST','PUT','PATCH','DELETE'].includes(req.method)){const origin=req.headers.origin;if(origin){let host;try{host=new URL(origin).host;}catch{fail(403,'Origine invalide.');}if(host!==req.headers.host)fail(403,'Origine non autorisée.');}else if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Requête intersite refusée.');}next();}
const buckets=new Map();
export function limitLogin(req,res,next){const key=req.ip,nowMs=Date.now();let b=buckets.get(key);if(!b||b.until<nowMs){b={count:0,until:nowMs+600000};buckets.set(key,b);}if(++b.count>25)fail(429,'Trop de tentatives. Réessayez dans dix minutes.');if(buckets.size>10000)for(const [k,v] of buckets)if(v.until<nowMs)buckets.delete(k);next();}
export function accountLimit(max=30, windowMs=60000) {
 const attempts=new Map();
 return (req,_res,next)=>{const key=`${req.ip}:${req.user?.role}:${req.user?.id}`,time=Date.now();let b=attempts.get(key);
  if(!b||b.until<=time){b={count:0,until:time+windowMs};attempts.set(key,b);}
  if(attempts.size>10000)for(const [k,v] of attempts)if(v.until<=time)attempts.delete(k);
  if(++b.count>max)fail(429,'Trop de tentatives. Réessaie plus tard.');next();};
}
// Called inside the host transaction by self-service and existing teacher assistance.
export async function replacePassword(tx, account, role, password) {
 account.passwordHash=passwordHash(password);account.authVersion=(account.authVersion||0)+1;
 await tx.put(role==='teacher'?'teachers':'learners',account);
 for(const session of await tx.list('sessions',account.classId))if(session.userId===account.id&&session.role===role)await tx.remove('sessions',session.id);
}
export function privateAccount(account) {
 return {username:account.username, email:account.email||null, emailVerification:'not_supported',
  passwordChange:!!account.passwordHash, passwordMinLength:12, passwordMaxLength:1024,
  passwordRecovery:false, assistance:account.role==='student'?'teacher':'administrator'};
}
export async function changePassword(tx, actor, sessionId, input) {
 const table=actor.role==='teacher'?'teachers':'learners';
 const account=await tx.get(table,actor.id),session=await tx.get('sessions',sessionId);
 if(!account||!session||session.expiresAt<=now()||session.userId!==actor.id||session.role!==actor.role||account.classId!==actor.classId
  ||(session.authVersion||0)!==(account.authVersion||0))fail(401,'Ta session a expiré. Reconnecte-toi.');
 if(!input||!Object.keys(input).every(k=>['currentPassword','newPassword','confirmation'].includes(k)))fail(400,'Champ de sécurité non autorisé.');
 if(!account.passwordHash)fail(409,'Ce compte ne permet pas de modifier un mot de passe ici. Contacte la personne qui gère ton accès.');
 if(typeof input.newPassword!=='string'||input.newPassword.length<12||input.newPassword.length>1024)fail(400,'Choisis un mot de passe de 12 à 1 024 caractères.');
 if(input.newPassword!==input.confirmation)fail(400,'Les mots de passe ne correspondent pas.');
 if(!passwordMatches(input.currentPassword,account.passwordHash))fail(400,'Le mot de passe actuel est incorrect.');
 await replacePassword(tx,account,actor.role,input.newPassword);
 await tx.audit(actor,'account.password_changed',actor.id);
 return {changed:true,reauthenticate:true};
}
export async function seedTeacher(store){if(!process.env.EDEN_TEACHER_PASSWORD)return;return store.transaction(async tx=>{if((await tx.list('teachers')).length)return;if(process.env.EDEN_TEACHER_PASSWORD.length<12)throw Error('EDEN_TEACHER_PASSWORD doit contenir au moins 12 caractères.');await tx.insert('teachers',{id:uid('teacher'),classId:'A1',displayName:'Professeur',username:process.env.EDEN_TEACHER_USERNAME||'professeur',role:'teacher',passwordHash:passwordHash(process.env.EDEN_TEACHER_PASSWORD)});});}
