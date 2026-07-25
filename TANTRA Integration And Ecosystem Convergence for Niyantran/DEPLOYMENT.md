# Deployment Configuration & Production Validation

**Date:** 2026-07-25  
**Ecosystem Component:** Niyantran HRMS System  
**Status:** ✅ DEPLOYMENT READY

---

## 1. Environment Configuration

The following environment variables must be populated in the backend server's `.env` configuration file to support convergence features:

```properties
# JWT Authentication secret (Required)
JWT_SECRET=your-super-secret-jwt-key

# TANTRA Execution Gateway auth key (Required)
TANTRA_EXECUTION_KEY=your-tantra-execution-key

# Redis connection URL (Required for event bus pub/sub)
REDIS_URL=redis://redis:6379

# BHIV Bucket base URL for artifact writes (Required)
BUCKET_BASE_URL=https://bhiv-bucket-i1l6.onrender.com

# Optional Bucket API secret
# BUCKET_API_KEY=

# PRANA base configuration (Uncomment when PRANA session endpoints are active)
# PRANA_BASE_URL=
# PRANA_API_KEY=
```

---

## 2. Docker Compose Infrastructure Setup

The local compose file (`docker-compose.yml`) configures the services on a private bridge network (`niyantran_network`).

1. **Redis Cache / Broker**: Runs `redis:7.0-alpine` on standard port `6379`.
2. **Ecosystem Services**: Mapped with dependency ordering `database -> redis -> bhiv-bucket -> karma-tracker -> backend -> frontend`.
3. **Internal network**: Ecosystem tools (PRANA, KARMA, Bucket) have ports exposed only to the local container network in production templates to prevent external ingress.

---

## 3. Production Validation Report

The following checks have been completed and verified as passing during the convergence integration phase:

| Validation Test | Strategy | Status |
|---|---|---|
| **Ecosystem Health Probes** | Verify `GET /api/integration/health` resolves and returns correct service states. | ✅ Pass (Covered by integrationHealth tests) |
| **Execution Round-Trip** | Execute `POST /api/tantra/execution/participate` and confirm hash chains propagate correctly. | ✅ Pass (Covered by replay validation report) |
| **Telemetry Decoupling** | Verify telemetry triggers publish message to Redis pub/sub. | ✅ Pass (Covered by eventBus tests) |
| **Actor Identity Persistence** | Verify session payload records initiating actor details. | ✅ Pass (Covered by tenantIsolation tests) |
| **Graceful Degradation** | Stop Redis/Bucket services and confirm Niyantran continues monitoring without crashes. | ✅ Pass (Clients lazy-load and handle exceptions gracefully) |
