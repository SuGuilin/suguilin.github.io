import {mechanismChecks,mechanismCheckExtensions,notebookReports} from './practice-reports.js';
import {learningNotebooks} from './practice-catalog.js';
import {currentAttempt} from './study-model.js';
import {noteUnitId} from './learning-signals.js';
import {journalReadingBody} from './journal-model.js';

// Read only complete, generated checklists for this topic's actual notebooks.
// A report is an observation supplied by the learner, never a skill assessment.
export function practiceResults(text,experiments){
  const found=new Map(),headers=[...String(text).matchAll(/^## 代码实践 · ([a-zA-Z0-9_-]+)\s*$/gm)];
  for(let i=0;i<headers.length;i++){
    const id=headers[i][1];if(!experiments.includes(id)||!Object.hasOwn(mechanismChecks,id))continue;
    const base=mechanismChecks[id],extension=mechanismCheckExtensions[id]??{},labels={...base,...extension};
    const body=text.slice(headers[i].index+headers[i][0].length,headers[i+1]?.index??text.length).split('\n\n我的解释：')[0];
    const lines=[...body.matchAll(/^- (.+)：(通过|未通过)$/gm)],checks=new Map();
    for(const line of lines){const key=Object.keys(labels).find(k=>labels[k]===line[1]);if(key)checks.set(key,line[2]==='通过');}
    const complete=Object.keys(base).every(k=>checks.has(k)),extras=Object.keys(extension).filter(k=>checks.has(k));
    if(!complete||lines.length!==checks.size||(extras.length&&extras.length!==Object.keys(extension).length))continue;
    found.set(id,{experiment:id,total:checks.size,failed:[...checks].filter(([,passed])=>!passed).map(([key])=>({id:key,label:labels[key]}))});
  }
  return [...found.values()];
}
export function practiceReadingSegments(text){
  const marker='\n\n导入只核验格式，不认证来源或真实系统效果。',headers=[];
  let offset=0,fence='';
  for(const line of text.split('\n')){
    const token=/^\s*(```|~~~)/.exec(line)?.[1];
    if(token){if(!fence)fence=token;else if(fence===token)fence='';}
    else if(!fence){const match=/^## 代码实践 · ([a-zA-Z0-9_-]+)\s*$/.exec(line);if(match&&Object.hasOwn(mechanismChecks,match[1]))headers.push({offset,id:match[1]});}
    offset+=line.length+1;
  }
  const parts=[];let cursor=0;
  for(let i=0;i<headers.length;i++){
    const h=headers[i],end=text.indexOf(marker,h.offset);if(end<0||end>=(headers[i+1]?.offset??text.length))continue;
    const body=text.slice(h.offset,end+marker.length),result=practiceResults(body,[h.id])[0];if(!result)continue;
    if(h.offset>cursor)parts.push({text:text.slice(cursor,h.offset)});
    parts.push({text:body,result});cursor=end+marker.length;
  }
  if(cursor<text.length)parts.push({text:text.slice(cursor)});
  return parts;
}
export function practiceFollowup(state,unit){
  const experiments=(learningNotebooks[unit.id]??[]).map(([file])=>notebookReports[file]?.experiment).filter(Boolean);
  if(!experiments.length)return [];
  const progress=state.studyProgress.find(p=>p.id===unit.id),attempt=progress&&currentAttempt(progress),results=new Map();
  for(const result of practiceResults(attempt?.reflection??'',experiments))results.set(result.experiment,{...result,origin:'draft',noteId:''});
  const notes=state.notes.filter(n=>noteUnitId(n)===unit.id&&['实验记录','学习笔记','学习复盘'].includes(n.kind)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
  for(const note of notes){
    const remaining=experiments.filter(id=>!results.has(id));if(!remaining.length)break;
    if(!remaining.some(id=>note.body.includes('## 代码实践 · '+id)))continue;
    for(const result of practiceResults(journalReadingBody(note),remaining))results.set(result.experiment,{...result,origin:'record',noteId:note.id});
  }
  return [...results.values()].filter(r=>r.failed.length);
}
export function practiceQuestion(unit,followup,progress=null){
  const attempt=progress&&currentAttempt(progress),answers=unit.exercises.flatMap(e=>{const text=attempt?.answers.find(a=>a.id===e.id)?.text.trim();return text?[e.prompt.slice(0,180)+'\n'+text.slice(0,500)]:[];}).join('\n\n').slice(0,1400);
  return `我在学习「${unit.title}」时，实验 ${followup.experiment} 的以下检查未通过：\n${followup.failed.map(f=>'- '+f.label).join('\n')}${answers?'\n\n当前尝试的作答：\n'+answers:''}\n\n请先帮助我定位失败属于实现、输入条件还是检查标准；不要仅根据报告判断我的能力。请用一个反例解释机制，给出最小修改和重跑时要观察的结果。\n\n我的预测、改动与实际输出是：`;
}
