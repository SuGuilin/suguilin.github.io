export const STORAGE_KEY = 'suguilin.agent-workspace.v1';
export const defaultState = () => ({version:1, saved:[], completed:[], milestones:[], mastered:[], notes:[], pace:10});
const text = (value, max, field) => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${field} 格式或长度不正确`);
  return value;
};
const list = (value, field) => {
  if (!Array.isArray(value) || value.length > 2000) throw new Error(`${field} 必须是有限的列表`);
  return [...new Set(value.map(item => text(item, 100, field)))];
};
export function validateState(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1) throw new Error('不支持的备份格式，请选择工作台导出的 JSON');
  if (!Array.isArray(raw.notes) || raw.notes.length > 1000) throw new Error('笔记列表格式不正确');
  const notes = raw.notes.map(note => {
    if (!note || typeof note !== 'object') throw new Error('笔记格式不正确');
    const id = text(note.id, 100, '笔记 ID');
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('笔记 ID 格式不正确');
    const createdAt = text(note.createdAt, 40, '创建日期');
    const updatedAt = text(note.updatedAt, 40, '更新日期');
    if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) throw new Error('笔记日期无效');
    return {id, title:text(note.title, 200, '标题'), body:text(note.body, 80000, '正文'), kind:text(note.kind, 30, '笔记类型'), tags:text(note.tags, 300, '标签'), createdAt, updatedAt};
  });
  if (new Set(notes.map(note => note.id)).size !== notes.length) throw new Error('备份包含重复笔记 ID');
  if (![6,10,15].includes(raw.pace)) throw new Error('学习节奏格式不正确');
  return {version:1,saved:list(raw.saved,'收藏'),completed:list(raw.completed,'学习任务'),milestones:list(raw.milestones,'项目里程碑'),mastered:list(raw.mastered,'面试进度'),notes,pace:raw.pace};
}
export function mergeStates(current, incoming) {
  const a = validateState(current), b = validateState(incoming);
  const notes = new Map(a.notes.map(note => [note.id, note]));
  for (const note of b.notes) {
    const old = notes.get(note.id);
    if (!old || Date.parse(note.updatedAt) > Date.parse(old.updatedAt)) notes.set(note.id, note);
  }
  return validateState({...a, saved:[...new Set([...a.saved,...b.saved])],completed:[...new Set([...a.completed,...b.completed])],milestones:[...new Set([...a.milestones,...b.milestones])],mastered:[...new Set([...a.mastered,...b.mastered])],notes:[...notes.values()]});
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function safeURL(value) {
  try {const url = new URL(value, 'https://suguilin.github.io'); return ['http:','https:'].includes(url.protocol) ? value : '#';} catch {return '#';}
}
