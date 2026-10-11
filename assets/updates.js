import {escapeHTML as esc,safeURL} from './state.js';

export const releaseSources=[
  {repo:'langchain-ai/langgraph',title:'LangGraph'},
  {repo:'langchain-ai/deepagents',title:'Deep Agents'},
  {repo:'openai/codex',title:'Codex CLI'},
  {repo:'anthropics/claude-code',title:'Claude Code'},
  {repo:'harbor-framework/harbor',title:'Harbor'},
  {repo:'huggingface/trl',title:'TRL'}
];
export function validateReleaseCache(raw){const items={};if(!raw||typeof raw!=='object')return items;for(const source of releaseSources){const r=raw[source.repo];if(!r||typeof r!=='object')continue;try{const url=new URL(r.url);if(typeof r.version==='string'&&r.version.length<=100&&typeof r.publishedAt==='string'&&typeof r.checkedAt==='string'&&Number.isFinite(Date.parse(r.publishedAt))&&Number.isFinite(Date.parse(r.checkedAt))&&url.origin==='https://github.com'&&url.pathname.startsWith('/'+source.repo+'/releases/'))items[source.repo]={repo:source.repo,title:source.title,version:r.version,url:url.href,publishedAt:r.publishedAt,checkedAt:r.checkedAt};}catch{}if(typeof r.error==='string')items[source.repo]={...items[source.repo],error:r.error.slice(0,150)};}return items;}
export async function fetchRelease(source,fetcher=fetch){
  const response=await fetcher('https://api.github.com/repos/'+source.repo+'/releases/latest',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(response.status===403||response.status===429?'GitHub 请求限流':response.status===404?'没有可读取的 latest 发布':'发布信息读取失败');
  const raw=await response.json(),url=new URL(raw.html_url);
  if(url.origin!=='https://github.com'||!url.pathname.startsWith('/'+source.repo+'/releases/')||typeof raw.tag_name!=='string'||!Number.isFinite(Date.parse(raw.published_at))||raw.prerelease||raw.draft)throw new Error('发布信息格式不正确');
  return {repo:source.repo,title:source.title,version:raw.tag_name.slice(0,100),url:url.href,publishedAt:raw.published_at,checkedAt:new Date().toISOString()};
}
export class ReleaseUpdates{
  constructor({getData}){this.getData=getData;this.busy=false;this.items={};this.lastRequest=0;try{this.items=validateReleaseCache(JSON.parse(localStorage.getItem('suguilin.releaseCache')||'{}'));}catch{}
    document.addEventListener('click',e=>{if(e.target.closest('[data-refresh-releases]'))this.refresh();});
  }
  markup(){return `<section class="release-updates"><div class="section-heading"><div><span class="eyebrow">官方发布 / ON DEMAND</span><h2>关注工具的新变化</h2></div><button class="button button-small" data-refresh-releases ${this.busy?'disabled':''}>${this.busy?'正在检查…':'检查最新发布'}</button></div><p class="release-explanation">读取 GitHub 官方仓库的 latest 稳定发布；多包仓库的标签可能属于 CLI，不代表所有 SDK 的最新版。新版本仍需检查变更与兼容性。</p><div id="release-results" class="release-results">${this.results()}</div><div class="release-links">${(this.getData()?.updateSources??[]).filter(s=>s.kind!=='official-release-page').map(s=>`<a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('')}</div></section>`;}
  results(){return releaseSources.map(s=>{const r=this.items[s.repo];return `<article><div><strong>${esc(s.title)}</strong><span>${r?.version?esc(r.version):'尚未检查'}</span></div>${r?.version?`<a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener noreferrer">阅读发布说明 ↗</a><small>发布 ${esc(r.publishedAt.slice(0,10))} · 读取 ${esc(new Date(r.checkedAt).toLocaleString('zh-CN'))}</small>`:`<a href="https://github.com/${s.repo}/releases" target="_blank" rel="noopener noreferrer">打开官方发布页 ↗</a>`}${r?.error?`<small class="release-error">${esc(r.error)}${r.version?'；上方保留上次成功读取的结果':''}</small>`:''}</article>`;}).join('');}
  async refresh(){if(this.busy)return;if(Date.now()-this.lastRequest<60000){const root=document.querySelector('.release-explanation');if(root)root.textContent='请间隔一分钟再检查，避免公共来源限流。上方版本仍显示原读取时间。';return;}this.lastRequest=Date.now();this.busy=true;this.paint();await Promise.allSettled(releaseSources.map(async source=>{try{this.items[source.repo]=await fetchRelease(source);}catch(e){this.items[source.repo]={...this.items[source.repo],error:e.message};}}));try{localStorage.setItem('suguilin.releaseCache',JSON.stringify(this.items));}catch{}this.busy=false;this.paint();}
  paint(){const root=document.querySelector('.release-updates');if(root)root.outerHTML=this.markup();}
}
