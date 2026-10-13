import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),require=createRequire(import.meta.url);

test('A content-only rebuild replaces a stale embedded reading and updates all shell cache versions',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'suguilin-build-'));
  try{
    for(const folder of ['scripts','assets','content','src'])await mkdir(path.join(root,folder));
    const script=(await readFile('scripts/build.mjs','utf8')).replace("from 'esbuild'",`from '${pathToFileURL(require.resolve('esbuild')).href}'`);
    await writeFile(path.join(root,'scripts/build.mjs'),script);
    await writeFile(path.join(root,'src/shell.html'),'<html data-content-version="{{assetVersion}}">{{title}}{{navigation}}{{explorationNavigation}}</html>');
    for(const name of ['workspace','product','experience','reader','workflow'])await writeFile(path.join(root,'assets',name+'.css'),'');
    await writeFile(path.join(root,'assets/app.js'),'stale bundle');
    await writeFile(path.join(root,'assets/workspace.js'),"import data from '../content/topic-readings.json' with {type:'json'}; export const reading = data.readings;");
    for(const [name,data] of Object.entries({workspace:{resources:[],guides:[]},lessons:{lessons:[]},'study-units':{units:[]},'study-curriculum':{groups:[]},'topic-readings':{readings:[{scope:'memory-only-v1'}]}}))await writeFile(path.join(root,'content',name+'.json'),JSON.stringify(data));
    await run(process.execPath,[path.join(root,'scripts/build.mjs')]);
    const first=await readFile(path.join(root,'study/index.html'),'utf8');
    assert.match(await readFile(path.join(root,'assets/app.js'),'utf8'),/memory-only-v1/);
    await writeFile(path.join(root,'content/topic-readings.json'),JSON.stringify({readings:[{scope:'verified-stdio-v2'}]}));
    await run(process.execPath,[path.join(root,'scripts/build.mjs')]);
    const bundle=await readFile(path.join(root,'assets/app.js'),'utf8');
    assert.match(bundle,/verified-stdio-v2/);assert.ok(!bundle.includes('memory-only-v1'));
    const next=await readFile(path.join(root,'study/index.html'),'utf8');assert.notEqual(next,first);
    assert.equal(next.match(/data-content-version="([^"]+)"/)[1],(await readFile(path.join(root,'plan/index.html'),'utf8')).match(/data-content-version="([^"]+)"/)[1]);
  }finally{await rm(root,{recursive:true,force:true});}
});
