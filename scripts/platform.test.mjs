import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {createZip,vaultFiles} from '../assets/backup.js';
import {SyncEngine} from '../assets/sync.js';
import {fetchRelease} from '../assets/updates.js';

const note=(body='本机内容',updatedAt='2026-10-11T00:00:00Z')=>({id:'note-1',title:'中文..笔记 / 实验',body,kind:'实验',tags:'Agent,验证',createdAt:'2026-10-10T00:00:00Z',updatedAt});
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
function server(){const docs=new Map();let lostResponse=false,offline=false;const client={
  from(){const query={select:()=>query,order:()=>query,range:async(start,end)=>({data:[...docs.values()].slice(start,end+1),error:offline?new Error('offline'):null})};return query;},
  async rpc(name,p){if(offline)return {error:new Error('offline')};const key=p.p_kind+':'+p.p_id,old=docs.get(key);
    if(old?.operation_id===p.p_operation_id)return {data:{conflict:false,document:old}};
    if((old?.revision??0)!==p.p_base_revision)return {data:{conflict:true,document:old??null}};
    const value={kind:p.p_kind,id:p.p_id,value:p.p_value,deleted:p.p_deleted,revision:(old?.revision??0)+1,operation_id:p.p_operation_id};docs.set(key,value);
    if(lostResponse){lostResponse=false;return {error:new Error('response lost')};}return {data:{conflict:false,document:value}};
  }};return {client,docs,setOffline:v=>offline=v,loseNextResponse:()=>lostResponse=true};}
const engine=(s,cache=storage(),key='owner')=>new SyncEngine({client:s.client,storage:cache,key});
test('Backup import preserves both contents, is repeatable, and accepts old v1 exports',()=>{
  const old={...defaultState(),notes:[note('旧版本')]};delete old.reading;delete old.conversations;
  const current={...defaultState(),notes:[note('新版本','2026-10-11T02:00:00Z')]};
  const result=mergeBackupStates(current,old);assert.equal(result.conflicts,1);assert.equal(result.state.notes.length,2);assert.deepEqual(new Set(result.state.notes.map(n=>n.body)),new Set(['旧版本','新版本']));
  assert.equal(mergeBackupStates(result.state,old).state.notes.length,2);assert.equal(current.notes.length,1);
  assert.throws(()=>validateState({...defaultState(),conversations:[{id:'chat',title:'bad',updatedAt:1,messages:[]}]}));
});
test('Obsidian ZIP passes a standard parser, CRC, Chinese filenames and full restore',async()=>{
  const state={...defaultState(),notes:[note()],reading:['lesson-harness'],completed:['task-1'],conversations:[{id:'chat-1',title:'工具问题',updatedAt:'2026-10-11T00:00:00Z',messages:[{role:'user',content:'为什么超时？',status:'complete'},{role:'assistant',content:'部分回答',status:'interrupted'}]}]};
  const files=vaultFiles(state,{resources:[],lessons:[{id:'lesson-harness',title:'Harness 导读'}],curriculum:[{tasks:[{id:'task-1',text:'手写循环'}]}]});
  const folder=await mkdtemp(join(tmpdir(),'suguilin-zip-test-'));try{const path=join(folder,'backup.zip');await writeFile(path,new Uint8Array(await createZip(files).arrayBuffer()));
    const output=execFileSync('python3',['-c',`import zipfile,json,sys\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None\nassert any(n.startswith('学习日志/') for n in z.namelist())\nassert '手写循环' in z.read('学习进度.md').decode()\ns=json.loads(z.read('完整备份.json'));assert s['notes'][0]['body']=='本机内容'\nassert s['conversations'][0]['messages'][1]['status']=='interrupted'\nprint(len(z.namelist()))`,path],{encoding:'utf8'});assert.equal(Number(output.trim()),6);
  }finally{await rm(folder,{recursive:true,force:true});}
  assert.throws(()=>createZip([{name:'../secret',text:'x'}]));
});
test('Two devices surface concurrent edits; explicitly resolving preserves the chosen content',async()=>{
  const s=server(),a=engine(s),b=engine(s);a.capture({...defaultState(),notes:[note()]});await a.sync();await b.sync();
  a.capture({...a.state(),notes:[note('A','2026-10-11T01:00:00Z')]});b.capture({...b.state(),notes:[note('B','2026-10-11T02:00:00Z')]});
  await a.sync();await b.sync();assert.equal(b.conflicts.size,1);assert.equal(b.state().notes[0].body,'B');assert.equal(s.docs.get('notes:note-1').value.body,'A');
  await b.resolve('notes:note-1','local');await a.sync();assert.equal(a.state().notes[0].body,'B');assert.equal(b.conflicts.size,0);
});
test('Offline outbox survives restart, unchecks propagate, and lost responses retry idempotently',async()=>{
  const s=server(),cache=storage(),a=engine(s,cache),b=engine(s);s.setOffline(true);a.capture({...defaultState(),saved:['langgraph'],notes:[note()]});await a.sync();assert.ok(a.pending.size);
  const restored=engine(s,cache);assert.equal(restored.state().notes.length,1);s.setOffline(false);s.loseNextResponse();await restored.sync();await restored.sync();assert.equal(restored.pending.size,0);await b.sync();assert.deepEqual(b.state().saved,['langgraph']);
  restored.capture({...restored.state(),saved:[],notes:[]});await restored.sync();await b.sync();assert.deepEqual(b.state().saved,[]);assert.equal(b.state().notes.length,0);assert.equal(s.docs.get('notes:note-1').deleted,true);
});
test('A stopped account cannot emit a late failed-sync status; caches are account scoped',async()=>{
  let finish;const client={from(){const q={select:()=>q,order:()=>q,range:()=>new Promise(r=>finish=r)};return q;}};const statuses=[],cache=storage();const a=new SyncEngine({client,storage:cache,key:'owner-A',onStatus:s=>statuses.push(s.status)});a.capture({...defaultState(),notes:[note()]});const pending=a.sync();a.stop();finish({error:new Error('late failure')});await pending;assert.ok(!statuses.includes('error'));
  const b=new SyncEngine({client,storage:cache,key:'owner-B'});assert.equal(b.state().notes.length,0);
});
test('Official release refresh rejects foreign links, previews, malformed dates and rate limits',async()=>{
  const source={repo:'langchain-ai/langgraph',title:'LangGraph'},valid={tag_name:'1.2.3',html_url:'https://github.com/langchain-ai/langgraph/releases/tag/1.2.3',published_at:'2026-10-10T00:00:00Z',draft:false,prerelease:false};
  const fetcher=raw=>async()=>new Response(JSON.stringify(raw));assert.equal((await fetchRelease(source,fetcher(valid))).version,'1.2.3');
  for(const bad of [{...valid,html_url:'https://evil.example/x'},{...valid,prerelease:true},{...valid,published_at:'not a date'}])await assert.rejects(fetchRelease(source,fetcher(bad)));
  await assert.rejects(fetchRelease(source,async()=>new Response('',{status:403})),/限流/);
});
