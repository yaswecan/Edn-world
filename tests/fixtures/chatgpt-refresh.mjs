import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createChatGPT,ISSUER,TOKEN,AUTHORIZE} from '../../server/ai/chatgpt.mjs';
const [directory,profileId]=process.argv.slice(2);
const json=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
const client=createChatGPT({directory,origin:'http://127.0.0.1:4181',fetchImpl:async url=>{
 if(String(url)===ISSUER+'/.well-known/openid-configuration')return json({issuer:ISSUER,authorization_endpoint:AUTHORIZE,token_endpoint:TOKEN,jwks_uri:ISSUER+'/jwks',revocation_endpoint:ISSUER+'/revoke'});
 if(String(url)===TOKEN){await appendFile(join(directory,'refresh-count.txt'),'refresh\n',{mode:0o600});await new Promise(r=>setTimeout(r,100));return json({access_token:'synthetic-child-access',refresh_token:'synthetic-child-refresh',expires_in:3600,token_type:'Bearer'});}
 throw Error('Unexpected external request');
}});
await client.access({id:'teacher-one',classId:'A1'},profileId);
