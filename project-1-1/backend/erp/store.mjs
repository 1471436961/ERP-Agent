import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, chmodSync, lstatSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fail} from './policy.mjs';

export class Store {
  constructor(path) {
    if (path !== ':memory:') {
      const dir = dirname(resolve(path));
      mkdirSync(dir, {recursive: true, mode: 0o700});
      if ((lstatSync(dir).mode & 0o077) !== 0) fail('state_directory_must_be_private');
      try { if (lstatSync(path).isSymbolicLink()) fail('state_symlink_denied'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY, business_key TEXT NOT NULL UNIQUE, principal TEXT NOT NULL,
        payload_hash TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL,
        expires INTEGER NOT NULL, result TEXT, reason TEXT, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, operation_id TEXT NOT NULL, event TEXT NOT NULL,
        actor TEXT NOT NULL, at INTEGER NOT NULL);`);
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = work(); this.db.exec('COMMIT'); return r; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  event(id, event, actor) { this.db.prepare('INSERT INTO events(operation_id,event,actor,at) VALUES(?,?,?,?)').run(id,event,actor,Date.now()); }
  get(id) {
    const r = this.db.prepare('SELECT * FROM operations WHERE id=?').get(id);
    if (!r) fail('operation_not_found');
    return {...r, payload: JSON.parse(r.payload), result: r.result ? JSON.parse(r.result) : null};
  }
  propose({key, principal, hash, payload, ttl = 300000}) {
    return this.transaction(() => {
      const old = this.db.prepare('SELECT id FROM operations WHERE business_key=?').get(key);
      if (old) {
        const r = this.get(old.id);
        if (r.principal !== principal) fail('business_key_owned_by_other_identity');
        if (r.payload_hash !== hash) fail('business_key_payload_conflict');
        return r;
      }
      const id = randomUUID(), now = Date.now();
      this.db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(id,key,principal,hash,JSON.stringify(payload),'pending',now+ttl,null,null,now);
      this.event(id,'pending',principal);
      return this.get(id);
    });
  }
  owned(id, principal) {
    const r = this.get(id);
    if (r.principal !== principal) fail('operation_identity_mismatch');
    return r;
  }
  // Operator-only entry point. Deliberately NOT registered as an MCP tool.
  decide(id, expectedHash, decision, actor) {
    if (!actor || !['approved','rejected'].includes(decision)) fail('invalid_decision');
    return this.transaction(() => {
      const r = this.get(id);
      if (r.payload_hash !== expectedHash) fail('approval_hash_mismatch');
      if (r.state !== 'pending') fail('approval_already_decided');
      const state = Date.now() > r.expires ? 'expired' : decision;
      this.db.prepare('UPDATE operations SET state=? WHERE id=?').run(state,id);
      this.event(id,state,actor);
      return this.get(id);
    });
  }
  claim(id, principal) {
    return this.transaction(() => {
      const r = this.owned(id,principal);
      if (r.state !== 'approved') return null;
      if (Date.now() > r.expires) { this.finish(id,'expired',null,'approval_expired'); return null; }
      this.db.prepare("UPDATE operations SET state='executing' WHERE id=? AND state='approved'").run(id);
      this.event(id,'executing',principal);
      return this.get(id);
    });
  }
  finish(id,state,result=null,reason=null) {
    this.db.prepare('UPDATE operations SET state=?,result=?,reason=? WHERE id=?').run(state,result ? JSON.stringify(result) : null,reason,id);
    this.event(id,state,'connector');
  }
  list() { return this.db.prepare('SELECT id,state,payload_hash,expires FROM operations ORDER BY created DESC LIMIT 30').all(); }
  close() { this.db.close(); }
}
