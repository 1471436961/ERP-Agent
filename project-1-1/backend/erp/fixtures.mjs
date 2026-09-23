import {FakeErpClient} from './legacy/fakeErpClient.mjs';
export const invoice = (bill = 'CLASS-001') => ({company:'Agentify Demo Co',supplier:'Globex',
  bill_no:bill,currency:'USD',posting_date:'2026-09-18',items:[{item_code:'CLASS-ITEM',qty:2,rate:30}]});
export class ClassroomErp extends FakeErpClient {
  constructor(user) {
    super(); this.writes = 0;
    this.seedPermission(user,'Purchase Invoice',['read','write','submit']);
  }
  async insert(user,dt,doc) {
    this.writes++;
    return super.insert(user,dt,{...doc,grand_total:doc.items.reduce((s,i)=>s+i.qty*i.rate,0)});
  }
  async submit(...args) { this.writes++; return super.submit(...args); }
}
