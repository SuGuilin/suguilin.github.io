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
  'mcp-tool-contract.ipynb':{experiment:'mcp-tool-contract',filename:'mechanism_report.json'},
  'langgraph-control-flow.ipynb':{experiment:'langgraph-control-flow',filename:'langgraph_flow_report.json'},
  'agent-research-checks.ipynb':{experiment:'agent-research-checks',filename:'mechanism_report.json'},
  ...Object.fromEntries(['llm-contract','retrieval-rag','context-engineering','agent-security','multi-agent','inference-serving'].map(id=>[id+'.ipynb',{experiment:'lesson-'+id,filename:'mechanism_report.json'}])),
  'langgraph-durable-workflow.ipynb':{experiment:'langgraph-durable-workflow',filename:'langgraph_report.json'},
  'durable-agent.ipynb':{experiment:'durable-agent',filename:'recovery_report.json'},
  'decision-calibration.ipynb':{experiment:'decision-calibration',filename:'calibration_report.json'}
};
export function appendPracticeReport(reflection,text,expectedExperiment='durable-agent'){
  const note=Object.hasOwn(mechanismChecks,expectedExperiment)?mechanismReportNote(text,expectedExperiment):expectedExperiment==='langgraph-durable-workflow'?langgraphReportNote(text):expectedExperiment==='decision-calibration'?calibrationReportNote(text):expectedExperiment==='durable-agent'?recoveryReportNote(text):null;
  if(!note)throw new Error('本篇暂不支持此实验记录');
  if(reflection.includes(note))return {text:reflection,duplicate:true};const combined=[reflection.trim(),note].filter(Boolean).join('\n\n');if(combined.length>6000)throw new Error('笔记超过 6000 字，请先将现有内容存入日志，再导入');return {text:combined,duplicate:false};
}
export const mechanismChecks={
  'mcp-tool-contract':{discovery:'真实工具发现',structured_result:'结构化结果',invalid_input_rejected:'非法类型拒绝',business_error_retained:'业务错误保留',unknown_tool_rejected:'未知工具拒绝',subprocess_boundary:'stdio 子进程边界'},
  'lesson-llm-contract':{strict_types:'严格类型',calendar_validation:'日历语义',finite_money:'有限金额',unknown_fields:'未知字段拒绝'},
  'lesson-retrieval-rag':{rank_fusion:'rank 融合',recall_at_k:'召回指标',acl_before_context:'上下文前权限过滤'},
  'lesson-context-engineering':{mandatory_preserved:'必要状态保留',budget_bound:'预算范围',overflow_explicit:'预算不足显式失败'},
  'lesson-agent-security':{trusted_identity:'可信身份',object_authorization:'对象授权',scope_enforced:'scope 拒绝'},
  'lesson-multi-agent':{evidence_required:'证据字段',conflict_rejected:'冲突拒绝',global_budget:'总预算',failure_retained:'子任务失败拒绝'},
  'lesson-inference-serving':{kv_baseline:'KV 算式',failed_cost_included:'失败费用计入',tail_latency:'尾部指标'},
  'langgraph-control-flow':{exclusive_route:'独占路由',static_edge_counterexample:'静态边反例',send_join:'Send 归并',tool_result:'ToolNode 结果',private_stream_visible:'内部字段流出反例',filtered_stream:'流白名单',retry_attempts:'重试次数',pending_writes:'成功写入复用',trusted_context:'可信上下文'},
  'agent-research-checks':{clipped_objective:'正负优势裁剪',zero_variance:'零方差',action_observation_mask:'动作与观察 mask',rollout_identity:'轨迹身份',reliability_estimators:'可靠性组合指标',attachment_contract:'附件合同',metric_negative_cases:'评分器负例',loop_termination:'循环终止',risk_cost:'回退代价'}
};
export function mechanismReportNote(text,expected){
  if(typeof text!=='string'||text.length>50000)throw new Error('请选择不超过 50 KB 的实验 JSON');
  let r;try{r=JSON.parse(text);}catch{throw new Error('实验记录不是有效 JSON');}
  const spec=Object.hasOwn(mechanismChecks,expected)?mechanismChecks[expected]:null,sdk=expected==='langgraph-control-flow',mcp=expected==='mcp-tool-contract';
  if(!spec||r?.experiment!==expected)throw new Error('实验类型不匹配');
  if(sdk){if(r.model_called!==false||typeof r.version!=='string'||!/^\d+\.\d+\.\d+$/.test(r.version))throw new Error('SDK 版本或运行范围不匹配');}
  else if(mcp){if(r.model_called!==false||r.version!=='2.3.0'||r.protocol!=='2026-07-28'||r.scope!=='official SDK; memory and stdio; no HTTP/auth')throw new Error('MCP 版本或运行范围不匹配');}
  else if(r.scope!=='stdlib fixtures; no model/service')throw new Error('实验运行范围不匹配');
  if(!r.checks||typeof r.checks!=='object'||Array.isArray(r.checks)||Object.keys(r.checks).length!==Object.keys(spec).length||!Object.keys(spec).every(k=>typeof r.checks[k]==='boolean'))throw new Error('实验检查项不完整');
  if(r.my_explanation!==undefined&&typeof r.my_explanation!=='string')throw new Error('实验解释须为文本');
  return `## 代码实践 · ${expected}\n\n范围：${sdk?'真实 LangGraph '+r.version+'；固定决策、无模型和远端服务':mcp?'真实 MCP SDK '+r.version+'，协议 '+r.protocol+'；内存与 stdio，无模型、HTTP/OAuth 或私有数据':'标准库教学 fixture；无模型、服务、训练或 benchmark 运行'}。\n\n${Object.entries(spec).map(([k,label])=>'- '+label+'：'+(r.checks[k]?'通过':'未通过')).join('\n')}\n\n导入只核验格式，不认证来源或真实系统效果。${r.my_explanation?.trim()?'\n\n我的解释：\n'+r.my_explanation.trim().slice(0,2500):''}`;
}
export function langgraphReportNote(text){
  if(typeof text!=='string'||text.length>50000)throw new Error('请选择不超过 50 KB 的 langgraph_report.json');
  let r;try{r=JSON.parse(text);}catch{throw new Error('实验记录不是有效 JSON');}
  if(r?.experiment!=='langgraph-durable-workflow'||r.data_scope!=='local SDK + SQLite subprocess experiment'||r.model_called!==false)throw new Error('这不是本篇支持的 LangGraph 实验记录');
  const versions=r.versions;if(!versions||!['langgraph','langgraph-checkpoint','langgraph-checkpoint-sqlite'].every(k=>typeof versions[k]==='string'&&/^\d+\.\d+\.\d+(?:[a-z0-9.+-]*)?$/i.test(versions[k])&&versions[k].length<40))throw new Error('SDK 版本记录不完整');
  const next=n=>Array.isArray(n)&&n.length<=4&&n.every(v=>['retrieve','draft','approve','save'].includes(v))&&new Set(n).size===n.length;
  if(!next(r.paused?.next)||!count(r.paused.before_interrupt)||![r.after_crash,r.recovered,r.rejected].every(s=>s&&[s.business_rows,s.write_attempts,s.before_interrupt].every(count)&&s.business_rows<=s.write_attempts)||![r.after_crash,r.recovered].every(s=>next(s.next))||!['thread_isolated','new_memory_empty','fork_requires_new_approval'].every(k=>typeof r[k]==='boolean')||!Array.isArray(r.reducer_keys)||r.reducer_keys.length>10||r.reducer_keys.some(k=>typeof k!=='string'||!/^[a-z0-9_-]{1,30}$/i.test(k))||new Set(r.reducer_keys).size!==r.reducer_keys.length)throw new Error('LangGraph 实验的状态、计数或边界记录无效');
  if(r.my_explanation!==undefined&&typeof r.my_explanation!=='string')throw new Error('实验解释须为文本');
  const status=values=>values.length?values.join('、'):'无待执行节点',check=value=>value?'通过':'未通过';
  let body=`## 代码实践 · LangGraph 恢复\n\n范围：真实 SDK、本地 SQLite 与独立子进程；固定教学材料，无模型调用。不是远端服务或多副本恢复证明。\n\n版本：LangGraph ${versions.langgraph}；checkpoint ${versions['langgraph-checkpoint']}；SQLite 插件 ${versions['langgraph-checkpoint-sqlite']}。\n\n| 观察时刻 | 待执行节点 | 业务结果数 | 保存调用数 | interrupt 前执行次数 |\n| --- | --- | --- | --- | --- |\n| 审批暂停 | ${status(r.paused.next)} | — | — | ${r.paused.before_interrupt} |\n| 写后硬退出 | ${status(r.after_crash.next)} | ${r.after_crash.business_rows} | ${r.after_crash.write_attempts} | ${r.after_crash.before_interrupt} |\n| 新进程恢复 | ${status(r.recovered.next)} | ${r.recovered.business_rows} | ${r.recovered.write_attempts} | ${r.recovered.before_interrupt} |\n| 拒绝审批 | — | ${r.rejected.business_rows} | ${r.rejected.write_attempts} | ${r.rejected.before_interrupt} |\n\n线程隔离：${check(r.thread_isolated)}；新内存 saver 为空：${check(r.new_memory_empty)}；新草稿拒绝旧审批：${check(r.fork_requires_new_approval)}。\n合并后的证据 ID：${r.reducer_keys.join('、')||'无'}。\n\n导入校验格式与计数关系，不认证文件的运行来源；未通过结果会如实保留。`;
  if(r.my_explanation?.trim())body+='\n\n我的解释：\n'+r.my_explanation.trim().slice(0,2500);
  return body;
}
