# CODE_INDEX.md — TANTRA Integration And Ecosystem Convergence

Listing of the files created or modified during the Niyantran-TANTRA convergence work.

| File Path (relative to `server/`) | Status | Reason |
|---|---|---|
| [`services/eventBus.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/services/eventBus.js) | **[NEW]** | Thin pub/sub wrapper using Redis as transport with local EventEmitter fallback |
| [`services/activityTracker.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/services/activityTracker.js) | **[MODIFY]** | Published excessive_idle events onto the event bus instead of calling karmaClient directly |
| [`services/ems_signals.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/services/ems_signals.js) | **[MODIFY]** | Decoupled EMS idle signals by routing them through the event bus |
| [`services/websiteMonitor.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/services/websiteMonitor.js) | **[MODIFY]** | Decoupled disallowed site compliance alerts to publish to the event bus |
| [`services/screenCapture.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/services/screenCapture.js) | **[MODIFY]** | Replaced direct bucketClient screenshot store with event bus publication |
| [`models/ExecutionSession.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/models/ExecutionSession.js) | **[MODIFY]** | Added actorId and actorType fields to schema for replay tracking |
| [`middleware/tenantIsolation.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/middleware/tenantIsolation.js) | **[MODIFY]** | Resolved and persisted initiating actor credentials to session records at runtime |
| [`tests/eventBus.test.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/tests/eventBus.test.js) | **[NEW]** | Unit tests for Redis pub/sub and local event propagation fallback paths |
| [`tests/tenantIsolation.test.js`](file:///c:/Users/shash/OneDrive/Documents/INFIVERSE-HR-PLATFORM/workflow-blackhole/server/tests/tenantIsolation.test.js) | **[NEW]** | Unit tests for enforceTenantIsolation and actor identity persistence validations |
