import {escapeHTML as esc} from './state.js';

export function interviewSelection(data,params){
  const categories=['全部',...new Set(data.questions.map(q=>q.category))];
  const direct=data.questions.some(q=>q.id===params.get('question'));
  const category=!direct&&categories.includes(params.get('category'))?params.get('category'):'全部';
  const query=direct?'':(params.get('q')||'').slice(0,200);
  const needle=query.trim().toLocaleLowerCase();
  const questions=data.questions.filter(q=>(category==='全部'||q.category===category)&&(!needle||[q.title,q.category,q.answer,...q.rubric].join(' ').toLocaleLowerCase().includes(needle)));
  return {categories,category,query,questions};
}
export function interviewFilterURL(params,changes){
  const next=new URLSearchParams(params);next.delete('question');next.delete('tab');
  for(const [key,value] of Object.entries(changes)){
    if(!['category','q'].includes(key))continue;
    if(value&&value!=='全部')next.set(key,String(value).slice(0,200));else next.delete(key);
  }
  return '/interview/'+(next.size?'?'+next:'');
}

export function createInterviewScreens({getData,link,ext,tag,icon,pageTitle}){
  function tabs(params){const data=getData(),selected=params.get('tab')||'training';return `<nav class="interview-tabs" aria-label="面试准备栏目">${[['training','能力训练',data.questions.length],['reports','公开面经',data.interviewReports.length],['resources','练习资料',data.interviewPracticeSources.length]].map(([id,name,count])=>`<a href="/interview/${id==='training'?'':'?tab='+id}" data-nav class="${selected===id?'active':''}" ${selected===id?'aria-current="page"':''}>${name}<span>${count}</span></a>`).join('')}</nav>`;}
  function reports(params){const data=getData(),company=params.get('company')||'全部',items=data.interviewReports.filter(r=>company==='全部'||r.company===company);return pageTitle('公开面经 / COMMUNITY REPORTS','公开面经与追问','作者分享与题意摘编，保留署名、日期和可读范围。经历与公司归属为作者陈述。')+`<div class="toolbar"><div class="filter-bar">${['全部',...new Set(data.interviewReports.map(r=>r.company))].map(c=>link('/interview/?tab=reports&company='+encodeURIComponent(c),esc(c),'filter-button '+(company===c?'active':''))).join('')}</div><span class="tiny muted">${items.length} 份公开材料</span></div><div class="report-list">${items.map(r=>`<article class="report-card"><div class="report-top"><span class="topic-label">${esc(r.company)}</span><span>${esc(r.platform)} · ${esc(r.evidence)}</span></div><h2>${esc(r.title)}</h2><p class="report-meta">${esc(r.author)} · ${esc(r.dateText)}</p><div class="tags">${r.topics.map(t=>tag(t)).join('')}</div><div class="report-content"><div><h3>面经题意摘编</h3><ul>${r.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul></div><div class="report-practice"><h3>把题目变成一次练习</h3><p>${esc(r.practice)}</p><div class="report-related">${r.questionRefs.map(id=>{const q=data.questions.find(q=>q.id===id);return q?link('/interview/?question='+id,esc(q.title),'text-link'):'';}).join('')}</div></div></div><footer><p>${esc(r.verification)} 核实 ${r.verifiedAt}。</p>${ext(r.url,'阅读原帖','button button-small')}</footer></article>`).join('')}</div>`;}
  function resources(){const data=getData();return pageTitle('练习与发现 / INTERVIEW REFERENCES','按问题练习，回到来源核验。','公开题库、作者整理和视频入口。题库数量或真题标签不代表本站逐题确认，也不代表企业官方题库。')+`<div class="interview-reference-list">${data.interviewPracticeSources.map(r=>`<article><span class="topic-label">${esc(r.platform)}</span><h2>${esc(r.title)}</h2><p>${esc(r.scope)}</p><small>${esc(r.verification)}</small>${ext(r.url,'打开资料','text-link')}</article>`).join('')}</div><div class="section-heading"><h2>继续发现面经</h2><span class="tiny muted">保留公开访问边界</span></div><div class="grid-2">${data.interviewDiscovery.map(r=>`<article class="panel"><h3>${esc(r.platform)}</h3><p>${esc(r.status)}</p><div class="tags">${r.queries.map(t=>tag(t)).join('')}</div><p style="margin-top:20px;margin-bottom:0">${ext(r.url,'打开平台搜索','text-link')}</p></article>`).join('')}</div>`;}
  return {tabs,reports,resources};
}
