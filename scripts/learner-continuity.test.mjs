import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultState} from '../assets/state.js';
import {newProgress,recordReview,beginRecall} from '../assets/study-model.js';
import {learningAction,dailyLearningQueue} from '../assets/learning-cycle.js';
import {questionWithContext,saveStudySnapshot} from '../assets/study-session.js';
import {questionNoteParts,journalNoteParts,journalPreview,journalTitle,journalReadingBody,noteDiscussion,noteLearningLink,filterJournal,journalScope} from '../assets/journal-model.js';
import {resourceLearningUnit} from '../assets/catalog-view.js';
import {StudyWorkspace} from '../assets/study.js';
import {LearningPlatform} from '../assets/platform.js';
import {saveAnnotation} from '../assets/learning-signals.js';
import {discoverySummary} from '../assets/discovery.js';
import {sourceRecord} from '../assets/source-records.js';
const units=JSON.parse(await readFile('content/study-units.json','utf8')).units;
const unit=units[0],now=new Date('2026-10-11T08:00:00Z');

test('Continue actions target the saved reading position, unassessed practice or an independent recall',()=>{
  assert.equal(learningAction(unit,null).label,'开始学习');
  const reading={...newProgress(unit),readingSection:'chapter-2'};
  assert.match(learningAction(unit,reading).url,/#chapter-2$/);
  const checking={...reading,answers:[{id:'e1',text:'我的推理'}]};
  assert.equal(learningAction(unit,checking).label,'继续自检');
  assert.match(learningAction(unit,checking).url,/#study-practice$/);
  const reviewed=recordReview(checking,'hard',15,now);
  assert.match(learningAction(unit,reviewed,{now:new Date('2026-10-13T08:00:00Z')}).url,/mode=recall#study-practice$/);
  assert.equal(learningAction(unit,beginRecall(reviewed,now)).label,'继续复习');
});

test('Question summaries fold only generated context; editing and backups retain the full original and user additions',()=>{
  const question='检查点是否也保存外部副作用？';
  const note=saveStudySnapshot(defaultState(),unit,newProgress(unit),{question:questionWithContext(question,unit),section:'exercise-e1',now,id:'question'}).note;
  note.body+='\n\n## 后续理解\n\n需要查询远端操作。';
  const original=note.body,parts=questionNoteParts(note);
  assert.equal(parts.question,question);assert.match(parts.context,/关键要点/);
  assert.ok(!parts.body.includes('关键要点'));assert.match(parts.body,/后续理解/);
  assert.equal(note.body,original);assert.equal(journalTitle(note),unit.title);assert.equal(journalPreview(note),question);
  assert.ok(journalReadingBody(note).includes(question));assert.match(journalReadingBody(note),/后续理解/);assert.equal(note.body,original);
  const context=noteDiscussion(note,unit);
  assert.equal(context.question,question);assert.equal(context.journalNoteId,note.id);assert.equal(context.section,'exercise-e1');
  assert.equal(noteLearningLink(note).id,unit.id);
  const custom={...note,body:'## 待解答的问题\n\n自己的说明\n\n---\n学习单元：我的格式\n关键要点：\n用户自己的正文'};
  assert.equal(questionNoteParts(custom).body,custom.body);assert.equal(questionNoteParts(custom).context,'');
  assert.equal(noteLearningLink({...note,body:'[外部](https://example.org/study/?id=lesson-a)'}),null);
});

test('Annotation journals separate generated titles, thoughts and source context without changing user records',()=>{
  const quote='超时只说明结果未知，不能证明远端没有提交。'.repeat(5),thought='我的理解：重试必须保持原操作 ID。';
  const note=saveAnnotation(defaultState(),unit,{section:'chapter-1',quote},{comment:thought,kind:'学习笔记',now,id:'layout'}).note;
  note.body+='\n\n## 后续笔记\n\n我的补充内容';
  const original=structuredClone(note),parts=journalNoteParts(note);
  assert.equal(journalTitle(note),unit.title);assert.equal(journalPreview(note),thought);
  assert.match(parts.body,/超时只说明结果未知/);assert.match(parts.body,/后续笔记/);
  assert.ok(!parts.body.includes('阅读范围：'));assert.ok(parts.context.includes(unit.source.url));assert.ok(parts.context.includes(unit.source.scope));
  assert.deepEqual(note,original);assert.equal(journalTitle({...note,title:'我自己写的标题'}),'我自己写的标题');
  const mark=saveAnnotation(defaultState(),unit,{section:'chapter-1',quote},{now,id:'mark'}).note;
  assert.equal(journalPreview(mark),quote.slice(0,150));
  assert.equal(filterJournal([note],{query:unit.source.scope}).length,1);
});
test('Recall journals fold previous evidence for reading while keeping edits, search and backup content intact',()=>{
  const previous={...newProgress(unit),answers:[{id:unit.exercises[0].id,text:'旧作答的具体证据'}],reflection:'旧实验记录 0.2797'};
  const current={...newProgress(unit),answers:[{id:unit.exercises[0].id,text:'这次独立解释'}],reflection:'新的理解'};
  const note=saveStudySnapshot(defaultState(),unit,current,{review:'good',previous,now,id:'compare'}).note;
  note.body+='\n\n## 后续补充\n\n我自己添加的内容';
  const original=structuredClone(note),parts=journalNoteParts(note);
  assert.match(parts.body,/这次独立解释/);assert.match(parts.body,/后续补充/);assert.ok(!parts.body.includes('旧实验记录'));
  assert.match(parts.comparison,/旧作答的具体证据/);assert.match(parts.comparison,/0.2797/);assert.match(journalReadingBody(note),/回到学习单元/);
  assert.equal(filterJournal([note],{query:'旧实验记录'}).length,1);assert.deepEqual(note,original);
  assert.equal(journalPreview(note),'新的理解');
  const onlyAnswer=saveStudySnapshot(defaultState(),unit,{...current,reflection:''},{now,id:'answer-only'}).note;assert.equal(journalPreview(onlyAnswer),'这次独立解释');
  assert.equal(journalNoteParts({...note,title:'我自定义的复盘'}).comparison,undefined);
  assert.equal(journalNoteParts({...note,body:note.body.split('[回到学习单元]')[0]}).comparison,undefined);
});

test('Today recommendations use the remaining time after recorded learning, without altering stored budgets or backend models',()=>{
  const reviewed=recordReview({...newProgress(unit),answers:[{id:'e1',text:'回答'}]},'hard',30,now);
  const s={...defaultState(),dailyMinutes:45,studyProgress:[reviewed]};
  assert.ok(dailyLearningQueue(s,units,now).reduce((n,q)=>n+q.minutes,0)<=15);
  assert.equal(s.dailyMinutes,45);
  s.dailyMinutes=30;assert.deepEqual(dailyLearningQueue(s,units,now),[]);
});

test('Per-unit journals include annotations and snapshots without mixing drafts from other units',()=>{
  const mark=saveAnnotation(defaultState(),unit,{section:'study-essentials',quote:'状态恢复的边界'},{now,id:'mark'}).note;
  const note=saveStudySnapshot(defaultState(),units[1],{...newProgress(units[1]),reflection:'另一篇的理解'},{now,id:'other'}).note;
  assert.deepEqual(filterJournal([mark,note],{unit:unit.id}).map(n=>n.id),[mark.id]);
  assert.equal(journalScope(new URLSearchParams('new=1&unit='+unit.id)),'unit:'+unit.id);
  assert.notEqual(journalScope(new URLSearchParams('new=1&unit='+unit.id)),journalScope(new URLSearchParams('new=1&unit='+units[1].id)));
  const platform=Object.create(LearningPlatform.prototype);
  platform.context={studyUnit:unit,journalNoteId:mark.id};
  assert.equal(platform.draftKey(),'journal:'+mark.id);
});

test('Reference material enters a genuinely related unit through an exact source, never just a shared tag',()=>{
  const source={id:'source',url:'https://example.org/source',tags:['Harness']},related={id:'related',source:{url:source.url}};
  assert.equal(resourceLearningUnit(source,[related]),related);
  assert.equal(resourceLearningUnit(source,[{id:'other',source:{url:'https://example.org/other'},tags:['Harness']}]),undefined);
  assert.equal(resourceLearningUnit(source,[{...related,id:'lesson'}],[{id:'lesson',sources:[{url:source.url}]}]).id,'lesson');
});

test('An empty plan offers learning without empty calendars; existing work is not duplicated in needs',()=>{
  const s=defaultState(),workspace=Object.assign(Object.create(StudyWorkspace.prototype),{getState:()=>s,getCurated:()=>units,getData:()=>({resources:[]})});
  const empty=workspace.plan();assert.match(empty,/开始学习/);assert.ok(!empty.includes('plan-calendar'));assert.ok(!empty.includes('learning-needs'));assert.ok(!empty.includes('learning-queue'));
  s.studyProgress=[{...newProgress(unit),answers:[{id:'e1',text:'独立作答'}]}];
  const active=workspace.plan();assert.match(active,/继续自检/);assert.ok(!active.includes('待自检</span>'));
  assert.match(active,/<details class="plan-details plan-schedule"/);
});

test('Unprocessed source leads remain available without crowding out today tasks or questions',()=>{
  let state=defaultState();
  for(let i=0;i<8;i++)state=sourceRecord(state,{title:'待整理 '+i,url:'https://example.org/'+i},{origin:'GitHub',author:'作者',perspective:'待核实线索'},{now,id:'source-'+i}).state;
  const workspace=Object.assign(Object.create(StudyWorkspace.prototype),{getState:()=>state,getCurated:()=>units,getData:()=>({resources:[]})});
  const html=workspace.plan();assert.match(html,/<details class="learning-needs-sources" id="learning-needs">/);
  assert.match(html,/8 份/);assert.ok(!html.includes('<h2>还待处理</h2>'));assert.match(html,/journal\/\?kind=inbox/);
  assert.equal(state.notes.length,8);
});

test('Discovery completion describes stored leads honestly when no learning unit was generated',()=>{
  const leads=discoverySummary({found:18,added:18});assert.ok(!leads.includes('生成 0'));assert.ok(!leads.includes('打开学习单元'));assert.match(leads,/继续整理要点与练习/);
  assert.match(discoverySummary({learned:2,found:3,added:3,unread:1}),/打开学习单元/);
  assert.match(discoverySummary({failures:3}),/换关键词/);
});
