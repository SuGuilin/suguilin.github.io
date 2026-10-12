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
const probability=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
export function calibrationReportNote(text){
  if(typeof text!=='string'||text.length>50000)throw new Error('请选择不超过 50 KB 的 calibration_report.json');
  let report;try{report=JSON.parse(text);}catch{throw new Error('实验记录不是有效 JSON');}
  if(report?.experiment!=='decision-calibration'||report.data_scope!=='synthetic binary classification'||report.model_evaluated!==false||!count(report.samples)||!report.samples||typeof report.change!=='string'||report.change.length>500)throw new Error('这不是本篇支持的离线概率实验记录');
  const rows=[];let thresholds;
  for(const [key,label] of [['baseline','修改前'],['changed','修改后']]){
    const result=report[key];
    if(!probability(result?.brier)||!Array.isArray(result.selective)||!result.selective.length||result.selective.length>10)throw new Error('概率实验的指标不完整');
    const current=result.selective.map(s=>s?.threshold);
    if(new Set(current).size!==current.length||thresholds&&JSON.stringify(current)!==JSON.stringify(thresholds))throw new Error('前后实验的阈值必须一致');
    thresholds=current;
    for(const s of result.selective){
      if(!probability(s.threshold)||s.threshold<0.5||!count(s.accepted)||s.accepted>report.samples||!count(s.errors)||s.errors>s.accepted||!probability(s.coverage)||Math.abs(s.coverage-s.accepted/report.samples)>1e-9|| (s.accepted?s.accepted_error===null||!probability(s.accepted_error)||Math.abs(s.accepted_error-s.errors/s.accepted)>1e-9:s.accepted_error!==null))throw new Error('概率实验的覆盖率、错误率或计数不一致');
      rows.push(`| ${label} | ${result.brier.toFixed(4)} | ${s.threshold} | ${s.accepted}/${report.samples}（${(s.coverage*100).toFixed(1)}%） | ${s.errors}/${s.accepted}${s.accepted?'（'+(s.accepted_error*100).toFixed(1)+'%）':'（无自动处理样本）'} |`);
    }
  }
  let body=`## 代码实践 · 概率与回退\n\n范围：${report.samples} 个合成二元样本，未调用或评测 Jev。阈值使用最大类别概率，不是 TypeSafe confidence。\n\n改动：${report.change}\n\n| 实验 | Brier | 概率阈值 | 自动处理 / 总样本（覆盖率） | 错误 / 自动处理（错误率） |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nBrier 越低越好；这里的样本量不能支持模型性能或生产阈值结论。`;
  if(report.my_interpretation!==undefined&&typeof report.my_interpretation!=='string')throw new Error('实验解释须为文本');
  if(report.my_interpretation?.trim())body+='\n\n我的解释：\n'+report.my_interpretation.trim().slice(0,2500);
  return body;
}
export const notebookReports={
  'durable-agent.ipynb':{experiment:'durable-agent',filename:'recovery_report.json'},
  'decision-calibration.ipynb':{experiment:'decision-calibration',filename:'calibration_report.json'}
};
export function appendPracticeReport(reflection,text,expectedExperiment='durable-agent'){
  const note=expectedExperiment==='decision-calibration'?calibrationReportNote(text):expectedExperiment==='durable-agent'?recoveryReportNote(text):null;
  if(!note)throw new Error('本篇暂不支持此实验记录');
  if(reflection.includes(note))return {text:reflection,duplicate:true};const combined=[reflection.trim(),note].filter(Boolean).join('\n\n');if(combined.length>6000)throw new Error('笔记超过 6000 字，请先将现有内容存入日志，再导入');return {text:combined,duplicate:false};
}
