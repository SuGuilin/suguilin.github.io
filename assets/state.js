import {validateUnit,validateProgress} from './study-model.js';
export const STORAGE_KEY = 'suguilin.agent-workspace.v1';
export const defaultState = () => ({version:1, saved:[], completed:[], milestones:[], mastered:[], reading:[], notes:[], conversations:[],studyUnits:[],studyProgress:[],dailyMinutes:45, pace:10});
const text = (value, max, field) => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${field} 格式或长度不正确`);
  return value;
};
const list = (value, field) => {
  if (!Array.isArray(value) || value.length > 2000) throw new Error(`${field} 必须是有限的列表`);
  return [...new Set(value.map(item => {const id=text(item,100,field);if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error(`${field} ID 格式不正确`);return id;}))];
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
    return {id, title:text(note.title, 200, '标题'), body:text(note.body, 80000, '正文'), kind:text(note.kind, 30, '笔记类型'), tags:text(note.tags, 300, '标签'), createdAt:new Date(createdAt).toISOString(), updatedAt:new Date(updatedAt).toISOString()};
  });
  if (new Set(notes.map(note => note.id)).size !== notes.length) throw new Error('备份包含重复笔记 ID');
  if (![6,10,15].includes(raw.pace)) throw new Error('学习节奏格式不正确');
  const conversations = raw.conversations ?? [];
  if (!Array.isArray(conversations) || conversations.length > 500) throw new Error('会话列表格式不正确');
  const chats = conversations.map(chat => {
    if (!chat || !/^[a-zA-Z0-9_-]+$/.test(chat.id)) throw new Error('会话 ID 格式不正确');
    if (new TextEncoder().encode(JSON.stringify(chat)).length>1000000) throw new Error('会话过大，请拆分对话');
    if (!Array.isArray(chat.messages) || chat.messages.length > 120) throw new Error('会话消息格式不正确');
    const updatedAt=text(chat.updatedAt,40,'会话日期');
    if (!Number.isFinite(Date.parse(updatedAt))) throw new Error('会话日期无效');
    return {id:text(chat.id,100,'会话 ID'),title:text(chat.title,200,'会话标题'),updatedAt:new Date(updatedAt).toISOString(),messages:chat.messages.map(m=>{
      if (!m || !['user','assistant'].includes(m.role)) throw new Error('消息角色无效');
      return {role:m.role,content:text(m.content,40000,'消息正文'),status:['complete','interrupted','error'].includes(m.status)?m.status:'complete'};
    })};
  });
  if (new Set(chats.map(c=>c.id)).size !== chats.length) throw new Error('重复会话 ID');
  const studyUnits=raw.studyUnits??[],studyProgress=raw.studyProgress??[];
  for(const records of [studyUnits,studyProgress])if(!Array.isArray(records)||records.length>300||new Set(records.map(r=>r?.id)).size!==records.length)throw new Error('学习单元或计划列表无效');
  const dailyMinutes=raw.dailyMinutes??45;if(![15,30,45,60,90].includes(dailyMinutes))throw new Error('每日学习时间无效');
  return {version:1,saved:list(raw.saved,'收藏'),completed:list(raw.completed,'学习任务'),milestones:list(raw.milestones,'项目里程碑'),mastered:list(raw.mastered,'面试进度'),reading:list(raw.reading??[],'课程进度'),notes,conversations:chats,studyUnits:studyUnits.map(validateUnit),studyProgress:studyProgress.map(validateProgress),dailyMinutes,pace:raw.pace};
}
export function mergeStates(current, incoming) {
  const a = validateState(current), b = validateState(incoming);
  const notes = new Map(a.notes.map(note => [note.id, note]));
  for (const note of b.notes) {
    const old = notes.get(note.id);
    if (!old || Date.parse(note.updatedAt) > Date.parse(old.updatedAt)) notes.set(note.id, note);
  }
  const chats = new Map(a.conversations.map(c=>[c.id,c]));
  for (const chat of b.conversations) {
    const old=chats.get(chat.id);
    if (!old || Date.parse(chat.updatedAt)>Date.parse(old.updatedAt)) chats.set(chat.id,chat);
  }
  const records=kind=>{const map=new Map(a[kind].map(r=>[r.id,r]));for(const r of b[kind])if(!map.has(r.id)||r.updatedAt>map.get(r.id).updatedAt)map.set(r.id,r);return [...map.values()];};
  return validateState({...a, saved:[...new Set([...a.saved,...b.saved])],completed:[...new Set([...a.completed,...b.completed])],milestones:[...new Set([...a.milestones,...b.milestones])],mastered:[...new Set([...a.mastered,...b.mastered])],reading:[...new Set([...a.reading,...b.reading])],notes:[...notes.values()],conversations:[...chats.values()],studyUnits:records('studyUnits'),studyProgress:records('studyProgress')});
}
// A backup is recovery material: preserve both edited contents even when their
// IDs overlap. Stable copy IDs make repeated imports idempotent.
export function mergeBackupStates(current,incoming){
  const a=validateState(current),b=validateState(incoming),state=mergeStates(a,b);let conflicts=0;
  const fingerprint=value=>{let x=2166136261,y=5381;for(const char of value){x=Math.imul(x^char.charCodeAt(0),16777619);y=Math.imul(y,33)^char.charCodeAt(0);}return (x>>>0).toString(16)+(y>>>0).toString(16);};
  const content=record=>JSON.stringify(Object.fromEntries(Object.entries(record).filter(([key])=>!['id','updatedAt'].includes(key))));
  for(const kind of ['notes','conversations','studyUnits','studyProgress'])for(const imported of b[kind]){
    const existing=a[kind].find(r=>r.id===imported.id);
    if(!existing||content(existing)===content(imported))continue;
    const winner=state[kind].find(r=>r.id===imported.id);
    // validateState returns new objects, so compare the content of the winner.
    const losing=content(winner)===content(imported)?existing:imported;
    if(kind==='studyProgress'){const id='backup-progress-'+fingerprint(content(losing));if(!state.notes.some(n=>n.id===id)){state.notes.push({id,title:losing.title.slice(0,170)+'（备份作答保留）',kind:'学习复盘',tags:'备份冲突',createdAt:losing.updatedAt,updatedAt:losing.updatedAt,body:`## 备份中保留的作答与计划\n\n${losing.answers.map(a=>'### '+a.id+'\n\n'+a.text).join('\n\n')}\n\n复盘：${losing.reflection}\n计划日期：${losing.scheduledFor}\n下次复习：${losing.nextReview}\n\n历史：\n${losing.history.map(h=>h.at+' · '+h.rating+' · '+h.minutes+' 分钟').join('\n')}`});conflicts++;}continue;}
    const base=imported.id.slice(0,55)+'-backup-'+fingerprint(content(losing));
    let id=base,index=1;
    while(state[kind].some(r=>r.id===id&&content({...r,title:losing.title})!==content(losing)))id=base+'-'+index++;
    if(state[kind].some(r=>r.id===id))continue;
    state[kind].push({...losing,id,title:(losing.title.slice(0,180)+'（备份保留版本）')});conflicts++;
  }
  return {state:validateState(state),conflicts};
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function safeURL(value) {
  try {const url = new URL(value, 'https://suguilin.github.io'); return ['http:','https:'].includes(url.protocol) ? value : '#';} catch {return '#';}
}
