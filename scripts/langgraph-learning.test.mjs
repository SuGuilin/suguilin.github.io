import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {langgraphReportNote,appendPracticeReport} from '../assets/practice-reports.js';
import {progressBackup,studyQuestion,saveStudySnapshot} from '../assets/study-session.js';
import {newProgress,recordReview,beginRecall} from '../assets/study-model.js';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {vaultFiles} from '../assets/backup.js';
import {notebookPanel,lessonChapters} from '../assets/study-visuals.js';
import {StudyWorkspace} from '../assets/study.js';

const unit=JSON.parse(await readFile('content/study-units.json','utf8')).units.find(u=>u.id==='digest-langgraph');
const report={experiment:'langgraph-durable-workflow',data_scope:'local SDK + SQLite subprocess experiment',model_called:false,
  versions:{langgraph:'1.2.14','langgraph-checkpoint':'4.2.0','langgraph-checkpoint-sqlite':'3.1.1'},
  paused:{next:['approve'],before_interrupt:1},after_crash:{next:['save'],business_rows:1,write_attempts:1,before_interrupt:2},
  recovered:{next:[],business_rows:1,write_attempts:2,before_interrupt:2},rejected:{business_rows:0,write_attempts:0,before_interrupt:2},
  thread_isolated:true,new_memory_empty:true,fork_requires_new_approval:true,reducer_keys:['a','b'],my_explanation:'保存调用两次不等于产生两份业务结果。'};

test('LangGraph result import preserves predictions, observations and bounds through questions, journal and Obsidian',()=>{
  const result=appendPracticeReport('我的预测：写后硬退出时检查点尚未确认。',JSON.stringify(report),'langgraph-durable-workflow');
  assert.ok(result.text.startsWith('我的预测'));assert.match(result.text,/\| 新进程恢复 \| 无待执行节点 \| 1 \| 2 \| 2 \|/);assert.match(result.text,/独立子进程/);
  assert.equal(appendPracticeReport(result.text,JSON.stringify(report),'langgraph-durable-workflow').duplicate,true);
  const p=newProgress(unit);p.reflection=result.text;p.answers=[{id:'e2',text:'业务唯一约束与同一操作身份共同去重。'}];
  assert.match(studyQuestion(unit,p,'e2'),/保存调用两次/);
  const state={...defaultState(),studyProgress:[p]},snapshot=saveStudySnapshot(state,unit,p,{id:'langgraph'}).state;
  assert.match(validateState(snapshot).notes[0].body,/本地 SQLite/);assert.ok(vaultFiles(snapshot).some(f=>f.text.includes('保存调用两次')));
});

test('LangGraph import rejects malformed and wrong experiments but retains a genuine failed observation',()=>{
  for(const mutate of [r=>r.model_called=true,r=>r.versions.langgraph='<script>',r=>r.after_crash.next=['invalid'],r=>r.recovered.write_attempts=-1,r=>r.recovered.business_rows=3,r=>r.thread_isolated='true',r=>r.reducer_keys=['a','a'],r=>r.my_explanation={},r=>delete r.paused]){
    const changed=structuredClone(report);mutate(changed);assert.throws(()=>langgraphReportNote(JSON.stringify(changed)));
  }
  assert.throws(()=>appendPracticeReport('',JSON.stringify(report),'durable-agent'));
  const failed=structuredClone(report);failed.thread_isolated=false;failed.recovered.business_rows=2;
  assert.match(langgraphReportNote(JSON.stringify(failed)),/线程隔离：未通过/);assert.match(langgraphReportNote(JSON.stringify(failed)),/\| 新进程恢复 \| 无待执行节点 \| 2 \| 2 \|/);
  assert.throws(()=>appendPracticeReport('x'.repeat(5900),JSON.stringify(report),'langgraph-durable-workflow'),/6000/);
});

test('A per-topic progress export restores answers, review history and unfinished recall without copying unrelated private work',()=>{
  const at=new Date('2026-10-12T08:00:00Z');let p=newProgress(unit);p.answers=[{id:'e2',text:'初次答案'}];p.reflection='初次观测';p=recordReview(p,'hard',15,at);p=beginRecall(p,at);p.recall.answers=[{id:'e2',text:'新的独立回忆'}];p.recall.reflection='本次补充';
  const unrelated={...p,id:'other',title:'另一专题'},state={...defaultState(),studyProgress:[p,unrelated],saved:['langgraph'],notes:[{id:'private',title:'个人记录',body:'原文',kind:'学习笔记',tags:'',createdAt:at.toISOString(),updatedAt:at.toISOString()}]};
  const backup=progressBackup(state,unit.id);assert.equal(backup.studyProgress.length,1);assert.equal(backup.notes.length,0);assert.equal(backup.saved.length,0);
  const removed={...state,studyProgress:[unrelated]},restored=mergeBackupStates(removed,JSON.parse(JSON.stringify(backup))).state;
  assert.deepEqual(restored.studyProgress.find(r=>r.id===p.id),validateState(state).studyProgress.find(r=>r.id===p.id));assert.deepEqual(restored.notes,state.notes);assert.deepEqual(restored.saved,state.saved);
  assert.deepEqual(mergeBackupStates(restored,backup).state,restored);assert.throws(()=>progressBackup(state,'missing'));
});

test('LangGraph reading and exercises expose the same runnable recovery experiment',async()=>{
  const reading=JSON.parse(await readFile('content/topic-readings.json','utf8')).readings.find(r=>r.id===unit.id),panel=notebookPanel(unit);
  assert.equal((lessonChapters(reading).match(/class="reading-chapter"/g)||[]).length,8);assert.match(panel,/langgraph-durable-workflow.ipynb/);assert.match(panel,/data-experiment="langgraph-durable-workflow"/);assert.match(panel,/langgraph_report.json/);assert.equal(unit.exercises.length,3);
  assert.match(reading.content,/进程 A/);assert.match(reading.content,/InvalidUpdateError/);assert.ok(reading.sources.some(s=>s.url.endsWith('/use-time-travel')));
});
test('Leaving an arrangement keeps the original progress if export or persistence fails',async()=>{
  const original={...defaultState(),studyProgress:[newProgress(unit)]};let current=original,exported;
  const context={unit:()=>unit,getState:()=>current,setState:s=>{current=s;},platform:{download:(_name,s)=>{exported=s;}},persist:()=>false,render:()=>{},notify:()=>{}};
  await StudyWorkspace.prototype.action.call(context,{dataset:{study:'export-remove',id:unit.id}});
  assert.equal(current,original);assert.deepEqual(exported.studyProgress,validateState(original).studyProgress);
  context.platform.download=()=>{throw Error('export failed');};
  await assert.rejects(StudyWorkspace.prototype.action.call(context,{dataset:{study:'export-remove',id:unit.id}}),/export failed/);assert.equal(current,original);
});
test('Recall labels use the learner local day across the UTC midnight boundary',()=>{
  const previous=process.env.TZ,initial=newProgress(unit);initial.answers=[{id:'e1',text:'检查点保存线程内执行状态'}];const p=recordReview(initial,'hard',15,new Date('2026-10-12T16:30:00Z'));
  try{process.env.TZ='Asia/Shanghai';assert.match(StudyWorkspace.prototype.recallReader.call({fontSize:18},unit,p),/上次学习 2026-10-13/);
    process.env.TZ='America/Los_Angeles';assert.match(StudyWorkspace.prototype.recallReader.call({fontSize:18},unit,p),/上次学习 2026-10-12/);
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
