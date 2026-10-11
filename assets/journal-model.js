const kinds=['实验记录','源码研究','论文精读','学习复盘','学习笔记','待解答问题','已解决问题','重点标注','作者观点','面试复盘','项目记录','资料收件箱'];
export function journalScope(params){
  for(const field of ['id','source','lesson','week','project','guide']){
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
export function filterJournal(notes,{inbox=false,kind='',query=''}={}){
  const needle=query.trim().toLocaleLowerCase();
  return notes.filter(n=>(!inbox||n.kind==='资料收件箱')&&(!kind||n.kind===kind)&&(!needle||[n.title,n.body,n.tags].join(' ').toLocaleLowerCase().includes(needle))).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
