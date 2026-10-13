import {dayKey,dailyQueue,currentAttempt} from './study-model.js';
import {noteUnitId,readAnnotation} from './learning-signals.js';
import {journalTitle,journalReadingBody} from './journal-model.js';

// One derived view of a topic's private records. Never persist these projections:
// the original notes and attempts remain the source of truth for sync/backup.
export function learningContext(state,unit,{now=new Date()}={}){
  const progress=state.studyProgress.find(p=>p.id===unit.id),attempt=progress&&currentAttempt(progress);
  const notes=state.notes.filter(n=>noteUnitId(n)===unit.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
  const questions=notes.filter(n=>n.kind==='待解答问题'),annotations=notes.filter(n=>readAnnotation(n));
  const experiment=notes.find(n=>n.kind==='实验记录'||['学习笔记','学习复盘'].includes(n.kind)&&/^## 代码实践[ ·]/m.test(journalReadingBody(n)));
  const answered=unit.exercises.filter(e=>attempt?.answers.some(a=>a.id===e.id&&a.text.trim())).length;
  return {unitId:unit.id,progress,stage:learningStage(progress,now),notes,questions,annotations,experiment,
    practice:{answered,total:unit.exercises.length,reflection:!!attempt?.reflection.trim(),experimentDraft:!!attempt&&/^## 代码实践[ ·]/m.test(attempt.reflection)}};
}

// These are observable records, never a mastery score or an inferred ability.
export function learningStage(progress, now=new Date()) {
  if (!progress) return {id:'new',label:'未开始'};
  if (progress.recall) return {id:'recalling',label:'复习作答中'};
  if (!progress.history.length) return progress.answers.some(a=>a.text.trim())
    ? {id:'checking',label:'已有作答 · 待自检'} : {id:'reading',label:'阅读中'};
  if (progress.nextReview && progress.nextReview<=dayKey(now)) return {id:'due',label:'到期复习'};
  return {id:'practiced',label:'已留作答 · 待复习'};
}
export function learningURL(unit, progress, {review=false,section=''}={}) {
  return '/study/?id='+encodeURIComponent(unit.id)+(review||progress?.recall?'&mode=recall':'')+(section?'#'+section:'');
}
export function learningAction(unit,progress,{review=false,now=new Date(),state=null,preferredQuestion=''}={}){
  const stage=learningStage(progress,now);
  const questions=state?learningContext(state,unit,{now}).questions:[],preferred=questions.find(n=>n.id===preferredQuestion);
  const questionAction=question=>({url:'/journal/?'+new URLSearchParams({id:question.id,unit:unit.id}),label:'回看未解疑问',stage,question});
  // Recommendations can explicitly select a question; ordinary continuations
  // still finish an active recall, due review or unassessed answer first.
  if(preferred)return questionAction(preferred);
  if(stage.id==='recalling')return {url:learningURL(unit,progress,{section:'study-practice'}),label:'继续复习',stage};
  if(review||stage.id==='due')return {url:learningURL(unit,progress,{review:true,section:'study-practice'}),label:'开始复习',stage};
  if(stage.id==='checking')return {url:learningURL(unit,progress,{section:'study-practice'}),label:'继续自检',stage};
  if(questions.length)return questionAction(questions[0]);
  return {url:learningURL(unit,progress,{section:progress?.readingSection||''}),label:progress?'继续阅读':'开始学习',stage};
}
export function dailyLearningQueue(state,units,now=new Date(),resources=[]){
  const today=dayKey(now),spent=state.studyProgress.flatMap(p=>p.history).filter(h=>dayKey(new Date(h.at))===today).reduce((n,h)=>n+h.minutes,0);
  const remaining=Math.max(0,state.dailyMinutes-spent);
  return remaining?dailyQueue({...state,dailyMinutes:remaining},units,now,resources):[];
}
export function learningNeeds(state, units, now=new Date()) {
  const byId=new Map(units.map(u=>[u.id,u])),today=dayKey(now),needs=[];
  const add=(kind,title,detail,url,key)=>needs.push({kind,title,detail,url,key});
  for(const p of state.studyProgress){
    const u=byId.get(p.id);
    if(!u){add('missing',p.title,'原单元暂不可用，已有作答仍保留；可在学习队列改期或回看日志。','/plan/#learning-queue',p.id);continue;}
    if(p.recall)add('recall',u.title,'这次复习的作答还未自检，继续后再安排下次复习。',learningURL(u,p,{section:'study-practice'}),p.id);
    else if(p.history.length&&p.nextReview&&p.nextReview<=today)add('review',u.title,'先用自己的话回忆，再对照上次作答与参考思路。',learningURL(u,p,{review:true,section:'study-practice'}),p.id);
    else if(!p.history.length&&p.answers.some(a=>a.text.trim()))add('check',u.title,'已经写下答案，对照自检标准并保留这次复盘。',learningURL(u,p,{section:'study-practice'}),p.id);
  }
  for(const n of state.notes){
    const u=byId.get(noteUnitId(n));
    if(n.kind==='待解答问题')add('question',journalTitle(n),'回看问题，继续提问或补充理解。','/journal/?id='+n.id,n.id);
    else if(readAnnotation(n)&&u&&!state.studyProgress.some(p=>p.id===u.id&&(p.history.length||p.answers.some(a=>a.text.trim())))){
      if(!needs.some(x=>x.kind==='practice'&&x.key===u.id))add('practice',u.title,'有标注和想法，还可以选一道题检验自己的理解。',learningURL(u,null,{section:'study-practice'}),u.id);
    }else if(n.kind==='资料收件箱'&&!u&&!/\[阅读与练习\]\(\/study\//.test(n.body))add('source',n.title,'保留了来源线索，还没有整理成可学习的要点和练习。','/journal/?id='+n.id+'&kind=inbox',n.id);
  }
  const order=['recall','question','review','check','practice','missing','source'];
  return needs.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
}
