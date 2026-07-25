# ARCHITECTURE.md
### Niyantran — TANTRA Ecosystem Deployment Architecture (As-Built)

**Last updated:** 2026-07-25 — Phase 5 + KARMA/Bucket wiring complete.

---

## Service Topology (Production VM)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Production VM                             │
│                                                                  │
│  ┌──────────┐                                                    │
│  │  nginx   │ :80/:443  ← public ingress                        │
│  │  proxy   │                                                    │
│  └────┬─────┘                                                    │
│       │                                                          │
│  ┌────▼─────────────┐    ┌──────────────────┐                    │
│  │ Niyantran        │    │ Niyantran        │                    │
│  │ Frontend         │    │ Backend  :5000   │                    │
│  │ (React SPA)      │    │ (Express.js)     │                    │
│  └──────────────────┘    └───┬──┬──┬────────┘                    │
│                              │  │  │                             │
│            ┌─────────────────┘  │  └─────────────────┐           │
│            │                    │                     │           │
│  ┌─────────▼──────┐  ┌────────▼─────────┐  ┌───────▼────────┐  │
│  │ bhiv-bucket     │  │ bhiv-prana        │  │ MongoDB        │  │
│  │ :8001           │  │ :8002            │  │ (Atlas cloud)  │  │
│  │ Artifact store  │  │ Stateless fwd    │  │                │  │
│  └───────┬─────────┘  └─────────────────┘  └────────────────┘  │
│          │                                                       │
│  ┌───────▼─────────┐  ┌─────────────────┐                       │
│  │ karma-tracker    │  │ Redis           │                       │
│  │ :8003            │  │ :6379           │                       │
│  │ Behavioral score │  │ (Bucket cache)  │                       │
│  └──────────────────┘  └─────────────────┘                       │
│                                                                  │
│  ┌─ Monitoring ──────────────────────────────────────────────┐   │
│  │ Prometheus :9090 │ Grafana :3000 │ cAdvisor │ node-export │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Service Dependency Chain

```
Redis
  └─► bhiv-bucket (needs Redis for caching)
        ├─► karma-tracker (depends_on bhiv-bucket — B7 authorization)
        └─► backend (depends_on bhiv-bucket for artifact writes)
              └─► frontend (depends_on backend health)
                    └─► proxy (depends_on frontend + backend)

bhiv-prana (independent — no hard dependencies)
MongoDB Atlas (external — cloud-hosted, no local container)
```

## Data Flow Summary

| Flow | Path | Status |
|------|------|--------|
| Screenshots | Backend → Cloudinary (primary) + Bucket (additive) | ✅ Wired |
| KARMA idle signal | activityTracker / ems_signals → karmaClient → bucketClient → Bucket → KARMA | ✅ Wired |
| KARMA disallowed site | websiteMonitor → karmaClient → bucketClient → Bucket → KARMA | ✅ Wired |
| TANTRA execution | External caller → `/api/tantra/execution/participate` → MongoDB | ✅ Wired |
| PRANA session | Login → PRANA session start → telemetry → dashboard | ❌ Blocked (B6) |
| Integration health | Admin → `/api/integration/health` → probes all services | ✅ Wired |

## Authentication Between Services

| From → To | Auth Mechanism | Header |
|-----------|---------------|--------|
| Backend → Bucket | API key | `x-api-key: BUCKET_API_KEY` |
| Backend → Bucket | Source identity | `x-source: niyantran` |
| Bucket → KARMA | Source identity | `x-source: bucket` (required by KARMA authorization.py) |
| Backend → KARMA | **Blocked** | KARMA rejects any source other than `bucket`, `core`, `internal` |
| Backend → PRANA | API key (reserved) | Not yet configured (B6 gap) |
| External → TANTRA | Execution key | `x-execution-key: TANTRA_EXECUTION_KEY` |
| User → Backend | JWT | `x-auth-token: <JWT>` |

## Ports

| Service | Internal Port | External (Dev) | External (Prod) |
|---------|--------------|----------------|-----------------|
| Backend | 5000 | 5000/5001 | proxy-only |
| Frontend | 80 | 80 | proxy-only |
| bhiv-bucket | 8001 | 8001 | internal-only |
| bhiv-prana | 8002 | 8002 | internal-only |
| karma-tracker | 8003 | 8003 | internal-only |
| Redis | 6379 | 6379 | internal-only |
| MongoDB | 27017 | 27017 | Atlas cloud |
| Prometheus | 9090 | 9090 | 9090 |
| Grafana | 3000 | 3000 | 3000 |

## Ownership Boundaries

| Component | Owner | Niyantran's Relationship |
|-----------|-------|--------------------------|
| PRANA | Rukayya | Consumer (when session endpoint exists) |
| KARMA | Rukayya | Producer (emit events) + Consumer (read signals) |
| Bucket | Rukayya | Producer (store artifacts) + Consumer (governance gate) |
| TANTRA Runtime | Shared | Participant (execution contracts) |
| Niyantran | This team | Owner |
| Cloudinary | This team | Primary artifact storage (not deprecated) |
