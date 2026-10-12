import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newProgress,validateProgress,recordReview} from '../assets/study-model.js';
import {saveStudySnapshot,studyQuestion,questionWithContext,studyReturnURL} from '../assets/study-session.js';
import {defaultState,validateState,mergeBackupStates} from '../assets/state.js';
import {toDocuments,fromDocuments} from '../assets/sync.js';
import {vaultFiles} from '../assets/backup.js';
import {renderMarkdown} from '../assets/markdown.js';

const unit=JSON.parse(await readFile('content/study-units.json','utf8')).units[0];
const now=new Date('2026-10-11T08:00:00Z');
test('A note can be saved before self assessment; identical saves deduplicate and later edits never overwrite journal work',()=>{
  const state=defaultState(),p=newProgress(unit);p.reflection='检查点记录了恢复位置，但远端提交需要独立查询。';
  const a=saveStudySnapshot(state,unit,p,{now,id:'first'});assert.equal(a.note.kind,'学习笔记');assert.match(a.note.body,/检查点/);assert.equal(state.notes.length,0);assert.equal(p.history.length,0);
  assert.equal(saveStudySnapshot(a.state,unit,p,{now,id:'repeat'}).duplicate,true);
  const edited={...a.state,notes:a.state.notes.map(n=>({...n,body:n.body+'\n\n我在日志中补充的思考'}))};
  const b=saveStudySnapshot(edited,unit,p,{now,id:'second'});assert.equal(b.state.notes.length,2);assert.match(b.state.notes[0].body,/日志中补充/);
  p.answers=[{id:'e1',text:'用稳定操作 ID 查询远端，再决定是否重试。'}];
  const review=recordReview(p,'hard',15,now),c=saveStudySnapshot(b.state,unit,review,{now,review:'hard',id:'review'});assert.equal(c.note.kind,'学习复盘');assert.match(c.note.body,/2026-10-13/);assert.ok(c.note.body.includes(unit.exercises[0].prompt));assert.equal(c.state.notes[0].body,edited.notes[0].body);
  assert.throws(()=>saveStudySnapshot(state,unit,newProgress(unit)),/先写下/);
  const full={...state,notes:Array.from({length:1000},()=>({...a.note}))};assert.throws(()=>saveStudySnapshot(full,unit,review,{review:'hard'}),/日志已满/);assert.equal(full.notes.length,1000);assert.equal(p.history.length,0);
});
test('Exercise questions include the actual prompt and answer, remain within API bounds, and do not reveal the reference solution',()=>{
  const p=newProgress(unit);p.answers=[{id:'e1',text:'我的推理 '+ '长'.repeat(6000)}];
  const q=studyQuestion(unit,p,'e1');assert.ok(q.includes(unit.exercises[0].prompt));assert.match(q,/我的推理/);assert.ok(q.length<=6000);assert.ok(!q.includes(unit.exercises[0].answer));
  const handoff=questionWithContext(q,unit);assert.ok(handoff.includes(unit.source.url));assert.ok(handoff.includes(unit.takeaways[0].point));assert.match(studyQuestion(unit,p,'','暂停与恢复'),/暂停与恢复/);assert.throws(()=>questionWithContext(' ',unit),/先写下/);
  const result=saveStudySnapshot(defaultState(),unit,p,{question:handoff,section:'exercise-e1',now,id:'question'});assert.equal(result.note.kind,'待解答问题');assert.ok(result.note.body.includes(studyReturnURL(unit,'exercise-e1')));
});
test('Reading bookmarks and course context survive old/new backups, cloud documents and Obsidian exports',()=>{
  const p={...newProgress(unit),updatedAt:now.toISOString(),readingSection:'chapter-2',answers:[{id:'e1',text:'可恢复的实际作答'}]};
  const state={...defaultState(),studyProgress:[p],conversations:[{id:'chat-1',studyUnitId:unit.id,title:'练习讨论',updatedAt:now.toISOString(),messages:[{role:'user',content:'这次超时能否重放？',status:'complete'}]}]};
  const valid=validateState(state);assert.equal(valid.studyProgress[0].readingSection,'chapter-2');assert.equal(valid.conversations[0].studyUnitId,unit.id);
  assert.deepEqual(fromDocuments([...toDocuments(valid).values()]),valid);assert.deepEqual(mergeBackupStates(defaultState(),valid).state,valid);
  const json=vaultFiles(valid,{studyUnits:[unit]}).find(f=>f.name.endsWith('.json'));assert.ok(json.text.includes('chapter-2'));assert.ok(json.text.includes(unit.id));
  assert.ok(vaultFiles(valid,{studyUnits:[unit]}).find(f=>f.name.startsWith('练习与复习/')).text.includes('https://suguilin.github.io/study/?id='+unit.id+'#chapter-2'));
  const legacy=structuredClone(state);delete legacy.studyProgress[0].readingSection;delete legacy.conversations[0].studyUnitId;assert.doesNotThrow(()=>validateState(legacy));
  const moved=structuredClone(valid);moved.studyProgress[0].readingSection='study-practice';moved.studyProgress[0].updatedAt='2026-10-12T08:00:00Z';const merged=mergeBackupStates(moved,valid);assert.equal(merged.conflicts,0);assert.equal(merged.state.notes.length,0);assert.equal(merged.state.studyProgress[0].readingSection,'study-practice');
  for(const section of ['javascript:alert(1)','../../secret','chapter-100','exercise-e6','study-unknown'])assert.throws(()=>validateProgress({...p,readingSection:section}),/阅读位置/);
  assert.throws(()=>validateState({...state,conversations:[{...state.conversations[0],studyUnitId:'bad/url'}]}),/会话学习单元/);
});
test('Return links stay in the current workspace while foreign and unsafe note links cannot become internal navigation',()=>{
  const html=renderMarkdown('[回到学习单元](/study/?id=lesson-harness#exercise-e1)\n\n[来源](https://example.org/study/)\n\n[伪装](//example.org/study/)\n\n[无效](javascript:alert)');
  assert.match(html,/href="\/study\/\?id=lesson-harness#exercise-e1" data-nav/);assert.equal((html.match(/data-nav/g)||[]).length,1);assert.match(html,/href="https:\/\/example.org\/study\/" target="_blank"/);assert.ok(!html.includes('href="javascript:'));
});
