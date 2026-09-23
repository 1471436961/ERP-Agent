import {userInfo} from 'node:os';
import {Store} from './store.mjs';
import {createTelemetry,step} from './telemetry.mjs';

// Trusted operator terminal only. No approval tool exposed to OpenWorker.
const [command,id,hash] = process.argv.slice(2);
if (!process.env.ERP_STATE_DB) throw new Error('ERP_STATE_DB_required');
const store = new Store(process.env.ERP_STATE_DB);
const telemetry = createTelemetry({send:process.env.SEND_LANGFUSE === '1'});
try {
  if (command === 'list') console.log(JSON.stringify(store.list(),null,2));
  else if (command === 'show') {
    const row = store.get(id);
    console.log(JSON.stringify({id:row.id,state:row.state,hash:row.payload_hash,
      expires:new Date(row.expires).toISOString(),principal:row.principal,preview:row.payload.preview},null,2));
  } else if (['approve','reject'].includes(command)) {
    const state = command === 'approve' ? 'approved' : 'rejected';
    const row = await step('erp.approval.decision',{operationId:id,decision:state},
      () => store.decide(id,hash,state,`operator:${userInfo().username}`));
    console.log(JSON.stringify({operationId:row.id,state:row.state}));
  } else throw new Error('usage: list | show ID | approve ID HASH | reject ID HASH');
} finally { await telemetry.shutdown(); store.close(); }
