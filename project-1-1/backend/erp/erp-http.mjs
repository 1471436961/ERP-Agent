import {fail} from './policy.mjs';

// Same REST endpoints as cohort-1 HttpErpClient; API-token identity is checked at startup.
export class HttpErp {
  constructor({baseUrl, apiKey, apiSecret, expectedUser, allowLocalHttp = false}) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('invalid_erp_origin');
    if (url.protocol !== 'https:' && !(allowLocalHttp && url.protocol === 'http:' && ['localhost','127.0.0.1','erp.localhost'].includes(url.hostname))) fail('erp_requires_https');
    if (!apiKey || !apiSecret || !expectedUser) fail('erp_credentials_required');
    this.origin = url.origin; this.token = `token ${apiKey}:${apiSecret}`; this.user = expectedUser;
  }
  async request(path, method = 'GET', body) {
    let res;
    try { res = await fetch(this.origin+path, {method, redirect:'error', signal:AbortSignal.timeout(15000),
      headers:{Authorization:this.token,'Content-Type':'application/json'},
      ...(body ? {body:JSON.stringify(body)} : {})}); }
    catch { fail('erp_transport_error'); }
    if (!res.ok) fail(res.status === 403 ? 'erp_permission_denied' : 'erp_request_failed');
    return res.json();
  }
  async verifyIdentity() {
    const result = await this.request('/api/method/frappe.auth.get_logged_user');
    if (result.message !== this.user || result.message === 'Administrator' || result.message === 'Guest') fail('erp_identity_mismatch');
  }
  bound(user) { if (user !== this.user) fail('erp_identity_mismatch'); }
  async list(user,dt,filters={}) { this.bound(user); return (await this.request(`/api/resource/${encodeURIComponent(dt)}?filters=${encodeURIComponent(JSON.stringify(filters))}&limit_page_length=50`)).data; }
  async get(user,dt,name) { this.bound(user); return (await this.request(`/api/resource/${encodeURIComponent(dt)}/${encodeURIComponent(name)}`)).data; }
  async insert(user,dt,doc) { this.bound(user); return (await this.request(`/api/resource/${encodeURIComponent(dt)}`,'POST',doc)).data; }
  async submit(user,dt,name) { this.bound(user); return (await this.request('/api/method/frappe.client.submit','POST',{doc:JSON.stringify({doctype:dt,name})})).message; }
  async runReport(user,report,filters={}) { this.bound(user); return this.request(`/api/method/frappe.desk.query_report.run?report_name=${encodeURIComponent(report)}&filters=${encodeURIComponent(JSON.stringify(filters))}`); }
}
