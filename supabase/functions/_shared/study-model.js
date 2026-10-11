import {learningRecommendations} from './learning-signals.js';
export const validReadingSection = value => typeof value === 'string' && /^(study-(body|essentials|boundaries|practice|marks|reflection|sources)|chapter-\d{1,2}|exercise-e[1-5])$/.test(value);
// Shared by the browser and the Edge Function. Never accept a title-only pack.
const idPattern=/^[a-zA-Z0-9_-]{1,100}$/;
const string=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error('学习内容格式或长度不正确');return v;};
const strings=(v,max=8)=>{if(!Array.isArray(v)||!v.length||v.length>max)throw new Error('学习要点列表无效');return v.map(s=>string(s,1600));};
export const dayKey=(now=new Date())=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
export function shiftDay(day,n){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return dayKey(d);}
export function validDay(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&dayKey(new Date(v+'T12:00:00'))===v;}
export function validateUnit(raw){
  if(!raw||!idPattern.test(raw.id)||!['editorial','extractive','ai'].includes(raw.mode))throw new Error('学习单元无效');
  const source=raw.source;let url;try{url=new URL(source.url);}catch{throw new Error('原始来源无效');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>1500)throw new Error('原始来源无效');
  if(!Number.isFinite(Date.parse(source.accessedAt))||!Number.isFinite(Date.parse(raw.updatedAt)))throw new Error('学习单元日期无效');
  const takeaways=raw.takeaways;if(!Array.isArray(takeaways)||takeaways.length<2||takeaways.length>6)throw new Error('至少需要两个有依据的要点');
  const exercises=raw.exercises;if(!Array.isArray(exercises)||exercises.length<2||exercises.length>5)throw new Error('练习数量无效');
  const excerpt=typeof source.excerpt==='string'?source.excerpt:'';if(excerpt.length>24000)throw new Error('原文过长');
  const points=takeaways.map(t=>({point:string(t.point,1200),evidence:string(t.evidence,350)}));
  if(raw.mode!=='editorial'&&(!excerpt||points.some(t=>!excerpt.includes(t.evidence))))throw new Error('总结缺少可核对的正文依据');
  const questions=exercises.map((e,i)=>({id:'e'+(i+1),prompt:string(e.prompt,1800),hint:string(e.hint,1000),answer:string(e.answer,2600),rubric:strings(e.rubric,5)}));
  return {id:raw.id,title:string(raw.title,200),topic:string(raw.topic,100),summary:string(raw.summary,1600),mode:raw.mode,minutes:[15,30,45,60].includes(raw.minutes)?raw.minutes:30,prerequisites:strings(raw.prerequisites),takeaways:points,pitfalls:strings(raw.pitfalls),exercises:questions,
    source:{title:string(source.title,200),url:url.href,scope:string(source.scope,400),accessedAt:new Date(source.accessedAt).toISOString(),excerpt},updatedAt:new Date(raw.updatedAt).toISOString()};
}
export function validateProgress(raw){
  if(!raw||!idPattern.test(raw.id)||!validDay(raw.scheduledFor)||raw.nextReview&&!validDay(raw.nextReview)||!Number.isFinite(Date.parse(raw.updatedAt)))throw new Error('每日计划记录无效');
  if(!Array.isArray(raw.answers)||raw.answers.length>5||!Array.isArray(raw.history)||raw.history.length>100)throw new Error('练习记录无效');
  const answers=raw.answers.map(a=>{if(!/^e[1-5]$/.test(a.id)||typeof a.text!=='string'||a.text.length>6000)throw new Error('练习作答无效');return {id:a.id,text:a.text};});
  if(new Set(answers.map(a=>a.id)).size!==answers.length)throw new Error('重复练习记录');
  const history=raw.history.map(h=>{if(!Number.isFinite(Date.parse(h.at))||!['again','hard','good'].includes(h.rating)||!Number.isInteger(h.minutes)||h.minutes<1||h.minutes>240)throw new Error('复习记录无效');return {at:new Date(h.at).toISOString(),rating:h.rating,minutes:h.minutes};});
  if(typeof raw.reflection!=='string'||raw.reflection.length>6000)throw new Error('复盘内容无效');
  if(raw.readingSection!==undefined&&!validReadingSection(raw.readingSection))throw new Error('阅读位置无效');
  return {...(raw.readingSection?{readingSection:raw.readingSection}:{}),id:raw.id,title:string(raw.title,200),scheduledFor:raw.scheduledFor,nextReview:raw.nextReview||'',stage:Number.isInteger(raw.stage)&&raw.stage>=0&&raw.stage<=4?raw.stage:0,answers,reflection:raw.reflection,history,updatedAt:new Date(raw.updatedAt).toISOString()};
}
export function newProgress(unit,day=dayKey()){return {id:unit.id,title:unit.title,scheduledFor:day,nextReview:'',stage:0,answers:[],reflection:'',history:[],updatedAt:new Date().toISOString()};}
export const scheduledDay = progress => progress.history.length ? progress.nextReview : progress.scheduledFor;
export function rescheduleProgress(progress,day,now=new Date()){
  if(!validDay(day))throw new Error('请选择有效日期');
  return validateProgress({...progress,[progress.history.length?'nextReview':'scheduledFor']:day,updatedAt:now.toISOString()});
}
export function scheduleUnit(state,unit,now=new Date(),{today=false}={}){
  if(state.studyProgress.some(p=>p.id===unit.id))return state;
  if(state.studyProgress.length>=300)throw new Error('学习计划已满，请先导出备份并整理旧计划');
  const day=dayKey(now);let selected=day;
  if(!today)for(let n=0;n<366;n++){selected=shiftDay(day,n);const used=state.studyProgress.filter(p=>p.history.length?p.nextReview===selected:p.scheduledFor===selected).reduce((n,p)=>n+(p.history.length?10:state.studyUnits.find(u=>u.id===p.id)?.minutes??30),0);if(used+unit.minutes<=state.dailyMinutes||used===0)break;}
  return {...state,studyProgress:[...state.studyProgress,newProgress(unit,selected)]};
}
export function dailyQueue(state,units,now=new Date(),resources=[]){
  const day=dayKey(now),lookup=new Map(units.map(u=>[u.id,u]));
  const due=state.studyProgress.filter(p=>lookup.has(p.id)&&(p.history.length?p.nextReview&&p.nextReview<=day:p.scheduledFor<=day)).sort((a,b)=>(a.history.length?0:1)-(b.history.length?0:1)||(a.nextReview||a.scheduledFor).localeCompare(b.nextReview||b.scheduledFor));
  let minutes=0;const selected=[];for(const progress of due){const unit=lookup.get(progress.id),cost=Math.min(state.dailyMinutes,progress.history.length?10:unit.minutes);if(minutes+cost>state.dailyMinutes&&selected.length)continue;selected.push({unit,progress,minutes:cost,review:!!progress.history.length});minutes+=cost;}
  if(!selected.length){const unit=learningRecommendations(state,units,resources,{limit:units.length}).map(r=>r.unit).find(u=>!state.studyProgress.some(p=>p.id===u.id));if(unit)selected.push({unit,minutes:Math.min(state.dailyMinutes,unit.minutes),review:false,recommended:true});}
  return selected;
}
export function recordReview(progress,rating,minutes,now=new Date()){
  if(!['again','hard','good'].includes(rating))throw new Error('请选择复习感受');
  if(!progress.answers.some(a=>a.text.trim()))throw new Error('先写下至少一道练习的回答，再进行自评');
  const stage=rating==='again'?0:rating==='hard'?Math.max(0,progress.stage):Math.min(4,progress.stage+1),interval=rating==='again'?1:rating==='hard'?2:[1,3,7,14,30][stage];
  return validateProgress({...progress,stage,nextReview:shiftDay(dayKey(now),interval),history:[...progress.history.slice(-99),{at:now.toISOString(),rating,minutes}],updatedAt:now.toISOString()});
}
export function unitMarkdown(unit){return `# ${unit.title}\n\n${unit.summary}\n\n## 关键要点\n\n${unit.takeaways.map(t=>'- '+t.point+'\n  - 依据：'+t.evidence).join('\n')}\n\n## 易错边界\n\n${unit.pitfalls.map(p=>'- '+p).join('\n')}\n\n## 练习与参考思路\n\n${unit.exercises.map(e=>`### ${e.prompt}\n\n提示：${e.hint}\n\n${e.answer}\n\n自检：${e.rubric.join('；')}`).join('\n\n')}\n\n## 来源\n\n${unit.source.title}：${unit.source.url}\n\n阅读范围：${unit.source.scope}\n读取时间：${unit.source.accessedAt}\n整理方式：${unit.mode}\n`;}
