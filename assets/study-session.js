// Pure helpers keep personal work recoverable across reading, notes and backups.
import {validReadingSection,currentAttempt} from './study-model.js';
export function learningSources(unit,{lessons=[],resources=[],readings=[]}={}){
  if(!unit)return [];
  const original=lessons.find(l=>l.id===unit.id)?.sources??resources.find(r=>'digest-'+r.id===unit.id)?.digest?.sourceLinks??[unit.source];
  const current=readings.find(r=>r.id===unit.id)?.sources??[];
  return [...current,...original].filter((s,i,all)=>all.findIndex(t=>t.url===s.url)===i);
}
export function studyReturnURL(unit, section = 'study-reflection', recall=false) {
  return '/study/?id=' + encodeURIComponent(unit.id) + (recall?'&mode=recall':'') + '#' + (validReadingSection(section) ? section : 'study-reflection');
}
export function studyQuestion(unit, progress, exerciseId = '', sectionTitle = '') {
  progress=currentAttempt(progress);
  const exercise = unit.exercises.find(e => e.id === exerciseId);
  if (exercise) {
    const request='\n\n请先指出推理中需要澄清的地方，用一个追问帮助我继续思考。',label='\n\n本篇笔记与实验观察：\n';
    const introduction=`关于「${unit.title}」的这道练习：\n${exercise.prompt}\n\n我的作答：\n${progress.answers.find(a => a.id === exerciseId)?.text.trim().slice(0, 3000) || '还未作答'}`.slice(0,6000-request.length);
    const room=6000-introduction.length-request.length-label.length,observations=progress.reflection.trim().slice(0,Math.max(0,Math.min(3500,room)));
    return introduction+(observations?label+observations:'')+request;
  }
  return `我正在学习「${unit.title}」${sectionTitle ? '，读到「' + sectionTitle.slice(0, 150) + '」' : ''}。${progress.reflection.trim()?'\n\n当前学习笔记与实验观察：\n'+progress.reflection.trim().slice(0,3500):''}\n\n我的问题是：`;
}
export function questionWithContext(question, unit, {sources=[]}={}) {
  if (!question.trim()) throw new Error('先写下你的问题');
  if (!unit) return question.trim();
  return `${question.trim()}\n\n---\n学习单元：${unit.title}\n关键要点：\n${unit.takeaways.map(t => '- ' + t.point).join('\n')}\n阅读范围：${unit.source.scope}\n来源：${sources.length?sources.slice(0,8).map(s=>s.title+'：'+s.url+'\n支持范围：'+(s.supports||s.section||unit.source.scope)).join('\n'):unit.source.url}\n\n请区分来源支持的事实与推断；先解释机制和边界，再给出一个最小验证方法。`;
}
export function saveStudySnapshot(state, unit, progress, {now = new Date(), review = '', question = '', section = 'study-reflection', previous = null, id = crypto.randomUUID()} = {}) {
  progress=currentAttempt(progress);
  const answered = unit.exercises.filter(e => progress.answers.some(a => a.id === e.id && a.text.trim()));
  if (!question.trim() && !answered.length && !progress.reflection.trim()) throw new Error('先写下一点理解或一道练习的回答，再存入日志');
  const body = question.trim() ? `## 待解答的问题\n\n${question.trim()}\n\n` : `${answered.length ? '## 我的作答\n\n' + answered.map(e => '### ' + e.prompt + '\n\n' + progress.answers.find(a => a.id === e.id).text).join('\n\n') + '\n\n' : ''}${progress.reflection.trim() ? '## 我的理解与疑问\n\n' + progress.reflection + '\n\n' : ''}${review ? '自评：' + {again:'还需重学',hard:'基本理解',good:'能独立解释'}[review] + '\n\n下次复习：' + progress.nextReview + '\n\n' : ''}`;
  const kind = question.trim() ? '待解答问题' : review ? '学习复盘' : '学习笔记';
  const comparison=previous?`## 上次作答（供事后比较）\n\n${previous.answers.filter(a=>a.text.trim()).map(a=>'### '+(unit.exercises.find(e=>e.id===a.id)?.prompt||a.id)+'\n\n'+a.text).join('\n\n')}\n\n上次复盘：${previous.reflection}\n\n`:'';
  const tail=`[回到学习单元](${studyReturnURL(unit, section)})\n\n原始来源：[${unit.source.title.replace(/[\[\]\n]/g, ' ')}](${unit.source.url})`;
  let content=body+comparison+tail;
  if(content.length>80000&&previous){
    const {recall,...last}=previous;
    const earlier=saveStudySnapshot(state,unit,last,{now,section,id:id+'-previous'});
    state=earlier.state;
    content=body+`[对照上次作答](/journal/?id=${earlier.note.id})\n\n`+tail;
  }
  const duplicate = state.notes.find(n => n.kind === kind && n.body === content);
  if (duplicate) return {state, note:duplicate, duplicate:true};
  if (state.notes.length >= 1000) throw new Error('日志已满，请先导出备份并腾出空间；当前作答仍保留在学习页');
  const at = now.toISOString(), note = {id:'study-' + id, title:unit.title.slice(0, 180) + ' · ' + kind, kind, tags:unit.topic, body:content, createdAt:at, updatedAt:at};
  return {state:{...state, notes:[...state.notes, note]}, note, duplicate:false};
}
