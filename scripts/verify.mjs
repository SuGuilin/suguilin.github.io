import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await readFile(path.join(root,'content/workspace.json'),'utf8'));
const ids=new Set(),urls=new Set();
for(const r of data.resources){
  for(const field of ['id','title','category','description','url','source','verification','verifiedAt'])assert.ok(typeof r[field]==='string'&&r[field].length,`${r.id}: missing ${field}`);
  assert.ok(Array.isArray(r.tags));assert.equal(new URL(r.url).protocol,'https:');assert.ok(!ids.has(r.id),`Duplicate ID ${r.id}`);assert.ok(!urls.has(r.url.replace(/\/$/,'')),`Duplicate URL ${r.url}`);ids.add(r.id);urls.add(r.url.replace(/\/$/,''));
}
for(const item of [...data.curriculum,...data.projects])for(const id of item.resources)assert.ok(ids.has(id),`Missing reference ${id}`);
for(const g of data.guides)for(const id of g.refs)assert.ok(ids.has(id),`Missing guide source ${id}`);
assert.equal(data.curriculum.length,12);assert.equal(data.curriculum.flatMap(w=>w.tasks).length,36);
for(const article of data.legacy)await stat(path.join(root,article.url));
for(const route of ['','roadmap','radar','lab','journal','interview','library','saved','about','guide','learn','assistant','account']){
  const html=await readFile(path.join(root,route,'index.html'),'utf8');assert.ok(!html.includes('{{'));assert.ok(html.includes('aria-label="搜索全站"'));
  for(const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){const target=path.join(root,match[1]);const s=await stat(target);if(s.isDirectory())await stat(path.join(target,'index.html'));}
}
const lessons=JSON.parse(await readFile(path.join(root,'content/lessons.json'),'utf8'));
assert.equal(lessons.lessons.length,6);
for(const l of lessons.lessons){assert.ok(l.content.length>700);assert.ok(l.sources.length>=3);for(const source of l.sources)assert.equal(new URL(source.url).protocol,'https:');}
assert.equal(data.resources.filter(r=>r.digest).length,15);
for(const r of data.interviewReports){assert.ok(r.author&&r.verification&&r.dateText);for(const id of r.questionRefs)assert.ok(data.questions.some(q=>q.id===id));}
const config=JSON.parse(await readFile(path.join(root,'assets/public-config.json'),'utf8'));assert.ok(!JSON.stringify(config).includes('sb_secret_'));assert.ok(!Object.keys(config).some(k=>/service.?role|openai|access.?token/i.test(k)));
console.log(`Verified ${ids.size} unique resources, all curriculum/project/guide references, legacy routes and 13 page shells.`);
