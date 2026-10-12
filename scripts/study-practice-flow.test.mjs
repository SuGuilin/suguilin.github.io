import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recoveryReportNote,calibrationReportNote,appendPracticeReport} from '../assets/practice-reports.js';
import {annotationThought,ReadingAnnotations} from '../assets/reading-annotations.js';
import {saveAnnotation,readAnnotation} from '../assets/learning-signals.js';
import {StudyWorkspace} from '../assets/study.js';
import {defaultState,validateState} from '../assets/state.js';
import {newProgress,recordReview,beginRecall} from '../assets/study-model.js';
import {vaultFiles} from '../assets/backup.js';
import {studyQuestion,questionWithContext,learningSources,saveStudySnapshot} from '../assets/study-session.js';
import {notebookPanel} from '../assets/study-visuals.js';
import {journalTitle} from '../assets/journal-model.js';

const {units}=JSON.parse(await readFile('content/study-units.json','utf8'));
const unit=units.find(u=>u.id==='lesson-tool-reliability');
const report={experiment:'durable-agent',data_scope:'synthetic in-memory simulation',results:[{protocol:'query_then_retry',crash_at:'after_remote_commit',status:'confirmed',business_commits:1,write_requests:1}],sqlite:{workers:20,business_commits:1,distinct_receipts:1,reopen_commits:1,rollback_commits:0,payload_conflict:true},my_explanation:'查询找到了已有回执，因此没有再发写请求。'};
test('Exercise questions carry this attempt experiment notes, retain the request and keep previous recall evidence separate',()=>{
  const progress={...newProgress(unit),answers:[{id:'e1',text:'我的当前作答'}],reflection:recoveryReportNote(JSON.stringify(report))};
  const question=studyQuestion(unit,progress,'e1');
  assert.match(question,/我的当前作答/);assert.match(question,/20 个并发调用/);assert.match(question,/查询找到了已有回执/);
  const reviewed=recordReview(progress,'hard',10,new Date('2026-10-12T04:00:00Z')),recall=beginRecall(reviewed,new Date('2026-10-14T04:00:00Z'));
  const fresh=studyQuestion(unit,recall,'e1');assert.ok(!fresh.includes('20 个并发调用'));assert.ok(!fresh.includes('我的当前作答'));assert.match(fresh,/还未作答/);
  recall.recall.reflection='本次新实验：结果仍未知。';assert.match(studyQuestion(unit,recall,'e1'),/本次新实验/);
  const large={...unit,title:'题'.repeat(200),exercises:[{...unit.exercises[0],prompt:'题'.repeat(2000)}]};
  const bounded=studyQuestion(large,{...progress,answers:[{id:'e1',text:'答'.repeat(4000)}],reflection:'观察'.repeat(3000)},'e1');
  assert.ok(bounded.length<=6000);assert.ok(bounded.endsWith('用一个追问帮助我继续思考。'));
});
test('Reading marks show the learner thought and discussion preserves the note and return context',()=>{
  const {note}=saveAnnotation(defaultState(),unit,{quote:'超时说明结果未知',section:'chapter-1'},{kind:'学习笔记',comment:'两个并发请求都查到未提交时，怎样阻止重复创建？',id:'thought'});
  const a=readAnnotation(note),thought=annotationThought(note);assert.match(thought,/两个并发请求/);assert.doesNotMatch(thought,/原始来源|回到标注位置/);assert.equal(annotationThought(undefined),'');
  const empty=saveAnnotation(defaultState(),unit,{quote:'超时说明结果未知',section:'chapter-1'},{id:'empty'}).note;assert.equal(annotationThought(empty),'');
  let context;const annotations=Object.create(ReadingAnnotations.prototype);annotations.study={platform:{openAssistant:c=>context=c}};
  const markup=annotations.list([a]);assert.match(markup,/annotation-thought/);assert.match(markup,/两个并发请求/);assert.match(markup,/edit=1/);
  annotations.discuss(unit,a);assert.equal(context.journalNoteId,note.id);assert.equal(context.section,'chapter-1');assert.ok(context.question.includes(thought));assert.ok(context.question.includes(a.quote));
});
test('Experiment import keeps measured results, appends existing reasoning and survives backup',()=>{
  const result=appendPracticeReport('原有理解：检查点不能证明远端状态。',JSON.stringify(report));assert.ok(result.text.startsWith('原有理解'));assert.match(result.text,/20 个并发调用/);assert.match(result.text,/查询找到了已有回执/);
  assert.equal(appendPracticeReport(result.text,JSON.stringify(report)).duplicate,true);
  const s=defaultState(),p=newProgress(unit);p.reflection=result.text;s.studyProgress=[p];const validated=validateState(s);assert.equal(validated.studyProgress[0].reflection,result.text);assert.ok(vaultFiles(s).some(f=>f.text.includes('20 个并发调用')));
  const failing={...report,results:[{...report.results[0],business_commits:2}],sqlite:{...report.sqlite,business_commits:2,payload_conflict:false}};
  assert.match(recoveryReportNote(JSON.stringify(failing)),/不同参数复用 ID：未拒绝/);assert.match(recoveryReportNote(JSON.stringify(failing)),/2 条业务记录/);
  const old={...report};delete old.sqlite;assert.match(recoveryReportNote(JSON.stringify(old)),/内存故障模拟/);
});
test('Malformed or oversized experiment files do not become plausible learning evidence',()=>{
  for(const bad of ['{}','invalid',JSON.stringify({...report,experiment:'other'}),JSON.stringify({...report,data_scope:'production'}),JSON.stringify({...report,results:[{...report.results[0],business_commits:-1}]}),JSON.stringify({...report,sqlite:{workers:20}})])assert.throws(()=>recoveryReportNote(bad));
  assert.throws(()=>recoveryReportNote('x'.repeat(50001)));assert.throws(()=>appendPracticeReport('x'.repeat(5990),JSON.stringify(report)),/6000/);
});
test('Questions asked after code practice include the current observation and source support',()=>{
  const progress=newProgress(unit);progress.reflection=recoveryReportNote(JSON.stringify(report));const question=studyQuestion(unit,progress,'','代码实践');assert.ok(question.includes('20 个并发调用'));assert.ok(question.includes('查询找到了已有回执'));
  const handoff=questionWithContext(question,unit,{sources:[{title:'SQLite Transaction',url:'https://www.sqlite.org/lang_transaction.html',supports:'单写事务与提交边界'}]});assert.match(handoff,/https:\/\/www.sqlite.org\/lang_transaction.html/);assert.match(handoff,/支持范围：单写事务/);
  assert.ok(!questionWithContext(question,unit,{sources:[{title:'Source',url:unit.source.url}]}).includes('undefined'));
});
test('Calibration observations retain counts and scope through questions, snapshots and backups',()=>{
  const jev=units.find(u=>u.id==='digest-jev'),selection={threshold:.9,accepted:2,errors:0,coverage:.25,accepted_error:0};
  const r={experiment:'decision-calibration',data_scope:'synthetic binary classification',model_evaluated:false,samples:8,change:'翻转第一个标签',baseline:{brier:.1671875,selective:[selection]},changed:{brier:.2796875,selective:[{...selection,errors:1,accepted_error:.5}]},my_interpretation:'高概率也会错，阈值必须独立验证。'};
  const result=appendPracticeReport('我的预测：提高阈值会降低覆盖率。',JSON.stringify(r),'decision-calibration');
  assert.match(result.text,/0.1672/);assert.match(result.text,/0.2797/);assert.match(result.text,/1\/2（50.0%）/);assert.match(result.text,/未调用或评测 Jev/);assert.ok(result.text.startsWith('我的预测'));
  assert.equal(appendPracticeReport(result.text,JSON.stringify(r),'decision-calibration').duplicate,true);
  const state=defaultState(),p=newProgress(jev);p.reflection=result.text;state.studyProgress=[p];
  assert.match(studyQuestion(jev,p),/不是 TypeSafe confidence/);
  const snapshot=saveStudySnapshot(state,jev,p,{id:'calibration'}).state;
  assert.match(validateState(snapshot).notes[0].body,/高概率也会错/);assert.ok(vaultFiles(snapshot).some(f=>f.text.includes('0.2797')));
  for(const bad of [{...r,model_evaluated:true},{...r,samples:0},{...r,changed:{...r.changed,selective:[{...selection,coverage:.9}]}},{...r,changed:{...r.changed,brier:Infinity}},{...r,changed:{...r.changed,selective:[{...selection,threshold:.8}]}},{...r,my_interpretation:{answer:'fake'}}])assert.throws(()=>calibrationReportNote(JSON.stringify(bad)));
  assert.throws(()=>appendPracticeReport('',JSON.stringify(r),'durable-agent'));assert.throws(()=>appendPracticeReport('',JSON.stringify(report),'decision-calibration'));
  const empty={...selection,accepted:0,errors:0,coverage:0,accepted_error:null};assert.match(calibrationReportNote(JSON.stringify({...r,baseline:{...r.baseline,selective:[empty]},changed:{...r.changed,selective:[empty]}})),/无自动处理样本/);
  assert.match(notebookPanel(jev),/calibration_report.json/);assert.match(notebookPanel(jev),/data-experiment="decision-calibration"/);
});
test('Digest question handoffs include the same supporting sources as the reading page',async()=>{
  const knowledge={resources:JSON.parse(await readFile('content/workspace.json','utf8')).resources,lessons:JSON.parse(await readFile('content/lessons.json','utf8')).lessons};
  const jev=units.find(u=>u.id==='digest-jev'),sources=learningSources(jev,knowledge),text=questionWithContext('如何验证 confidence？',jev,{sources});
  assert.equal(sources.length,5);assert.match(text,/https:\/\/docs.typesafe.ai\/confidence/);assert.match(text,/未阅读全文或复现/);assert.match(text,/支持范围：/);
  assert.ok(learningSources(unit,knowledge).some(s=>s.url==='https://www.sqlite.org/lang_transaction.html'));
  assert.deepEqual(learningSources(jev,{}),[jev.source]);assert.deepEqual(learningSources(null,knowledge),[]);
});
test('First self assessment and later recall have distinguishable journal titles without rewriting records',()=>{
  const first={title:unit.title+' · 学习复盘',kind:'学习复盘',body:'## 我的作答\nanswer\n\n[回到学习单元](/study/?id='+unit.id+')'},later={...first,body:'## 上次作答（供事后比较）\nold\n\n'+first.body};
  assert.match(journalTitle(first),/学习自检$/);assert.match(journalTitle(later),/独立回忆$/);assert.equal(first.title,unit.title+' · 学习复盘');assert.equal(journalTitle({...first,title:'我的实验复盘'}),'我的实验复盘');
});
test('Code practice follows the explanation and is available from the exercise anchor without exposing answers in recall',async()=>{
  const {lessons}=JSON.parse(await readFile('content/lessons.json','utf8'));
  const study=Object.create(StudyWorkspace.prototype);Object.assign(study,{fontSize:18,focus:false,getCurated:()=>units,getLessons:()=>lessons,getData:()=>({resources:[]}),getState:()=>defaultState(),annotations:{records:()=>[],markup:()=>''}});
  const html=study.reader(new URLSearchParams({id:unit.id}));assert.ok(html.indexOf('运行本篇代码')>html.indexOf('id="study-practice"'));assert.ok(html.indexOf('运行本篇代码')>html.indexOf('id="study-boundaries"'));
  const recall={...newProgress(unit),recall:{startedAt:new Date().toISOString(),answers:[],reflection:''}};assert.ok(!study.exercisesMarkup(unit,recall).includes('运行本篇代码'));
});
