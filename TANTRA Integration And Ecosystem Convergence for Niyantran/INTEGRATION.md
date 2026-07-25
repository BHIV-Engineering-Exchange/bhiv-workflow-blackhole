# Integration & Event Contract Documentation

**Date:** 2026-07-25  
**Version:** 1.0.0  
**Target Contracts:** KARMA signal contract v1.0.0, Bucket ArtifactEnvelope spec  

---

## 1. Telemetry Mapping Registry

Niyantran-internal events are translated to canonical ecosystem event mapping models before publication.

| Local Event source | Channel Type | Event Type | Target Service | Payload Translation details |
|---|---|---|---|---|
| `activityTracker.js` | eventBus | `excessive_idle` | KARMA (via Bucket) | Mapped to `opaque_reason_code: "NIY_MON_001"`, severity mapped linearly based on idle duration (nudge/restrict signals) |
| `ems_signals.js` | eventBus | `excessive_idle` | KARMA (via Bucket) | Mapped to `opaque_reason_code: "NIY_EMS_001"` or `NIY_EMS_002` (idle thresholds) |
| `websiteMonitor.js` | eventBus | `disallowed_site` | KARMA (via Bucket) | Mapped to `opaque_reason_code: "NIY_MON_002"`, signal set to restrict with 0.8 severity |
| `screenCapture.js` | eventBus | `store_screenshot` | Bucket | Mapped to artifact class `agent_outputs` with user metadata and base64 payload |

---

## 2. Event Contracts

### 2.1 KARMA Signal Contract Envelope

All behavioral events destined for KARMA must conform to the following schema contract:

```json
{
  "subject_id": "UUID (string)",
  "product_context": "workflow",
  "signal": "allow | nudge | restrict | escalate",
  "severity": 0.0,
  "ttl": 300,
  "requires_core_ack": true,
  "opaque_reason_code": "NIY_MON_xxx"
}
```

*Note: The `product_context` is strictly enforced as `"workflow"` per contract guidelines, and all events are validated client-side against the contract before being sent to the relay.*

### 2.2 Bucket ArtifactEnvelope Spec

All artifacts stored on the Bucket filesystem must conform to this schema:

```json
{
  "artifact_id": "UUID (string)",
  "trace_id": "string",
  "timestamp_utc": "ISO-8601 string",
  "schema_version": "1.0.0",
  "source_module_id": "niyantran",
  "artifact_type": "agent_outputs | execution_metadata | audit_trails | event_records",
  "parent_hash": "string (null if root)",
  "payload": {}
}
```

*Note: In accordance with the append-only evidence contract, the cryptographic `hash` is calculated server-side by the Bucket service; the client envelope does not send a hash.*
