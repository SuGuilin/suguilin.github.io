import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {interviewSelection,interviewFilterURL,createInterviewScreens} from '../assets/interview.js';
import {filterCatalogResources,resourceLearningUnit,resourceSourceKind} from '../assets/catalog-view.js';
import {sourcePerspectives} from '../assets/source-perspectives.js';
import {appendPracticeReport,mechanismChecks,mechanismCheckExtensions} from '../assets/practice-reports.js';
import {prerequisiteTopics,topicInterviewQuestions} from '../assets/study-curriculum.js';
import {StudyWorkspace} from '../assets/study.js';
import {questionWithContext} from '../assets/study-session.js';
import {LearningPlatform} from '../assets/platform.js';
const data=JSON.parse(await readFile('content/workspace.json','utf8'));
const units=JSON.parse(await readFile('content/study-units.json','utf8')).units;
const lessons=JSON.parse(await readFile('content/lessons.json','utf8')).lessons;

test('A reader can open actual prerequisite lessons and interview followups without an enabled AI service',()=>{
  const context={unit:id=>units.find(u=>u.id===id),getData:()=>data};
  for(const unit of units){
    for(const id of prerequisiteTopics(unit.id)){assert.notEqual(id,unit.id);assert.ok(context.unit(id));}
    const markup=StudyWorkspace.prototype.prerequisitesMarkup.call(context,unit);
    for(const id of prerequisiteTopics(unit.id))assert.ok(markup.includes('/study/?id='+id));
    const questions=topicInterviewQuestions(unit.id,data.questions);
    const interview=StudyWorkspace.prototype.interviewMarkup.call(context,unit);
    for(const q of questions)assert.ok(interview.includes('/interview/?question='+q.id));
  }
  assert.deepEqual(prerequisiteTopics('custom-reading'),[]);
  assert.equal(StudyWorkspace.prototype.prerequisitesMarkup.call(context,{id:'custom-reading',prerequisites:[]}), '');
  assert.equal(StudyWorkspace.prototype.interviewMarkup.call(context,{id:'custom-reading'}), '');
});

test('Expanded experiments preserve old reports and failed checks but reject partial or unknown extensions',()=>{
  for(const [id,extra] of Object.entries(mechanismCheckExtensions)){
    const legacy={experiment:id,scope:'stdlib fixtures; no model/service',checks:Object.fromEntries(Object.keys(mechanismChecks[id]).map(k=>[k,true]))};
    const old=appendPracticeReport('',JSON.stringify(legacy),id).text;
    assert.match(old,/旧版报告未包含/);
    const expanded=structuredClone(legacy);Object.assign(expanded.checks,Object.fromEntries(Object.keys(extra).map((k,i)=>[k,i!==0])));
    const fresh=appendPracticeReport('已有解释',JSON.stringify(expanded),id).text;
    assert.match(fresh,/已有解释/);assert.ok(fresh.includes(Object.values(extra)[0]+'：未通过'));
    assert.ok(!fresh.includes('旧版报告未包含'));
    const partial=structuredClone(expanded);delete partial.checks[Object.keys(extra)[0]];
    assert.throws(()=>appendPracticeReport('',JSON.stringify(partial),id));
    const unknown=structuredClone(expanded);unknown.checks.unknown=true;
    assert.throws(()=>appendPracticeReport('',JSON.stringify(unknown),id));
    const forged=structuredClone(expanded);forged.checks[Object.keys(extra)[0]]='true';
    assert.throws(()=>appendPracticeReport('',JSON.stringify(forged),id));
  }
});

test('Account status refreshes after configuration settles without activating sign-in or creating an auth client',async()=>{
  const originalFetch=globalThis.fetch;
  try{
    for(const [config,status] of [[{},'unconfigured'],[{supabaseUrl:'https://test-project.supabase.co',supabasePublishableKey:'sb_publishable_unit_test_only',assistantFunction:'study-assistant',enableSignIn:false},'deployment-pending']]){
      globalThis.fetch=async()=>new Response(JSON.stringify(config));let renders=0,observed;
      const context={client:null,onRender:()=>renders++,updateStatus:value=>{observed=value.status;}};
      await LearningPlatform.prototype.init.call(context);assert.equal(observed,status);assert.equal(renders,1);assert.equal(context.client,null);
    }
  }finally{globalThis.fetch=originalFetch;}
});

test('Deferred configuration does not replace a question or reader that the learner is already interacting with',async()=>{
  const originalFetch=globalThis.fetch,originalLocation=globalThis.location;
  try{
    globalThis.location={pathname:'/interview/'};
    globalThis.fetch=async()=>new Response(JSON.stringify({supabaseUrl:'https://test-project.supabase.co',supabasePublishableKey:'sb_publishable_unit_test_only',assistantFunction:'study-assistant',enableSignIn:false}));
    let renders=0;const context={client:null,onRender:()=>renders++,updateStatus:()=>{}};
    await LearningPlatform.prototype.init.call(context);assert.equal(renders,0);assert.equal(context.client,null);
  }finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;}
});

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
