// Remote Step-3 MCP smoke test; read-only, no model call or ERP writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const state = path.resolve(process.argv[2]);
const config = JSON.parse(fs.readFileSync(path.join(state, 'mcp.json'), 'utf8'));
const server = config.mcpServers['project-1-1-erp'];
assert.deepEqual(server.include_tools, ['erp.query', 'erp.get']);
const transport = new StdioClientTransport({command: server.command, args: server.args, stderr: 'pipe'});
const client = new Client({name: 'step3-remote-readonly-acceptance', version: '1.0.0'});
const get = async (docType, name) => {
  const result = await client.callTool({name: 'erp.get', arguments: {docType, name}});
  assert.notEqual(result.isError, true, `${docType} ${name} read failed`);
  return JSON.parse(result.content.find(part => part.type === 'text').text).untrustedBusinessData.data;
};
try {
  await client.connect(transport);
  for (const [name, amount] of [['SAL-ORD-2026-00002', 950], ['SAL-ORD-2026-00003', 275]]) {
    const order = await get('Sales Order', name);
    assert.equal(order.name, name);
    assert.equal(order.company, 'Agentify Demo Co');
    assert.equal(order.currency, 'USD');
    assert.equal(Number(order.grand_total), amount);
    console.log(`${name}: remote detail passed; status=${order.status}; amount=${amount} USD`);
  }
  for (const docType of ['Item', 'Sales Order', 'Sales Invoice']) {
    const result = await client.callTool({name: 'erp.query', arguments: {docType, filters: {}}});
    assert.notEqual(result.isError, true, `${docType} list failed`);
    console.log(`${docType}: remote list passed`);
  }
  const missing = await client.callTool({name: 'erp.get', arguments: {docType: 'Sales Order', name: 'SAL-ORD-2099-99999'}});
  assert.equal(missing.isError, true);
  console.log('Nonexistent Sales Order: not returned as a real record');
  const denied = await client.callTool({name: 'erp.query', arguments: {docType: 'User', filters: {}}});
  assert.equal(denied.isError, true);
  console.log('Out-of-scope User query: denied');
} finally {
  await client.close();
  await transport.close();
}
