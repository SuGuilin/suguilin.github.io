import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {readSource,pastedSource,extractiveUnit} from '../assets/source-reader.js';
import {validateUnit,scheduleUnit,dailyQueue,recordReview,dayKey} from '../assets/study-model.js';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {toDocuments,fromDocuments} from '../assets/sync.js';
import {vaultFiles} from '../assets/backup.js';
import {createSynthesisHandler} from '../supabase/functions/learning-synthesis/handler.js';
import {StudyWorkspace} from '../assets/study.js';

const now=new Date('2026-10-11T08:00:00Z');
const body='The agent runtime stores durable checkpoints so work can resume after a process restart.\nTool operations use a stable operation identity to reconcile uncertain remote writes after failures.\nThe evaluation harness checks actual output artifacts instead of treating a completion message as proof.\nMemory retrieval keeps source evidence and effective time to avoid using stale preferences.';
const item={title:'org/runtime',url:'https://github.com/org/runtime'};
const source=()=>pastedSource(item,body,now);
const unit=()=>extractiveUnit(source());
test('Source reader uses bounded provider endpoints, rejects arbitrary hosts and does not pretend to read metadata',async()=>{
  const urls=[];const fetcher=async(url,opts)=>{urls.push(url);assert.equal(opts.redirect,'error');assert.equal(opts.credentials,'omit');return new Response(body);};
  const s=await readSource(item,{fetcher,now});assert.equal(urls[0],'https://api.github.com/repos/org/runtime/readme');assert.match(s.scope,/README/);assert.equal(s.excerpt,body);
  for(const url of ['http://127.0.0.1/secrets','https://github.com.evil.test/org/repo','https://user:pass@github.com/org/repo','https://github.com/org/repo/issues/1'])await assert.rejects(readSource({...item,url},{fetcher,now}));
  assert.equal(urls.length,1);
  await assert.rejects(readSource({title:'Paper',url:'https://doi.org/10.1234/agent'},{now,fetcher:async()=>new Response(JSON.stringify({message:{title:['Agent']}}))}),/不能自动读取/);
  await assert.rejects(readSource(item,{fetcher:async()=>new Response('x'.repeat(400001))}),/读取上限/);
});
test('Free packs are grounded in actual text, keep access scope, and reject fabricated citations and oversized imports',()=>{
  const u=unit();assert.equal(u.mode,'extractive');assert.equal(u.exercises.length,2);assert.ok(u.takeaways.every(t=>u.source.excerpt.includes(t.evidence)));assert.match(u.summary,/未.*AI/);
  assert.throws(()=>validateUnit({...u,mode:'ai',takeaways:u.takeaways.map(t=>({...t,evidence:'fabricated evidence'}))}),/正文依据/);
  assert.throws(()=>pastedSource(item,'title only'),/250/);assert.throws(()=>pastedSource(item,'a'.repeat(24001)),/24,000/);
  const promotion=pastedSource(item,'We build swarms for complex, long-running agentic workloads.\nOur powerful agent product helps teams get started quickly and achieve great results.\nJoin our community to learn more about the agent ecosystem and our roadmap.\nContact our sales team to get a personal demo and discuss your needs.');
  assert.throws(()=>extractiveUnit(promotion),/具体机制/);
});
test('README links and emphasis retain original evidence while producing readable key points',()=>{
  const markdown='- **Durable execution**: Checkpoints persist agent state so workflows can resume after interruption without losing progress.\n- **Human oversight**: Inspect and modify agent state at any point using [human-in-the-loop controls](https://example.com/oversight).\n- **Comprehensive memory**: Maintain agent state across conversations with [long-term memory](https://example.com/memory) and persistence.\n- API Reference: Detailed reference on core state classes, recovery methods, the graph and checkpointing APIs.';
  const u=extractiveUnit(pastedSource(item,markdown,now));
  assert.ok(u.takeaways.length>=2);
  assert.ok(u.takeaways.every(t=>markdown.includes(t.evidence)));
  assert.ok(u.takeaways.every(t=>!t.point.includes('https://')&&!t.point.includes('**')));
  assert.ok(u.exercises.every(e=>!e.prompt.includes('https://')));
  assert.ok(u.takeaways.every(t=>!t.point.startsWith('API Reference')));
  const navigation=pastedSource(item,markdown+'\nGuides – Quick, actionable code snippets for topics such as streaming, adding memory & persistence, and design patterns.\nHuman-in-the-loop – Inspect and modify agent state at any point to incorporate human oversight before a tool action.');
  const filtered=extractiveUnit(navigation);assert.ok(filtered.takeaways.every(t=>!t.point.startsWith('Guides')));
  assert.ok(extractiveUnit(pastedSource(item,'Human-in-the-loop – Inspect and modify agent state at any point to incorporate human oversight before a tool action.\nDurable execution – Checkpoints persist state so workflows resume after an interruption.\nGuides – Quick code snippets for memory & persistence and design patterns.')).takeaways.some(t=>t.point.startsWith('Human-in-the-loop')));
});
test('New learning flows respect daily budget, preserve attempts and bring reviews back when due',()=>{
  const u=unit(),s=defaultState();s.studyUnits=[u,{...u,id:'second-unit'}];s.dailyMinutes=30;
  const a=scheduleUnit(s,u,now),b=scheduleUnit(a,s.studyUnits[1],now);assert.equal(b.studyProgress[0].scheduledFor,dayKey(now));assert.notEqual(b.studyProgress[0].scheduledFor,b.studyProgress[1].scheduledFor);assert.equal(scheduleUnit(b,u,now).studyProgress.length,2);
  assert.equal(dailyQueue(b,s.studyUnits,now).length,1);assert.throws(()=>recordReview(b.studyProgress[0],'good',30,now),/先写下/);
  const p={...b.studyProgress[0],answers:[{id:'e1',text:'My explanation with a testable boundary.'}]},review=recordReview(p,'good',30,now);assert.equal(review.nextReview,'2026-10-14');assert.equal(review.history.length,1);
  const next={...b,studyProgress:[review]};assert.equal(dailyQueue(next,[u],now).length,0);assert.equal(dailyQueue(next,[u],new Date('2026-10-14T08:00:00Z'))[0].review,true);
  next.dailyMinutes=15;assert.equal(dailyQueue(next,[u],new Date('2026-10-14T08:00:00Z'))[0].minutes,10);
});
test('Units, answers, self assessment and daily settings round-trip through sync, backup and Obsidian',()=>{
  const u=unit();let s=scheduleUnit({...defaultState(),studyUnits:[u]},u,now);s.studyProgress[0].answers=[{id:'e1',text:'persisted answer'}];s.studyProgress[0].reflection='one unresolved question';s.studyProgress[0]=recordReview(s.studyProgress[0],'hard',15,now);
  s=validateState(s);assert.deepEqual(fromDocuments([...toDocuments(s).values()]),s);const restored=mergeBackupStates(defaultState(),s).state;assert.deepEqual(restored.studyUnits,s.studyUnits);assert.deepEqual(restored.studyProgress,s.studyProgress);
  const files=vaultFiles(s);assert.ok(files.some(f=>f.name.startsWith('学习单元/')&&f.text.includes('关键要点')));assert.ok(files.some(f=>f.name.startsWith('练习与复习/')&&f.text.includes('persisted answer')&&f.text.includes('2026-10-13')));
  assert.equal(mergeBackupStates(restored,s).conflicts,0);
});
test('Editorial units include specific answers and rubrics, not only metadata or empty practice templates',async()=>{
  const {units}=JSON.parse(await readFile('content/study-units.json','utf8'));assert.equal(units.length,22);for(const u of units){validateUnit(u);assert.ok(u.summary.length>15);assert.ok(u.exercises.every(e=>e.answer.length>60&&e.rubric.length>=2));}
});
test('Colab notebooks execute all cells and demonstrate recovery and correlated evaluation invariants',()=>{
  const output=execFileSync('python3',['scripts/verify-notebooks.py'],{encoding:'utf8'});assert.match(output,/durable-agent.ipynb: all cells/);assert.match(output,/paired-agent-evaluation.ipynb: all cells/);assert.match(output,/agent-mechanism-checks.ipynb: all cells/);
});
test('Conflicting backup answers remain recoverable without creating an orphan plan or duplicating imports',()=>{
  const u=unit();const initial=scheduleUnit({...defaultState(),studyUnits:[u]},u,now);
  initial.studyProgress[0].answers=[{id:'e1',text:'older reasoning'}];initial.studyProgress[0].updatedAt=now.toISOString();
  const edited=structuredClone(initial);edited.studyProgress[0].answers[0].text='newer reasoning';edited.studyProgress[0].updatedAt='2026-10-12T08:00:00Z';
  const result=mergeBackupStates(edited,initial);assert.equal(result.conflicts,1);assert.equal(result.state.studyProgress.length,1);assert.equal(result.state.studyProgress[0].answers[0].text,'newer reasoning');assert.ok(result.state.notes.some(n=>n.body.includes('older reasoning')));
  const repeated=mergeBackupStates(result.state,initial);assert.equal(repeated.conflicts,0);assert.deepEqual(repeated.state,result.state);
});
test('Replacing source exercises preserves previous answers with their original prompts',()=>{
  const before=unit(),after={...before,exercises:before.exercises.map(e=>({...e,prompt:'Updated exercise: '+e.prompt}))};
  const s=scheduleUnit({...defaultState(),studyUnits:[before]},before,now);s.studyProgress[0].answers=[{id:'e1',text:'answer for the earlier prompt'}];s.studyProgress[0]=recordReview(s.studyProgress[0],'good',30,now);
  StudyWorkspace.prototype.preservePreviousAnswers(before,after,s);assert.equal(s.notes.length,1);assert.ok(s.notes[0].body.includes(before.exercises[0].prompt));assert.ok(s.notes[0].body.includes('answer for the earlier prompt'));assert.deepEqual(s.studyProgress[0].answers,[]);assert.deepEqual(s.studyProgress[0].history,[]);validateState(s);
  StudyWorkspace.prototype.preservePreviousAnswers(after,after,s);assert.equal(s.notes.length,1);
});
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'public',OPENAI_API_KEY:'server-secret',OPENAI_MODEL:'configured-model',ALLOWED_ORIGINS:'https://suguilin.github.io'};
const request=(input,origin=env.ALLOWED_ORIGINS)=>new Request('https://edge.test',{method:'POST',headers:{Origin:origin,Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify(input)});
function synthesisMock({allowed=true,quota=true,broken=false}={}){let calls=0,payload;return {get calls(){return calls;},get payload(){return payload;},fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'owner'}));
  if(url.endsWith('/is_workspace_member'))return new Response(JSON.stringify(allowed));
  if(url.endsWith('/consume_ai_quota'))return new Response(JSON.stringify(quota));
  if(url==='https://api.openai.com/v1/responses'){calls++;assert.equal(options.headers.Authorization,'Bearer server-secret');payload=JSON.parse(options.body);const u=unit();if(broken)u.takeaways[0].evidence='not present';return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(u)}]}]}));}throw Error('unexpected endpoint '+url);
}};}
test('Synthesis authenticates, checks quota and source grounding, and uses server-side structured Responses',async()=>{
  const mock=synthesisMock(),handler=createSynthesisHandler({env,fetcher:mock.fetcher});const response=await handler(request({item,pastedText:body}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.unit.mode,'ai');assert.equal(mock.payload.store,false);assert.equal(mock.payload.text.format.strict,true);assert.equal(mock.payload.text.format.type,'json_schema');assert.ok(!JSON.stringify(result).includes('server-secret'));
  for(const settings of [{allowed:false},{quota:false},{broken:true}]){const m=synthesisMock(settings),h=createSynthesisHandler({env,fetcher:m.fetcher}),r=await h(request({item,pastedText:body}));assert.ok(r.status>=400);assert.equal(m.calls,settings.broken?1:0);}
  const m=synthesisMock();assert.equal((await createSynthesisHandler({env,fetcher:m.fetcher})(request({item,pastedText:body},'https://evil.test'))).status,403);assert.equal(m.calls,0);
  const unconfigured=synthesisMock();assert.equal((await createSynthesisHandler({env:{...env,OPENAI_API_KEY:''},fetcher:unconfigured.fetcher})(request({item,pastedText:body}))).status,503);assert.equal(unconfigured.calls,0);
});
