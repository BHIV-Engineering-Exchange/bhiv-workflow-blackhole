# Architecture Documentation — Niyantran ↔ TANTRA Ecosystem Convergence

**Date:** 2026-07-25  
**Ecosystem Version:** 1.0.0  
**Status:** Completed & Integrated

---

## 1. Architecture Overview

Niyantran operates as an execution participant within the canonical TANTRA ecosystem, adhering to strict boundaries and utilizing shared, decoupled messaging protocols. The integration is split into two primary layers:

1. **TANTRA Gateway Runtime Contracts**: Handles formal execution participation requests, validating routing, tenant isolation, and tracing, and persisting the cryptographic hash chain of event logs.
2. **Decoupled Telemetry Event Bus**: Decouples local behavioral monitoring from downstream ecosystem components (KARMA, Bucket) via a Redis pub/sub event pipeline with graceful local in-process fallback mechanism.

```mermaid
graph TB
    subgraph Client ["Niyantran Client Context"]
        EMP[Employee Browser / Desktop Agent]
    end

    subgraph Niyantran ["Niyantran HRMS System"]
        BE[Express Backend]
        DB[(MongoDB)]
        EB[Event Bus Wrapper]
    end

    subgraph Broker ["Message Broker"]
        REDIS[(Redis pub/sub channel: ecosystem.events)]
    end

    subgraph Ecosystem ["TANTRA Ecosystem Substrate"]
        BUCKET[BHIV Bucket Service]
        KARMA[KARMA behavioral Tracker]
    end

    EMP -->|Telemetry Event| BE
    BE -->|Publish| EB
    EB -->|Redis PUBLISH| REDIS
    REDIS -->|Redis SUBSCRIBE| EB
    EB -->|relays event| BUCKET
    BUCKET -->|relays signal| KARMA
    BE -->|Persist state| DB
```

---

## 2. Runtime Sequence Diagrams

### 2.1 Decoupled Telemetry Event Flow (Redis pub/sub)

When telemetry events (e.g. idle duration, site violations, or screenshots) are captured, they are published asynchronously to Redis pub/sub. Decoupled handlers subscribe and dispatch writes to Bucket/KARMA fire-and-forget.

```mermaid
sequenceDiagram
    participant Monitor as Telemetry Monitor (e.g. activityTracker)
    participant Bus as Event Bus (eventBus.js)
    participant Redis as Redis Broker
    participant Handler as eventBus Subscriber
    participant Bucket as Bucket Service

    Monitor->>Bus: publish('excessive_idle', { employeeId, idleMinutes })
    alt Redis is connected
        Bus->>Redis: PUBLISH ecosystem.events
        Redis-->>Handler: On Message ('excessive_idle')
        Handler->>Bucket: storeKarmaEventRecord()
    else Redis is disconnected (Fallback)
        Bus->>Bus: localEmitter.emit('excessive_idle')
        Bus->>Bucket: storeKarmaEventRecord()
    end
    Note over Handler,Bucket: Fire-and-forget; does not block request paths
```

### 2.2 TANTRA Execution Gateway Flow (Trace & Identity Persistence)

For formal execution contracts, the gateway enforces JWT authentication, trace continuity, tenant isolation, and persists the resolved initiating actor details onto the `ExecutionSession` model.

```mermaid
sequenceDiagram
    participant Caller as External Caller / SETU
    participant Gate as tantraExecution Route
    participant MW as executionAuth → traceContinuity → tenantIsolation
    participant DB as MongoDB (ExecutionSession)

    Caller->>Gate: POST /api/tantra/execution/participate
    Gate->>MW: Run middleware chain
    MW->>MW: Verify Trace & Tenant Match
    MW->>MW: Resolve Actor (req.user OR req.executionAuthority)
    MW->>DB: Save/Update ExecutionSession with actorId & actorType
    Gate->>DB: Save ExecutionEvent (hash-chained)
    Gate-->>Caller: 200 OK (with result_hash, start_hash, end_hash)
```
