import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuery,normalizeDiscovery,searchProvider,discoveryNote,appendDiscoveryNotes} from '../assets/discovery.js';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {toDocuments,fromDocuments} from '../assets/sync.js';
import {vaultFiles} from '../assets/backup.js';

const now=new Date('2026-10-11T06:00:00Z');
const item={provider:'github',title:'org/agent',url:'https://github.com/org/agent',source:'GitHub',description:'Agent runtime',publishedAt:'2026-10-10T06:00:00Z',checkedAt:now.toISOString(),query:'LLM agents'};
test('Discovery validates sources, dates, safe URLs and bounded public queries',()=>{
  assert.equal(normalizeQuery('长程记忆'),'agent memory');assert.throws(()=>normalizeQuery(''));assert.throws(()=>normalizeQuery('x'.repeat(101)));
  assert.equal(normalizeDiscovery({...item,url:'javascript:alert(1)'}),null);assert.equal(normalizeDiscovery({...item,url:'https://secret@example.org'}),null);assert.equal(normalizeDiscovery({...item,provider:'invented'}),null);assert.equal(normalizeDiscovery({...item,publishedAt:'invalid'}),null);
  assert.equal(normalizeDiscovery({...item,title:'<script>evil</script>'}).title,'evil');
});
test('GitHub query restricts recent public maintained projects and validates repository identities',async()=>{
  let url;const fetcher=async endpoint=>{url=endpoint;return new Response(JSON.stringify({incomplete_results:true,items:[{full_name:'org/agent',html_url:item.url,pushed_at:item.publishedAt,description:item.description,owner:{login:'org'}},{full_name:'org/fake',html_url:'https://evil.example/org/fake',pushed_at:item.publishedAt}]}));};
  const r=await searchProvider('github','LLM agents',30,{fetcher,now});assert.equal(r.items.length,1);assert.equal(r.incomplete,true);assert.match(new URL(url).searchParams.get('q'),/archived:false fork:false.*pushed:>=2026-09-11/);
});
test('Community and paper searches reject malformed records and future or stale dates',async()=>{
  const community=await searchProvider('community','agent memory',7,{now,fetcher:async()=>new Response(JSON.stringify({hits:[{objectID:'12',title:'Memory',url:'javascript:alert(1)',created_at:item.publishedAt,author:'writer'},{objectID:'bad',title:'bad',created_at:item.publishedAt}]}))});assert.equal(community.items[0].url,'https://news.ycombinator.com/item?id=12');
  const papers=await searchProvider('papers','agent memory',7,{now,fetcher:async()=>new Response(JSON.stringify({message:{items:[{DOI:'10.1234/agents',title:['Memory'],publisher:'Publisher',published:{'date-parts':[[2026,10,10]]}},{DOI:'10.1234/future',title:['future'],published:{'date-parts':[[2027,1,1]]}},{DOI:'malformed',title:['bad'],published:{'date-parts':[[2026,10,10]]}}]}}))});assert.equal(papers.items.length,1);assert.match(papers.items[0].description,/元数据/);
  await assert.rejects(searchProvider('papers','x',90,{fetcher:async()=>new Response('',{status:429}),now}),/限流/);
});
test('One-click supplementation deduplicates, preserves edited notes, survives backup, sync and Obsidian',()=>{
  const record=normalizeDiscovery(item),first=appendDiscoveryNotes(defaultState(),[record,record]);assert.equal(first.added,1);first.state.notes[0].body+='\n我的验证';
  const second=appendDiscoveryNotes(first.state,[record]);assert.equal(second.added,0);assert.match(second.state.notes[0].body,/我的验证/);assert.match(discoveryNote(record).body,/不是已验证/);
  const validated=validateState(second.state);assert.deepEqual(fromDocuments([...toDocuments(validated).values()]),validated);assert.equal(mergeBackupStates(defaultState(),validated).state.notes.length,1);
  const files=vaultFiles(validated);assert.ok(files.some(f=>f.name.startsWith('学习日志/')&&f.text.includes(item.url)&&f.text.includes('我的验证')));
});
