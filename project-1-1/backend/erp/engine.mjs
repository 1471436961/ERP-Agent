import {schemas, authorize, checkInvoice, businessKey, digest, snapshot, fail} from './policy.mjs';
import {classify} from './legacy/risk.mjs';
import {step} from './telemetry.mjs';

export class Engine {
  constructor({erp, store, profile}) {
    this.erp = erp; this.store = store;
    this.profile = structuredClone(profile); // Binding is server-owned, not a tool parameter.
  }
  summary(row) {
    return {operationId: row.id, state: row.state, ...(row.result ? {result: row.result} : {}),
      ...(row.reason ? {reason: row.reason} : {})};
  }
  api(method, ...args) {
    return step(`erp.api.${method}`, {method}, () => this.erp[method](this.profile.erpUser,...args));
  }
  async call(action, args) {
    if (!Object.hasOwn(schemas,action)) fail('unknown_tool');
    const parsed = schemas[action].safeParse(args);
    if (!parsed.success) fail('invalid_arguments');
    const call = {action,...parsed.data};
    return step('erp.connector.call', {action}, async () => {
      if (action === 'erp.operation') {
        this.store.owned(call.operationId,this.profile.principal);
        return call.mode === 'resume' ? this.resume(call.operationId) : this.summary(this.store.get(call.operationId));
      }
      authorize(this.profile,call);
      if (classify(action) === 'read') {
        const data = action === 'erp.query' ? await this.api('list',call.docType,call.filters)
          : action === 'erp.get' ? await this.api('get',call.docType,call.name)
          : await this.api('runReport',call.report,call.filters);
        return {state: 'read_complete', data};
      }
      let preview, fingerprint;
      if (action === 'erp.submit') {
        const doc = await this.api('get',call.docType,call.name);
        const total = checkInvoice(this.profile,doc,{existing:true});
        fingerprint = snapshot(doc);
        preview = {action, name:call.name, company:doc.company, supplier:doc.supplier,
          currency:doc.currency, amount:total, docstatus:doc.docstatus, items:doc.items};
      } else {
        const total = checkInvoice(this.profile,call.doc);
        preview = {action, ...call.doc, estimatedAmount:total};
      }
      const payload = {call, preview, fingerprint: fingerprint ?? null,
        binding:digest(this.profile), erpUser:this.profile.erpUser};
      const row = this.store.propose({key:businessKey(this.profile,call),principal:this.profile.principal,
        hash:digest(payload),payload});
      return this.summary(row);
    },'tool');
  }
  async resume(id) {
    const original = this.store.owned(id,this.profile.principal);
    const {call,binding,fingerprint} = original.payload;
    authorize(this.profile,call);
    if (binding !== digest(this.profile)) fail('identity_or_policy_changed');
    const row = this.store.claim(id,this.profile.principal);
    if (!row) return this.summary(this.store.get(id));
    return step('erp.operation.execute',{operationId:id},async () => {
      let writeStarted = false;
      try {
        if (call.action === 'erp.submit') {
          const current = await this.api('get',call.docType,call.name);
          checkInvoice(this.profile,current,{existing:true});
          if (snapshot(current) !== fingerprint) fail('document_changed_after_approval');
        } else {
          checkInvoice(this.profile,call.doc);
          // Collision check before the first write. Empty query is NOT proof a timed-out write failed.
          const existing = await this.api('list',call.docType,{company:call.doc.company,supplier:call.doc.supplier,bill_no:call.doc.bill_no});
          if (existing.length) fail('invoice_already_exists');
        }
        writeStarted = true;
        const receipt = call.action === 'erp.submit'
          ? await this.api('submit',call.docType,call.name)
          : await this.api('insert',call.docType,call.doc);
        const doc = await this.api('get',call.docType,receipt.name);
        const expectedStatus = call.action === 'erp.submit' ? 1 : 0;
        if (Number(doc.docstatus) !== expectedStatus || doc.name !== receipt.name) fail('verification_failed');
        if (call.action === 'erp.submit') {
          const approved = row.payload.preview;
          for (const key of ['company','supplier','currency']) if (doc[key] !== approved[key]) fail('verification_failed');
          if (Number(doc.grand_total) !== approved.amount) fail('verification_failed');
          const lines = items => items?.map(i=>({item_code:i.item_code,qty:Number(i.qty),rate:Number(i.rate)}));
          if (digest(lines(doc.items)) !== digest(lines(approved.items))) fail('verification_failed');
        }
        if (call.action === 'erp.create_draft') {
          for (const key of ['company','supplier','bill_no','currency']) if (doc[key] !== call.doc[key]) fail('verification_failed');
          const actualItems = doc.items?.map(i => ({item_code:i.item_code,qty:Number(i.qty),rate:Number(i.rate)}));
          if (digest(actualItems) !== digest(call.doc.items)) fail('verification_failed');
          // Host-computed total, including taxes, must satisfy the cap too.
          checkInvoice(this.profile,doc,{existing:true});
        }
        this.store.finish(id,'verified',{name:doc.name,docstatus:Number(doc.docstatus)});
      } catch (error) {
        // An executing row survives a crash. NEVER reclaim or automatically retry it.
        this.store.finish(id,writeStarted ? 'unknown' : 'blocked',null,
          writeStarted ? 'write_or_verification_uncertain_do_not_retry' : 'prewrite_check_failed');
      }
      return this.summary(this.store.get(id));
    });
  }
}
