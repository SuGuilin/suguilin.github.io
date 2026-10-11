// Pure helpers keep personal work recoverable across reading, notes and backups.
import {validReadingSection} from './study-model.js';
export function studyReturnURL(unit, section = 'study-reflection') {
  return '/study/?id=' + encodeURIComponent(unit.id) + '#' + (validReadingSection(section) ? section : 'study-reflection');
}
export function studyQuestion(unit, progress, exerciseId = '', sectionTitle = '') {
  const exercise = unit.exercises.find(e => e.id === exerciseId);
  if (exercise) return `关于「${unit.title}」的这道练习：\n${exercise.prompt}\n\n我的作答：\n${progress.answers.find(a => a.id === exerciseId)?.text.trim().slice(0, 3000) || '还未作答'}\n\n请先指出推理中需要澄清的地方，用一个追问帮助我继续思考。`.slice(0, 6000);
  return `我正在学习「${unit.title}」${sectionTitle ? '，读到「' + sectionTitle.slice(0, 150) + '」' : ''}。\n\n我的问题是：`;
}
export function questionWithContext(question, unit) {
  if (!question.trim()) throw new Error('先写下你的问题');
  if (!unit) return question.trim();
  return `${question.trim()}\n\n---\n学习单元：${unit.title}\n关键要点：\n${unit.takeaways.map(t => '- ' + t.point).join('\n')}\n阅读范围：${unit.source.scope}\n来源：${unit.source.url}\n\n请区分来源支持的事实与推断；先解释机制和边界，再给出一个最小验证方法。`;
}
export function saveStudySnapshot(state, unit, progress, {now = new Date(), review = '', question = '', section = 'study-reflection', id = crypto.randomUUID()} = {}) {
  const answered = unit.exercises.filter(e => progress.answers.some(a => a.id === e.id && a.text.trim()));
  if (!question.trim() && !answered.length && !progress.reflection.trim()) throw new Error('先写下一点理解或一道练习的回答，再存入日志');
  const body = question.trim() ? `## 待解答的问题\n\n${question.trim()}\n\n` : `${answered.length ? '## 我的作答\n\n' + answered.map(e => '### ' + e.prompt + '\n\n' + progress.answers.find(a => a.id === e.id).text).join('\n\n') + '\n\n' : ''}${progress.reflection.trim() ? '## 我的理解与疑问\n\n' + progress.reflection + '\n\n' : ''}${review ? '自评：' + {again:'还需重学',hard:'基本理解',good:'能独立解释'}[review] + '\n\n下次复习：' + progress.nextReview + '\n\n' : ''}`;
  const kind = question.trim() ? '待解答问题' : review ? '学习复盘' : '学习笔记';
  const content = body + `[回到学习单元](${studyReturnURL(unit, section)})\n\n原始来源：[${unit.source.title.replace(/[\[\]\n]/g, ' ')}](${unit.source.url})`;
  const previous = state.notes.find(n => n.kind === kind && n.body === content);
  if (previous) return {state, note:previous, duplicate:true};
  if (state.notes.length >= 1000) throw new Error('日志已满，请先导出备份并腾出空间；当前作答仍保留在学习页');
  const at = now.toISOString(), note = {id:'study-' + id, title:unit.title.slice(0, 180) + ' · ' + kind, kind, tags:unit.topic, body:content, createdAt:at, updatedAt:at};
  return {state:{...state, notes:[...state.notes, note]}, note, duplicate:false};
}
