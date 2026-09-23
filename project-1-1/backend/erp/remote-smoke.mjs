// Operator-only, read-only real ERP smoke test. Never prints business rows or secrets.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
process.umask(0o077);
const privateRoot=path.join(os.homedir(),'.config/enterprise-ai-week06');
const creds=JSON.parse(fs.readFileSync(path.join(privateRoot,'remote-erp-credentials.json'),'utf8'));
const state=fs.mkdtempSync(path.join(privateRoot,'remote-smoke-'));
const client=new Client({name:'remote-acceptance',version:'1.0.0'});
const origin=process.env.SMOKE_ERP_URL||creds.url;
const transport=new StdioClientTransport({command:process.execPath,
  args:[new URL('./server.mjs',import.meta.url).pathname],
  env:{ERP_FAKE:'0',ERP_URL:origin,ERP_ALLOW_LOCAL_HTTP:origin==='http://127.0.0.1:18080'?'1':'0',
    ERP_API_KEY:creds.api_key,ERP_API_SECRET:creds.api_secret,
    ERP_PROFILE_FILE:path.join(privateRoot,'profile.json'),ERP_STATE_DB:path.join(state,'erp.sqlite'),SEND_LANGFUSE:'0'},stderr:'pipe'});
try{
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length,6);
  for(const docType of ['Item','Sales Order','Sales Invoice']){
    const r=await client.callTool({name:'erp.query',arguments:{docType,filters:{}}});
    assert.ok(!r.isError,`${docType} read failed`);
    console.log(`${docType}: real remote MCP read passed`);
  }
  const denied=await client.callTool({name:'erp.query',arguments:{docType:'User',filters:{}}});
  assert.equal(denied.isError,true);
  console.log('User data outside allowlist: denied');
  console.log('MCP acceptance passed; no model inference or business writes performed.');
}finally{await client.close();await transport.close();}
