import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {Engine} from './engine.mjs';
import {testProfile} from './policy.mjs';
import {ClassroomErp,invoice} from './fixtures.mjs';
import {createTelemetry} from './telemetry.mjs';

const dir=mkdtempSync(join(tmpdir(),'erp-governed-'));
const store=new Store(join(dir,'erp.sqlite')), profile=testProfile();
const erp=new ClassroomErp(profile.erpUser), engine=new Engine({erp,store,profile});
const telemetry=createTelemetry({send:process.argv.includes('--send-langfuse')});
try {
  console.log('OFFLINE SCRIPTED DEMO: Fake ERP; operator decisions below are test fixtures, not human approvals.');
  for (const scenario of ['approved','rejected','write-timeout']) {
    const request=await engine.call('erp.create_draft',{docType:'Purchase Invoice',doc:invoice(scenario)});
    console.log(scenario,'request',request);
    const row=store.get(request.operationId);
    store.decide(row.id,row.payload_hash,scenario==='rejected'?'rejected':'approved','scripted-demo-operator');
    if (scenario==='write-timeout') erp.timeoutOnce=true;
    console.log(scenario,'resume',await engine.call('erp.operation',{operationId:row.id,mode:'resume'}));
    console.log(scenario,'repeat resume',await engine.call('erp.operation',{operationId:row.id,mode:'resume'}));
  }
  await telemetry.flush();
  console.log(JSON.stringify({stateDatabase:join(dir,'erp.sqlite'),writes:erp.writes,
    spans:telemetry.exporter.getFinishedSpans().map(s=>({name:s.name,traceId:s.spanContext().traceId,
      spanId:s.spanContext().spanId,parentSpanId:s.parentSpanContext?.spanId}))},null,2));
} finally {await telemetry.shutdown();store.close();}
