import {validateState} from './state.js';
import {unitMarkdown} from './study-model.js';

const filename=value=>value.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\.{2,}/g,'_').replace(/[. ]+$/g,'').slice(0,65)||'未命名';
const frontmatter=values=>'---\n'+Object.entries(values).map(([key,value])=>key+': '+JSON.stringify(value)).join('\n')+'\n---\n\n';
export function vaultFiles(raw,data={resources:[],lessons:[]}){
  const state=validateState(raw),files=[];
  const allUnits=[...(data.studyUnits??[]),...state.studyUnits];
  for(const unit of state.studyUnits)files.push({name:`学习单元/${filename(unit.title)}--${unit.id}.md`,text:unitMarkdown(unit)});
  for(const p of state.studyProgress){const unit=allUnits.find(u=>u.id===p.id);files.push({name:`练习与复习/${filename(p.title)}--${p.id}.md`,text:`# ${p.title}\n\n计划日期：${p.scheduledFor}\n下次复习：${p.nextReview||'待首次自评'}\n\n${unit?unitMarkdown(unit):''}\n\n## 我的作答\n\n${p.answers.map(a=>`### ${unit?.exercises.find(e=>e.id===a.id)?.prompt||a.id}\n\n${a.text}`).join('\n\n')}\n\n## 复盘\n\n${p.reflection}\n\n## 学习记录（自评）\n\n${p.history.map(h=>'- '+h.at+' · '+h.rating+' · '+h.minutes+' 分钟').join('\n')}\n`});}
  const labels=new Map([...(data.lessons??[]).map(l=>[l.id,l.title]),...(data.curriculum??[]).flatMap(w=>w.tasks.map(t=>[t.id,t.text])),...(data.projects??[]).flatMap(p=>p.milestones.map((m,i)=>[p.id+'-m'+i,m])),...(data.questions??[]).map(q=>[q.id,q.title])]);
  for(const note of state.notes)files.push({name:`学习日志/${filename(note.title)}--${note.id}.md`,text:frontmatter({id:note.id,type:note.kind,tags:note.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean),created:note.createdAt,updated:note.updatedAt})+`# ${note.title}\n\n${note.body}\n`});
  for(const chat of state.conversations)files.push({name:`AI 对话/${filename(chat.title)}--${chat.id}.md`,text:frontmatter({id:chat.id,type:'AI 学习对话',updated:chat.updatedAt})+`# ${chat.title}\n\n`+chat.messages.map(m=>`## ${m.role==='user'?'我的问题':'学习助手'}${m.status==='complete'?'':' · '+(m.status==='interrupted'?'已停止':'未完成')}\n\n${m.content}`).join('\n\n')+'\n'});
  files.push({name:'收藏资料.md',text:'# 我的收藏资料\n\n'+state.saved.map(id=>data.resources.find(r=>r.id===id)).filter(Boolean).map(r=>`## ${r.title}\n\n${r.description}\n\n来源：${r.url}\n\n核实于 ${r.verifiedAt}`).join('\n\n')+'\n'});
  files.push({name:'学习进度.md',text:'# 学习进度\n\n'+`每周投入：${state.pace} 小时\n每天学习：${state.dailyMinutes} 分钟\n\n`+[['已读专题',state.reading],['学习任务',state.completed],['项目里程碑',state.milestones],['面试掌握度',state.mastered]].map(([title,ids])=>`## ${title}\n\n`+(ids.length?ids.map(id=>'- [x] '+(labels.get(id)||id)).join('\n'):'尚未标记')).join('\n\n')+'\n'});
  files.push({name:'完整备份.json',text:JSON.stringify(state,null,2)+'\n'});
  files.push({name:'开始阅读.md',text:`# SuGuilin 个人学习备份\n\n导出时间：${new Date().toISOString()}\n\n## 内容\n\n- [[收藏资料]]\n- [[学习进度]]\n- 学习日志：${state.notes.length} 篇\n- AI 对话：${state.conversations.length} 段\n- 学习单元：${state.studyUnits.length} 份\n- 作答与复习：${state.studyProgress.length} 份，见“练习与复习”文件夹\n\n将解压后的文件夹作为 Obsidian 库打开，或把文件放入现有库。Markdown 可独立阅读和编辑。\n\n## 回到网站\n\n访问 https://suguilin.github.io/account/ ，选择“导入备份”，导入本文件夹的“完整备份.json”。网站会先预览并合并记录。\n\n本次导出不包含登录令牌或 API 密钥。Markdown 在 Obsidian 中的编辑不会自动回传网站；需要网站原生 JSON 恢复。\n`});
  return files;
}
// Small standards-compliant uncompressed ZIP writer. No remote conversion,
// credentials or server upload. UTF-8 filenames work in Obsidian and Finder.
export function createZip(files){
  const encoder=new TextEncoder(),local=[],central=[];let offset=0;
  const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  const header=size=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};};
  for(const file of files){if(file.name.includes('..')||file.name.startsWith('/')||file.name.includes('\\'))throw new Error('Invalid archive path');
    const name=encoder.encode(file.name),body=encoder.encode(file.text),crc=crc32(body),h=header(30+name.length);
    h.view.setUint32(0,0x04034b50,true);h.view.setUint16(4,20,true);h.view.setUint16(6,0x800,true);h.view.setUint16(12,33,true);h.view.setUint32(14,crc,true);h.view.setUint32(18,body.length,true);h.view.setUint32(22,body.length,true);h.view.setUint16(26,name.length,true);h.bytes.set(name,30);local.push(h.bytes,body);
    const c=header(46+name.length);c.view.setUint32(0,0x02014b50,true);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x800,true);c.view.setUint16(14,33,true);c.view.setUint32(16,crc,true);c.view.setUint32(20,body.length,true);c.view.setUint32(24,body.length,true);c.view.setUint16(28,name.length,true);c.view.setUint32(42,offset,true);c.bytes.set(name,46);central.push(c.bytes);offset+=h.bytes.length+body.length;
  }
  const size=central.reduce((s,b)=>s+b.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);
  return new Blob([...local,...central,end.bytes],{type:'application/zip'});
}
