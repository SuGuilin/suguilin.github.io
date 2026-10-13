import {discoveryInterests} from './learning-signals.js';
import {escapeHTML as esc} from './state.js';

export const discoveryProviders = [
  {id:'github',title:'GitHub 项目',description:'按相关性检索近期有代码更新的公开仓库'},
  {id:'papers',title:'论文元数据',description:'Crossref 近期发表记录；不代表已读论文全文'},
  {id:'community',title:'技术讨论',description:'Hacker News 新近讨论；社区观点需要核实'}
];
const topics=[['Jev 决策模型','Jev'],['Agent 系统','LLM agents'],['长程记忆','agent memory'],['Agent 评测','agent evaluation'],['强化学习','agent reinforcement learning'],['面试练习','LLM interview']];
const clean=(value,max=700)=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
const httpURL=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const hash=value=>{let a=2166136261,b=5381;for(const c of value){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(16)+(b>>>0).toString(16);};
export function normalizeQuery(value){const q=clean(value,101);if(!q||q.length>100)throw new Error('请填写 1–100 字的公开技术关键词');return topics.find(([title])=>q===title)?.[1]??q;}
export function normalizeDiscovery(raw){
  if(!raw||!discoveryProviders.some(p=>p.id===raw.provider))return null;
  const url=httpURL(raw.url),title=clean(raw.title,200),publishedAt=date(raw.publishedAt),checkedAt=date(raw.checkedAt);
  if(!url||!title||!publishedAt||!checkedAt)return null;
  return {id:'discovery-'+hash(url),provider:raw.provider,title,url,discussionURL:httpURL(raw.discussionURL),description:clean(raw.description),source:clean(raw.source,150),publishedAt,checkedAt,dateLabel:raw.provider==='github'?'代码更新':'发表',query:clean(raw.query,100)};
}
export async function searchProvider(provider,query,days=90,{fetcher=fetch,now=new Date()}={}){
  query=normalizeQuery(query);if(![7,30,90,365].includes(days))throw new Error('时间范围无效');
  const since=new Date(now.getTime()-days*86400000),sinceDate=since.toISOString().slice(0,10),today=now.toISOString().slice(0,10),checkedAt=now.toISOString();let endpoint;
  if(provider==='github')endpoint='https://api.github.com/search/repositories?'+new URLSearchParams({q:query+' in:name,description,topics archived:false fork:false pushed:>='+sinceDate,per_page:'6'});
  else if(provider==='community')endpoint='https://hn.algolia.com/api/v1/search_by_date?'+new URLSearchParams({query,tags:'story',hitsPerPage:'6',numericFilters:'created_at_i>'+Math.floor(since.getTime()/1000)+',created_at_i<='+Math.floor(now.getTime()/1000)});
  else if(provider==='papers')endpoint='https://api.crossref.org/works?'+new URLSearchParams({'query.title':query,filter:'from-pub-date:'+sinceDate+',until-pub-date:'+today,rows:'6',select:'DOI,title,publisher,published,URL'});
  else throw new Error('未知来源');
  const response=await fetcher(endpoint,{signal:AbortSignal.timeout(18000),headers:{Accept:'application/json'},credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error([403,429].includes(response.status)?'来源限流，请稍后重试':'来源暂不可用（'+response.status+'）');
  const body=await response.json();let records;
  if(provider==='github'){
    if(!Array.isArray(body.items))throw new Error('仓库搜索响应无效');
    records=body.items.slice(0,6).flatMap(r=>{
      const url=httpURL(r.html_url);if(!url||new URL(url).origin!=='https://github.com'||new URL(url).pathname!=='/'+r.full_name||r.archived||r.fork)return [];
      return [{title:r.full_name,url,description:r.description,source:'GitHub · '+clean(r.owner?.login,100),publishedAt:r.pushed_at}];
    });
  }else if(provider==='community'){
    if(!Array.isArray(body.hits))throw new Error('讨论搜索响应无效');
    records=body.hits.slice(0,6).flatMap(r=>/^\d{1,20}$/.test(r.objectID)?[{title:r.title,url:httpURL(r.url)||'https://news.ycombinator.com/item?id='+r.objectID,discussionURL:'https://news.ycombinator.com/item?id='+r.objectID,description:'讨论入口；原文内容与评论尚未阅读。',source:'Hacker News · '+clean(r.author,100),publishedAt:r.created_at}]:[]);
  }else{
    if(!Array.isArray(body.message?.items))throw new Error('论文搜索响应无效');
    records=body.message.items.slice(0,6).flatMap(r=>{
      const parts=r.published?.['date-parts']?.[0],doi=clean(r.DOI,200);if(!/^10\.\d{4,9}\/\S+$/.test(doi)||!parts||!Number.isInteger(parts[0]))return [];
      const month=parts[1]??1,day=parts[2]??1;if(month<1||month>12||day<1||day>31)return [];
      const publishedAt=parts[0]+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')+'T00:00:00.000Z';
      return [{title:r.title?.[0],url:'https://doi.org/'+encodeURI(doi),description:'已读取标题、出版方与发表日期等元数据；方法、结果及适用范围需要阅读全文确认。',source:'Crossref · '+clean(r.publisher,100),publishedAt}];
    });
  }
  const items=records.map(r=>normalizeDiscovery({...r,provider,query,checkedAt})).filter(r=>r&&Date.parse(r.publishedAt)>=since.getTime()-86400000&&Date.parse(r.publishedAt)<=now.getTime()).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  return {items,incomplete:body.incomplete_results===true,endpoint};
}
export function discoveryNote(item,now=new Date().toISOString()){
  const r=normalizeDiscovery(item);if(!r)throw new Error('资料格式无效');
  return {id:r.id,title:r.title,kind:'资料收件箱',tags:'实时发现, 待核实, '+discoveryProviders.find(p=>p.id===r.provider).title,createdAt:now,updatedAt:now,
    body:`# ${r.title}\n\n> 自动发现 · 待阅读全文核实。此记录不是已验证的知识总结。\n\n## 来源\n\n- 原始链接：${r.url}\n${r.discussionURL?'- 讨论链接：'+r.discussionURL+'\n':''}- 来源：${r.source}\n- ${r.dateLabel}日期：${r.publishedAt.slice(0,10)}\n- 检索时间：${r.checkedAt}\n- 检索词：${r.query}\n\n## 已读取的信息\n\n${r.description||'仅标题与来源元数据；尚未阅读正文。'}\n\n## 阅读与实践清单\n\n- [ ] 阅读原文，记录核心问题与方法\n- [ ] 区分作者结论、实验结果与个人推断\n- [ ] 检查版本、数据集、成本与适用边界\n- [ ] 与已有基线比较，设计最小复现实验\n\n## 我的要点与实验\n\n在这里补充阅读后的总结、关键信息和实际验证结果。\n`};
}
export function appendDiscoveryNotes(state,items){
  const notes=[...state.notes],ids=new Set(notes.map(n=>n.id));let added=0;
  for(const item of items){const note=discoveryNote(item);if(ids.has(note.id))continue;if(notes.length>=1000)break;notes.push(note);ids.add(note.id);added++;}
  return {state:{...state,notes},added};
}
export function discoverySummary({learned=0,unread=0,found=0,added=0,failures=0}){
  return `${learned?'生成 '+learned+' 个学习单元（要点、练习与计划）。':''}${unread?unread+' 条正文暂无法读取，可粘贴公开节选整理。':''}读取 ${found} 条结果，新增 ${added} 条到资料收件箱。${failures?failures+' 个来源读取失败，其他结果已保留。':''}${learned?'打开学习单元开始阅读与作答。':found?'选择一份资料，继续整理要点与练习。':'可换关键词或扩大时间范围。'}`;
}
export class KnowledgeDiscovery{
  constructor({getState,setState,persist,notify,study,getAccount=()=>''}){
    Object.assign(this,{getState,setState,persist,notify,study,getAccount});this.autoLearn=true;this.aiLearn=false;this.resultsExpanded=false;this.learningErrors={};this.query='LLM agents';this.days=30;this.busy=false;this.results={};this.message='';this.lastRequest=0;
    try{const saved=JSON.parse(localStorage.getItem('suguilin.discoveryCache')||'null');if(saved){this.query=normalizeQuery(saved.query);this.days=[7,30,90,365].includes(saved.days)?saved.days:90;for(const p of discoveryProviders){const r=saved.results?.[p.id];if(r)this.results[p.id]={items:(Array.isArray(r.items)?r.items:[]).slice(0,6).map(normalizeDiscovery).filter(Boolean),checkedAt:date(r.checkedAt),error:clean(r.error,150),incomplete:!!r.incomplete};}}}catch{}
    document.addEventListener('click',e=>{const b=e.target.closest('[data-study-source]');if(!b)return;const item=Object.values(this.results).flatMap(r=>r.items??[]).find(i=>i.id===b.dataset.studySource);if(item)this.study.openImport(item);});
    document.addEventListener('submit',e=>{if(e.target.id==='discovery-form'){e.preventDefault();this.refresh(e.target);}});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-discovery-topic]');if(b&&!this.busy){this.query=b.dataset.discoveryTopic;const input=document.querySelector('#discovery-query');if(input){input.value=this.query;input.focus();}}});
  }
  markup(){const count=this.getState().notes.filter(n=>n.kind==='资料收件箱').length,interests=discoveryInterests(this.getState());
    return `<section class="knowledge-discovery"><div class="section-heading"><div><h2>搜索并整理</h2></div><a href="/journal/?kind=inbox" data-nav class="text-link">资料收件箱${count?' '+count:''} ↗</a></div><p class="discovery-intro">检索 GitHub、论文与技术讨论，整理成可阅读、可练习的学习内容。</p><form id="discovery-form"><label for="discovery-query" class="sr-only">公开技术关键词</label><input id="discovery-query" name="query" type="search" maxlength="100" value="${esc(this.query)}" placeholder="例如 agent memory、LangGraph" required ${this.busy?'disabled':''}><label for="discovery-days" class="sr-only">发现时间范围</label><select id="discovery-days" name="days" ${this.busy?'disabled':''}>${[[7,'近 7 天'],[30,'近 30 天'],[90,'近 90 天'],[365,'近一年']].map(([n,t])=>`<option value="${n}" ${n===this.days?'selected':''}>${t}</option>`).join('')}</select><button class="button button-dark" type="submit" ${this.busy?'disabled':''}>${this.busy?'正在搜索…':'搜索并生成学习内容'} ↗</button></form><div class="discovery-options"><label><input form="discovery-form" type="checkbox" name="autoLearn" ${this.autoLearn?'checked':''}> 正文提炼 + 练习 + 加入计划（免费）</label><details class="discovery-method"><summary>整理方式与读取范围</summary><p>免费提炼摘取实际读取的正文，练习由规则组织。只读到摘要时标明范围；无法读取的资料可粘贴公开节选继续整理。</p><label><input form="discovery-form" type="checkbox" name="aiLearn" ${this.aiLearn?'checked':''} ${!this.study.platform.session?'disabled':''}> 使用站内 AI 深度整理（需 API；当前${this.study.platform.session?'可用':'待接入'}）</label></details></div><div class="discovery-topics">${interests.map(t=>`<button type="button" data-discovery-topic="${esc(t.query)}">继续关注 · ${esc(t.title)}</button>`).join('')}${topics.map(([t,q])=>`<button type="button" data-discovery-topic="${q}">${t}</button>`).join('')}</div><p class="discovery-status" role="status">${esc(this.message||'')}</p>${this.busy||Object.keys(this.results).length?'<details class="discovery-cache-results" '+(this.resultsExpanded?'open':'')+'><summary>'+ (this.resultsExpanded?'本次检索结果':'上次发现的资料 · 展开查看') +'</summary><div class="discovery-columns">'+discoveryProviders.map(p=>this.providerMarkup(p)).join('')+'</div></details>':''}<div class="discovery-external"><strong>继续在国内平台发现</strong>${[['微信公众号','https://weixin.sogou.com/weixin?type=2&query='],['小红书','https://www.xiaohongshu.com/search_result?keyword='],['牛客','https://www.nowcoder.com/search?query='],['知乎','https://www.zhihu.com/search?type=content&q='],['掘金','https://juejin.cn/search?query='],['B站','https://search.bilibili.com/all?keyword=']].map(([name,url])=>`<a href="${url+encodeURIComponent(this.query)}" target="_blank" rel="noopener noreferrer">${name} ↗</a>`).join('')}<small>这些入口需在原平台检索，部分需要登录。当前没有自动读取受限帖子或视频。</small></div></section>`;
  }
  providerMarkup(p){const r=this.results[p.id];const card=item=>{const unit=this.getState().studyUnits.find(u=>u.source.url===item.url);return `<article><div class="discovery-item-heading"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a><small>${item.dateLabel} ${item.publishedAt.slice(0,10)}</small></div><p>${esc(item.description||'打开来源继续阅读。')}</p>${unit?`<a href="/study/?id=${unit.id}" data-nav class="discovery-saved">✓ ${unit.mode==='ai'?'AI 整理':'正文提炼'} · ${unit.exercises.length} 道练习 · 已入计划 →</a>`:`<button class="text-link" data-study-source="${item.id}">${this.learningErrors[item.id]?'粘贴正文继续整理':'整理要点与练习'} →</button>${this.learningErrors[item.id]?'<small class="source-read-limit">'+esc(this.learningErrors[item.id])+'</small>':''}`}</article>`;};return `<section class="discovery-source"><header><strong>${p.title}</strong><small>${r?.checkedAt?'读取 '+new Date(r.checkedAt).toLocaleString('zh-CN'):'尚未搜索'}</small></header><p>${p.description}</p>${r?.error?`<div class="discovery-error">${esc(r.error)}${r.items?.length?' · 保留上次结果':''}</div>`:''}${r?.incomplete?'<div class="discovery-error">来源返回部分结果。</div>':''}${r?.items?.length?r.items.slice(0,3).map(card).join('')+(r.items.length>3?'<details class="discovery-more"><summary>展开其余 '+(r.items.length-3)+' 条资料</summary>'+r.items.slice(3).map(card).join('')+'</details>':''):`<div class="discovery-empty">${this.busy?'正在查询并读取正文…':r&&!r.error?'本范围暂无结果。':'搜索后，资料和学习单元会出现在这里。'}</div>`}</section>`;}
  paint(){const root=document.querySelector('.knowledge-discovery');if(root)root.outerHTML=this.markup();}
  async refresh(form){
    if(this.busy)return;
    try{this.query=normalizeQuery(new FormData(form).get('query'));this.days=Number(new FormData(form).get('days'));this.autoLearn=new FormData(form).has('autoLearn');this.aiLearn=new FormData(form).has('aiLearn');if(![7,30,90,365].includes(this.days))throw new Error('请选择时间范围');}catch(e){this.notify(e.message);return;}
    if(Date.now()-this.lastRequest<30000){this.notify('请间隔 30 秒再搜索，避免公共来源限流。');return;}
    this.lastRequest=Date.now();this.busy=true;this.resultsExpanded=true;this.message='正在并行检索三个公开来源…';const account=this.getAccount();this.paint();const fresh=[];
    await Promise.allSettled(discoveryProviders.map(async p=>{try{const r=await searchProvider(p.id,this.query,this.days);this.results[p.id]={...r,checkedAt:new Date().toISOString()};fresh.push(...r.items);}catch(e){this.results[p.id]={...this.results[p.id],error:e.name==='TimeoutError'?'来源响应超时，请稍后重试':e.message};}}));
    try{localStorage.setItem('suguilin.discoveryCache',JSON.stringify({query:this.query,days:this.days,results:this.results}));}catch{}
    const failures=discoveryProviders.filter(p=>this.results[p.id]?.error).length;
    try{if(account===this.getAccount()){
      const {state,added}=appendDiscoveryNotes(this.getState(),fresh);this.setState(state);const saved=this.persist();
      let learned=0,unread=0;if(this.autoLearn&&this.study&&saved){for(const item of fresh){if(account!==this.getAccount())break;if(this.getState().studyUnits.some(u=>u.source.url===item.url))continue;this.message='正在读取正文并生成学习内容：'+item.title;this.paint();try{await this.study.ingest(item,{ai:this.aiLearn});learned++;delete this.learningErrors[item.id];}catch(e){unread++;this.learningErrors[item.id]=e.message;}}}
      this.message=account!==this.getAccount()?'账号已切换，后续资料未保存。':saved?discoverySummary({learned,unread,found:fresh.length,added,failures}):'结果已展示，但本机保存失败，请立即导出备份。';
    }else this.message='检索期间账号已切换。结果已展示，未写入新账号。请重新搜索后保存。';
    }catch{this.message='检索完成，但保存未完成。结果仍在页面，可重试或导出已有记录。';}finally{this.busy=false;this.paint();}
  }
}
