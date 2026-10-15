import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {newProgress,recordReview,beginRecall} from '../assets/study-model.js';
import {mechanismChecks,mechanismCheckExtensions,appendPracticeReport} from '../assets/practice-reports.js';
import {practiceResults,practiceFollowup,practiceQuestion} from '../assets/practice-feedback.js';
import {learningContext,learningAction,learningNeeds,continuingRecommendations,dailyLearningQueue} from '../assets/learning-cycle.js';
import {saveStudySnapshot,progressBackup} from '../assets/study-session.js';
import {StudyWorkspace} from '../assets/study.js';
import {learningNotebooks} from '../assets/practice-catalog.js';
import {lessonChapters} from '../assets/study-visuals.js';
import {renderMarkdown} from '../assets/markdown.js';
import {renderJournalReading} from '../assets/journal-view.js';
import {practiceReadingSegments} from '../assets/practice-feedback.js';
const units=JSON.parse(await readFile('content/study-units.json','utf8')).units,unit=units.find(u=>u.id==='lesson-retrieval-rag');
const now=new Date('2026-10-15T04:00:00Z');
function report(failed=[]){return {experiment:'rag-sqlite-retrieval',scope:'stdlib fixtures; no model/service',checks:Object.fromEntries(Object.keys(mechanismChecks['rag-sqlite-retrieval']).map(k=>[k,!failed.includes(k)])),my_explanation:'先截断再过滤，Alice 的相关证据少了一条。'};}
function fixture(failed=['filter_before_limit']){const p=newProgress(unit,'2026-10-15');p.reflection=appendPracticeReport('',JSON.stringify(report(failed)),'rag-sqlite-retrieval').text;return {...defaultState(),studyProgress:[p]};}
test('Actual practice failure persists through topic backup, journal and recall without becoming a mastery score',()=>{
  const state=fixture(),before=structuredClone(state),result=practiceFollowup(state,unit)[0];
  assert.equal(result.failed[0].id,'filter_before_limit');assert.equal(result.origin,'draft');
  assert.deepEqual(state,before);assert.equal(state.mastered.length,0);
  const saved=saveStudySnapshot(state,unit,state.studyProgress[0],{id:'failure',now}).state;
  const restored=mergeBackupStates(defaultState(),progressBackup(saved,unit.id)).state;
  assert.deepEqual(practiceFollowup(restored,unit),practiceFollowup(saved,unit));
  const p={...state.studyProgress[0],answers:[{id:'e3',text:'先约束候选再截断'}]},recalled=beginRecall(recordReview(p,'hard',10,now),now);
  const recallState={...saved,studyProgress:[recalled]};assert.equal(learningContext(recallState,unit,{now}).practice.answered,0);
  assert.equal(practiceFollowup(recallState,unit)[0].origin,'record');
  assert.match(learningAction(unit,recalled,{state:recallState,now}).url,/mode=recall/);
});
test('Failure leads to explanation, question and recommendation; passing rerun clears reminder but preserves original observations',()=>{
  let state=fixture();
  assert.equal(learningAction(unit,state.studyProgress[0],{state,now}).label,'复核未通过实验');
  assert.ok(learningNeeds(state,units,now).some(n=>n.key===unit.id+':experiment'));
  assert.equal(continuingRecommendations(state,units,[],{now})[0].unit.id,unit.id);
  assert.match(practiceQuestion(unit,practiceFollowup(state,unit)[0]),/过滤先于候选截断/);
  assert.match(practiceQuestion(unit,practiceFollowup(state,unit)[0],{...state.studyProgress[0],answers:[{id:'e3',text:'本次过滤观察'}]}),/本次过滤观察/);
  const view={getState:()=>state};assert.match(StudyWorkspace.prototype.practiceFeedbackMarkup.call(view,unit),/结合失败项提问/);
  const failed=state.studyProgress[0].reflection,passed=appendPracticeReport(failed,JSON.stringify(report()),'rag-sqlite-retrieval');
  state={...state,studyProgress:[{...state.studyProgress[0],reflection:passed.text}]};
  assert.ok(passed.text.includes(failed));assert.equal(practiceFollowup(state,unit).length,0);
  assert.equal(StudyWorkspace.prototype.practiceFeedbackMarkup.call(view,unit),'');
  assert.ok(!learningNeeds(state,units,now).some(n=>n.kind==='experiment'));
  assert.equal(appendPracticeReport(passed.text,JSON.stringify(report()),'rag-sqlite-retrieval').duplicate,true);
  const regressed=appendPracticeReport(passed.text,JSON.stringify(report(['filter_before_limit'])),'rag-sqlite-retrieval');
  assert.equal(regressed.duplicate,false);assert.equal(practiceFollowup({...state,studyProgress:[{...state.studyProgress[0],reflection:regressed.text}]},unit)[0].failed.length,1);
});
test('Reports are scoped to supported notebooks; prose, missing checks, foreign topics and historical comparisons do not create failures',()=>{
  const s=fixture(),text=s.studyProgress[0].reflection;
  assert.equal(practiceResults('随手写下：过滤先于候选截断：未通过',['rag-sqlite-retrieval']).length,0);
  assert.equal(practiceResults(text.replace('- 查询与身份边界：通过',''),['rag-sqlite-retrieval']).length,0);
  const foreign=units.find(u=>u.id==='lesson-model-foundations');assert.equal(practiceFollowup(s,foreign).length,0);
  const snapshot=saveStudySnapshot(s,unit,s.studyProgress[0],{id:'old',now}).note;
  const later={...snapshot,kind:'学习复盘',title:unit.title+' · 学习复盘',id:'new',updatedAt:'2026-10-15T05:00:00.000Z',body:'## 我的理解与疑问\n\n'+appendPracticeReport('',JSON.stringify(report()),'rag-sqlite-retrieval').text+'\n\n## 上次作答（供事后比较）\n\n'+text+'\n\n[回到学习单元](/study/?id='+unit.id+'#study-reflection)\n\n原始来源：[fixture](https://example.com)'};
  assert.equal(practiceFollowup({...defaultState(),notes:[snapshot,later]},unit).length,0);
  for(const [id,base] of Object.entries(mechanismChecks)){
    if(id==='langgraph-control-flow'||id==='mcp-tool-contract')continue;
    for(const checks of [base,{...base,...(mechanismCheckExtensions[id]??{})}]){
      const raw={experiment:id,scope:'stdlib fixtures; no model/service',checks:Object.fromEntries(Object.keys(checks).map((k,i)=>[k,i!==0]))};
      const note=appendPracticeReport('',JSON.stringify(raw),id).text;
      assert.equal(practiceResults(note,[id])[0].failed.length,1);
    }
  }
  assert.ok(learningNotebooks[unit.id].some(n=>n[0]==='rag-sqlite-retrieval.ipynb'));validateState(s);
});
test('Recommendations use explicit knowledge relationships after self-review without declaring prerequisites mastered or changing the plan',()=>{
  const p={...newProgress(unit,'2026-10-15'),answers:[{id:'e3',text:'先过滤候选再取 top-k'}]},state={...defaultState(),studyProgress:[recordReview(p,'good',15,now)]},before=structuredClone(state);
  const next=continuingRecommendations(state,units,[],{now});
  assert.equal(next[0].unit.id,'lesson-context-engineering');
  assert.ok(next.some(r=>r.unit.id==='lesson-context-engineering'&&r.reason.includes('相邻问题')));
  const queue=dailyLearningQueue(state,units,now);assert.equal(queue[0].unit.id,next[0].unit.id);assert.equal(queue[0].minutes,30);assert.match(queue[0].reason,/相邻问题/);
  const hard={...state,studyProgress:[recordReview(p,'hard',15,now)]};
  assert.ok(continuingRecommendations(hard,units,[],{now}).some(r=>r.unit.id==='lesson-evaluation-statistics'&&r.reason.includes('前置机制')));
  assert.deepEqual(state,before);assert.equal(state.mastered.length,0);assert.equal(state.studyProgress.length,1);
});
test('Deep mechanism subheadings render as actual headings without renumbering established reading chapters or accepting HTML',()=>{
  const content='## 机制\n\n正文\n\n#### 失败边界\n\n<script>unsafe</script>\n\n## 实践\n\n正文';
  const markup=lessonChapters({content});
  assert.match(markup,/<h4[^>]*>失败边界<\/h4>/);assert.ok(!markup.includes('####'));
  assert.deepEqual([...markup.matchAll(/id="(chapter-\d+)"/g)].map(m=>m[1]),['chapter-0','chapter-1']);
  assert.ok(!markup.includes('<script>'));assert.match(renderMarkdown('###### 深层标题'),/<h6>深层标题<\/h6>/);
});
test('Journal reading folds generated checklists while keeping the learner explanation, failures, raw text and fenced code intact',()=>{
  const state=fixture(),note=saveStudySnapshot(state,unit,state.studyProgress[0],{id:'readable',now}).note,before=structuredClone(note);
  note.body=note.body.replace('先截断再过滤，Alice 的相关证据少了一条。','我的实验解释应直接可读。');
  const html=renderJournalReading(note);
  assert.match(html,/<details class="journal-practice-result">/);assert.match(html,/9 项 · 1 项未通过/);
  assert.ok(html.indexOf('我的实验解释应直接可读。')>html.indexOf('</details>'));assert.ok(note.body.includes('过滤先于候选截断：未通过'));
  const fenced='```markdown\n'+state.studyProgress[0].reflection+'\n```';assert.ok(practiceReadingSegments(fenced).every(p=>!p.result));
  assert.ok(practiceReadingSegments('普通笔记').every(p=>!p.result));assert.equal(before.id,note.id);
});
