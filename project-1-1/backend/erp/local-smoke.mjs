// Local read-only connector acceptance. Prints only fixed assertions, never credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const runtime=path.resolve(process.argv[2]||'../../.runtime/local');
const config=JSON.parse(fs.readFileSync(path.join(runtime,'mcp.json'),'utf8'));
const server=config.mcpServers['project-1-1-erp'];
assert.deepEqual(server.include_tools,['erp.query','erp.get']);
const transport=new StdioClientTransport({command:server.command,args:server.args,stderr:'pipe'});
const client=new Client({name:'local-readonly-acceptance',version:'1.0.0'});
try {
  await client.connect(transport);
  const order=await client.callTool({name:'erp.get',arguments:{docType:'Sales Order',name:'SAL-ORD-2026-00001'}});
  assert.notEqual(order.isError,true);
  const body=JSON.parse(order.content.find(c=>c.type==='text').text).untrustedBusinessData.data;
  assert.equal(body.name,'SAL-ORD-2026-00001');
  assert.equal(body.company,'ZHOU');
  assert.equal(body.docstatus,1);
  assert.equal(body.currency,'CNY');
  assert.equal(Number(body.grand_total),200);
  for (const docType of ['Item','Sales Order','Sales Invoice']) {
    const result=await client.callTool({name:'erp.query',arguments:{docType,filters:{}}});
    assert.notEqual(result.isError,true,`${docType} query failed`);
  }
  const denied=await client.callTool({name:'erp.query',arguments:{docType:'User',filters:{}}});
  assert.equal(denied.isError,true);
  console.log('Local MCP order detail and three document lists passed; out-of-scope User query denied.');
} finally {
  await client.close();
  await transport.close();
}
