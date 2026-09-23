import { PermissionError, NotFoundError } from './types.mjs';
export class FakeErpClient {
    docs = new Map(); // key: `${docType}:${name}`
    perms = new Map(); // key: `${user}:${docType}` -> actions
    permlevelUsers = new Set(); // 谁能看 permlevel>0(默认没人)
    timeoutOnce = false; // Demo C:模拟超时
    seq = 0;
    seedDoc(dt, name, doc, opts = {}) {
        this.docs.set(`${dt}:${name}`, { doc: { ...doc, name }, docstatus: 0, permlevelFields: opts.permlevelFields ?? [] });
    }
    seedPermission(user, dt, actions) {
        this.perms.set(`${user}:${dt}`, new Set(actions));
    }
    grantPermlevel(user) { this.permlevelUsers.add(user); }
    can(user, dt, action) {
        return this.perms.get(`${user}:${dt}`)?.has(action) ?? false;
    }
    redact(user, s) {
        if (this.permlevelUsers.has(user))
            return { ...s.doc, docstatus: s.docstatus };
        const out = { ...s.doc };
        for (const f of s.permlevelFields)
            delete out[f];
        return { ...out, docstatus: s.docstatus };
    }
    async list(user, dt, filters = {}) {
        if (!this.can(user, dt, 'read'))
            throw new PermissionError(`${user} cannot read ${dt}`);
        return [...this.docs.entries()]
            .filter(([k]) => k.startsWith(`${dt}:`))
            .map(([, s]) => this.redact(user, s))
            .filter(d => Object.entries(filters).every(([k, v]) => d[k] === v));
    }
    async get(user, dt, name) {
        if (!this.can(user, dt, 'read'))
            throw new PermissionError(`${user} cannot read ${dt}`);
        const s = this.docs.get(`${dt}:${name}`);
        if (!s)
            throw new NotFoundError(`${dt} ${name} not found`);
        return this.redact(user, s);
    }
    async insert(user, dt, doc) {
        if (!this.can(user, dt, 'write'))
            throw new PermissionError(`${user} cannot write ${dt}`);
        const name = `${dt.replace(/\s/g, '')}-${++this.seq}`;
        this.docs.set(`${dt}:${name}`, { doc: { ...doc, name }, docstatus: 0, permlevelFields: [] });
        if (this.timeoutOnce) {
            this.timeoutOnce = false;
            throw new Error('ETIMEDOUT');
        } // 落库成功但"回执超时"
        return { name, docstatus: 0 };
    }
    async submit(user, dt, name) {
        if (!this.can(user, dt, 'submit'))
            throw new PermissionError(`${user} cannot submit ${dt}`);
        const s = this.docs.get(`${dt}:${name}`);
        if (!s)
            throw new NotFoundError(`${dt} ${name}`);
        s.docstatus = 1;
        return { name, docstatus: 1 };
    }
    async runReport(user, report, filters) {
        return { report, filters, rows: [] };
    }
    /** 测试用:直接查库(绕权限),验证副作用真发生。 */
    _peek(dt, name) { return this.docs.get(`${dt}:${name}`); }
    _count(dt) { return [...this.docs.keys()].filter(k => k.startsWith(`${dt}:`)).length; }
}
