import {dayKey,dailyQueue,currentAttempt} from './study-model.js';
import {noteUnitId,readAnnotation} from './learning-signals.js';
import {journalTitle,journalReadingBody} from './journal-model.js';
import {practiceFollowup} from './practice-feedback.js';
import {learningRecommendations} from './learning-signals.js';
import {prerequisiteTopics,relatedTopics} from './study-curriculum.js';

// One derived view of a topic's private records. Never persist these projections:
// the original notes and attempts remain the source of truth for sync/backup.
export function learningContext(state,unit,{now=new Date()}={}){
  const progress=state.studyProgress.find(p=>p.id===unit.id),attempt=progress&&currentAttempt(progress);
  const notes=state.notes.filter(n=>noteUnitId(n)===unit.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
  const questions=notes.filter(n=>n.kind==='待解答问题'),annotations=notes.filter(n=>readAnnotation(n));
  const experiment=notes.find(n=>n.kind==='实验记录'||['学习笔记','学习复盘'].includes(n.kind)&&/^## 代码实践[ ·]/m.test(journalReadingBody(n)));
  const answered=unit.exercises.filter(e=>attempt?.answers.some(a=>a.id===e.id&&a.text.trim())).length;
  return {unitId:unit.id,progress,stage:learningStage(progress,now),notes,questions,annotations,experiment,practiceFollowup:practiceFollowup(state,unit),
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
  const followup=state&&practiceFollowup(state,unit)[0];
  if(followup&&!questions.length)return {url:learningURL(unit,progress,{section:'study-practice'}),label:'复核未通过实验',stage,followup};
  if(stage.id==='checking')return {url:learningURL(unit,progress,{section:'study-practice'}),label:'继续自检',stage};
  if(questions.length)return questionAction(questions[0]);
  return {url:learningURL(unit,progress,{section:progress?.readingSection||''}),label:progress?'继续阅读':'开始学习',stage};
}
export function dailyLearningQueue(state,units,now=new Date(),resources=[]){
  const today=dayKey(now),spent=state.studyProgress.flatMap(p=>p.history).filter(h=>dayKey(new Date(h.at))===today).reduce((n,h)=>n+h.minutes,0);
  const remaining=Math.max(0,state.dailyMinutes-spent);
  if(!remaining)return [];
  const queue=dailyQueue({...state,dailyMinutes:remaining},units,now,resources);
  if(queue.length===1&&queue[0].recommended){
    const next=continuingRecommendations(state,units,resources,{now,limit:units.length}).find(r=>!state.studyProgress.some(p=>p.id===r.unit.id));
    if(next)return [{unit:next.unit,minutes:Math.min(remaining,next.unit.minutes),review:false,recommended:true,reason:next.reason}];
  }
  return queue;
}
export function learningNeeds(state, units, now=new Date()) {
  const byId=new Map(units.map(u=>[u.id,u])),today=dayKey(now),needs=[];
  const add=(kind,title,detail,url,key)=>needs.push({kind,title,detail,url,key});
  for(const u of units){const results=practiceFollowup(state,u);if(results.length){const failed=results.flatMap(r=>r.failed);add('experiment',u.title,failed.map(f=>f.label).join('、')+'；回看观察并修改重跑。',learningURL(u,null,{section:'study-practice'}),u.id+':experiment');}}
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
  const order=['recall','question','review','experiment','check','practice','missing','source'];
  return needs.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
}
export function continuingRecommendations(state,units,resources=[],options={}){
  const base=learningRecommendations(state,units,resources,options),pending=units.filter(u=>u.id!==options.exclude).map(unit=>({unit,followups:practiceFollowup(state,unit)})).filter(r=>r.followups.length&&!state.notes.some(n=>n.kind==='待解答问题'&&noteUnitId(n)===r.unit.id));
  const latest=state.studyProgress.filter(p=>p.history.length&&units.some(u=>u.id===p.id)).sort((a,b)=>b.history.at(-1).at.localeCompare(a.history.at(-1).at))[0];
  if(!pending.length&&!latest)return base;
  const full=learningRecommendations(state,units,resources,{...options,limit:units.length});
  for(const item of pending){
    const progress=state.studyProgress.find(p=>p.id===item.unit.id),stage=learningStage(progress,options.now??new Date());
    if(['due','recalling'].includes(stage.id))continue;
    const existing=full.find(r=>r.unit.id===item.unit.id);if(existing?.score>=110)continue;
    const count=item.followups.reduce((n,r)=>n+r.failed.length,0),replacement={unit:item.unit,progress:state.studyProgress.find(p=>p.id===item.unit.id),score:105,reason:'实验有 '+count+' 项未通过，先复核观察与实现',section:'study-practice'};
    if(existing)Object.assign(existing,replacement);else full.push(replacement);
  }
  if(latest){
    const revisit=latest.history.at(-1).rating!=='good',ids=revisit?prerequisiteTopics(latest.id):relatedTopics(latest.id);
    for(const [order,id] of ids.entries()){
      const unit=units.find(u=>u.id===id);if(!unit||id===options.exclude||state.studyProgress.some(p=>p.id===id))continue;
      const existing=full.find(r=>r.unit.id===id);if(existing?.score>=65)continue;
      const replacement={unit,score:65,relationOrder:order,reason:revisit?'根据「'+latest.title+'」的自评，按需补读前置机制':'沿着「'+latest.title+'」继续研究相邻问题',section:'study-body'};
      if(existing)Object.assign(existing,replacement);else full.push(replacement);
    }
  }
  return full.sort((a,b)=>b.score-a.score||(a.relationOrder??99)-(b.relationOrder??99)||a.unit.id.localeCompare(b.unit.id)).slice(0,options.limit??3);
}
