import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {StudyWorkspace} from '../assets/study.js';
import {defaultState} from '../assets/state.js';
import {learningSources,questionWithContext} from '../assets/study-session.js';

const {readings}=JSON.parse(await readFile('content/topic-readings.json','utf8'));
const {units}=JSON.parse(await readFile('content/study-units.json','utf8'));
const resources=JSON.parse(await readFile('content/workspace.json','utf8')).resources;

test('Every existing digest opens its explanatory chapters and retains learner actions and provenance',()=>{
  const study=Object.create(StudyWorkspace.prototype);
  study.getCurated=()=>units;study.getState=()=>defaultState();study.getLessons=()=>[];
  study.getReadings=()=>readings;study.getData=()=>({resources});study.fontSize=18;
  study.annotations={records:()=>[],markup:()=>'<section id="study-marks"></section>'};
  study.exercisesMarkup=()=>'<section id="study-practice"></section>';
  study.reflectionMarkup=()=>'<section id="study-reflection"></section>';
  assert.equal(new Set(readings.map(r=>r.id)).size,units.filter(u=>u.id.startsWith('digest-')).length);
  for(const unit of units.filter(u=>u.id.startsWith('digest-'))){
    const r=readings.find(r=>r.id===unit.id);assert.ok(r,unit.id);
    assert.ok(r.goal&&r.scope&&r.reviewedAt);assert.ok(r.sources.length);
    const chapters=[...r.content.matchAll(/^## (.+)$/gm)];assert.ok(chapters.length>=5,unit.id);
    const html=study.reader(new URLSearchParams({id:unit.id}));
    for(let i=0;i<chapters.length;i++){
      assert.match(html,new RegExp('id="chapter-'+i+'"'));
      assert.ok(html.includes('href="#chapter-'+i+'"'));
    }
    assert.ok(html.indexOf('id="chapter-'+(chapters.length-1)+'"')<html.indexOf('id="study-essentials"'));
    for(const action of ['bookmark','plan','ask'])assert.ok(html.includes('data-study="'+action+'"'));
    for(const id of ['study-marks','study-practice','study-reflection','study-sources'])assert.ok(html.includes('id="'+id+'"'));
    assert.ok(!html.includes('推荐阅读顺序'));assert.ok(html.includes(r.reviewedAt));
    for(const source of r.sources){assert.equal(new URL(source.url).protocol,'https:');assert.ok(html.includes(source.url));}
  }
});

test('Current explanations and original supporting sources both reach copied learning questions',()=>{
  const unit=units.find(u=>u.id==='digest-jev');
  const sources=learningSources(unit,{resources,readings});
  assert.equal(new Set(sources.map(s=>s.url)).size,sources.length);
  const text=questionWithContext('二元概率阈值 0.9 如何换算？',unit,{sources});
  assert.ok(text.includes('https://docs.typesafe.ai/confidence'));
  assert.ok(text.includes('https://arxiv.org/abs/2609.37647'));
  assert.ok(text.includes('Choice 公式'));
  assert.deepEqual(learningSources(unit,{resources,readings:[]}),resources.find(r=>r.id==='jev').digest.sourceLinks);
});
