import {randomBytes} from 'node:crypto';
console.log('# Copie ces valeurs uniquement dans les variables Vercel ou .env.local. Ne les publie pas.');
console.log('TEACHER_PASSWORD='+randomBytes(24).toString('base64url'));
console.log('CLASS_CODE='+randomBytes(9).toString('base64url'));
console.log('CRON_SECRET='+randomBytes(32).toString('base64url'));
