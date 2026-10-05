import {readConfig} from '../server/config.mjs';
import {createDatabase} from '../server/database.mjs';
const cfg=readConfig();
if(!cfg.databaseUrl){console.error('DATABASE_URL manque. Copie .env.example vers .env.local et renseigne la chaîne Neon.');process.exit(1);}
try{await createDatabase(cfg.databaseUrl).migrate();console.log('Schéma eden_bios_hub initialisé. Les autres schémas ne sont pas modifiés.');}
catch(error){console.error('Migration impossible. Vérifie la chaîne Neon, le réseau et les droits CREATE SCHEMA. Code :',error.code||error.name);process.exitCode=1;}
