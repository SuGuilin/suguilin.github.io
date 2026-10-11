const protocols={naive_replay:'盲目重放',idempotent_replay:'同 ID 幂等重放',query_then_retry:'先查询再重试'};
const faults={before_submit:'提交前',after_remote_commit:'远端已提交',after_checkpoint:'检查点已确认'};
const count=value=>Number.isInteger(value)&&value>=0&&value<=10000;
export function recoveryReportNote(text){
  if(typeof text!=='string'||text.length>50000)throw new Error('请选择不超过 50 KB 的 recovery_report.json');
  let report;try{report=JSON.parse(text);}catch{throw new Error('实验记录不是有效 JSON');}
  if(report?.experiment!=='durable-agent'||report.data_scope!=='synthetic in-memory simulation'||!Array.isArray(report.results)||!report.results.length||report.results.length>30)throw new Error('这不是本篇支持的故障恢复实验记录');
  const row=r=>{if(!protocols[r?.protocol]||!faults[r.crash_at]||!['confirmed','unknown'].includes(r.status)||!count(r.business_commits)||!count(r.write_requests))throw new Error('实验记录的状态或次数无效');return `| ${protocols[r.protocol]} | ${faults[r.crash_at]} | ${r.status} | ${r.business_commits} | ${r.write_requests} |`;};
  const rows=report.results.map(row);
  if(report.changed_id)rows.push(row(report.changed_id).replace('同 ID 幂等重放','重试换了 ID'));
  if(report.query_unavailable)rows.push(row(report.query_unavailable).replace('先查询再重试','查询不可用'));
  let body='## 代码实践 · durable-agent\n\n范围：内存故障模拟'+(report.sqlite?'与本地 SQLite 事务实验':'')+'，未连接真实业务服务。\n\n| 恢复协议 | 故障位置 | 结果状态 | 业务提交 | 写请求 |\n| --- | --- | --- | --- | --- |\n'+rows.join('\n');
  if(report.sqlite){const s=report.sqlite;if(![s.workers,s.business_commits,s.distinct_receipts,s.reopen_commits,s.rollback_commits].every(count)||typeof s.payload_conflict!=='boolean')throw new Error('SQLite 实验记录不完整');body+=`\n\nSQLite：${s.workers} 个并发调用，${s.business_commits} 条业务记录，${s.distinct_receipts} 种回执。重新打开数据库并重放后共 ${s.reopen_commits} 条；提交前异常回滚后 ${s.rollback_commits} 条。不同参数复用 ID：${s.payload_conflict?'已拒绝':'未拒绝'}。`;}
  if(report.my_explanation!==undefined&&typeof report.my_explanation!=='string')throw new Error('实验解释须为文本');
  if(report.my_explanation?.trim())body+='\n\n我的解释：\n'+report.my_explanation.trim().slice(0,2500);
  return body;
}
export function appendPracticeReport(reflection,text){const note=recoveryReportNote(text);if(reflection.includes(note))return {text:reflection,duplicate:true};const combined=[reflection.trim(),note].filter(Boolean).join('\n\n');if(combined.length>6000)throw new Error('笔记超过 6000 字，请先将现有内容存入日志，再导入');return {text:combined,duplicate:false};}
