/** Server-only configuration. Never imported by a file in docs/. */
import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
export const hash = value => createHash('sha256').update(String(value)).digest('hex');
export const secretEqual = (a,b) => typeof a === 'string' && typeof b === 'string' &&
  timingSafeEqual(Buffer.from(hash(a),'hex'),Buffer.from(hash(b),'hex'));
export function integer(value, fallback, min, max) {
  if (value === undefined || String(value).trim() === '') return fallback;
  const n=Number(value); return Number.isSafeInteger(n)&&n>=min&&n<=max?n:fallback;
}
export function readConfig(env=process.env) {
  const databaseUrl=(env.DATABASE_URL||'').trim();
  const teacherPassword=(env.TEACHER_PASSWORD||'').trim();
  const classCode=(env.CLASS_CODE||'').trim();
  const problems=[];
  if(!databaseUrl) problems.push('DATABASE_URL');
  else {try {const u=new URL(databaseUrl); if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname.endsWith('.neon.tech')||!u.username||!u.password)problems.push('DATABASE_URL (chaîne Neon attendue)');}catch{problems.push('DATABASE_URL (format)');}}
  if(teacherPassword.length<20||teacherPassword.length>256)problems.push('TEACHER_PASSWORD (20 à 256 caractères)');
  if(classCode.length<8||classCode.length>128)problems.push('CLASS_CODE (8 à 128 caractères)');
  const classId=(env.CLASS_ID||'a1-bios-os').trim();
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(classId))problems.push('CLASS_ID (lettres, chiffres, tirets)');
  const scope=`${env.VERCEL_ENV||'development'}:${classId}`;
  const teacherVersion=hash(`teacher:${teacherPassword}`);
  const studentVersion=hash(`class:${classCode}`);
  return {
    databaseUrl,teacherPassword,classCode,scope,teacherVersion,studentVersion,
    classLabel:String(env.CLASS_LABEL||'EDEN · BIOS / OS · mardi').slice(0,100),
    retentionDays:integer(env.RETENTION_DAYS,30,1,365),
    cronSecret:(env.CRON_SECRET||'').trim(),
    secure:env.VERCEL==='1'||env.NODE_ENV==='production',
    publicOrigin:(env.PUBLIC_ORIGIN||'').trim(),problems,
    configured:problems.length===0,
    ipKey(ip,kind) {return createHmac('sha256',teacherPassword).update(`${scope}:${kind}:${ip}`).digest('hex');}
  };
}
