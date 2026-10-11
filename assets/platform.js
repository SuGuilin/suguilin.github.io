import {createClient} from './vendor/supabase.js';
import {STORAGE_KEY,defaultState,validateState,mergeBackupStates,escapeHTML as esc,safeURL} from './state.js';
import {SyncEngine} from './sync.js';
import {renderMarkdown} from './markdown.js';
import {createZip,vaultFiles} from './backup.js';
import {questionWithContext,saveStudySnapshot,studyReturnURL,studyQuestion} from './study-session.js';
import {newProgress} from './study-model.js';

export class LearningPlatform {
  constructor({getState,setState,getKnowledge=()=>({resources:[],lessons:[]}),notify,onRender}) {
    Object.assign(this,{getState,setState,getKnowledge,notify,onRender});
    this.client=null;this.session=null;this.syncEngine=null;this.status={status:'local'};this.activeChat='';this.context={};this.controller=null;this.busy=false;this.sources=[];this.lastBackup=null;this.error='';this.cooldown=0;this.drafts=new Map();this.seedQuestions=new Map();this.webSearch=false;
    document.addEventListener('change',e=>{if(e.target.name==='webSearch')this.webSearch=e.target.checked;});
    document.addEventListener('input',e=>{if(e.target.matches('[name=question]'))this.drafts.set(this.draftKey(),e.target.value);});
    document.addEventListener('click',e=>{const b=e.target.closest?.('[data-platform]');if(b){e.preventDefault();this.action(b).catch(error=>this.notify(error.message||'操作失败，请重试。'));}});
    document.addEventListener('submit',e=>{if(e.target.matches('#login-form,#otp-form,.chat-composer')){e.preventDefault();this.submit(e.target).catch(error=>this.notify(error.message||'操作失败，请重试。'));}});
    document.addEventListener('keydown',e=>{if(e.target.matches('[name=question]')&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();e.target.closest('form').requestSubmit();}});
    window.addEventListener('online',()=>this.syncEngine?.sync());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.syncEngine?.sync();});
    this.timer=setInterval(()=>{if(!document.hidden&&navigator.onLine)this.syncEngine?.sync();},30000);
  }
  async init(){
    try{const r=await fetch('/assets/public-config.json',{cache:'no-store'});if(!r.ok)throw new Error('连接配置未能载入');this.config=await r.json();
      if(!this.config.supabaseUrl||!this.config.supabasePublishableKey){this.updateStatus({status:'unconfigured'});return;}
      const url=new URL(this.config.supabaseUrl),key=this.config.supabasePublishableKey;let publicKey=key.startsWith('sb_publishable_');
      if(!publicKey)try{publicKey=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{}
      if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||!publicKey||!/^[a-zA-Z0-9_-]+$/.test(this.config.assistantFunction)||this.config.synthesisFunction&&!/^[a-zA-Z0-9_-]+$/.test(this.config.synthesisFunction))throw new Error('连接配置不正确');
      this.client=createClient(url.origin,this.config.supabasePublishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
      this.client.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','INITIAL_SESSION','TOKEN_REFRESHED'].includes(event))setTimeout(()=>this.accountChanged(session),0);});
      const {data,error}=await this.client.auth.getSession();if(error)throw error;await this.accountChanged(data.session);
    }catch(error){this.updateStatus({status:'error',message:error.message});}
  }
  async accountChanged(session){
    if(session?.user.id===this.session?.user.id){this.session=session;return;}
    this.controller?.abort();this.syncEngine?.stop();this.syncEngine=null;this.session=session;this.activeChat='';this.context={};this.drafts.clear();this.seedQuestions.clear();
    if(!session){let state=defaultState();try{state=validateState(JSON.parse(localStorage.getItem(STORAGE_KEY)||JSON.stringify(state)));}catch{}this.setState(state);this.updateStatus({status:this.client?'guest':'unconfigured'});this.onRender();return;}
    const key='suguilin.cloud.v1.'+session.user.id;
    this.syncEngine=new SyncEngine({client:this.client,storage:localStorage,key,onChange:next=>{const changed=JSON.stringify(this.getState())!==JSON.stringify(next);this.setState(next);if(changed&&!document.querySelector('#note-form')&&!this.chatInput()?.value&&!this.busy&&!document.querySelector('.study-reader textarea:focus,#source-import-form'))this.onRender();},onStatus:s=>this.updateStatus(s)});
    this.setState(this.syncEngine.state());this.onRender();await this.syncEngine.sync();
  }
  persist(){
    try{if(this.syncEngine){this.syncEngine.capture(this.getState());clearTimeout(this.syncDelay);this.syncDelay=setTimeout(()=>this.syncEngine?.sync(),600);}else localStorage.setItem(STORAGE_KEY,JSON.stringify(this.getState()));return true;}
    catch{this.updateStatus({status:'error',message:'本机存储已满，请立即导出备份。'});this.notify('未能保存到本机，请导出备份。');return false;}
  }
  updateStatus(status){this.status={...this.status,...status};const text=this.statusText();for(const el of document.querySelectorAll('[data-sync-label]'))el.textContent=text;const b=document.querySelector('#account-entry');if(b){b.classList.toggle('sync-error',['error','conflict'].includes(status.status));b.title=text;}if(location.pathname==='/account/'&&!document.querySelector('#login-form,#otp-form'))this.onRender();}
  statusText(){return {unconfigured:'本机保存 · 云端待连接',local:'本机保存',guest:'本机保存 · 未登录',syncing:'正在同步',pending:`等待同步 · ${this.status.count??0} 项`,synced:'已同步',conflict:`有 ${this.status.conflicts??0} 项冲突`,error:'同步未完成 · 本机已保留'}[this.status.status]||'本机保存';}
  storageLabel(){return this.session?'账号私有记录 · '+this.statusText():'仅保存在此浏览器';}
  accountView(){
    const state=this.getState(),conflicts=this.syncEngine?[...this.syncEngine.conflicts]:[];
    const backupDate=localStorage.getItem('suguilin.lastBackup');
    return `<div class="page-title"><span class="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>账号与备份</h1><p>让笔记、收藏、学习进度与对话跟着你走。</p></div>
      <div class="account-grid"><section class="panel account-panel"><div class="section-kicker">01 / ACCOUNT</div><h2>${this.session?'个人学习账号':'登录，继续你的学习。'}</h2>
      ${this.session?`<div class="account-identity"><span class="avatar">SG</span><div><strong>${esc(this.session.user.email??'个人账号')}</strong><small data-sync-label>${esc(this.statusText())}</small></div></div><p class="muted">记录按账号隔离。同步失败时，修改会留在本机等待重试。</p><div class="actions"><button class="button button-dark" data-platform="sync">立即同步</button><button class="button" data-platform="logout">退出登录</button></div><button class="text-link" data-platform="import-guest">合并登录前的本机记录</button>`:
      this.client?`<p class="muted">邮箱登录，无需设置密码。只有已授权的个人账号能够访问云端工作台。</p><form id="login-form"><label for="login-email">邮箱地址</label><input id="login-email" name="email" type="email" required autocomplete="email" placeholder="你的邮箱"><button class="button button-dark" type="submit">发送登录邮件 ${arrow()}</button><p id="login-status" role="status"></p></form>`:
      `<div class="connection-empty"><span class="connection-symbol">↗</span><h3>云端连接正在准备中</h3><p>当前可以阅读、练习、记录和导出。Supabase 接入后，在这里登录并合并你的本机记录。</p><a class="button" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">打开 Supabase 控制台 ${arrow()}</a></div>`}
      ${this.status.status==='error'?`<div class="inline-error" role="status">${esc(this.status.message||'请检查网络、服务状态或账号授权，再重试。')}</div>`:''}</section>
      <section class="panel account-panel"><div class="section-kicker">02 / BACKUP & RESTORE</div><h2>一份随时可带走的备份</h2><p class="muted">导出当前可见账号的记录；未登录时导出本机记录。导入先预览，再合并，保留已有内容。</p><div class="backup-metrics"><span><b>${state.notes.length}</b>篇笔记</span><span><b>${state.saved.length}</b>条收藏</span><span><b>${state.conversations.length}</b>段对话</span><span><b>${state.studyUnits.length}</b>学习单元</span><span><b>${state.studyProgress.length}</b>作答与计划</span></div><div class="actions"><button class="button button-dark" data-platform="backup">导出完整备份 ${arrow()}</button><button class="button" data-platform="restore">导入备份</button><button class="button" data-platform="obsidian">导出 Obsidian</button><input id="platform-import" type="file" accept="application/json,.json" hidden></div><p class="backup-date">${backupDate?'上次导出：'+esc(new Date(backupDate).toLocaleString('zh-CN')):'还未导出备份。开始记录后，建议每周备份一次。'}</p><div class="backup-note">免费云端服务可能因闲置暂停。离线缓存与手动备份，让学习记录始终可恢复。</div></section></div>
      ${conflicts.length?`<section class="panel conflict-panel"><h2>两处修改，先保留再决定。</h2><p>同一条记录在不同设备上修改过。请检查两个版本；下方可以分别导出，不会自动覆盖。</p>${conflicts.map(([key,c])=>`<article class="sync-conflict"><h3>${esc(c.local.value?.title||key)}</h3><div class="conflict-versions"><div><strong>此设备</strong><pre>${esc(c.local.deleted?'已删除':JSON.stringify(c.local.value,null,2))}</pre></div><div><strong>云端</strong><pre>${esc(c.remote?.deleted?'已删除':JSON.stringify(c.remote?.value??null,null,2))}</pre></div></div><div class="actions"><button class="button" data-platform="conflict-export" data-key="${esc(key)}">导出两份版本</button><button class="button" data-platform="conflict-local" data-key="${esc(key)}">使用此设备版本</button><button class="button" data-platform="conflict-remote" data-key="${esc(key)}">使用云端版本</button></div></article>`).join('')}</section>`:''}
      <section class="privacy-strip"><span>你的记录属于你。</span><p>公开课程可以直接阅读。个人记录不会提交到 GitHub；使用站内 AI 问答或资料整理时，选定的对话、学习上下文或公开正文会发送给模型服务。复制会员任务后，由你在官网粘贴。</p></section>`;
  }
  chatView(){
    const chats=[...this.getState().conversations].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    return `<div class="page-title row"><div><span class="eyebrow">LEARNING WITH AI</span><h1>学习助手</h1><p>围绕机制、源码与实验，把问题研究透。</p></div><button class="button" data-platform="new-chat">＋ 新对话</button></div><div class="assistant-layout"><aside class="conversation-sidebar"><span class="section-kicker">RECENT CONVERSATIONS</span>${chats.length?chats.map(c=>`<button class="conversation-item ${this.activeChat===c.id?'active':''}" data-platform="chat" data-id="${c.id}"><strong>${esc(c.title)}</strong><small>${new Date(c.updatedAt).toLocaleDateString('zh-CN')}</small></button>`).join(''):`<p class="muted">你的问题会留在这里。<br>从一段源码或一个失败案例开始。</p>`}<a href="/account/" data-nav class="conversation-sync"><span data-sync-label>${esc(this.statusText())}</span>查看账号与备份 ${arrow()}</a></aside><section class="assistant-main">${this.chatBody()}</section></div>`;
  }
  draftKey(){return this.context.studyUnit?'unit:'+this.context.studyUnit.id+':'+(this.context.exerciseId||'reading'):this.activeChat||'new';}
  contextFor(chat){const unit=this.getKnowledge().studyUnits?.find(u=>u.id===chat?.studyUnitId);return unit?{studyUnit:unit,title:unit.title,lessonId:this.getKnowledge().lessons?.some(l=>l.id===unit.id)?unit.id:''}:{};}
  chatBody(){const chat=this.getState().conversations.find(c=>c.id===this.activeChat),messages=chat?.messages??[],ready=!!(this.client&&this.session);const suggestions=this.context.studyUnit?['帮我检查这段理解的假设和边界','给我一个能验证这个机制的最小实验','用一个反例帮助我理解']:['如何设计可恢复的 Agent Harness？','工具超时后，怎样避免重复写入？','帮我设计一个评测与消融实验'];
    return `<div class="assistant-context"><span class="ai-symbol">✳</span><div><strong>SuGuilin 学习助手</strong><small>${this.context.title?'正在讨论：'+esc(this.context.title):'深入理解 · 可复现实验 · 证据与来源'}</small></div><span class="assistant-status">${ready?'站内 AI 已连接':'官网提问 / 本机记录'}</span></div>
    <div class="chat-messages" aria-live="polite" aria-relevant="additions text">${messages.length?messages.map((m,i)=>this.messageHTML(m,i)).join(''):`<div class="chat-welcome"><h2>${this.context.studyUnit?'沿着当前内容继续思考':'记下你想研究的问题'}</h2><p>${ready?'问题会带上学习内容发送，回答可以存入日志。':'复制问题与学习上下文，到 Gemini 或 ChatGPT 官网提问；也可以先把疑问存入日志。'}</p><div class="question-suggestions">${suggestions.map(q=>`<button data-platform="suggest" data-question="${esc(q)}">${esc(q)} ${arrow()}</button>`).join('')}</div></div>`}</div>
    ${this.error?`<div class="inline-error" role="status">${esc(this.error)} <button data-platform="retry">重新尝试</button></div>`:''}
    <form class="chat-composer"><textarea aria-label="向学习助手提问" name="question" rows="3" maxlength="6000" placeholder="输入你的问题、代码片段或实验现象…" ${this.busy?'disabled':''}>${esc(this.drafts.get(this.draftKey())||'')}</textarea>${ready?`<label class="chat-web-search"><input name="webSearch" type="checkbox" ${this.webSearch?'checked':''} ${!this.config?.enableWebSearch||this.busy?'disabled':''}> ${this.config?.enableWebSearch?'联网查找最新资料（另计 API 费用）':'联网检索待配置'}</label>`:''}<div class="composer-bottom"><span>${this.busy?'正在生成，可随时停止':ready?'发送问题与当前学习上下文 · Enter 发送':'Enter 复制 · Shift + Enter 换行'}</span>${this.busy?'<button type="button" class="button button-dark" data-platform="stop">停止</button>':`<button type="submit" class="button button-dark">${ready?'发送问题':'复制问题与上下文'} ${arrow()}</button>`}</div></form><div class="question-handoff"><button class="text-link" data-platform="save-question">保存疑问到日志</button>${ready?'<button class="text-link" data-platform="copy-question">复制问题与上下文</button>':''}<a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">Gemini ↗</a><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT ↗</a></div><div class="question-save-result" role="status"></div><div class="assistant-foot"><span data-sync-label>${esc(this.statusText())}</span>${this.context.studyUnit?`<a href="${studyReturnURL(this.context.studyUnit,this.context.section)}" data-platform="return-study">回到当前学习 ↗</a>`:''}</div>`;
  }
  messageHTML(message,i){return `<article class="chat-message ${message.role}"><div class="message-role">${message.role==='user'?'你':'学习助手'} ${message.status!=='complete'?'<span>· '+(message.status==='interrupted'?'已停止':'未完成')+'</span>':''}</div><div class="markdown-body">${renderMarkdown(message.content)}</div>${message.role==='assistant'?`<button class="text-link" data-platform="save-answer" data-index="${i}">保存到学习日志 ${arrow()}</button>`:''}</article>`;}
  chatRoot(){return document.querySelector('#assistant-dialog[open] #assistant-content')??document.querySelector('.assistant-main');}
  chatInput(){return this.chatRoot()?.querySelector('[name=question]');}
  openAssistant(context={}){if(this.busy){this.notify('先停止当前回答，再切换学习问题');return;}document.querySelector('#detail-dialog[open]')?.close();const current=this.getState().conversations.find(c=>c.id===this.activeChat);if(context.studyUnit?.id!==current?.studyUnitId)this.activeChat=[...this.getState().conversations].filter(c=>context.studyUnit&&c.studyUnitId===context.studyUnit.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]?.id||'';this.context=context;const key=this.draftKey();if(context.question){if(!this.drafts.has(key)||this.drafts.get(key)===this.seedQuestions.get(key))this.drafts.set(key,context.question);this.seedQuestions.set(key,context.question);}this.error='';const dialog=document.querySelector('#assistant-dialog');document.querySelector('#assistant-content').innerHTML=`<div class="assistant-drawer-head"><span>随文提问</span><button class="icon-button" data-platform="close-assistant" aria-label="关闭学习助手">×</button></div>${this.chatBody()}`;dialog.showModal();this.chatInput()?.focus();}
  refreshChat(){const root=document.querySelector('#assistant-dialog[open] #assistant-content')??document.querySelector('.assistant-main');if(root){root.innerHTML=(root.id==='assistant-content'?'<div class="assistant-drawer-head"><span>随文提问</span><button class="icon-button" data-platform="close-assistant" aria-label="关闭学习助手">×</button></div>':'')+this.chatBody();root.querySelector('.chat-messages')?.lastElementChild?.scrollIntoView({block:'nearest'});}}
  currentChat(){let chat=this.getState().conversations.find(c=>c.id===this.activeChat);if(!chat){if(this.getState().conversations.length>=500)throw new Error('对话已满，请先导出备份并整理旧对话');chat={id:crypto.randomUUID(),title:'新的学习对话',messages:[],updatedAt:new Date().toISOString(),...(this.context.studyUnit?{studyUnitId:this.context.studyUnit.id}:{})};this.getState().conversations.push(chat);this.activeChat=chat.id;}return chat;}
  async send(question){
    if(this.busy)return;if(!question.trim())return;
    if(!this.client||!this.session){await this.copyQuestion(question);return;}
    const draftKey=this.draftKey(),chat=this.currentChat();if(chat.messages.length>=100||new TextEncoder().encode(JSON.stringify(chat)).length>800000){this.notify('这段对话已较长，请开始新对话。');return;}
    chat.messages.push({role:'user',content:question,status:'complete'});if(chat.messages.length===1)chat.title=question.slice(0,60);chat.updatedAt=new Date().toISOString();
    this.drafts.delete(draftKey);this.sources=[];
    const answer={role:'assistant',content:'',status:'interrupted'};chat.messages.push(answer);this.persist();this.busy=true;this.error='';this.controller=new AbortController();this.refreshChat();let complete=false,lastCheckpoint=Date.now();const accountId=this.session.user.id;
    try{const {data,error}=await this.client.auth.getSession();if(error||!data.session)throw new Error('登录已过期，请重新登录。');
      const candidates=chat.messages.slice(0,-1).filter(m=>m.content.trim()).slice(-16);const messages=[];let budget=30000;
      for(const m of candidates.reverse()){const content=m.content.slice(0,Math.min(6000,budget));if(!content)break;messages.unshift({role:m.role,content});budget-=content.length;}
      const response=await fetch(this.config.supabaseUrl+'/functions/v1/'+this.config.assistantFunction,{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,apikey:this.config.supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({messages,lessonId:this.context.lessonId??'',resourceId:this.context.resourceId??'',webSearch:this.webSearch&&this.config.enableWebSearch===true,studyUnit:this.context.studyUnit??undefined}),signal:this.controller.signal});
      if(!response.ok){let errorBody;try{errorBody=await response.json();}catch{}throw new Error(errorBody?.error||'服务暂不可用，请稍后重试。');}
      if(!response.body)throw new Error('响应内容为空。');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;
        while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;const event=JSON.parse(line);
          if(event.type==='sources')this.sources=event.sources;
          if(event.type==='final-text')answer.content=event.text.slice(0,38000);
          if(event.type==='delta'){answer.content=(answer.content+event.text).slice(0,38000);if(Date.now()-lastCheckpoint>2000&&this.session?.user.id===accountId){this.persist();lastCheckpoint=Date.now();}const el=this.chatRoot()?.querySelector('.chat-messages .chat-message:last-child .markdown-body');if(el)el.innerHTML=renderMarkdown(answer.content);if(answer.content.length>=38000)throw new Error('回答过长，已停止。');}
          if(event.type==='done')complete=true;
          if(event.type==='error')throw new Error(event.message);
        }if(done)break;
      }}finally{reader.releaseLock();}
      if(!complete)throw new Error('连接中断，已有回答已保留。');
      if(this.sources.length)answer.content=(answer.content+'\n\n## 参考来源\n'+this.sources.map((s,i)=>`${i+1}. [${s.title.replace(/[\[\]\n]/g,' ')}](${safeURL(s.url)})${s.kind==='web-search'?' · 本次联网来源':' · 课程来源'}`).join('\n\n')).slice(0,40000);
      answer.status='complete';
    }catch(error){answer.status=error.name==='AbortError'?'interrupted':'error';this.error=error.name==='AbortError'?'已停止生成，已有内容会保留。':error.message;}
    finally{this.controller?.abort();this.controller=null;this.busy=false;chat.updatedAt=new Date().toISOString();if(this.session?.user.id===accountId){this.persist();this.refreshChat();}}
  }
  async copyQuestion(question=this.chatInput()?.value||''){const text=questionWithContext(question,this.context.studyUnit);await navigator.clipboard.writeText(text);this.notify('问题与学习上下文已复制，可到 Gemini / ChatGPT 官网粘贴');}
  saveQuestion(){const question=this.chatInput()?.value||'';if(!question.trim())throw new Error('先写下你的问题');const unit=this.context.studyUnit;let note;if(unit){const p=this.getState().studyProgress.find(p=>p.id===unit.id)||newProgress(unit);const result=saveStudySnapshot(this.getState(),unit,p,{question:questionWithContext(question,unit),section:this.context.section});this.setState(result.state);note=result.note;}else{if(this.getState().notes.length>=1000)throw new Error('日志已满，请先导出备份');const now=new Date().toISOString();note=this.getState().notes.find(n=>n.kind==='待解答问题'&&n.body===question);if(!note){note={id:crypto.randomUUID(),title:question.slice(0,100),body:question,kind:'待解答问题',tags:'',createdAt:now,updatedAt:now};this.getState().notes.push(note);}}const saved=this.persist();this.chatRoot()?.querySelector('.question-save-result')?.replaceChildren();const el=this.chatRoot()?.querySelector('.question-save-result');if(el)el.innerHTML=saved?`疑问已保留 · <a href="/journal/?id=${note.id}" data-nav>查看日志 ↗</a>`:'本机保存失败，请立即导出备份';}
  download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  backup(){this.download('SuGuilin-backup-'+new Date().toISOString().slice(0,10)+'.json',this.getState());localStorage.setItem('suguilin.lastBackup',new Date().toISOString());this.notify('完整备份已导出，包含笔记、收藏、进度和对话。');if(location.pathname==='/account/')this.onRender();}
  async action(button){const action=button.dataset.platform;
    if(action==='obsidian'){const blob=createZip(vaultFiles(this.getState(),this.getKnowledge()));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SuGuilin-Obsidian-'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);localStorage.setItem('suguilin.lastBackup',new Date().toISOString());this.notify('Obsidian 备份已导出，解压后即可打开。');}
    if(action==='assistant'){const id=button.dataset.lesson||(button.dataset.resourceId?'digest-'+button.dataset.resourceId:document.querySelector('.study-reader')?.dataset.unit),unit=this.getKnowledge().studyUnits?.find(u=>u.id===id);this.openAssistant(unit?{lessonId:this.getKnowledge().lessons?.some(l=>l.id===id)?id:'',title:unit.title,studyUnit:unit,question:studyQuestion(unit,this.getState().studyProgress.find(p=>p.id===id)||newProgress(unit))}:{lessonId:button.dataset.lesson,resourceId:button.dataset.resourceId,title:button.dataset.title});}
    if(action==='close-assistant')document.querySelector('#assistant-dialog').close();
    if(action==='copy-question')await this.copyQuestion();
    if(action==='save-question')this.saveQuestion();
    if(action==='return-study'){const dialog=document.querySelector('#assistant-dialog[open]');if(dialog)dialog.close();else location.assign(button.getAttribute('href'));}
    if(action==='stop')this.controller?.abort();
    if(action==='new-chat'){this.activeChat='';this.context={};this.error='';this.onRender();}
    if(action==='chat'){this.activeChat=button.dataset.id;this.context=this.contextFor(this.getState().conversations.find(c=>c.id===this.activeChat));this.error='';this.onRender();}
    if(action==='suggest'){const input=this.chatInput();const q=button.dataset.question;input.value=this.context.studyUnit&&input.value.trim()?(input.value.trim().endsWith(q)?input.value:input.value.trim().slice(0,5998-q.length)+'\n\n'+q):q;this.drafts.set(this.draftKey(),input.value);input.focus();}
    if(action==='retry'){const chat=this.getState().conversations.find(c=>c.id===this.activeChat);const question=chat?.messages.filter(m=>m.role==='user').at(-1)?.content;if(question){const input=this.chatInput();input.value=question;input.focus();}else this.notify('请填写问题后发送。');}
    if(action==='sync')await this.syncEngine?.sync();
    if(action==='logout'){if(this.syncEngine?.pending.size){this.notify('还有未同步修改，请先同步或导出备份，再退出。');return;}const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;}
    if(action==='backup')this.backup();
    if(action==='restore'){let file=document.querySelector('#platform-import');if(!file){file=document.createElement('input');file.id='platform-import';file.type='file';file.accept='application/json,.json';file.hidden=true;document.body.append(file);}file.onchange=async()=>{try{const selected=file.files[0];if(!selected)return;if(selected.size>10*1024*1024)throw new Error('备份大于 10 MB，请拆分后导入。');const incoming=validateState(JSON.parse(await selected.text()));this.previewImport(incoming);}catch(error){this.notify('无法导入：'+error.message);}file.value='';};file.click();}
    if(action==='confirm-restore'){this.setState(mergeBackupStates(this.getState(),this.importing).state);if(!this.persist())throw new Error('导入内容仍在当前页面内存中，请立即导出备份；本机存储未能写入。');document.querySelector('#detail-dialog').close();this.importing=null;this.onRender();this.notify('备份已合并，有差异的记录保留两份。');}
    if(action==='import-guest'){let incoming;try{incoming=validateState(JSON.parse(localStorage.getItem(STORAGE_KEY)||JSON.stringify(defaultState())));}catch{throw new Error('本机记录无法读取，请检查备份。');}this.previewImport(incoming);}
    if(action.startsWith('conflict-')){const key=button.dataset.key,c=this.syncEngine.conflicts.get(key);if(!c)return;if(action==='conflict-export')this.download('SuGuilin-conflict.json',c);else await this.syncEngine.resolve(key,action==='conflict-local'?'local':'remote');this.onRender();}
    if(action==='save-answer'){if(this.getState().notes.length>=1000)throw new Error('日志已满，请先导出备份');const chat=this.getState().conversations.find(c=>c.id===this.activeChat),m=chat?.messages[Number(button.dataset.index)];if(!m?.content)return;const now=new Date().toISOString();this.getState().notes.push({id:crypto.randomUUID(),title:chat.title,kind:'学习复盘',tags:'AI 学习, 待验证',body:m.content+(this.context.studyUnit?'\n\n[回到学习单元]('+studyReturnURL(this.context.studyUnit,this.context.section)+')':''),createdAt:now,updatedAt:now});this.persist();this.notify('回答已存入学习日志，请用实验核验其中结论。');}
  }
  previewImport(incoming){this.importing=incoming;const {conflicts}=mergeBackupStates(this.getState(),incoming);const content=document.querySelector('#detail-content');content.innerHTML=`<div class="detail-inner"><h2 id="detail-title">确认合并这份备份</h2><p>${incoming.notes.length} 篇笔记 · ${incoming.saved.length} 条收藏 · ${incoming.conversations.length} 段对话 · ${incoming.studyUnits.length} 个学习单元 · ${incoming.studyProgress.length} 条作答与计划</p><p>原有记录保留。${conflicts?conflicts+' 项内容差异会另存保留版本。':'未发现需要另存的内容差异。'}学习进度与收藏合并。登录后，新增内容会同步到当前账号。</p><div class="actions"><button class="button button-dark" data-platform="confirm-restore">确认合并</button><button class="button" data-close-dialog>取消</button></div></div>`;document.querySelector('#detail-dialog').showModal();}
  async submit(form){
    if(form.matches('.chat-composer')){await this.send(new FormData(form).get('question'));return;}
    if(!this.client)return;
    const button=form.querySelector('button[type=submit]');button.disabled=true;
    try{if(form.id==='login-form'){
      if(Date.now()<this.cooldown)throw new Error('请稍等一分钟后再请求登录邮件。');
      const email=String(new FormData(form).get('email')).trim();const {error}=await this.client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+'/account/'}});if(error)throw error;
      this.cooldown=Date.now()+60000;document.querySelector('#login-status').textContent='登录邮件已发送。点击邮件中的链接返回；如果邮件包含验证码，可在下方填写。';
      if(!document.querySelector('#otp-form'))form.insertAdjacentHTML('afterend',`<form id="otp-form"><input name="email" type="hidden" value="${esc(email)}"><label for="login-code">邮件中的验证码</label><input id="login-code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6,10}" autocomplete="one-time-code" required><button type="submit" class="button">验证并登录</button></form>`);
    }else{const fields=new FormData(form);const {error}=await this.client.auth.verifyOtp({email:String(fields.get('email')),token:String(fields.get('code')).trim(),type:'email'});if(error)throw error;this.notify('登录成功，正在载入你的记录。');}
    }finally{button.disabled=false;}
  }
}
const arrow=()=>'<span aria-hidden="true">↗</span>';
