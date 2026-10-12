import {escapeHTML as esc} from './state.js';
import {renderMarkdown} from './markdown.js';
import {journalScope,validateJournalDraft,journalPreview,filterJournal,journalNoteParts,journalTitle,journalReadingBody,noteLearningLink} from './journal-model.js';
import {learningURL} from './learning-cycle.js';
import {dayKey} from './study-model.js';

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
    const q=new URLSearchParams();for(const field of ['kind','q','type','unit'])if(params.get(field))q.set(field,params.get(field));
    if(id)q.set('id',id);if(edit)q.set('edit','1');return '/journal/'+(q.size?'?'+q:'');
  }
  content(params){
    const notes=filterJournal(this.getNotes(),{inbox:params.get('kind')==='inbox',kind:params.get('type')||'',query:params.get('q')||'',unit:params.get('unit')||''});
    const selected=notes.find(n=>n.id===params.get('id'))||(params.has('id')?null:notes[0]),create=params.get('new')==='1',editing=params.get('edit')==='1';
    let note=create?this.newNote(params):selected;
    this.activeKey=this.draftKey(params);this.baseUpdatedAt=create?'':note?.updatedAt||'';this.restored=false;this.conflictingDraft=null;this.recoveryDraft=this.readDraft(this.activeKey+'.previous');
    if((create||editing)&&note){const draft=this.readDraft(this.activeKey);if(draft){if(draft.baseUpdatedAt===this.baseUpdatedAt){note=draft.note;this.restored=true;}else this.conflictingDraft=draft;}}
    const previews=notes.map(n=>this.link(this.url(params,n.id),`${this.tag(n.kind)}<strong>${esc(journalTitle(n))}</strong><p>${esc(journalPreview(n))}</p><small>${this.date(n.updatedAt)}${n.tags?' · '+esc(n.tags):''}</small>`,'note-preview '+(selected?.id===n.id&&!create?'active':''))).join('');
    const index=`<aside class="journal-index ${params.get('q')&&!params.has('id')?'is-open':''}" aria-label="学习记录列表"><div class="journal-index-heading"><span>${notes.length} 篇记录${notes.length!==this.getNotes().length?' / 共 '+this.getNotes().length+' 篇':''}</span><button class="text-link" data-action="journal-index-toggle" aria-expanded="${!!params.get('q')&&!params.has('id')}" aria-controls="journal-index-list">切换记录 ${this.icon('chevron')}</button></div><div id="journal-index-list" class="journal-list">${previews||'<p class="journal-empty small-note">'+(this.getNotes().length?'没有匹配记录。换一个关键词或类型。':'开始记录自己的理解、问题或代码。')+'</p>'}</div></aside>`;
    const ref=note&&noteLearningLink(note),unit=ref&&this.getUnits().find(u=>u.id===ref.id),progress=unit&&this.getProgress().find(p=>p.id===unit.id);
    const question=note&&['待解答问题','已解决问题'].includes(note.kind),parts=note&&journalNoteParts(note);
    const studyLink=note?.kind==='资料收件箱'
      ? unit?`<div class="journal-source-unit">${this.link('/study/?id='+unit.id,'阅读整理后的内容与练习 →','text-link')}${this.link('/plan/#learning-queue','查看安排 ↗','text-link')}</div>`:`<div class="journal-source-unit"><button class="button button-small" data-study="import" data-source-note="${esc(note.id)}">继续整理资料 →</button></div>`
      : unit?`<nav class="note-learning-actions" aria-label="本篇记录的学习操作">${this.link(ref.url,'回到阅读 ↗','text-link')}${this.link(learningURL(unit,progress,{section:'study-practice',review:!!progress?.history.length&&!!progress.nextReview&&progress.nextReview<=dayKey()}),progress?.recall?'继续复习 →':'继续练习 →','text-link')}${!question?'<button class="text-link" data-action="discuss-note" data-id="'+note.id+'">讨论这篇笔记 ↗</button>':''}</nav>`:'';
    const reader=note?`<article class="editor note-reader" tabindex="-1" aria-label="当前学习记录"><div class="editor-title">${this.tag(note.kind)}<div class="actions"><button class="icon-button" data-action="export-note" data-id="${note.id}" aria-label="导出这篇笔记">${this.icon('download')}</button>${this.link(this.url(params,note.id,true),this.icon('pen')+'<span class="sr-only">编辑这篇笔记</span>','icon-button')}<button class="icon-button" data-action="delete-note" data-id="${note.id}" aria-label="删除这篇笔记">${this.icon('trash')}</button></div></div><h2>${esc(journalTitle(note))}</h2><p class="note-meta">${this.date(note.updatedAt)}${note.tags?' · '+esc(note.tags):''}</p>${studyLink}${question?`<div class="question-record-actions"><button class="button button-small button-dark" data-action="discuss-note" data-id="${note.id}">继续提问</button>${this.link(this.url(params,note.id,true),'补充理解','text-link')}<button class="text-link" data-action="resolve-question" data-id="${note.id}">${note.kind==='待解答问题'?'标记已解决':'重新打开疑问'}</button></div>`:!unit&&note.kind!=='资料收件箱'?`<button class="text-link note-discuss" data-action="discuss-note" data-id="${note.id}">讨论这篇笔记 ↗</button>`:''}<div class="note-body markdown-body">${renderMarkdown(journalReadingBody(note))}</div>${parts.comparison?`<details class="note-context note-comparison"><summary>对照上次作答与实验记录</summary><div class="markdown-body">${renderMarkdown(parts.comparison)}</div></details>`:''}${parts.context?`<details class="note-context"><summary>${question?'提问时的学习上下文':'选文来源与阅读范围'}</summary><div class="markdown-body">${renderMarkdown(parts.context)}</div></details>`:''}</article>`:`<div class="journal-empty-reader"><h2>${params.has('id')?'当前列表中没有这篇记录':this.getNotes().length?'没有匹配的学习记录':params.has('unit')?'这篇内容还没有学习记录':'记下今天的一点理解'}</h2>${this.getNotes().length?'<button class="button" data-action="journal-clear">查看全部记录</button>':this.link('/journal/?new=1'+(params.has('unit')?'&unit='+encodeURIComponent(params.get('unit')):''),'开始写笔记 →','button button-dark')}</div>`;
    return `<div class="journal-layout ${this.getNotes().length?'':'journal-layout-empty'}">${this.getNotes().length?index:''}<div>${(create||editing)&&note?this.editorMarkup(note,create):reader}</div></div>`;
  }
  render(params){
    const create=params.get('new')==='1',editing=params.get('edit')==='1',inbox=params.get('kind')==='inbox';
    const unit=this.getUnits().find(u=>u.id===params.get('unit'));
    const header=this.pageTitle('','学习日志','',this.link('/journal/?new=1'+(unit?'&unit='+unit.id:''),this.icon('plus')+' 新建记录','button button-small button-dark')+this.link('/account/','备份','text-link'));
    const tabs=`<nav class="journal-view-tabs" aria-label="学习日志栏目">${this.link('/journal/','全部记录','text-link '+(!inbox&&!unit?'active':''))}${this.link('/journal/?kind=inbox','资料收件箱','text-link '+(inbox?'active':''))}${unit?this.link('/study/?id='+unit.id,esc(unit.title)+' ↗','journal-unit-filter'):''}</nav>`;
    const available=types.filter(t=>t===params.get('type')||filterJournal(this.getNotes(),{inbox,unit:unit?.id||''}).some(n=>n.kind===t));
    const controls=create||editing||!this.getNotes().length?'':`<div class="journal-filters"><label class="search-field">${this.icon('search')}<input type="search" id="journal-search" aria-label="搜索学习记录" placeholder="搜索自己的解释、问题或标签" value="${esc(params.get('q')||'')}" maxlength="200"></label><label class="sr-only" for="journal-type">记录类型筛选</label><select id="journal-type"><option value="">全部类型</option>${available.map(t=>`<option ${params.get('type')===t?'selected':''}>${t}</option>`).join('')}</select></div>`;
    return header+tabs+controls+`<div data-journal-content>${this.content(params)}</div>`;
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
