import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {saveAnnotation,readAnnotation,learningRecommendations,discoveryInterests} from '../assets/learning-signals.js';
import {sourceRecord,sourceDetails} from '../assets/source-records.js';
import {toDocuments,fromDocuments} from '../assets/sync.js';
import {vaultFiles} from '../assets/backup.js';
const now=new Date('2026-10-11T12:00:00Z');
const unit={id:'lesson-memory',title:'记忆与上下文',topic:'长期记忆',summary:'理解有效时间',takeaways:[],exercises:[],source:{url:'https://example.org/memory',scope:'原始文档'}};
test('A selected passage survives JSON, sync documents and Obsidian with its exact return location',()=>{
  const first=saveAnnotation(defaultState(),unit,{section:'study-essentials',quote:'  thread_id\n保留恢复身份  '},{now,id:'one'});
  const annotation=readAnnotation(first.note);assert.equal(annotation.quote,'thread_id 保留恢复身份');assert.equal(annotation.section,'study-essentials');
  const saved=validateState(JSON.parse(JSON.stringify(first.state)));assert.deepEqual(fromDocuments([...toDocuments(saved).values()]),saved);
  assert.equal(readAnnotation(mergeBackupStates(defaultState(),saved).state.notes[0]).unitId,unit.id);
  const file=vaultFiles(saved).find(f=>f.name.startsWith('学习日志/'));assert.match(file.text,/https:\/\/suguilin.github.io\/study\/\?id=lesson-memory#study-essentials/);
  assert.equal(saveAnnotation(saved,unit,{section:'study-essentials',quote:annotation.quote},{now,id:'two'}).duplicate,true);
  assert.throws(()=>saveAnnotation(saved,unit,{section:'../other',quote:'text'}));
});
test('Unresolved questions outrank novelty; resolving them changes recommendations without deleting evidence',()=>{
  const other={...unit,id:'digest-jev',title:'Jev 决策模型',topic:'决策模型',summary:'类型化判断',source:{url:'https://example.org/jev'}};
  const s=saveAnnotation(defaultState(),unit,{section:'study-essentials',quote:'什么是跨会话记忆？'},{kind:'待解答问题',id:'question',now}).state;
  const resources=[{id:'jev',url:other.source.url,priority:'frontier',title:'Jev',tags:[]}];
  const first=learningRecommendations(s,[unit,other],resources);assert.equal(first[0].unit.id,unit.id);assert.match(first[0].reason,/待解答/);
  s.notes[0].kind='已解决问题';assert.ok(!learningRecommendations(s,[unit,other],resources)[0].question);assert.equal(s.notes.length,1);
  assert.ok(discoveryInterests(s).some(t=>t.query==='agent memory'));
  assert.equal(learningRecommendations(defaultState(),[unit,other],resources)[0].unit.id,other.id);
});
test('New recommendations include personal saved interests and do not repeat already practiced unrelated units',()=>{
  const evalUnit={...unit,id:'lesson-evaluation',title:'评测与实验',topic:'评测',summary:'固定任务与评分器',source:{url:'https://example.org/evaluation'}};
  const s={...defaultState(),saved:['reference-memory'],studyProgress:[{id:evalUnit.id,title:evalUnit.title,updatedAt:now.toISOString(),history:[{rating:'good'}],answers:[]}]};
  const ranked=learningRecommendations(s,[unit,evalUnit],[{id:'reference-memory',title:'长期记忆',tags:[],url:unit.source.url}]);
  assert.equal(ranked.length,1);assert.equal(ranked[0].unit.id,unit.id);assert.match(ranked[0].reason,/收藏/);
  const marked=saveAnnotation(defaultState(),unit,{section:'study-essentials',quote:'保留事实的有效时间'},{now,id:'old-mark'}).state;
  marked.studyProgress=[{id:unit.id,title:unit.title,updatedAt:now.toISOString(),history:[{at:new Date(now.getTime()+1000).toISOString(),rating:'good'}],answers:[]}];
  assert.equal(learningRecommendations(marked,[unit]).length,0);
  marked.notes[0].updatedAt=new Date(now.getTime()+2000).toISOString();assert.equal(learningRecommendations(marked,[unit]).length,1);
});
test('Author material retains provenance, unknown dates and learner questions without pretending to read the source',()=>{
  const fields=new Map([['origin','小红书'],['author','作者甲'],['perspective','作者观点'],['readingQuestion','这个结论是否依赖小样本？']]);
  const details=sourceDetails(fields),item={title:'作者的 Agent 实践',url:'https://example.org/post'};
  const result=sourceRecord(defaultState(),item,details,{id:'post',now});assert.match(result.note.body,/原文发布日期：未知/);assert.match(result.note.body,/小样本/);assert.match(result.note.body,/尚未整理或核实正文/);
  assert.equal(validateState(result.state).notes.length,1);assert.equal(sourceRecord(result.state,item,details,{id:'again',now}).note.id,result.note.id);
  assert.throws(()=>sourceDetails(new Map([['publishedAt','2099-01-01']])));
  assert.throws(()=>sourceRecord(defaultState(),{...item,url:'javascript:alert(1)'},details));
  const supplemented=sourceRecord(result.state,item,{...details,question:'要怎样独立验证这个判断？'},{text:'保留原记录与新节选',now});
  assert.equal(supplemented.note.id,result.note.id);assert.equal(supplemented.state.notes.length,1);assert.match(supplemented.note.body,/小样本/);assert.match(supplemented.note.body,/独立验证/);
  assert.match(supplemented.note.body,/新节选/);assert.deepEqual(sourceRecord(supplemented.state,item,{...details,question:'要怎样独立验证这个判断？'},{text:'保留原记录与新节选',now}).state,supplemented.state);
});
test('Bookmarking an editorial unit is included in an Obsidian backup',()=>{
  const files=vaultFiles({...defaultState(),saved:[unit.id]},{resources:[],studyUnits:[unit]});
  assert.match(files.find(f=>f.name==='收藏资料.md').text,/记忆与上下文/);assert.match(files.find(f=>f.name==='收藏资料.md').text,/https:\/\/example.org\/memory/);
});
