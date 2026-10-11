import {escapeHTML as esc} from './state.js';
import {renderMarkdown} from './markdown.js';
import {journalScope,validateJournalDraft,notePreview,filterJournal} from './journal-model.js';
import {noteUnitId} from './learning-signals.js';

const types=['学习笔记','学习复盘','待解答问题','已解决问题','重点标注','作者观点','实验记录','源码研究','论文精读','面试复盘','项目记录','资料收件箱'];
export class JournalWorkspace{
  constructor(options){Object.assign(this,options);}
  draftKey(params){return 'suguilin.journalDraft.'+this.getAccount()+'.'+journalScope(params);}
  readDraft(key){try{const raw=localStorage.getItem(key);return raw?validateJournalDraft(JSON.parse(raw)):null;}catch{return null;}}
  saveDraft(form){
    try{
      const f=new FormData(form),at=new Date().toISOString();
      const draft=validateJournalDraft({at,baseUpdatedAt:form.dataset.baseUpdatedAt||'',note:{id:form.dataset.noteId,title:String(f.get('title')),body:String(f.get('body')),tags:String(f.get('tags')),kind:String(f.get('kind')),createdAt:form.dataset.created}});
      if(this.conflictingDraft){localStorage.setItem(form.dataset.draftKey+'.previous',JSON.stringify(this.conflictingDraft));this.recoveryDraft=this.conflictingDraft;this.conflictingDraft=null;}
      localStorage.setItem(form.dataset.draftKey,JSON.stringify(draft));
      form.querySelector('#editor-status').textContent='草稿已保留在本机 · 保存后进入日志与完整备份。';return true;
    }catch{form.querySelector('#editor-status').textContent='草稿未能保留，请先保存记录或复制正文。';return false;}
  }
  clearDraft(form){try{localStorage.removeItem(form.dataset.draftKey);}catch{}}
  url(params,id='',edit=false){
    const q=new URLSearchParams();for(const field of ['kind','q','type'])if(params.get(field))q.set(field,params.get(field));
    if(id)q.set('id',id);if(edit)q.set('edit','1');return '/journal/'+(q.size?'?'+q:'');
  }
  content(params){
    const notes=filterJournal(this.getNotes(),{inbox:params.get('kind')==='inbox',kind:params.get('type')||'',query:params.get('q')||''});
    const selected=notes.find(n=>n.id===params.get('id'))||notes[0],create=params.get('new')==='1',editing=params.get('edit')==='1';
    let note=create?this.newNote(params):selected;
    this.activeKey=this.draftKey(params);this.baseUpdatedAt=create?'':note?.updatedAt||'';this.restored=false;this.conflictingDraft=null;this.recoveryDraft=this.readDraft(this.activeKey+'.previous');
    if((create||editing)&&note){const draft=this.readDraft(this.activeKey);if(draft){if(draft.baseUpdatedAt===this.baseUpdatedAt){note=draft.note;this.restored=true;}else this.conflictingDraft=draft;}}
    const previews=notes.map(n=>this.link(this.url(params,n.id),`${this.tag(n.kind)}<strong>${esc(n.title)}</strong><p>${esc(notePreview(n.kind==='资料收件箱'?(n.body.match(/## 已读取的信息\n+([\s\S]*?)(?=\n##|$)/)?.[1]||n.body):n.body))}</p><small>${this.date(n.updatedAt)}${n.tags?' · '+esc(n.tags):''}</small>`,'note-preview '+(selected?.id===n.id&&!create?'active':''))).join('');
    const index=`<aside class="journal-index ${params.get('q')&&!params.has('id')?'is-open':''}" aria-label="学习记录列表"><div class="journal-index-heading"><span>${notes.length} / ${this.getNotes().length} 篇记录</span><button class="text-link" data-action="journal-index-toggle" aria-expanded="${!!params.get('q')&&!params.has('id')}" aria-controls="journal-index-list">切换记录 ${this.icon('chevron')}</button></div><div id="journal-index-list" class="journal-list">${previews||'<p class="journal-empty small-note">'+(this.getNotes().length?'没有匹配记录。换一个关键词或类型。':'开始记录自己的理解、问题或代码。')+'</p>'}</div></aside>`;
    const sourceUnit=note?.kind==='资料收件箱'?this.getUnits().find(u=>u.id===noteUnitId(note)||u.id.replace(/^study-/, 'discovery-')===note.id):null;
    const studyLink=sourceUnit?`<section class="journal-source-unit"><h3>已整理的学习内容</h3><p>${esc(sourceUnit.source.scope)}</p><ul>${sourceUnit.takeaways.slice(0,2).map(t=>'<li>'+esc(t.point)+'</li>').join('')}</ul><div class="actions">${this.link('/study/?id='+sourceUnit.id,'阅读与 '+sourceUnit.exercises.length+' 道练习 →','text-link')}${this.link('/plan/','查看排期 ↗','text-link')}</div></section>`:note?.kind==='资料收件箱'?`<section class="journal-source-unit"><h3>从资料开始学习</h3><p>已有来源与阅读问题。继续整理为要点和练习，后续作答与复习会回到同一个学习单元。</p><button class="button button-small" data-study="import" data-source-note="${esc(note.id)}">继续整理这份资料 →</button></section>`:'';
    const reader=note?`<article class="editor note-reader" tabindex="-1" aria-label="当前学习记录"><div class="editor-title">${this.tag(note.kind)}<div class="actions"><button class="icon-button" data-action="export-note" data-id="${note.id}" aria-label="导出这篇笔记">${this.icon('download')}</button>${this.link(this.url(params,note.id,true),this.icon('pen')+'<span class="sr-only">编辑这篇笔记</span>','icon-button')}<button class="icon-button" data-action="delete-note" data-id="${note.id}" aria-label="删除这篇笔记">${this.icon('trash')}</button></div></div><h2>${esc(note.title)}</h2><p class="note-meta">${this.date(note.updatedAt)} · ${esc(note.tags||'未添加标签')}</p>${note.kind==='待解答问题'||note.kind==='已解决问题'?`<div class="question-record-actions"><button class="button button-small" data-action="resolve-question" data-id="${note.id}">${note.kind==='待解答问题'?'我已理解，标记解决':'仍有疑问，重新打开'}</button><small>可以先编辑笔记，补上理解与验证结果。</small></div>`:''}${studyLink}<div class="note-body markdown-body">${renderMarkdown(note.body.startsWith('# '+note.title+'\n')?note.body.slice(note.title.length+3).trimStart():note.body)}</div></article>`:`<div class="journal-empty-reader"><h2>${this.getNotes().length?'没有匹配的学习记录':'记下今天理解的一点知识'}</h2><p>${this.getNotes().length?'清除筛选可以回到完整列表。':'概念解释、代码、问题都可以写；实验模板按需要插入。'}</p>${this.getNotes().length?'<button class="button" data-action="journal-clear">清除筛选</button>':this.link('/journal/?new=1','开始写笔记 →','button button-dark')}</div>`;
    return `<div class="journal-layout">${index}<div>${(create||editing)&&note?this.editorMarkup(note,create):reader}</div></div>`;
  }
  render(params){
    const create=params.get('new')==='1',editing=params.get('edit')==='1',inbox=params.get('kind')==='inbox';
    const header=this.pageTitle('SUGUILIN / 学习日志','学习记录','留下自己的理解、作答和问题，随时回到来源继续学习。',this.link('/journal/?new=1',this.icon('plus')+' 新建记录','button button-small button-dark'));
    const tabs=`<nav class="journal-view-tabs" aria-label="学习日志栏目">${this.link('/journal/','全部记录','text-link '+(!inbox?'active':''))}${this.link('/journal/?kind=inbox','资料收件箱','text-link '+(inbox?'active':''))}</nav>`;
    const controls=create||editing?'':`<div class="journal-filters"><label class="search-field">${this.icon('search')}<input type="search" id="journal-search" aria-label="搜索学习记录" placeholder="搜索标题、自己的解释或标签" value="${esc(params.get('q')||'')}" maxlength="200"></label><label class="sr-only" for="journal-type">记录类型筛选</label><select id="journal-type"><option value="">全部类型</option>${types.filter(t=>!inbox||t==='资料收件箱').map(t=>`<option ${params.get('type')===t?'selected':''}>${t}</option>`).join('')}</select></div>`;
    return header+tabs+controls+`<div data-journal-content>${this.content(params)}</div><div class="backup-panel"><div><strong>本机保存，随时备份</strong><p>已保存记录、作答、收藏和进度可导出 JSON 或 Obsidian。${esc(this.storageLabel())}。</p></div><div class="actions"><button class="button button-small" data-action="export-json">导出 JSON</button><button class="button button-small" data-platform="obsidian">Obsidian 备份</button><button class="button button-small" data-action="import">导入备份</button></div></div>`;
  }
  apply(){
    const form=document.getElementById('note-form');if(!form)return;
    form.dataset.draftKey=this.activeKey;form.dataset.baseUpdatedAt=this.baseUpdatedAt;
    const status=document.getElementById('editor-status');
    if(this.restored)status.textContent='已恢复本机草稿 · 保存后进入日志与完整备份。';
    else status.textContent='输入时保留本机草稿 · 保存后进入日志与完整备份。';
    if(this.conflictingDraft||this.recoveryDraft)status.innerHTML='旧版本草稿仍在本机保留。 <button type="button" class="text-link" data-action="journal-old-draft">复制旧草稿</button>';
  }
  refresh(params){const body=document.querySelector('[data-journal-content]');if(body)body.innerHTML=this.content(params);}
}
