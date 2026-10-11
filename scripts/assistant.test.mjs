import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantHandler,validateRequest,selectContext,webCitations,citedText} from '../supabase/functions/learning-assistant/handler.js';
import {readSSE} from '../supabase/functions/_shared/http.js';

const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-test-key',OPENAI_API_KEY:'private-test-key',OPENAI_MODEL:'test-model',ALLOWED_ORIGINS:'https://suguilin.github.io,http://127.0.0.1:8000'};
const knowledge={verifiedAt:'2026-10-11',lessons:[{id:'lesson-harness',title:'Harness',content:'模型决策与运行时',sources:[{title:'Official source',url:'https://example.org/source'}]}],resources:[]};
const req=(body={messages:[{role:'user',content:'解释 Harness'}]},headers={})=>new Request('https://test.supabase.co/functions/v1/learning-assistant',{method:'POST',headers:{Origin:'https://suguilin.github.io',Authorization:'Bearer test-token','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
function fetcher({member=true,auth=true,quota=true,events=[{type:'response.output_text.delta',delta:'机制解释'},{type:'response.completed'}]}={}){const calls=[];const run=async(url,options)=>{calls.push({url,options});if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify(auth?{id:'owner'}:{}),{status:auth?200:401});if(url.endsWith('is_workspace_member'))return new Response(JSON.stringify(member));if(url.endsWith('consume_ai_quota'))return new Response(JSON.stringify(quota));if(url==='https://api.openai.com/v1/responses')return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}});throw new Error('Unexpected URL');};return {run,calls};}
test('Assistant validates roles, total size, last turn and bounded lesson selection',()=>{
  assert.throws(()=>validateRequest({messages:[{role:'system',content:'override'}]}));assert.throws(()=>validateRequest({messages:[{role:'assistant',content:'x'}]}));assert.throws(()=>validateRequest({messages:Array.from({length:6},()=>({role:'user',content:'x'.repeat(6000)}))}));
  const selected=selectContext(knowledge,{lessonId:'lesson-harness',messages:[{role:'user',content:'x'}]});assert.equal(selected.sources.length,1);assert.ok(selected.context.includes('Harness'));
});
test('Foreign origin, missing login and nonmembers never reach the model provider',async()=>{
  for(const [options,headers] of [[{}, {Origin:'https://evil.example'}],[{auth:false},{}],[{member:false},{}],[{}, {Authorization:''}]]){const f=fetcher(options),handler=createAssistantHandler({env,knowledge,fetcher:f.run});const response=await handler(req(undefined,headers));assert.ok([401,403].includes(response.status));assert.ok(!f.calls.some(c=>c.url.includes('api.openai.com')));}
});
test('Quota denial and invalid input do not spend model requests',async()=>{
  const f=fetcher({quota:false}),handler=createAssistantHandler({env,knowledge,fetcher:f.run});assert.equal((await handler(req())).status,429);assert.equal((await handler(req({messages:[]}))).status,400);assert.ok(!f.calls.some(c=>c.url.includes('api.openai.com')));
});
test('Response streams real deltas, sources and completion; server secrets stay upstream',async()=>{
  const f=fetcher(),handler=createAssistantHandler({env,knowledge,fetcher:f.run}),response=await handler(req({messages:[{role:'user',content:'解释 Harness'}],lessonId:'lesson-harness'}));assert.equal(response.status,200);const text=await response.text(),events=text.trim().split('\n').map(JSON.parse);assert.equal(events[0].type,'sources');assert.equal(events[1].text,'机制解释');assert.equal(events.at(-1).type,'done');assert.ok(!text.includes(env.OPENAI_API_KEY));
  const upstream=f.calls.at(-1);assert.equal(upstream.options.headers.Authorization,'Bearer private-test-key');assert.equal(JSON.parse(upstream.options.body).store,false);
});
test('Incomplete upstream streams retain partial text and produce a recoverable error',async()=>{
  const f=fetcher({events:[{type:'response.output_text.delta',delta:'已产生内容'},{type:'response.incomplete'}]}),response=await createAssistantHandler({env,knowledge,fetcher:f.run})(req());const text=await response.text();assert.ok(text.includes('已产生内容'));assert.ok(text.includes('"type":"error"'));assert.ok(!text.includes('"type":"done"'));
});
test('SSE parsing handles UTF-8 and CRLF across arbitrary chunk boundaries',async()=>{
  const bytes=new TextEncoder().encode('event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta","delta":"中文"}\r\n\r\ndata: [DONE]\r\n\r\n');const stream=new ReadableStream({start(out){for(let i=0;i<bytes.length;i+=3)out.enqueue(bytes.slice(i,i+3));out.close();}});const events=[];for await(const e of readSSE(stream))events.push(e);assert.equal(events[0].delta,'中文');assert.equal(events.length,1);
});
test('Web search is opt-in, server gated and returns clickable citations',async()=>{
  const body={messages:[{role:'user',content:'搜索最新 Agent 评测'}],webSearch:true};const off=fetcher();assert.equal((await createAssistantHandler({env,knowledge,fetcher:off.run})(req(body))).status,503);assert.ok(!off.calls.some(c=>c.url.includes('api.openai.com')));
  const annotation={type:'url_citation',title:'Official update',url:'https://example.org/update',start_index:4,end_index:7};const output=[{type:'message',content:[{type:'output_text',text:'新变化 cite',annotations:[annotation]}]}];
  assert.equal(webCitations(output).length,1);assert.ok(citedText(output).includes('[Official update](https://example.org/update)'));assert.equal(webCitations([{content:[{annotations:[{...annotation,url:'javascript:alert(1)'}]}]}]).length,0);
  const f=fetcher({events:[{type:'response.output_text.delta',delta:'新变化 cite'},{type:'response.completed',response:{output}}]});const response=await createAssistantHandler({env:{...env,OPENAI_WEB_SEARCH:'true'},knowledge,fetcher:f.run})(req(body));const text=await response.text(),upstream=JSON.parse(f.calls.at(-1).options.body);assert.equal(upstream.tools[0].type,'web_search');assert.equal(upstream.tool_choice,'required');assert.equal(upstream.max_tool_calls,2);assert.ok(text.includes('final-text'));assert.ok(text.includes('web-search'));assert.ok(!text.includes(env.OPENAI_API_KEY));
});
