import {createHash} from 'node:crypto';
import {z} from 'zod';
import {Identity} from './legacy/identity.mjs';

export const fail = code => { throw new Error(code); };
export const stable = value => JSON.stringify(value, function (_key, v) {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v;
});
export const digest = value => createHash('sha256').update(stable(value)).digest('hex');
const name = z.string().trim().min(1).max(160);
const dt = z.enum(['Purchase Invoice', 'Sales Order', 'Sales Invoice', 'Item', 'Supplier', 'Company']);
const filters = z.record(z.union([z.string().max(160), z.number().finite(), z.boolean()])).optional();
const item = z.object({item_code: name, qty: z.number().positive().max(1000), rate: z.number().nonnegative().max(100000)}).strict();
export const schemas = {
  'erp.query': z.object({docType: dt, filters}).strict(),
  'erp.get': z.object({docType: dt, name}).strict(),
  'erp.run_report': z.object({report: name, filters}).strict(),
  'erp.create_draft': z.object({docType: z.literal('Purchase Invoice'), doc: z.object({
    company: name, supplier: name, bill_no: name, currency: name,
    posting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), items: z.array(item).min(1).max(20),
  }).strict()}).strict(),
  'erp.submit': z.object({docType: z.literal('Purchase Invoice'), name}).strict(),
  'erp.operation': z.object({operationId: z.string().uuid(), mode: z.enum(['status', 'resume'])}).strict(),
};

// Profiles are server-owned. Caller identity never comes from tool arguments.
export function authorize(profile, call) {
  if (!profile?.principal || !profile?.erpUser) fail('identity_required');
  if (!profile.actions.includes(call.action)) fail('action_denied');
  new Identity(profile.docTypes).enforce(call);
  if (call.action === 'erp.run_report' && !profile.reports.includes(call.report)) fail('report_denied');
}
export function checkInvoice(profile, doc, {existing = false} = {}) {
  if (doc.company !== profile.company || doc.currency !== profile.currency) fail('company_or_currency_denied');
  if (!profile.suppliers.includes(doc.supplier)) fail('supplier_denied');
  if (existing && Number(doc.docstatus) !== 0) fail('not_draft');
  const items = doc.items;
  if (!Array.isArray(items) || !items.length) fail('invalid_items');
  const estimate = items.reduce((sum, i) => {
    const qty = Number(i.qty), rate = Number(i.rate);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) fail('invalid_items');
    return sum + qty * rate;
  }, 0);
  const total = existing ? Number(doc.grand_total) : estimate;
  if (!Number.isFinite(total) || total < 0 || total > profile.maxAmount || estimate > profile.maxAmount) fail('amount_denied');
  return total;
}
export function businessKey(profile, call) {
  // Scope includes ERP deployment, not user: two users cannot duplicate the same invoice.
  const target = call.action === 'erp.submit' ? [call.name] : [call.doc.company, call.doc.supplier, call.doc.bill_no];
  return digest([profile.scope, call.action, call.docType, ...target]);
}
export function snapshot(doc) {
  // Include all fields except transport metadata. Any business change invalidates approval.
  const {__onload, ...business} = doc;
  return digest(business);
}
export const testProfile = (overrides = {}) => ({
  principal: 'classroom-buyer', erpUser: 'accounts_user@example.com', scope: 'fake-erp',
  company: 'Agentify Demo Co', currency: 'USD', maxAmount: 500, suppliers: ['Globex'],
  docTypes: ['Purchase Invoice', 'Item', 'Supplier', 'Company'], reports: [],
  actions: ['erp.query', 'erp.get', 'erp.create_draft', 'erp.submit'],
  ...overrides,
});
