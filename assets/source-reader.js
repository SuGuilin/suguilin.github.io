import {validateUnit} from './study-model.js';
const fail=()=>{throw new Error('此来源不能自动读取正文。请在原平台阅读后，粘贴公开正文或摘要。');};
const cleanHTML=v=>String(v??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot);/g,m=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[m])).replace(/\s+/g,' ').trim();
async function boundedText(response){
  if(!response.ok)throw new Error([403,429].includes(response.status)?'正文来源限流，请稍后重试':'正文暂不可用');
  const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>400000)throw new Error('正文超过读取上限，请选择公开摘要');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel().catch(()=>{});}
}
export async function readSource(raw,{fetcher=fetch,now=new Date()}={}){
  if(!raw||typeof raw.url!=='string'||raw.url.length>1500)fail();let url;try{url=new URL(raw.url);}catch{fail();}
  if(url.protocol!=='https:'||url.username||url.password)fail();
  let text,scope;
  const get=async(endpoint,accept='application/json')=>boundedText(await fetcher(endpoint,{headers:{Accept:accept},redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)}));
  if(url.hostname==='github.com'&&/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)){
    const [owner,repo]=url.pathname.split('/').filter(Boolean);text=await get(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,'application/vnd.github.raw+json');scope='仓库 README；未读取全部源码、Issue 或运行项目';
  }else if(url.hostname==='doi.org'&&/^\/10\.\d{4,9}\/.+/.test(decodeURI(url.pathname))){
    const record=JSON.parse(await get('https://api.crossref.org/works/'+encodeURIComponent(decodeURI(url.pathname.slice(1))))).message;
    if(!record?.abstract)fail();text=cleanHTML(record.abstract);scope='出版方提供的摘要；未阅读全文或核验实验结果';
  }else{
    const discussion=raw.discussionURL?new URL(raw.discussionURL):url;
    if(discussion.hostname!=='news.ycombinator.com'||discussion.pathname!=='/item'||!/^\d{1,20}$/.test(discussion.searchParams.get('id')||''))fail();
    const record=JSON.parse(await get('https://hn.algolia.com/api/v1/items/'+discussion.searchParams.get('id')));
    text=cleanHTML(record.text);if(text.length<250)fail();scope='HN 主帖正文；未读取外链文章、评论或验证作者观点';
  }
  text=text.replace(/<[^>]+>/g,' ').trim();if(text.length<250)throw new Error('可读正文太短，无法生成有依据的学习单元');
  const truncated=text.length>24000;text=text.slice(0,24000);
  return {title:String(raw.title||url.hostname).slice(0,200),url:url.href,scope:scope+(truncated?'；仅前 24,000 字符（已截断）':''),accessedAt:now.toISOString(),excerpt:text};
}
export function pastedSource(raw,text,now=new Date()){
  if(typeof text!=='string'||text.trim().length<250||text.length>24000)throw new Error('请粘贴 250–24,000 字符的公开正文或摘要');
  const url=new URL(raw.url);if(url.protocol!=='https:'||url.username||url.password)throw new Error('请选择 HTTPS 原始来源');
  return {title:String(raw.title).slice(0,200),url:url.href,scope:'用户粘贴的公开节选；未自动核实与原网页的一致性',accessedAt:now.toISOString(),excerpt:text.trim()};
}
export const sourceUnitId=url=>{let a=2166136261,b=5381;for(const c of url){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return 'study-'+(a>>>0).toString(16)+(b>>>0).toString(16);};
const statementLabel=text=>text.length<=120?text:text.slice(0,120).replace(/\s+\S*$/,'').trimEnd()+'…';
// Free, local, extractive fallback. Explicitly names its limits; it never
// invents a mechanism or a result from a search title or repository metadata.
export function extractiveUnit(source){
  const lines=source.excerpt.split(/\n|(?<=[。.!?])\s+/).map(raw=>({raw:raw.trim(),text:raw.replace(/^\s*[#>*-]+\s*/,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__/g,'').trim()})).filter(s=>s.text.length>=45&&s.text.length<=500&&!/https?:|^```|pip install|npm install|<img/i.test(s.text));
  const keywords=/agent|memory|tool|state|context|evaluat|recover|workflow|模型|工具|记忆|状态|评测|智能体|上下文/i;
  const score=s=>(keywords.test(s)?2:0)+(/checkpoint|persist|reconcil|operation identity|effective time|evidence|artifact|lease|timeout|transaction|bootstrap|logprob|gradient|idempoten|retry|retries|permission|budget|schema|mask|reward|baseline|latency|isolat|conflict|recover|对账|溯源|有效时间|租约|超时|事务|损失|梯度|检查点|持久|幂等|重试|权限|预算|约束|奖励|基线|隔离|冲突/i.test(s)?4:0)+(s.length>=90?1:0)-(/powerful|awesome|make your own|minimal, extensible|built for|强大|最佳|开箱即用/i.test(s)?3:0);
  const chosen=[...new Map(lines.map(s=>[s.text,s])).values()].map((s,index)=>({...s,index,score:score(s.text)})).filter(s=>s.score>=4&&!/^(?:api reference|tutorials?|quickstart|documentation|learn more|get started)\s*[:—-]/i.test(s.text)).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3);
  if(chosen.length<2)throw new Error('正文缺少足够的具体机制说明，暂保留为阅读线索。请补充技术章节，或使用 AI 整理。');
  // Keep the original Markdown span as evidence; removing links or emphasis
  // must not make an otherwise readable README lose its source grounding.
  const evidence=chosen.map(s=>s.raw.slice(0,160));
  const points=chosen.map(s=>s.text);
  const topics=[['长程记忆',/memory|记忆/i],['评测与实验',/evaluat|benchmark|评测/i],['工具与可靠性',/tool|recover|工具|恢复/i],['强化学习',/reinforcement|reward|强化|奖励/i]];
  const topic=topics.find(([,re])=>re.test(source.title+' '+evidence.join(' ')))?.[0]||'Agent 系统';
  const unit={id:sourceUnitId(source.url),title:source.title,topic,summary:'正文线索：'+points[0].slice(0,220)+'（正文摘取，未进行 AI 语义归纳或事实核验。）',mode:'extractive',minutes:30,prerequisites:['能够阅读技术文档；涉及术语可结合专题补齐'],
    takeaways:points.map((point,i)=>({point,evidence:evidence[i]})),pitfalls:['这些陈述来自作者，不能据此认定效果已被独立复现。','节选未包含的实现、数据与限制需要返回原文核实。'],
    exercises:[{prompt:`解释第一条陈述：${statementLabel(points[0])}`,hint:'先还原作者的对象、问题与方法；找不到的信息明确写“节选未说明”。',answer:`原文依据：${evidence[0]}\n围绕这条证据复述机制，区分明确陈述与自己的推断。节选不支持的实现或性能结论不能补写为事实。`,rubric:['准确复述原文对象与意图','列出至少一个尚需核实的问题']},
      {prompt:`针对“${statementLabel(points[1])}”，怎样设计一个能暴露失效边界的最小检查？`,hint:'明确这一陈述适用的对象、输入条件、需要观察的结果；先列出节选没有交代的条件。',answer:`原文依据：${evidence[1]}\n先写下这条陈述成立所需的条件；将一个条件改掉，比较正常与失败路径。记录输出、次数或状态，说明什么结果会反驳当前理解。节选未提供实现时，先返回技术章节核对；这里是练习思路，未声称运行。`,rubric:['检查对象直接对应这条正文陈述','验证包含基线与失败条件','不把计划写成已取得的结果']}],source,updatedAt:new Date().toISOString()};
  return validateUnit(unit);
}
