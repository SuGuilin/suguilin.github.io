import {escapeHTML as esc} from './state.js';
import {normalizeQuote,readAnnotation,saveAnnotation,noteUnitId} from './learning-signals.js';
import {journalEntryURL} from './study-session.js';
import {validReadingSection} from './study-model.js';
const excluded='button,textarea,select,input,summary,.code-caption,.annotation-tools,.reading-selection-bar';
export function annotationThought(note){const body=note?.body||'',heading=/^## (?:我的思考|我的疑问)\r?\n/m.exec(body);return heading?body.slice(heading.index+heading[0].length).split(/^\[回到标注位置\]/m)[0].trim():'';}
export class ReadingAnnotations{
  constructor(study){
    this.study=study;this.selection=null;
    document.addEventListener('selectionchange',()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.capture(),120);});
    document.addEventListener('pointerdown',e=>{if(e.target.closest('.reading-selection-bar button'))e.preventDefault();});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-annotation]');if(b){e.preventDefault();try{this.action(b);}catch(error){study.notify(error.message);}}});
  }
  records(unit){return this.study.getState().notes.map(readAnnotation).filter(a=>a?.unitId===unit.id);}
  markup(unit){const records=this.records(unit);return `<section id="study-marks" class="reading-marks"><div class="section-heading"><h2>我的标注与思考</h2><span data-annotation-total ${records.length?'':'hidden'}><span data-annotation-count>${records.length||''}</span> 条</span></div><p class="small-note" data-annotation-empty ${records.length?'hidden':''}>选中正文可标注、记笔记或提问。</p><div data-annotation-list>${this.list(records)}</div></section><div class="reading-selection-bar" role="region" aria-label="选文操作" hidden><span data-selected-quote></span><div><button data-annotation="mark">标注重点</button><button data-annotation="note">记笔记</button><button data-annotation="ask">选文提问</button><button data-annotation="dismiss" aria-label="关闭选文操作">×</button></div></div>`;}
  list(records){return records.length?records.map(a=>`<article class="annotation-row"><span>${esc(a.note.kind)} · <span data-mark-status="${a.note.id}">已保存</span></span><blockquote>${esc(a.quote)}</blockquote>${annotationThought(a.note)?`<p class="annotation-thought">${esc(annotationThought(a.note))}</p>`:''}<div><a href="#${a.section}" data-reading-link>回到正文 ↑</a><a href="${journalEntryURL(a.note.id,noteUnitId(a.note))}&edit=1" data-nav>编辑笔记 ↗</a><button data-annotation="discuss" data-note="${a.note.id}">继续讨论 ↗</button></div></article>`).join(''):'';}
  sectionFor(node){for(let el=node.nodeType===1?node:node.parentElement;el?.closest('.study-reader');el=el.parentElement)if(validReadingSection(el.id)&&el.id!=='study-marks'&&el.id!=='study-reflection')return el;return null;}
  capture(){
    if(document.querySelector('dialog[open]'))return;
    const selected=window.getSelection(),bar=document.querySelector('.reading-selection-bar');if(!bar)return;
    if(selected?.isCollapsed||!selected?.rangeCount){bar.hidden=true;return;}
    const range=selected.getRangeAt(0),start=this.sectionFor(range.startContainer),end=this.sectionFor(range.endContainer),quote=normalizeQuote(selected.toString());
    if(!start||start!==end||range.startContainer.parentElement?.closest(excluded)||range.endContainer.parentElement?.closest(excluded)||quote.length<2||quote.length>3000){bar.hidden=true;return;}
    this.selection={section:start.id,quote};bar.querySelector('[data-selected-quote]').textContent=quote.slice(0,100)+(quote.length>100?'…':'');bar.hidden=false;
  }
  discuss(unit,selection){const thought=annotationThought(selection.note);this.study.platform.openAssistant({title:unit.title,studyUnit:unit,journalNoteId:selection.note?.id,section:selection.section,selectionKey:selection.section+':'+selection.quote.slice(0,100),question:`我正在学习「${unit.title}」。\n\n读到这段：\n「${selection.quote}」\n\n${thought?'我的笔记与疑问：\n'+thought:'我的疑问：'}\n\n请先帮助我澄清这段内容的机制、假设与边界，再给一个追问或最小验证方法。`});}
  action(button){
    const unit=this.study.unit(document.querySelector('.study-reader')?.dataset.unit);if(!unit)return;
    if(button.dataset.annotation==='dismiss'){document.querySelector('.reading-selection-bar').hidden=true;window.getSelection()?.removeAllRanges();return;}
    if(button.dataset.annotation==='point'){const point=unit.takeaways[Number(button.dataset.index)];if(!point)return;this.selection={quote:unit.mode==='extractive'?point.point.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|`/g,''):point.point,section:'study-essentials'};}
    if(button.dataset.annotation==='discuss'){const a=this.records(unit).find(a=>a.note.id===button.dataset.note);if(a)this.discuss(unit,a);return;}
    const selection=this.selection;if(!selection)throw new Error('先选中一段正文，或使用要点旁的标注按钮');
    if(button.dataset.annotation==='ask'){this.discuss(unit,selection);return;}
    const kind=button.dataset.annotation==='note'?'学习笔记':'重点标注',result=saveAnnotation(this.study.getState(),unit,selection,{kind});
    this.study.setState(result.state);const saved=this.study.persist();
    if(!saved){this.study.notify('本机保存失败，请立即导出备份');return;}
    window.getSelection()?.removeAllRanges();document.querySelector('.reading-selection-bar').hidden=true;
    if(kind==='学习笔记'){this.study.navigate(journalEntryURL(result.note.id,unit.id)+'&edit=1');return;}
    this.apply();this.study.notify(result.duplicate?'这段重点已标注':'重点已保存，可在日志与备份中回看');
  }
  apply(){
    this.selection=null;const article=document.querySelector('.study-reader');if(!article)return;
    const unit=this.study.unit(article.dataset.unit),records=this.records(unit),list=article.querySelector('[data-annotation-list]');if(list)list.innerHTML=this.list(records);
    for(const mark of article.querySelectorAll('mark[data-learning-mark]'))mark.replaceWith(...mark.childNodes);
    article.normalize();
    for(const a of records){
      const root=article.querySelector('#'+CSS.escape(a.section));let matched=false;
      if(root){
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest(excluded+',.reading-marks')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}),nodes=[];let text='',node;
        let previousBlock=null;
        while(node=walker.nextNode()){const block=node.parentElement.closest('p,li,h2,h3,h4,pre,blockquote,figcaption');if(text&&block!==previousBlock)text+='\n';nodes.push({node,start:text.length});text+=node.textContent;previousBlock=block;}
        // Map normalized characters back to DOM offsets, including inline code.
        let plain='',offsets=[],space=false;
        for(let i=0;i<text.length;i++){if(/\s/.test(text[i])){if(plain&&!space){plain+=' ';offsets.push(i);}space=true;}else{plain+=text[i];offsets.push(i);space=false;}}
        const pos=plain.indexOf(a.quote);if(pos>=0){matched=true;const first=offsets[pos],last=offsets[pos+a.quote.length-1]+1;
          for(const entry of nodes.reverse()){const from=Math.max(0,first-entry.start),to=Math.min(entry.node.length,last-entry.start);if(to<=from)continue;const range=document.createRange();range.setStart(entry.node,from);range.setEnd(entry.node,to);const mark=document.createElement('mark');mark.dataset.learningMark=a.note.id;mark.title='已保存的'+a.note.kind;range.surroundContents(mark);}
        }
      }
      const status=article.querySelector('[data-mark-status="'+a.note.id+'"]');if(status)status.textContent=matched?'正文已标注':'正文已变化，选文仍保留';
    }
    for(const count of document.querySelectorAll('[data-annotation-count]'))count.textContent=records.length||'';
    const empty=article.querySelector('[data-annotation-empty]'),total=article.querySelector('[data-annotation-total]');if(empty)empty.hidden=!!records.length;if(total)total.hidden=!records.length;
  }
}
