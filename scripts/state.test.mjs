import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,validateState,mergeStates,escapeHTML,safeURL} from '../assets/state.js';
import {renderMarkdown} from '../assets/markdown.js';

const note = (id, title, updatedAt='2026-10-11T10:00:00Z') => ({id,title,body:'## 实验\n测试结果',kind:'实验记录',tags:'eval',createdAt:'2026-10-10T10:00:00Z',updatedAt});
test('Backup merge preserves existing work and keeps the newest version of an overlapping note',()=>{
  const current={...defaultState(),saved:['mcp'],completed:['w1-t1'],notes:[note('a','现有笔记'),note('b','保留记录')],pace:6};
  const incoming={...defaultState(),saved:['mcp','langgraph'],completed:['w1-t2'],notes:[note('a','更新笔记','2026-10-11T11:00:00Z'),note('c','新增记录')]};
  const result=mergeStates(current,incoming);
  assert.equal(result.notes.length,3);assert.equal(result.notes.find(n=>n.id==='a').title,'更新笔记');assert.equal(result.notes.find(n=>n.id==='b').title,'保留记录');
  assert.deepEqual(result.saved,['mcp','langgraph']);assert.deepEqual(result.completed,['w1-t1','w1-t2']);assert.equal(result.pace,6);
  assert.equal(current.notes[0].title,'现有笔记');
});
test('Malformed backups cannot overwrite local work',()=>{
  for (const bad of [null,{version:2},{...defaultState(),notes:[{id:'bad'}]},{...defaultState(),notes:[note('a','重复'),note('a','重复2')]},{...defaultState(),saved:'bad'},{...defaultState(),notes:[note('<img>','坏ID')]},{...defaultState(),notes:[{...note('a','坏日期'),updatedAt:'not-a-date'}]}]) assert.throws(()=>validateState(bad));
});
test('Import strips unknown fields and cannot pollute object prototypes',()=>{
  const input=JSON.parse('{"version":1,"saved":[],"completed":[],"milestones":[],"mastered":[],"notes":[],"pace":10,"__proto__":{"polluted":true},"privateExtra":"discard"}');
  const result=validateState(input);assert.equal(Object.hasOwn(result,'__proto__'),false);assert.equal(Object.hasOwn(result,'privateExtra'),false);assert.equal({}.polluted,undefined);
});
test('Untrusted notes render as inert text, including HTML and attribute injection',()=>{
  const raw='<img src=x onerror="alert(1)">\n\n## <script>alert(1)</script>\n\n```html\n</code><svg onload=alert(1)>\n```';
  const output=renderMarkdown(raw);assert.equal(output.includes('<img'),false);assert.equal(output.includes('<script>'),false);assert.equal(output.includes('<svg'),false);assert.ok(output.includes('&lt;img'));assert.ok(output.includes('&lt;/code&gt;'));
  assert.equal(safeURL('javascript:alert(1)'),'#');assert.equal(safeURL('data:text/html,test'),'#');assert.equal(safeURL('https://example.com'),'https://example.com');assert.equal(safeURL('/lab/'),'/lab/');
  assert.equal(escapeHTML('"<>&\''),'&quot;&lt;&gt;&amp;&#39;');
});
test('Readable notes preserve code and distinguish headings and lists',()=>{
  const output=renderMarkdown('## 结论\n\n- 结果一\n- 结果二\n\n```python\nif x < 2:\n    print(x)\n```');
  assert.ok(output.includes('<h3>结论</h3>'));assert.ok(output.includes('<ul><li>结果一</li><li>结果二</li></ul>'));assert.ok(output.includes('if x &lt; 2:'));
});
