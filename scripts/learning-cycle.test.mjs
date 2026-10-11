import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newProgress,beginRecall,currentAttempt,recordReview,validateProgress,dailyQueue} from '../assets/study-model.js';
import {learningStage,learningNeeds,learningURL} from '../assets/learning-cycle.js';
import {studyQuestion,saveStudySnapshot} from '../assets/study-session.js';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {toDocuments,fromDocuments} from '../assets/sync.js';
import {vaultFiles} from '../assets/backup.js';
import {sourceRecord,sourceRecordInfo} from '../assets/source-records.js';
import {saveAnnotation,learningRecommendations} from '../assets/learning-signals.js';
const units=JSON.parse(await readFile('content/study-units.json','utf8')).units;
const unit=units[0],now=new Date('2026-10-11T08:00:00Z');
const graded=()=>recordReview({...newProgress(unit),answers:[{id:'e1',text:'上次答案：稳定操作 ID'}],reflection:'之前的理解'},'hard',15,now);
test('Repeated review requires a new recall; old answers remain untouched until the new attempt is assessed',()=>{
  const old=graded();assert.throws(()=>recordReview(old,'good',10,now),/独立回忆/);
  const p=beginRecall(old,now);assert.deepEqual(p.answers,old.answers);assert.deepEqual(currentAttempt(p).answers,[]);
  p.recall.answers=[{id:'e1',text:'这次解释：恢复位置与远端提交身份必须分别管理'}];p.recall.reflection='我补上了查询失败的边界';
  assert.deepEqual(beginRecall(p,now),p);assert.equal(old.answers[0].text,'上次答案：稳定操作 ID');
  const question=studyQuestion(unit,p,'e1');assert.match(question,/这次解释/);assert.ok(!question.includes('上次答案'));
  const next=recordReview(p,'good',10,now);assert.equal(next.answers[0].text,p.recall.answers[0].text);assert.equal(next.reflection,p.recall.reflection);assert.equal(next.recall,undefined);assert.equal(next.history.length,2);
  const note=saveStudySnapshot(defaultState(),unit,next,{review:'good',previous:p,now,id:'recall'}).note;assert.match(note.body,/上次答案/);assert.match(note.body,/这次解释/);
  assert.throws(()=>recordReview(beginRecall(old,now),'again',10,now),/先写下/);
});
test('Recall drafts survive sync, JSON, conflict recovery and readable Obsidian exports; legacy records remain valid',()=>{
  const p=beginRecall(graded(),now);p.recall.answers=[{id:'e2',text:'中途离开的复习推理'}];p.recall.reflection='需要验证并发提交';
  const s=validateState({...defaultState(),studyProgress:[p]});assert.deepEqual(fromDocuments([...toDocuments(s).values()]),s);
  assert.deepEqual(mergeBackupStates(defaultState(),JSON.parse(JSON.stringify(s))).state,s);
  const markdown=vaultFiles(s,{studyUnits:units}).find(f=>f.name.startsWith('练习与复习/')).text;assert.match(markdown,/中途离开的复习推理/);assert.match(markdown,/上次答案/);
  const newer=structuredClone(s);newer.studyProgress[0].recall.answers[0].text='修改后的推理';newer.studyProgress[0].updatedAt='2026-10-12T08:00:00Z';
  const recovered=mergeBackupStates(newer,s);assert.match(recovered.state.notes[0].body,/中途离开的复习推理/);assert.equal(recovered.conflicts,1);assert.deepEqual(mergeBackupStates(recovered.state,s).state,recovered.state);
  assert.doesNotThrow(()=>validateProgress(graded()));
  for(const recall of [{...p.recall,answers:[{id:'e6',text:'x'}]},{...p.recall,startedAt:'bad'},{...p.recall,answers:[{id:'e1',text:'x'},{id:'e1',text:'y'}]}])assert.throws(()=>validateProgress({...p,recall}));
});
test('Learner needs connect questions, fresh recall, source inbox, annotations and unassessed attempts to their next action',()=>{
  const p=beginRecall(graded(),now),other=units[3];let s={...defaultState(),studyProgress:[p,{...newProgress(other),answers:[{id:'e1',text:'我的记忆解释'}]}]};
  s=saveAnnotation(s,unit,{section:'study-essentials',quote:'仍然不懂的边界'},{kind:'待解答问题',now,id:'question'}).state;
  s=saveAnnotation(s,units[2],{section:'study-essentials',quote:'分组统计的边界'},{now,id:'mark'}).state;
  const source=sourceRecord(s,{title:'待整理分享',url:'https://example.org/article'},{origin:'微信公众号',author:'作者',publishedAt:'',question:'独立评测了吗？',perspective:'作者观点'},{now,id:'article'});s=source.state;
  const needs=learningNeeds(s,units,now);assert.deepEqual(needs.map(n=>n.kind),['recall','question','check','practice','source']);assert.match(needs[0].url,/mode=recall/);assert.match(needs[1].url,/journal/);
  assert.equal(learningStage(p).id,'recalling');assert.equal(learningStage(s.studyProgress[1]).id,'checking');assert.equal(learningStage(undefined).id,'new');
  s.notes.find(n=>n.kind==='待解答问题').kind='已解决问题';assert.ok(!learningNeeds(s,units,now).some(n=>n.kind==='question'));
  const linked=sourceRecord(s,{title:'待整理分享',url:'https://example.org/article'},{origin:'微信公众号',author:'作者',question:'',publishedAt:'',perspective:'作者观点'},{now,unit:other});assert.ok(!learningNeeds(linked.state,units,now).some(n=>n.kind==='source'));
  const info=sourceRecordInfo(source.note);assert.equal(info.author,'作者');assert.equal(info.readingQuestion,'独立评测了吗？');assert.equal(info.publishedAt,'');assert.equal(info.text,'');
});
test('A recall started before its due date still appears in the daily queue and recommendations, within the budget',()=>{
  const p=beginRecall(graded(),now),s={...defaultState(),dailyMinutes:15,studyProgress:[p]};
  assert.equal(dailyQueue(s,units,now)[0].unit.id,unit.id);assert.equal(dailyQueue(s,units,now)[0].minutes,10);
  assert.equal(learningRecommendations(s,units)[0].unit.id,unit.id);assert.match(learningURL(unit,p),/mode=recall/);
  assert.equal(learningStage(graded(),new Date('2026-10-13T08:00:00Z')).id,'due');
});
test('Long before-and-after answers are preserved in separate linked notes instead of exceeding the journal limit',()=>{
  const big={...unit,exercises:unit.exercises.map(e=>({...e,prompt:'长题目'.repeat(590)}))};
  // Five answers and the longest allowed prompts exceed a single note when compared.
  while(big.exercises.length<5)big.exercises.push({...big.exercises[0],id:'e'+(big.exercises.length+1)});
  const previous={...graded(),answers:big.exercises.map(e=>({id:e.id,text:'旧'.repeat(6000)})),reflection:'旧'.repeat(6000)};
  const next={...previous,answers:big.exercises.map(e=>({id:e.id,text:'新'.repeat(6000)})),reflection:'新'.repeat(6000)};
  const result=saveStudySnapshot(defaultState(),big,next,{review:'good',previous,now,id:'long'});
  assert.equal(result.state.notes.length,2);assert.ok(result.state.notes.every(n=>n.body.length<=80000));assert.match(result.note.body,/对照上次作答/);validateState(result.state);
});
