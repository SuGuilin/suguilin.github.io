import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {StudyWorkspace} from '../assets/study.js';
import {defaultState,validateState} from '../assets/state.js';
import {newProgress} from '../assets/study-model.js';
import {saveStudySnapshot,studyQuestion,learningSources} from '../assets/study-session.js';
import {mechanismChecks,appendPracticeReport} from '../assets/practice-reports.js';
import {learningNotebooks} from '../assets/study-visuals.js';
import {studyGroups,relatedTopics} from '../assets/study-curriculum.js';
const units=JSON.parse(await readFile('content/study-units.json','utf8')).units;
const lessons=JSON.parse(await readFile('content/lessons.json','utf8')).lessons;
const readings=JSON.parse(await readFile('content/topic-readings.json','utf8')).readings;
const resources=JSON.parse(await readFile('content/workspace.json','utf8')).resources;

test('Every authored topic has one knowledge home, connected explanations, practice and live reader anchors',async()=>{
  const ids=studyGroups.flatMap(g=>g.units);assert.equal(new Set(ids).size,ids.length);assert.deepEqual(new Set(ids),new Set(units.map(u=>u.id)));
  const view=Object.create(StudyWorkspace.prototype);
  Object.assign(view,{getCurated:()=>units,getState:()=>defaultState(),getLessons:()=>lessons,getReadings:()=>readings,getData:()=>({resources}),fontSize:18,annotations:{records:()=>[],markup:()=>''}});
  for(const unit of units){
    const body=lessons.find(l=>l.id===unit.id)??readings.find(r=>r.id===unit.id);assert.ok(body,unit.id);
    assert.ok(learningNotebooks[unit.id]?.length,unit.id);
    for(const n of learningNotebooks[unit.id])await readFile('notebooks/'+n[0]);
    const html=view.reader(new URLSearchParams({id:unit.id}));
    for(const m of html.matchAll(/href="#(chapter-\d+)"/g))assert.ok(html.includes('id="'+m[1]+'"'),unit.id);
    for(const id of relatedTopics(unit.id)){assert.ok(units.some(u=>u.id===id));assert.ok(html.includes('/study/?id='+id));}
    for(const e of unit.exercises)assert.ok(html.includes('exercise-'+e.id));
    assert.ok(learningSources(unit,{lessons,readings,resources}).length>=1);
  }
  const base=view.library(new URLSearchParams({topic:'base'}));
  assert.ok(base.includes('模型调用：'));assert.ok(base.includes('检索与 RAG：'));assert.ok(!base.includes('href="/study/?id=digest-verl'));
});

test('Mechanism reports preserve failure, explanation and provenance across learning questions and journals',()=>{
  for(const [experiment,spec] of Object.entries(mechanismChecks)){
    const report={experiment,scope:'stdlib fixtures; no model/service',model_called:false,version:'1.2.14',checks:Object.fromEntries(Object.keys(spec).map((k,i)=>[k,i!==0])),my_explanation:'我修改一个边界，观察到失败而非掩盖它。'};
    const imported=appendPracticeReport('原来的预测',JSON.stringify(report),experiment);assert.match(imported.text,/未通过/);assert.ok(imported.text.startsWith('原来的预测'));assert.match(imported.text,/不认证/);
    const unit=units.find(u=>u.id===experiment)||units.find(u=>u.id==='digest-langgraph'),p={...newProgress(unit),reflection:imported.text,answers:[{id:'e1',text:'我的独立解释'}]};
    assert.match(studyQuestion(unit,p),/未通过/);assert.match(validateState(saveStudySnapshot({...defaultState(),studyProgress:[p]},unit,p,{id:'qa'}).state).notes[0].body,/修改一个边界/);
    const missing=structuredClone(report);delete missing.checks[Object.keys(spec)[0]];assert.throws(()=>appendPracticeReport('',JSON.stringify(missing),experiment));
    const wrong=structuredClone(report);wrong.experiment='other';assert.throws(()=>appendPracticeReport('',JSON.stringify(wrong),experiment));
    const forged=structuredClone(report);forged.checks[Object.keys(spec)[0]]='true';assert.throws(()=>appendPracticeReport('',JSON.stringify(forged),experiment));
  }
  assert.throws(()=>appendPracticeReport('',JSON.stringify({experiment:'langgraph-control-flow',model_called:true,version:'1.2.14',checks:mechanismChecks['langgraph-control-flow']}),'langgraph-control-flow'));
  for(const id of ['constructor','__proto__'])assert.throws(()=>appendPracticeReport('',JSON.stringify({experiment:id,scope:'stdlib fixtures; no model/service',checks:{}}),id));
});
