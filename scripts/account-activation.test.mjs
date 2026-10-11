import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningPlatform} from '../assets/platform.js';

test('Deferred account activation keeps the workspace local without creating an auth client',async()=>{
  const previousFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async url=>{
    requests.push(url);
    assert.equal(url,'/assets/public-config.json');
    return new Response(JSON.stringify({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test',assistantFunction:'learning-assistant',synthesisFunction:'learning-synthesis',enableSignIn:false}));
  };
  try{
    const platform=Object.assign(Object.create(LearningPlatform.prototype),{client:null,session:null,updateStatus(status){this.status=status;}});
    await platform.init();
    assert.equal(platform.client,null);
    assert.equal(platform.session,null);
    assert.equal(platform.status.status,'deployment-pending');
    assert.equal(platform.statusText(),'本机保存 · 云端暂未启用');
    assert.deepEqual(requests,['/assets/public-config.json']);
  }finally{globalThis.fetch=previousFetch;}
});
