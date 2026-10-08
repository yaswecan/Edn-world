import express from 'express';
import {teacher,accountLimit,cookie} from './auth.mjs';
import {MAX_UPLOAD_BYTES,decodeBackup,inspectBackup,restoreBackup} from './database-snapshot.mjs';

export function databaseRoutes(app,store){
 const upload=[teacher,accountLimit(10),express.raw({type:'application/octet-stream',limit:MAX_UPLOAD_BYTES,inflate:false})];
 app.post('/api/database/import/preview',...upload,async(req,res)=>{
  const snapshot=await decodeBackup(req.body,req.user.classId);
  res.json(await inspectBackup(store,snapshot,req.user,{mode:req.headers['x-database-mode']}));
 });
 app.post('/api/database/import/apply',...upload,async(req,res)=>{
  const snapshot=await decodeBackup(req.body,req.user.classId);
  const result=await restoreBackup(store,snapshot,req.user,req.headers['x-database-confirmation'],{
   mode:req.headers['x-database-mode'],targetConfirmation:req.headers['x-database-target-confirmation'],sessionId:req.sessionId,
  });
  if(result.status==='imported')cookie(res,'');
  res.json(result);
 });
}
