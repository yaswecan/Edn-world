import test from 'node:test';
import assert from 'node:assert/strict';
import {readResponsesStream,planRequest,PLAN_FIELDS} from '../server/ai/plan-provider.mjs';
import {planError,nextRetryAt} from '../server/ai/errors.mjs';
import {callStructured,qualityConfig,pipelineLimits} from '../server/pedagogy/provider.mjs';
import {prompts} from '../server/pedagogy/prompts.mjs';
import {planSchema,planReviewSchema,unitSchema,reviewSchema,CHARTER_VERSION} from '../server/pedagogy/contracts.mjs';
import {validate} from '../server/contracts.mjs';
import {planProfiles} from '../server/ai/settings.mjs';
export function sse(events,{split=false,contentType='text/event-stream'}={}){
 const bytes=new TextEncoder().encode(events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join(''));
 return new Response(new ReadableStream({start(controller){if(split){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));}else controller.enqueue(bytes);controller.close();}}),{headers:{...(contentType===null?{}:{'content-type':contentType}),'x-request-id':'req-stream'}});
}
const completed=text=>({type:'response.completed',response:{id:'resp',model:'account-model',status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:20,output_tokens:30}}});
const config={provider:'chatgpt_plan',ownerId:'teacher',classId:'A1',connectionId:'one',version:'test',roles:{planReview:{model:'account-model',effort:null}},timeoutMs:10000};
test('ChatGPT calls allow long generations while API and explicit timeout settings keep their limits',()=>{
 assert.equal(pipelineLimits({},{provider:'chatgpt_plan'}).timeoutMs,600000);
 assert.equal(pipelineLimits({}).timeoutMs,180000);
 assert.equal(pipelineLimits({EDEN_AI_CALL_TIMEOUT_SECONDS:'900'},{provider:'chatgpt_plan'}).timeoutMs,900000);
 assert.equal(pipelineLimits({EDEN_AI_CALL_TIMEOUT_SECONDS:'180'},{provider:'chatgpt_plan'}).timeoutMs,180000);
 for(const seconds of ['9','1201','invalid'])assert.throws(()=>pipelineLimits({EDEN_AI_CALL_TIMEOUT_SECONDS:seconds},{provider:'chatgpt_plan'}),/hors limites/);
 assert.throws(()=>pipelineLimits({EDEN_AI_CALL_TIMEOUT_SECONDS:'600'}),/hors limites/);
});
test('a ChatGPT generation can complete after the old 180 second deadline without a retry',async t=>{
 const timers=[];
 t.mock.method(AbortSignal,'timeout',milliseconds=>{const controller=new AbortController();timers.push({milliseconds,controller});return controller.signal;});
 let calls=0;
 const chatgpt={request:async(_owner,_id,_body,{signal})=>{
  calls++;
  // Move a controlled clock past the old limit without waiting four minutes.
  for(const timer of timers)if(timer.milliseconds<=240000)timer.controller.abort(new DOMException('expired','TimeoutError'));
  signal.throwIfAborted();return sse([completed('{"decision":"accept","issues":[]}')]);
 },noteError:async()=>assert.fail('A healthy long stream must not be marked failed')};
 const result=await callStructured({role:'planReview',input:{},schema:planReviewSchema,config:{...config,...pipelineLimits({},{provider:'chatgpt_plan'})},chatgpt});
 assert.equal(result.value.decision,'accept');assert.equal(calls,1);assert.equal(result.trace.parameters.timeoutMs,600000);
});
test('a local deadline cancels a stalled read, retains partial output and records a non-retryable timeout',async t=>{
 const deadline=new AbortController();t.mock.method(AbortSignal,'timeout',()=>deadline.signal);
 let cancelled=false,noted,calls=0;
 const chatgpt={request:async()=>{
  calls++;return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:'response.output_text.delta',delta:'{"partial":'})+'\n\n'));},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});
 },noteError:async(_owner,_id,error)=>{noted=error;}};
 await assert.rejects(callStructured({role:'planReview',input:{},schema:planReviewSchema,config:{...config,timeoutMs:600000},chatgpt,onEvent:()=>setImmediate(()=>deadline.abort(new DOMException('private timeout detail','TimeoutError')))}),error=>{
  assert.equal(error.details.kind,'uncertain');assert.equal(error.details.interruption,'timeout');assert.equal(error.details.timeoutMs,600000);assert.equal(error.details.retryable,false);
  assert.equal(error.partialOutput,'{"partial":');assert.match(error.message,/600 s/);assert.doesNotMatch(error.message,/private timeout detail/);
  assert.equal(error.trace.providerError.interruption,'timeout');return true;
 });
 assert.equal(cancelled,true);assert.equal(calls,1);assert.equal(noted.details.interruption,'timeout');
});
test('timeouts before response headers, cancellations and network cuts have distinct safe diagnostics',async()=>{
 for(const [name,interruption] of [['TimeoutError','timeout'],['AbortError','aborted'],['TypeError','transport']]){
  const chatgpt={request:async()=>{throw Object.assign(new Error('private transport details'),{name});},noteError:async()=>{}};
  await assert.rejects(callStructured({role:'planReview',input:{},schema:planReviewSchema,config,chatgpt}),error=>{
   assert.equal(error.details.interruption,interruption);assert.equal(error.details.retryable,false);assert.doesNotMatch(error.message,/private transport details/);return true;
  });
 }
});
test('SIWC serializer preserves the shared prompt and schema with an explicit small allowlist',()=>{
 const args={role:'planReview',input:{sources:['untrusted']},schema:planReviewSchema,config,images:['image']},body=planRequest(args);
 assert.deepEqual(Object.keys(body).sort(),[...PLAN_FIELDS].sort());assert.equal(body.instructions,prompts.planReview);assert.equal(body.text.format.schema,planReviewSchema);assert.equal(body.input[0].role,'user');assert.equal(body.input[0].content[1].type,'input_image');assert.equal(body.store,false);assert.equal(body.stream,true);
 for(const key of ['background','conversation','max_output_tokens','max_tool_calls','metadata','moderation','multi_agent','prompt','prompt_cache_retention','safety_identifier','temperature','top_logprobs','top_p','truncation','user','previous_response_id','service_tier'])assert.equal(body[key],undefined,key);
 assert.throws(()=>planRequest({...args,config:{...config,roles:{planReview:{model:'account-model',effort:'xhigh'}}}}),/pas confirmé/);
});
test('high effort is sent only when the account catalogue confirms it, with an explicit trace',async()=>{
 const frozen={...config,roles:planProfiles({slug:'account-model',reasoningEfforts:['medium','high']})};let sent;
 const chatgpt={request:async(_owner,_id,body)=>{sent=body;return sse([completed('{"decision":"accept","issues":[]}')]);},noteError:async()=>assert.fail('Supported request rejected')};
 const result=await callStructured({role:'planReview',input:{},schema:planReviewSchema,config:frozen,chatgpt});
 assert.deepEqual(sent.reasoning,{effort:'high'});assert.deepEqual(result.trace.parameters.reasoning,{effort:'high'});assert.equal(result.trace.parameters.reasoningPolicy,'explicit_catalog_verified');
 assert.equal(planProfiles({slug:'old-model'}).design.effort,null);assert.equal(sent.max_output_tokens,undefined);
});
test('every pedagogical response schema declares types, including nested constants and enums',()=>{
 const visit=(schema,path)=>{
  assert.ok(['object','array','string','integer','number','boolean','null'].includes(schema.type),`${path}: missing or unsupported type`);
  if(schema.type==='object'){
   assert.equal(schema.additionalProperties,false,path);
   assert.deepEqual([...schema.required].sort(),Object.keys(schema.properties).sort(),path);
   for(const [key,value] of Object.entries(schema.properties))visit(value,`${path}.${key}`);
  }
  if(schema.type==='array')visit(schema.items,`${path}[]`);
 };
 for(const [role,schema] of Object.entries({design:planSchema,planReview:planReviewSchema,write:unitSchema,review:reviewSchema,repair:unitSchema})){
  const body=planRequest({role,input:{},schema,config:{...config,roles:{[role]:{model:'account-model',effort:null}}}});
  visit(body.text.format.schema,role);
 }
 const durationFlag=planSchema.properties.duration.properties.includesReadingAttemptsHelpAndCorrection;
 assert.equal(validate(durationFlag,true),true);
 for(const invalid of [false,'true',1])assert.throws(()=>validate(durationFlag,invalid));
 assert.equal(validate(reviewSchema.properties.charterVersion,CHARTER_VERSION),CHARTER_VERSION);
 assert.throws(()=>validate(reviewSchema.properties.charterVersion,'wrong-version'));
 assert.throws(()=>validate(planReviewSchema,{decision:'invalid',issues:[]}));
});
test('fragmented UTF8 SSE completes only at response.completed; reasoning is never forwarded',async()=>{
 const events=[];const result=await readResponsesStream(sse([{type:'response.reasoning_text.delta',delta:'private reasoning'},{type:'response.output_text.delta',delta:'préparé'},completed('préparé')],{split:true}),{onEvent:e=>events.push(e)});
 assert.equal(result.text,'préparé');assert.equal(events.some(e=>e.type.includes('reasoning')),false);
 for(const tail of [[],[{type:'response.incomplete',response:{status:'incomplete'}}],[{type:'error',code:'subscription_sharing_usage_unavailable'}],[{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded',message:'never expose'}}}]]){
  await assert.rejects(readResponsesStream(sse([{type:'response.output_text.delta',delta:'{"partial":'},...tail])),e=>{assert.equal(e.partialOutput,'{"partial":');assert.doesNotMatch(e.message,/never expose/);return true;});
 }
});
test('SSE without Content-Type still requires a successful terminal event',async()=>{
 const events=[],response=sse([{type:'response.output_text.delta',delta:'préparé'},completed('préparé')],{split:true,contentType:null});
 assert.equal(response.headers.get('content-type'),null);
 const result=await readResponsesStream(response,{onEvent:event=>events.push(event)});
 assert.equal(result.text,'préparé');assert.equal(result.status,'completed');assert.equal(result.model,'account-model');
 assert.deepEqual(events.map(({activity,model,...event})=>event),[{type:'response.output_text.delta'},{type:'response.completed',responseId:'resp',status:'completed'}]);
 assert.equal(events[0].activity.outputCharacters,7);assert.equal(events[1].activity.phase,'completed');
 await assert.rejects(readResponsesStream(sse([{type:'response.output_text.delta',delta:'brouillon'}],{contentType:null})),error=>error.details.kind==='uncertain'&&error.partialOutput==='brouillon');
 await assert.rejects(readResponsesStream(sse([{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}}],{contentType:null})),error=>error.details.kind==='usage_limit');
 // A complete JSON response or an HTML page cannot stand in for SSE completion.
 for(const body of [JSON.stringify(completed('unvalidated').response),'<html>upstream error</html>']){
  await assert.rejects(readResponsesStream(new Response(new TextEncoder().encode(body))),error=>error.details.kind==='uncertain');
 }
});
test('SSE media types are case insensitive and incompatible bodies are cancelled',async()=>{
 assert.equal((await readResponsesStream(sse([completed('préparé')],{contentType:'Text/Event-Stream; charset=utf-8'}))).text,'préparé');
 let cancelled=false;
 const response=new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'text/html'}});
 await assert.rejects(readResponsesStream(response),error=>error.details.kind==='uncertain');
 assert.equal(cancelled,true);
});
test('live activity exposes only public summaries and lifecycle signals, with bounded deduplicated UTF8 text',async()=>{
 const events=[],done=completed('réponse');
 done.response.output.unshift({id:'reason',type:'reasoning',content:[{type:'reasoning_text',text:'private content'}],encrypted_content:'private encrypted',summary:[{type:'summary_text',text:'Je compare les objectifs.'}]});
 await readResponsesStream(sse([
  {type:'response.created',response:{id:'resp',status:'in_progress',model:'account-model',private:'not forwarded'}},
  {type:'response.output_item.added',output_index:0,item:{id:'reason',type:'reasoning',content:['private item'],encrypted_content:'private encrypted'}},
  {type:'response.reasoning_text.delta',delta:'private reasoning'},
  {type:'response.reasoning_text.done',text:'private reasoning'},
  {type:'response.reasoning_summary_text.delta',item_id:'reason',summary_index:0,delta:'Je compare '},
  {type:'response.reasoning_summary_text.delta',item_id:'reason',summary_index:0,delta:'les objectifs.'},
  {type:'response.reasoning_summary_text.done',item_id:'reason',summary_index:0,text:'Je compare les objectifs.'},
  {type:'response.reasoning_summary_part.done',item_id:'reason',summary_index:0,part:{type:'summary_text',text:'Je compare les objectifs.'}},
  {type:'response.output_text.delta',delta:'réponse'},done
 ],{split:true}),{onEvent:e=>events.push(e)});
 assert.equal(events[0].model,'account-model');assert.equal(events[1].activity.phase,'reasoning');
 assert.equal(events[3].activity.summary,'Je compare les objectifs.');
 assert.equal(events.at(-2).activity.outputCharacters,7);assert.equal(events.at(-2).activity.phase,'writing');
 assert.equal(events.at(-1).activity.summary,'Je compare les objectifs.');assert.equal(events.at(-1).activity.phase,'completed');
 assert.doesNotMatch(JSON.stringify(events),/private|not forwarded|reasoning_text/);
 assert.ok(events.every(e=>Number.isFinite(Date.parse(e.activity.lastSignalAt))));
 const bounded=[];await readResponsesStream(sse([
  ...Array.from({length:20},(_,i)=>({type:'response.reasoning_summary_text.delta',item_id:'reason-'+i,summary_index:0,delta:'é'.repeat(7000)})),completed('ok')
 ]),{onEvent:e=>bounded.push(e)});
 assert.ok(bounded.every(e=>e.activity.summary.length<=6000));assert.equal(bounded.at(-1).activity.summaryTruncated,true);
});
test('normalized plan call validates JSON, retains unknown cost, and cannot use the API key fallback',async()=>{
 let credentials=0,requests=0,noted=0;
 const chatgpt={request:async(_owner,_id,body,{fetchImpl,signal})=>{credentials++;return fetchImpl('https://api.openai.com/v1/responses',{headers:{Authorization:'Bearer synthetic-oauth-only'},body:JSON.stringify(body),signal});},noteError:async()=>{noted++;}};
 const fetchImpl=async(url,options)=>{requests++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer synthetic-oauth-only');assert.equal(JSON.parse(options.body).stream,true);return sse([completed('{"decision":"accept","issues":[]}')]);};
 const args={role:'planReview',input:{},schema:planReviewSchema,config,apiKey:'must-never-use',chatgpt,fetchImpl};
 const result=await callStructured(args);assert.equal(result.value.decision,'accept');assert.equal(result.trace.costUSD,null);assert.equal(requests,1);assert.equal(credentials,1);
 await assert.rejects(callStructured({...args,fetchImpl:async()=>sse([completed('not json')])}),e=>e.details.kind==='incomplete');assert.equal(noted,1);
 await assert.rejects(callStructured({...args,chatgpt:{...chatgpt,request:async()=>{throw planError({error:{code:'subscription_sharing_usage_limit_exceeded'}},429);}}}));assert.equal(requests,1);
});
test('SIWC admission errors and all documented recovery codes are classified without leaking payloads',()=>{
 const overload=planError({error:{code:'server_is_overloaded'}},200,new Headers({'retry-after':'17'}),{stream:true});assert.equal(overload.details.kind,'temporary');assert.equal(overload.details.retryable,true);assert.equal(overload.details.retryAfterSeconds,17);assert.equal(overload.details.providerStatus,200);assert.equal(overload.details.stream,true);
 const matrix={subscription_sharing_usage_limit_exceeded:'usage_limit',subscription_sharing_user_not_eligible:'permission_missing',subscription_sharing_usage_unavailable:'temporary',subscription_sharing_user_unavailable:'temporary',subscription_sharing_unsupported_capability:'unsupported',subscription_sharing_route_not_supported:'configuration_incomplete',subscription_sharing_invalid_user:'reconnect_required',chatpass_v2_scope_not_authorized:'permission_missing',chatpass_v2_invalid_authorization_context:'permission_missing'};
 for(const [code,kind] of Object.entries(matrix)){const e=planError({error:{code,param:'temperature',message:'sk-secret'}},400,new Headers({'x-request-id':'req_safe','retry-after':'17'}));assert.equal(e.details.kind,kind);assert.equal(e.details.code,code);assert.equal(e.details.retryable,kind==='temporary');assert.equal(e.details.requestId,'req_safe');assert.equal(e.details.param,'temperature');assert.doesNotMatch(JSON.stringify(e.details)+e.message,/sk-secret/);}
 const detail=planError({detail:'sensitive'},503);assert.equal(detail.details.bodyShape,'detail');assert.equal(detail.details.retryable,true);assert.doesNotMatch(detail.message,/sensitive/);
 assert.equal(planError({error:{code:'model_not_found'}},400).details.code,'model_not_found');
 assert.equal(planError({error:{code:'sk-secret / arbitrary text'}},400).details.code,null);
 assert.equal(planError({error:{code:'constructor'}},400).details.kind,'failed');
 const schemaError=planError({error:{code:'invalid_json_schema',param:'text.format.schema',message:'private provider payload'}},400);
 assert.equal(schemaError.details.retryable,false);assert.equal(schemaError.details.code,'invalid_json_schema');assert.match(schemaError.message,/format de préparation/);assert.doesNotMatch(schemaError.message,/private provider payload/);
 const at=Date.parse('2026-10-06T12:00:00Z');assert.equal(nextRetryAt({retryAfterSeconds:3600},2,{at}),new Date(at+3600000).toISOString());assert.ok(Date.parse(nextRetryAt({},2,{at,random:()=>0.5}))>at);
});
test('explicit API selection keeps the existing JSON HTTP serialization',async()=>{
 let body;const result=await callStructured({role:'planReview',input:{},schema:planReviewSchema,config:{...qualityConfig({OPENAI_MODEL:'gpt-5.4'}),provider:'openai_api'},apiKey:'synthetic-api',fetchImpl:async(_url,o)=>{assert.equal(o.headers.Authorization,'Bearer synthetic-api');body=JSON.parse(o.body);return new Response(JSON.stringify(completed('{"decision":"accept","issues":[]}').response),{headers:{'content-type':'application/json'}});}});
 assert.equal(result.value.decision,'accept');assert.equal(body.stream,undefined);assert.equal(body.max_output_tokens,24000);assert.equal(body.reasoning.effort,'high');
});
