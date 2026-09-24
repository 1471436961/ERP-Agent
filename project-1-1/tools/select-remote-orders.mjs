// Select two real, read-only remote Sales Orders for Step-3 acceptance.
import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (config.ERP_URL !== 'https://erp.agentist.org' || config.ERP_USER !== 'demo@agentist.org') {
  throw new Error('Expected the controlled remote demo identity and HTTPS origin');
}
const request = async (path) => {
  const response = await fetch(config.ERP_URL + path, {
    headers: {Authorization: `token ${config.ERP_API_KEY}:${config.ERP_API_SECRET}`},
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`ERP HTTP ${response.status}`);
  return response.json();
};
const identity = await request('/api/method/frappe.auth.get_logged_user');
if (identity.message !== config.ERP_USER) throw new Error('Remote identity mismatch');
const rows = (await request('/api/resource/Sales%20Order?limit_page_length=20')).data;
const selected = [];
for (const row of rows) {
  const order = (await request(`/api/resource/Sales%20Order/${encodeURIComponent(row.name)}`)).data;
  if (order.company === config.COMPANY && order.name !== 'SAL-ORD-2026-00001') {
    selected.push({name: order.name, status: order.status, docstatus: order.docstatus,
      grand_total: order.grand_total, currency: order.currency, modified: order.modified});
    if (selected.length === 2) break;
  }
}
if (selected.length < 2) throw new Error('Fewer than two eligible remote orders');
console.log(JSON.stringify({origin: config.ERP_URL, identity: 'matched', selected}, null, 2));
