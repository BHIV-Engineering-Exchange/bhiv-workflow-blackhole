# Dependency Map — Niyantran (workflow-blackhole)

## 1. Internal dependencies (within this repo)

```
client/  →  depends on  →  server/  (all data; via REST + Socket.IO)
server/routes/*  →  depends on  →  server/models/*, server/services/*, server/middleware/*
server/services/eventBus.js  →  optionally depends on  →  Redis (graceful fallback if absent)
server/services/attendanceCronJobs.js  →  depends on  →  server/models/WorkSession.js, Attendance-related models
```

There is no internal package boundary (e.g. a shared npm workspace) — `client/` and `server/` are two independent Node projects with their own `package.json`, connected only over HTTP/WebSocket at runtime.

## 2. External (third-party) dependencies

| Service | Purpose | Required for core function? |
|---|---|---|
| MongoDB Atlas | System of record | Yes — hard dependency |
| Redis | Pub/sub for real-time events | No — automatic fallback exists |
| Cloudinary | Screenshot/file storage | Only for EMS/screenshot features |
| Groq API | AI task review | Only for AI features |
| Google Gemini API | AI task review | Only for AI features |
| SMTP provider | Transactional email | Only for email-dependent flows (password reset, welcome email, procurement/leave notifications) |
| npm registry | Package installation at build/deploy time | Yes, at build time |

## 3. Ecosystem (cross-repository) dependencies — per `ECOSYSTEM_REPOSITORY_MAP.md`

| System | Relationship to Niyantran |
|---|---|
| **Sampada** (`INFIVERSE-HR-PLATFORM`, not in this handover) | Consumes Niyantran's TANTRA participation signals via the SETU ingestion layer inside Sampada's gateway. Contract is the `/v1/setu/*` routes on Sampada's side and the `SAMPADA_SETU_*` env vars + `/api/tantra`, `/api/integration` routes on this side. |
| **Bucket** | Persistence/replay-chain participant. Vendored locally as `bhiv-bucket/` for local dev only (and its Dockerfile is missing — see Known Issues); production points at an externally-hosted instance on Render. `services/bucketClient.js` is the integration code, with a passing dedicated test suite. |
| **PRANA** | Signal/packet participation. Vendored locally as `bhiv_prana/`; explicitly not deployed in production per the compose template — repo-only today. |
| **Karma** | Karma tracking participation. Vendored locally as `Karma-Tracker/`; `services/karmaClient.js` is the integration code, with a passing dedicated test suite. |
| **ai-crm** (CRM + Logistics + SETU) | **Correction from an earlier draft of this document: there is a confirmed, direct, multi-point dependency, not merely an indirect ecosystem relationship.** Verified while producing `ai-crm/handover/`: (1) `ai-crm`'s React frontend (`Infiverse.jsx`) calls this system's production API directly from the browser; (2) `ai-crm`'s Python backend has a 23-endpoint reverse-proxy layer (`INFIVERSE_BASE_URL`) forwarding requests here; (3) `ai-crm`'s SETU module has a dedicated `niyantran_integration_adapter.py`. This repository (Niyantran) is the **callee** in all three cases — nothing in this codebase calls out to `ai-crm`, but `ai-crm` depends on this system reachably more than on any other ecosystem component. See `ai-crm/handover/09_DEPENDENCY_MAP.md` for full detail. |
| **Artha** | No reference found in this codebase. Per the ecosystem map it's a separate payroll/financial system; no integration code for it was found here. |

**Important, verified scope note:** `bhiv-bucket`, `bhiv_prana`, and `Karma-Tracker` are vendored *copies* inside this repo for local orchestration convenience — they are **not owned by the Niyantran team** per `ECOSYSTEM_REPOSITORY_MAP.md` §7 ("never commit partner/external repo folders"). Treat any changes needed inside those folders as a cross-team request, not something to fix unilaterally here.

## 4. Team dependencies

Per the source task and ecosystem map:

| Need | Who to ask (per existing documentation) |
|---|---|
| System ownership / handover sign-off | Shashank Mishra (owner), Rishabh Yadav (ecosystem acceptance authority) |
| Strategic placement questions | TMS (per `ECOSYSTEM_REPOSITORY_MAP.md` §6) |
| Governance / authority questions | GC |
| Data / schema / provenance questions | MDU |
| Bucket system access/changes | Bucket team (owner of the externally-hosted Render service) |
| Sampada/SETU contract changes | Sampada team — the `/v1/setu/*` contract is described as frozen unless the owner approves changes |

## 5. Repository dependencies (build/deploy order)

1. MongoDB Atlas must be reachable before the backend will finish booting.
2. Backend (`server/`) must be reachable before the frontend is useful (the frontend will load, but every data-dependent view will fail).
3. Frontend build (`npm run build`) needs `VITE_API_URL` set correctly **before** building, since it's compiled into the static bundle — this is a build-order dependency, not just a runtime one.
4. Docker Compose brings services up in the order defined by `depends_on` in `docker-compose.yml` (Mongo/Redis before backend, backend before frontend) — read that file directly if you're changing startup order.

## 6. Service dependencies (runtime call graph, summarized)

See `02_ARCHITECTURE_GUIDE.md` §3 for the full interaction diagram; in short, `server/` is the hub — everything else (client, MongoDB, Redis, Cloudinary, AI providers, SMTP, TANTRA gateway) is a spoke that `server/` calls out to or is called by. Nothing in this repo calls Bucket/PRANA/Karma's HTTP APIs directly in a way that would block the main request path if they're down — confirm this assumption against `services/bucketClient.js` and `services/karmaClient.js` directly if you're relying on it for an availability decision.
