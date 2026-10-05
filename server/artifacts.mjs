import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {Readable} from 'node:stream';
import archiver from 'archiver';
import {hash} from './importer.mjs';
import {requireValue} from './store.mjs';
let objectClient;
async function s3(){const sdk=await import('@aws-sdk/client-s3');objectClient??=new sdk.S3Client({region:process.env.AWS_REGION||'eu-west-3',...(process.env.EDEN_S3_ENDPOINT?{endpoint:process.env.EDEN_S3_ENDPOINT,forcePathStyle:true}:{})});return {client:objectClient,...sdk};}
async function objectBody(file){requireValue(file.s3Key&&/^artifacts\/[a-f0-9]{64}$/.test(file.s3Key),'Clé objet invalide.');const {client,GetObjectCommand}=await s3();const result=await client.send(new GetObjectCommand({Bucket:process.env.EDEN_S3_BUCKET,Key:file.s3Key}));return result.Body;}
function pathFor(key){requireValue(/^[a-f0-9]{64}$/.test(key),'Identifiant d’artefact invalide.');return join(resolve(process.env.EDEN_ARTIFACT_PATH||'.data/artifacts'),key.slice(0,2),key);}
export async function storeArtifact(buffer,{inline=false}={}){const sha256=hash(buffer);if(process.env.EDEN_S3_BUCKET){const {client,PutObjectCommand}=await s3();const s3Key='artifacts/'+sha256;await client.send(new PutObjectCommand({Bucket:process.env.EDEN_S3_BUCKET,Key:s3Key,Body:buffer,ContentType:'application/octet-stream',Metadata:{sha256},ChecksumSHA256:Buffer.from(sha256,'hex').toString('base64')}));return {sha256,bytes:buffer.length,s3Key};}if(inline)return {sha256,bytes:buffer.length,base64:buffer.toString('base64')};const path=pathFor(sha256);await mkdir(resolve(path,'..'),{recursive:true});try{await writeFile(path,buffer,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}return {sha256,bytes:buffer.length,artifactKey:sha256};}
export function artifactStream(file){if(file.s3Key)return Readable.from((async function*(){const body=await objectBody(file);for await(const chunk of body)yield chunk;})());return file.artifactKey?createReadStream(pathFor(file.artifactKey)):Readable.from(Buffer.from(file.base64,'base64'));}
export async function artifactBuffer(file){const buffer=file.s3Key?Buffer.from(await (await objectBody(file)).transformToByteArray()):file.artifactKey?await readFile(pathFor(file.artifactKey)):Buffer.from(file.base64,'base64');requireValue(!file.sha256||hash(buffer)===file.sha256,'Artefact corrompu.');return buffer;}
export function streamCorpus(pack,response){const archive=archiver('zip',{zlib:{level:6}});archive.on('error',error=>response.destroy(error));response.on('close',()=>archive.abort());archive.pipe(response);for(const f of pack.files){const input=artifactStream(f);input.on('error',error=>archive.destroy(error));archive.append(input,{name:`${pack.manifest.lessonId}/${f.path}`});}return archive.finalize();}
