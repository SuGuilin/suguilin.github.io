import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {interviewSelection,interviewFilterURL,createInterviewScreens} from '../assets/interview.js';
import {filterCatalogResources,resourceLearningUnit,resourceSourceKind} from '../assets/catalog-view.js';
import {sourcePerspectives} from '../assets/source-perspectives.js';
import {appendPracticeReport,mechanismChecks} from '../assets/practice-reports.js';
import {questionWithContext} from '../assets/study-session.js';
const data=JSON.parse(await readFile('content/workspace.json','utf8'));
const units=JSON.parse(await readFile('content/study-units.json','utf8')).units;
const lessons=JSON.parse(await readFile('content/lessons.json','utf8')).lessons;

test('Official-site question copies retain the exact note or reading position and reject external return destinations',()=>{
  const unit=units.find(u=>u.id==='lesson-finetuning-foundations');
  assert.ok(questionWithContext('我的问题',unit,{returnPath:'/journal/?id=own-note&unit='+unit.id}).includes('https://suguilin.github.io/journal/?id=own-note'));
  assert.ok(questionWithContext('我的问题',unit,{returnPath:'/study/?id='+unit.id+'&mode=recall#exercise-e2'}).includes('&mode=recall#exercise-e2'));
  for(const returnPath of ['https://evil.test/journal/','//evil.test/study/','javascript:alert(1)','https://user:pass@suguilin.github.io/journal/']){
    const text=questionWithContext('我的问题',unit,{returnPath});assert.ok(!text.includes(returnPath));assert.ok(text.includes('https://suguilin.github.io/study/'));
  }
  assert.equal(questionWithContext('独立问题',null),'独立问题');
});

test('Interview category and search compose, survive URL reopening and never hide a direct question',()=>{
  const url=interviewFilterURL(new URLSearchParams('question=q1'),{category:'后训练',q:'DPO'});
  const params=new URL(url,'https://suguilin.github.io').searchParams;
  const selected=interviewSelection(data,params);
  assert.equal(selected.category,'后训练');assert.ok(selected.questions.length>0);
  assert.ok(selected.questions.every(q=>q.category==='后训练'));
  assert.ok(selected.questions.some(q=>q.id==='q37'));
  assert.deepEqual(interviewSelection(data,new URLSearchParams(params)).questions,selected.questions);
  const direct=interviewSelection(data,new URLSearchParams('question=q31&category=工程&q=nothing'));
  assert.equal(direct.category,'全部');assert.equal(direct.query,'');assert.ok(direct.questions.some(q=>q.id==='q31'));
  assert.equal(interviewSelection(data,new URLSearchParams('q=unmatched-quality-negative')).questions.length,0);
  assert.equal(interviewFilterURL(params,{category:'全部',q:''}),'/interview/');
});

test('Source type filters compose with category and unknown learning references cannot produce a broken reader URL',()=>{
  for(const sourceKind of ['github','paper','community','official']){
    const found=filterCatalogResources(data.resources,{sourceKind});assert.ok(found.length);
    assert.ok(found.every(r=>resourceSourceKind(r)===sourceKind));
  }
  const found=filterCatalogResources(data.resources,{sourceKind:'github',category:'course',query:'课程'});
  assert.ok(found.length);assert.ok(found.every(r=>r.url.startsWith('https://github.com/')&&r.category==='course'));
  const r=data.resources.find(r=>r.id==='harness-effects-2026');assert.equal(resourceLearningUnit(r,units,lessons).id,'lesson-harness');
  assert.equal(resourceLearningUnit({...r,studyUnits:['missing']},units,[]),undefined);
  assert.equal(resourceLearningUnit({id:'one',url:units[0].source.url,studyUnits:['missing']},units,[]).id,units[0].id);
});

test('Every interview answer, report practice link and frontier recommendation points to an existing usable topic',()=>{
  const ids=new Set(units.map(u=>u.id));
  for(const q of data.questions){assert.ok(q.answer?.length>120,q.id);assert.ok(q.rubric.length>=3);assert.ok(q.studyUnits.length);for(const id of q.studyUnits)assert.ok(ids.has(id));}
  for(const r of data.interviewReports){assert.ok(r.author&&r.verification&&r.verifiedAt);assert.ok(r.questionRefs.length);for(const id of r.questionRefs)assert.ok(data.questions.some(q=>q.id===id));}
  for(const f of data.frontier)assert.ok(ids.has(f.unitId||'digest-'+f.resourceId));
  const html=sourcePerspectives(data,{saved:[]});assert.match(html,/id=lesson-harness/);assert.ok(!html.includes('id=digest-harness-effects-2026'));
  const screens=createInterviewScreens({getData:()=>data,link:(url,label)=>`<a href="${url}">${label}</a>`,ext:()=>'',tag:()=>'',icon:()=>'',pageTitle:()=>''});
  const reports=screens.reports(new URLSearchParams('company=快手'));assert.match(reports,/SFT 的 assistant-only loss/);assert.ok(!reports.includes('训练 35'));
});

test('New algorithm reports retain failed checks, explanatory notes, existing reflection and backup-compatible text',()=>{
  for(const id of ['lesson-model-foundations','lesson-finetuning-foundations']){
    const checks=Object.fromEntries(Object.keys(mechanismChecks[id]).map((k,i)=>[k,i!==0]));
    const r={experiment:id,scope:'stdlib fixtures; no model/service',checks,my_explanation:'我改变 mask 后得到反例。'};
    const result=appendPracticeReport('原来的预测',JSON.stringify(r),id);
    assert.ok(result.text.startsWith('原来的预测'));assert.match(result.text,/未通过/);assert.match(result.text,/改变 mask/);
    delete r.checks[Object.keys(checks)[0]];assert.throws(()=>appendPracticeReport('',JSON.stringify(r),id));
  }
});
