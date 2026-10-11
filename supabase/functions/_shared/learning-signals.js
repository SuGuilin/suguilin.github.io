// Learning signals are derived from existing private records. No remote profile
// or inferred skill score is needed, and backups remain ordinary notes.
export const normalizeQuote = value => String(value).replace(/\s+/g,' ').trim();
export function noteUnitId(note){
  const match=note.body.match(/\]\(\/study\/\?id=([a-zA-Z0-9_-]{1,100})(?:#[a-zA-Z0-9_-]+)?\)/);
  return match?.[1]||'';
}
export function readAnnotation(note){
  const quote=note.body.match(/^## 选文\n+> ([^\n]+)(?:\n|$)/m)?.[1];
  const link=note.body.match(/\[回到标注位置\]\(\/study\/\?id=([a-zA-Z0-9_-]{1,100})#(study-(?:body|essentials|boundaries|practice|sources)|chapter-\d{1,2}|exercise-e[1-5])\)/);
  return quote&&link?{note,unitId:link[1],section:link[2],quote:normalizeQuote(quote)}:null;
}
export function saveAnnotation(state,unit,selection,{kind='重点标注',comment='',now=new Date(),id=crypto.randomUUID()}={}){
  const quote=normalizeQuote(selection.quote),section=selection.section;
  if(quote.length<2||quote.length>3000||! /^(study-(body|essentials|boundaries|practice|sources)|chapter-\d{1,2}|exercise-e[1-5])$/.test(section))throw new Error('请选择同一段落或章节内的 2–3000 字');
  if(!['重点标注','学习笔记','待解答问题'].includes(kind))throw new Error('记录类型无效');
  const old=state.notes.find(n=>{const a=readAnnotation(n);return n.kind===kind&&a?.unitId===unit.id&&a.section===section&&a.quote===quote;});
  if(old)return {state,note:old,duplicate:true};
  if(state.notes.length>=1000)throw new Error('记录已满，请先导出备份并整理旧记录');
  const at=now.toISOString(),note={id:'annotation-'+id,title:unit.title.slice(0,100)+' · '+quote.slice(0,60),kind,tags:unit.topic,createdAt:at,updatedAt:at,
    body:`## 选文\n\n> ${quote}\n\n## ${kind==='待解答问题'?'我的疑问':'我的思考'}\n\n${comment}\n\n[回到标注位置](/study/?id=${unit.id}#${section})\n\n原始来源：${unit.source.url}\n阅读范围：${unit.source.scope}`};
  return {state:{...state,notes:[...state.notes,note]},note,duplicate:false};
}
const themes=[
  ['memory','上下文与记忆',/memory|mem0|context|记忆|上下文/i,'agent memory'],
  ['evaluation','评测与实验',/evaluat|benchmark|GAIA|τ-bench|评测|统计|校准/i,'agent evaluation'],
  ['tools','工具与可靠性',/tool|MCP|工具|幂等|可靠|恢复/i,'agent tool reliability'],
  ['rl','强化学习',/\bRL\b|GRPO|PPO|RAGEN|verl|强化|训练/i,'agent reinforcement learning'],
  ['decision','决策模型',/Jev|System One|决策模型/i,'Jev TypeSafe'],
  ['harness','执行系统',/harness|agent loop|执行系统|ReAct/i,'agent harness']
];
const themeIds=value=>themes.filter(t=>t[2].test(value)).map(t=>t[0]);
export function learningRecommendations(state,units,resources=[],{exclude='',limit=3}={}){
  const allNotes=[...state.notes].filter(n=>n.kind!=='资料收件箱').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),recentNotes=allNotes.slice(0,12);
  const active=state.studyProgress.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8);
  const signalText=[...recentNotes.map(n=>n.title+' '+n.tags),...active.map(p=>p.title),...resources.filter(r=>state.saved.includes(r.id)).map(r=>r.title+' '+r.tags.join(' '))].join(' ');
  const interests=new Set(themeIds(signalText)),hasSignals=!!(recentNotes.length||active.length||state.saved.length);
  const ranked=units.filter(u=>u.id!==exclude).map(u=>{
    const p=state.studyProgress.find(p=>p.id===u.id),question=allNotes.find(n=>n.kind==='待解答问题'&&noteUnitId(n)===u.id);
    const annotation=recentNotes.find(n=>readAnnotation(n)?.unitId===u.id),freshAnnotation=annotation&&(!p?.history.length||Date.parse(annotation.updatedAt)>Date.parse(p.history.at(-1).at));
    const source=resources.find(r=>r.url===u.source.url||'digest-'+r.id===u.id),saved=state.saved.includes(u.id)||source&&state.saved.includes(source.id);
    const unitThemes=themeIds(u.title+' '+u.topic+' '+u.summary),shared=unitThemes.find(t=>interests.has(t));
    let score=0,reason='',section='';
    if(question){score=120;reason='你留下的问题还待解答';section=readAnnotation(question)?.section||'study-reflection';}
    else if(p&&!p.history.length){score=90;reason=p.answers.some(a=>a.text.trim())?'已有作答，继续自检或动手验证':'继续已开始的阅读';section=p.readingSection||'study-essentials';}
    else if(freshAnnotation){score=70;reason='从你标注的重点继续，完成一道验证题';section='study-practice';}
    else if(saved){score=60;reason='你收藏过这份资料';}
    else if(shared){score=40;reason='延伸你近期关注的'+themes.find(t=>t[0]===shared)[1];}
    else if(source?.priority==='frontier'){score=hasSignals?20:50;reason='近期补充的方向，先理解机制与限制';}
    else{score=hasSignals?5:10;reason=hasSignals?'补充一个尚未练习的方向':'从一个具体机制开始';}
    if(p?.history.length&&!question&&!freshAnnotation)score=-1;
    return {unit:u,progress:p,score,reason,section,theme:unitThemes[0]||u.topic,question};
  }).filter(r=>r.score>=0).sort((a,b)=>b.score-a.score||a.unit.id.localeCompare(b.unit.id));
  const result=[],used=new Set();
  for(const r of ranked)if(!used.has(r.theme)||r.score>=70){result.push(r);used.add(r.theme);if(result.length===limit)break;}
  if(result.length<limit)for(const r of ranked)if(!result.includes(r)){result.push(r);if(result.length===limit)break;}
  return result;
}
export function discoveryInterests(state){
  const text=[...state.notes.filter(n=>n.kind!=='资料收件箱').slice(-12).map(n=>n.title+' '+n.tags),...state.studyProgress.slice(-8).map(p=>p.title)].join(' ');
  return themes.filter(t=>t[2].test(text)).slice(0,3).map(t=>({title:t[1],query:t[3]}));
}
