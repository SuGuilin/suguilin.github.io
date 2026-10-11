import test from 'node:test';
import assert from 'node:assert/strict';
import {newProgress,recordReview,rescheduleProgress,scheduledDay} from '../assets/study-model.js';
import {journalScope,validateJournalDraft,notePreview,filterJournal} from '../assets/journal-model.js';

test('Rescheduling changes the next actionable date while keeping learning evidence and history',()=>{
  const p={...newProgress({id:'lesson-test',title:'恢复实验'},'2026-10-11'),answers:[{id:'e1',text:'超时表示结果未知，需要查询原操作。'}],reflection:'保留原操作 ID。'};
  const scheduled=rescheduleProgress(p,'2026-10-12');
  assert.equal(scheduledDay(scheduled),'2026-10-12');assert.equal(scheduled.nextReview,'');
  const reviewed=recordReview(scheduled,'good',15,new Date('2026-10-11T12:00:00+08:00'));
  const moved=rescheduleProgress(reviewed,'2026-10-16');
  assert.equal(scheduledDay(moved),'2026-10-16');assert.equal(moved.scheduledFor,'2026-10-12');
  assert.deepEqual(moved.answers,p.answers);assert.deepEqual(moved.history,reviewed.history);assert.equal(moved.reflection,p.reflection);
  assert.equal(reviewed.nextReview,'2026-10-14');assert.throws(()=>rescheduleProgress(p,'2026-02-30'));
});

test('Journal drafts preserve unfinished text, isolate edit scopes and reject unsafe or oversized data',()=>{
  assert.equal(journalScope(new URLSearchParams('new=1')),'new');
  assert.equal(journalScope(new URLSearchParams('new=1&source=langgraph')),'source:langgraph');
  assert.equal(journalScope(new URLSearchParams('id=study-note&edit=1')),'id:study-note');
  assert.equal(journalScope(new URLSearchParams('source=../../other')),'new');
  const raw={at:'2026-10-11T12:00:00Z',baseUpdatedAt:'',note:{id:'draft-1',title:'',body:'还没写完的解释\n```python\nprint(1)',tags:'恢复',kind:'学习笔记',createdAt:'2026-10-11T11:00:00Z',untrusted:'ignored'}};
  const clean=validateJournalDraft(JSON.parse(JSON.stringify(raw)));
  assert.equal(clean.note.body,raw.note.body);assert.equal(clean.note.title,'');assert.equal(clean.note.untrusted,undefined);
  assert.throws(()=>validateJournalDraft({...raw,note:{...raw.note,body:'a'.repeat(80001)}}));
  assert.throws(()=>validateJournalDraft({...raw,note:{...raw.note,id:'../other'}}));
});

test('Journal search finds personal explanations and tags; previews keep readable link labels',()=>{
  const notes=[{id:'a',title:'恢复',body:'检查点无法确认远端写入',tags:'LangGraph',kind:'学习笔记',updatedAt:'2026-10-11T12:00:00Z'},{id:'b',title:'资料',body:'新的论文线索',tags:'检索',kind:'资料收件箱',updatedAt:'2026-10-11T13:00:00Z'}];
  assert.deepEqual(filterJournal(notes,{query:'langgraph'}).map(n=>n.id),['a']);
  assert.deepEqual(filterJournal(notes,{query:'远端',kind:'学习笔记'}).map(n=>n.id),['a']);
  assert.deepEqual(filterJournal(notes,{inbox:true}).map(n=>n.id),['b']);
  assert.equal(notePreview('## 我的笔记\n来源：[LangGraph](https://example.com/)\n`thread_id` 是恢复身份。'),'我的笔记 来源：LangGraph thread_id 是恢复身份。');
});
