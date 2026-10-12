import {validReadingSection} from './study-model.js';
import {noteUnitId,readAnnotation} from './learning-signals.js';
const kinds=['实验记录','源码研究','论文精读','学习复盘','学习笔记','待解答问题','已解决问题','重点标注','作者观点','面试复盘','项目记录','资料收件箱'];

// Fold only the exact generated handoff block. Keep the stored note intact,
// including user additions before or after it, for editing and every backup.
export function questionNoteParts(note){
  const body=note.body;
  if(!['待解答问题','已解决问题'].includes(note.kind))return {body,context:'',question:body};
  const match=body.match(/\n\n---\n学习单元：[^\n]+\n关键要点：\n[\s\S]*?\n\n请区分来源支持的事实与推断；先解释机制和边界，再给出一个最小验证方法。(?=\n\n|$)/);
  if(!match)return {body,context:'',question:body.replace(/^## 待解答的问题\n+/, '')};
  const question=body.slice(0,match.index).replace(/^## 待解答的问题\n+/, '').trim();
  return {body:body.slice(0,match.index)+body.slice(match.index+match[0].length),context:match[0].replace(/^\n\n---\n/,''),question};
}
export function journalTitle(note){
  if(note.kind==='学习复盘'&&/ · 学习复盘$/.test(note.title)&&note.body.includes('[回到学习单元](/study/'))return note.title.replace(/ · 学习复盘$/,'')+' · '+(/(?:^## 上次作答|\[对照上次作答\])/m.test(note.body)?'独立回忆':'学习自检');
  const annotation=readAnnotation(note),suffix=annotation&&' · '+annotation.quote.slice(0,60);
  if(suffix&&note.title.endsWith(suffix))return note.title.slice(0,-suffix.length)||note.title;
  return /^## 待解答的问题\n/.test(note.body)&&/ · 待解答问题$/.test(note.title)&&['待解答问题','已解决问题'].includes(note.kind)
    ? note.title.replace(/ · 待解答问题$/,'')||note.title : note.title;
}
export function journalNoteParts(note){
  if(!readAnnotation(note)){
    const parts=questionNoteParts(note);
    if(note.kind==='学习复盘'&&/ · 学习复盘$/.test(note.title)){
      const marker='\n\n## 上次作答（供事后比较）\n\n',start=note.body.indexOf(marker),end=note.body.lastIndexOf('\n\n[回到学习单元](/study/?id=');
      if(start>=0&&end>start&&note.body.indexOf(marker,start+marker.length)===-1&&/^\n\n\[回到学习单元\]\(\/study\/\?id=[a-zA-Z0-9_-]+(?:#[a-zA-Z0-9_-]+)?\)\n\n原始来源：\[[^\n]+\]\(https?:\/\/[^\n]+\)/.test(note.body.slice(end))){
        return {...parts,body:note.body.slice(0,start)+note.body.slice(end),comparison:note.body.slice(start+marker.length,end)};
      }
    }
    return parts;
  }
  const footer=note.body.match(/\n\n\[回到标注位置\]\(\/study\/\?id=[a-zA-Z0-9_-]+#[a-zA-Z0-9_-]+\)\n\n原始来源：[^\n]+\n阅读范围：[^\n]+(?=\n\n|$)/);
  return footer?{body:note.body.slice(0,footer.index)+note.body.slice(footer.index+footer[0].length),context:footer[0].trim(),question:''}:{body:note.body,context:'',question:''};
}
export function journalPreview(note){
  if(['待解答问题','已解决问题'].includes(note.kind)&&/^## 待解答的问题\n/.test(note.body))return notePreview(questionNoteParts(note).question);
  const annotation=readAnnotation(note);
  if(annotation){const thought=note.body.match(/## 我的(?:思考|疑问)\n\n([\s\S]*?)(?=\n\n\[回到标注位置\]|$)/)?.[1]?.trim();return notePreview(thought||annotation.quote);}
  if(['学习笔记','学习复盘'].includes(note.kind)&&note.title.endsWith(' · '+note.kind)&&note.body.includes('[回到学习单元](/study/')){
    const reflection=note.body.match(/(?:^|\n)## 我的理解与疑问\n\n([\s\S]*?)(?=\n\n(?:自评：|## 上次作答（供事后比较）|\[回到学习单元\])|$)/)?.[1]?.trim();
    const answer=note.body.match(/^## 我的作答\n\n### [^\n]+\n\n([\s\S]*?)(?=\n\n(?:### |## |\[回到学习单元\])|$)/)?.[1]?.trim();
    if(reflection||answer)return notePreview(reflection||answer);
  }
  return notePreview(note.kind==='资料收件箱'?(note.body.match(/## 已读取的信息\n+([\s\S]*?)(?=\n##|$)/)?.[1]||note.body):journalReadingBody(note));
}
export function journalReadingBody(note){
  const parts=journalNoteParts(note);
  let body=parts.body;
  if(['待解答问题','已解决问题'].includes(note.kind))body=body.replace(/^## 待解答的问题\n/,'## 问题\n');
  if(body.startsWith('# '+note.title+'\n'))body=body.slice(note.title.length+3).trimStart();
  if(note.kind==='资料收件箱')body=body.replace(/^## [^\n]+\n+(?=## |$)/gm,'');
  return body;
}
export function noteLearningLink(note){
  const match=note.body.match(/\]\((\/study\/\?id=([a-zA-Z0-9_-]{1,100})(?:&mode=recall)?(?:#([a-zA-Z0-9_-]+))?)\)/);
  if(!match)return null;
  return {id:match[2],url:match[1],section:validReadingSection(match[3])?match[3]:'study-reflection'};
}
export function noteDiscussion(note,unit){
  const q=questionNoteParts(note),ref=noteLearningLink(note),question=['待解答问题','已解决问题'].includes(note.kind)
    ? q.question : '这是我保存的'+note.kind+'：\n\n'+q.body+'\n\n请帮助我检查理解的假设与边界，先提出一个需要澄清的问题。';
  return {title:unit?.title||note.title,studyUnit:unit,journalNoteId:note.id,section:ref?.section||'study-reflection',question:question.slice(0,6000)};
}
export function journalScope(params){
  for(const field of ['id','source','unit','lesson','week','project','guide']){
    const value=params.get(field);if(value&&/^[a-zA-Z0-9_-]{1,100}$/.test(value))return field+':'+value;
  }
  return 'new';
}
export function validateJournalDraft(raw){
  if(!raw||!raw.note||!Number.isFinite(Date.parse(raw.at)))throw new Error('草稿格式无效');
  const n=raw.note;
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(n.id)||!kinds.includes(n.kind)||!Number.isFinite(Date.parse(n.createdAt)))throw new Error('草稿记录无效');
  for(const [field,max] of [['title',200],['body',80000],['tags',300]])if(typeof n[field]!=='string'||n[field].length>max)throw new Error('草稿长度无效');
  if(typeof raw.baseUpdatedAt!=='string')throw new Error('草稿版本无效');
  return {at:new Date(raw.at).toISOString(),baseUpdatedAt:raw.baseUpdatedAt,note:{id:n.id,title:n.title,body:n.body,tags:n.tags,kind:n.kind,createdAt:n.createdAt,updatedAt:raw.at}};
}
export function notePreview(body,max=150){
  return body.replace(/^# [^\n]+\n+/, '').replace(/```[^\n]*\n([\s\S]*?)```/g,'$1').replace(/!?\[([^\]\n]+)\]\([^\n)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/[*`>|]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
}
export function filterJournal(notes,{inbox=false,kind='',query='',unit=''}={}){
  const needle=query.trim().toLocaleLowerCase();
  return notes.filter(n=>(!inbox||n.kind==='资料收件箱')&&(!kind||n.kind===kind)&&(!unit||noteUnitId(n)===unit)&&(!needle||[n.title,n.body,n.tags].join(' ').toLocaleLowerCase().includes(needle))).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
