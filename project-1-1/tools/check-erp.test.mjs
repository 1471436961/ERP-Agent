import test from 'node:test';
import assert from 'node:assert/strict';
import {checkERP} from './check-erp.mjs';
test('rejects missing credentials without a network call',async()=>{
 await assert.rejects(checkERP({ERP_URL:'https://erp.agentist.org',ERP_USER:'demo@agentist.org'}),/Missing ERP_API_KEY/);
});
test('rejects login-page URLs and plaintext remote origins',async()=>{
 await assert.rejects(checkERP({ERP_URL:'https://erp.agentist.org/login'}),/base origin/);
 await assert.rejects(checkERP({ERP_URL:'http://erp.agentist.org'}),/loopback/);
});
test('reads details as well as lists and fails mismatched identities',async()=>{
 const previous=globalThis.fetch; const calls=[];
 const c={ERP_URL:'http://localhost:8080',ERP_API_KEY:'fake',ERP_API_SECRET:'fake',ERP_USER:'reader@example.com'};
 try {
  globalThis.fetch=async(url,options)=>{
   calls.push(url); assert.equal(options.headers.Authorization,'token fake:fake');
   return {ok:true,json:async()=>url.includes('get_logged_user')?{message:c.ERP_USER}:url.includes('?')?{data:[{name:'TEST-1'}]}:{data:{name:'TEST-1'}}};
  };
  const r=await checkERP(c);assert.equal(calls.length,7);assert.ok(Object.values(r.reads).every(x=>x==='list_and_detail_pass'));
  globalThis.fetch=async()=>({ok:true,json:async()=>({message:'someone-else'})});
  await assert.rejects(checkERP(c),/identity differs/);
 } finally {globalThis.fetch=previous;}
});
