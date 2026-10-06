import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('serverless startup and PowerPoint export work with CommonJS as the default package type',()=>{
 const result=spawnSync(process.execPath,[
  '--no-experimental-detect-module',
  '--no-experimental-require-module',
  '--experimental-default-type=commonjs',
  '--experimental-strip-types',
  fileURLToPath(new URL('./fixtures/serverless-export.mjs',import.meta.url))
 ],{encoding:'utf8',timeout:30000,env:{...process.env,NODE_OPTIONS:'',DATABASE_URL:'',EDEN_S3_BUCKET:''}});
 assert.equal(result.status,0,result.error?.message||result.stderr||result.stdout);
 assert.match(result.stdout,/Serverless startup and PPTX export passed/);
});
