/**
 * Tier-2 Niyantran partner capture — uses real ExecutionEvent from Mongo when present.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: false });
const mongoose = require('mongoose');
const ExecutionEvent = require('../models/ExecutionEvent');
const { dispatchToSampada } = require('../services/setuDispatcher');

const uri = (process.env.MONGODB_URI || '').trim().replace(/^"|"$/g, '');
if (!uri) {
  console.log(JSON.stringify({ ok: false, error: 'MONGODB_URI missing' }));
  process.exit(1);
}

(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  let event = await ExecutionEvent.findOne().sort({ eventTimestamp: -1 }).lean();
  if (!event) {
    console.log(JSON.stringify({
      ok: false,
      tier: 'Not Yet Available',
      blocker: 'No ExecutionEvent documents in Niyantran Mongo — cannot build payload from real records',
    }));
    process.exit(1);
  }

  const result = await dispatchToSampada(event, {
    correlationId: process.env.SAMPADA_SETU_CORRELATION_ID,
  });
  console.log(JSON.stringify({
    ok: !!result.dispatched,
    tier: 'Tier 2 — dispatcher invoked directly, partner server not booted in this environment',
    execution_event_id: event.eventId,
    sampada_signal_id: result.response?.body?.signal_id,
    trace_id: event.traceId,
    correlation_id: result.request?.body?.correlation_id,
    ...result,
  }));
  await mongoose.disconnect();
  process.exit(result.dispatched ? 0 : 1);
})().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
