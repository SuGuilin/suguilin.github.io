import {validDay,dayKey} from './study-model.js';
export function sourceDetails(fields){
  const get=(key,max)=>String(fields.get(key)||'').trim().slice(0,max);
  const origin=get('origin',60)||'公开资料',author=get('author',100),publishedAt=get('publishedAt',10),question=get('readingQuestion',2000),perspective=get('perspective',30)||'待核实线索';
  if(publishedAt&&(!validDay(publishedAt)||publishedAt>dayKey()))throw new Error('请选择有效的原文发布日期；不知道可以留空');
  if(!['官方资料','作者观点','论文','项目源码','课程','待核实线索'].includes(perspective))throw new Error('资料性质无效');
  return {origin,author,publishedAt,question,perspective};
}
export function sourceRecord(state,item,details,{text='',unit=null,now=new Date(),id=crypto.randomUUID()}={}){
  let url;try{url=new URL(item.url);}catch{throw new Error('请填写有效的原文链接');}if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>1500)throw new Error('请填写有效的原文链接');
  if(!item.title.trim())throw new Error('请填写资料标题');
  const old=state.notes.find(n=>n.body.split('\n').includes('原始链接：'+url.href)&&n.kind==='资料收件箱');
  if(old){
    const additions=[];
    if(details.question&&!old.body.includes(details.question))additions.push('阅读问题：'+details.question);
    if(details.author&&!old.body.includes('作者：'+details.author))additions.push('作者：'+details.author);
    if(details.publishedAt&&!old.body.includes('原文发布日期：'+details.publishedAt))additions.push('原文发布日期：'+details.publishedAt);
    if(unit&&!old.body.includes('[阅读与练习](/study/?id='+unit.id+')'))additions.push(unit.summary+'\n\n[阅读与练习](/study/?id='+unit.id+')\n\n阅读范围：'+unit.source.scope);
    if(text&&!unit&&!old.body.includes(text))additions.push('补充节选：\n\n'+text);
    if(!additions.length)return {state,note:old};
    const body=old.body+'\n\n## 补充阅读\n\n'+additions.join('\n\n');if(body.length>80000)throw new Error('这份来源记录已满，请另建笔记保留新的思考');
    const note={...old,body,updatedAt:now.toISOString()};return {state:{...state,notes:state.notes.map(n=>n.id===old.id?note:n)},note};
  }
  if(state.notes.length>=1000)throw new Error('日志已满，请先备份');
  const at=now.toISOString(),note={id:'source-'+id,title:item.title.slice(0,200),kind:'资料收件箱',tags:[details.origin,details.perspective,details.author].filter(Boolean).join(', ').slice(0,300),createdAt:at,updatedAt:at,
    body:`## 来源与作者\n\n原始链接：${url.href}\n\n平台：${details.origin}\n作者：${details.author||'尚未填写'}\n原文发布日期：${details.publishedAt||'未知'}\n记录时间：${at}\n资料性质：${details.perspective}\n\n## 我想弄清的问题\n\n${details.question||'读完后写下具体问题。'}\n\n${unit?`## 已整理的学习内容\n\n${unit.summary}\n\n${unit.takeaways.map(t=>'- '+t.point).join('\n')}\n\n[阅读与练习](/study/?id=${unit.id})\n\n阅读范围：${unit.source.scope}`:`## 已保存的节选\n\n${text||'仅保存了阅读线索，尚未整理或核实正文。'}`}\n\n## 作者观点与我的理解\n\n\n## 待验证与实践结果\n\n`};
  return {state:{...state,notes:[...state.notes,note]},note};
}
