import {NodeSDK} from '@opentelemetry/sdk-node';
import {InMemorySpanExporter} from '@opentelemetry/sdk-trace-base';
import {LangfuseSpanProcessor} from '@langfuse/otel';
import {startActiveObservation, propagateAttributes, getActiveTraceId} from '@langfuse/tracing';

// Start once per process, before creating agents. No automatic HTTP instrumentation.
export function createTelemetry({send = false} = {}) {
  const exporter = new InMemorySpanExporter();
  const processors = [new LangfuseSpanProcessor({exporter, mediaUploadEnabled: false,
    publicKey: 'offline', secretKey: 'offline', baseUrl: 'http://127.0.0.1', environment: 'classroom'})];
  if (send) {
    for (const key of ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASE_URL']) {
      if (!process.env[key]?.trim()) throw new Error(`missing_${key}`);
    }
    const url = new URL(process.env.LANGFUSE_BASE_URL);
    if (url.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')) {
      throw new Error('use_https_or_localhost');
    }
    processors.push(new LangfuseSpanProcessor({mediaUploadEnabled: false, environment: 'classroom'}));
  }
  const sdk = new NodeSDK({spanProcessors: processors});
  sdk.start();
  return {exporter, flush: () => Promise.all(processors.map(p => p.forceFlush())),
    shutdown: () => sdk.shutdown()};
}

// Only controlled labels and generated operation IDs enter telemetry.
export async function step(name, metadata, work, asType = 'span') {
  const envelope = await startActiveObservation(name, async span => {
    span.update({metadata});
    try {
      const value = await work();
      const state = value?.state || 'completed';
      span.update({output: {state}, ...(['unknown','blocked','rejected','expired'].includes(state) ? {level:'WARNING',statusMessage:state} : {}), metadata: {...metadata,
        ...(value?.operationId ? {operationId: value.operationId} : {})}});
      return {value};
    } catch (error) {
      span.update({level: 'ERROR', statusMessage: 'operation_failed', output: {state: 'failed'}});
      return {error}; // Never let the SDK auto-capture a raw ERP exception.
    }
  }, {asType});
  if (envelope.error) throw envelope.error;
  return envelope.value;
}
