import {escapeHTML as esc} from './state.js';
export class ResourceCatalog{
  constructor(options){Object.assign(this,options);}
  syncURL(kind,changes={}){
    const params=new URLSearchParams(location.search);
    for(const [name,value] of Object.entries(changes)){
      const key={query:'q',category:'category',page:'page'}[name];
      if(key){if(value&&value!=='all'&&value!==1)params.set(key,String(value));else params.delete(key);}
    }
    params.delete('resource');history.replaceState({},'',`/${kind}/`+(params.size?'?'+params:''));
  }
  markup(kind){
    const {data,state}=this.getData(),params=new URLSearchParams(location.search),filter=Object.hasOwn(this.categories,params.get('category'))?params.get('category'):'all',query=(params.get('q')||'').slice(0,200);
    const base=kind==='saved'?data.resources.filter(r=>state.saved.includes(r.id)):kind==='radar'?data.resources.filter(r=>['framework','protocol','project','platform'].includes(r.category)):data.resources;
    const items=base.filter(r=>(filter==='all'||r.category===filter)&&(!query||[r.title,r.description,r.source,...r.tags,r.digest?.oneSentence||'',...(r.digest?.takeaways||[])].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));
    const allowed=Object.keys(this.categories).filter(c=>c==='all'||base.some(r=>r.category===c));
    const totalPages=Math.max(1,Math.ceil(items.length/18)),page=Math.max(1,Math.min(totalPages,Math.floor(Number(params.get('page')))||1)),visible=items.slice((page-1)*18,page*18);
    const pagination=totalPages>1?`<div class="catalog-pagination"><span>${page} / ${totalPages} 页 · 每页 18 条</span><div class="actions"><button class="button button-small" data-action="catalog-page" data-kind="${kind}" data-page="${page-1}" ${page===1?'disabled':''}>上一页</button><button class="button button-small" data-action="catalog-page" data-kind="${kind}" data-page="${page+1}" ${page===totalPages?'disabled':''}>下一页</button></div></div>`:'';
    const empty=!items.length?`<div class="empty-state"><h2>${kind==='saved'&&!base.length?'留下一份自己的阅读清单':'没有匹配的资料'}</h2><p>${kind==='saved'&&!base.length?'在知识库收藏资料，之后可以直接回到导读与练习。':'试试更短的关键词，或清除分类与搜索。'}</p>${kind==='saved'&&!base.length?this.link('/library/','探索知识库','button button-dark'):`<button class="button" data-action="catalog-clear" data-kind="${kind}">清除筛选</button>`}</div>`:'';
    return `<section class="resource-catalog" data-catalog="${kind}"><div class="toolbar"><div class="filter-bar" role="group" aria-label="资料分类">${allowed.map(c=>`<button class="filter-button ${filter===c?'active':''}" data-filter="${c}" data-kind="${kind}" aria-pressed="${filter===c}">${this.categories[c]}<small>${c==='all'?base.length:base.filter(r=>r.category===c).length}</small></button>`).join('')}</div><label class="search-field">${this.icon('search')}<input type="search" data-catalog-search="${kind}" value="${esc(query)}" placeholder="搜索主题、机制、标签或来源" aria-label="筛选${this.routeTitles[kind]}" maxlength="200" autocomplete="off"></label><div class="view-switch" role="group" aria-label="浏览布局"><button class="icon-button ${this.getView()==='grid'?'active':''}" data-action="catalog-view" data-view="grid" aria-label="网格视图" aria-pressed="${this.getView()==='grid'}">${this.icon('grid')}</button><button class="icon-button ${this.getView()==='list'?'active':''}" data-action="catalog-view" data-view="list" aria-label="列表视图" aria-pressed="${this.getView()==='list'}">${this.icon('list')}</button></div></div><div class="catalog-content"><div class="catalog-count" aria-live="polite">${items.length} 条资料${query||filter!=='all'?' · 已筛选':''} · 有导读的资料可直接阅读与练习</div><div class="resource-grid ${this.getView()==='list'?'list':''}" id="catalog-results">${visible.map(this.resourceCard).join('')}</div>${pagination}${empty}</div></section>`;
  }
  refresh(kind){
    const current=document.querySelector(`[data-catalog="${kind}"]`);if(!current)return;
    const template=document.createElement('template');template.innerHTML=this.markup(kind);
    current.querySelector('.catalog-content').replaceWith(template.content.querySelector('.catalog-content'));
    const params=new URLSearchParams(location.search),category=params.get('category')||'all';
    for(const b of current.querySelectorAll('[data-filter]')){const active=b.dataset.filter===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
    for(const b of current.querySelectorAll('[data-view]')){const active=b.dataset.view===this.getView();b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
    this.updateCounts();
  }
}
