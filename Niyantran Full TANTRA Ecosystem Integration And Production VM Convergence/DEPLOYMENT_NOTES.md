# DEPLOYMENT_NOTES.md
### Niyantran — TANTRA Ecosystem Deployment Guide

---

## Prerequisites

1. **Docker Engine** 24+ and **Docker Compose** v2 installed on the production VM
2. **MongoDB Atlas** connection string (`MONGODB_URI`) — database is cloud-hosted, not containerized
3. **Environment file** (`.env`) with all required variables — see `ENVIRONMENT.md`
4. **Docker Hub access** — images are pulled from `bhiv/` organization

## Service Start Order

Docker Compose handles this automatically via `depends_on` + `healthcheck`, but for reference:

```
1. redis           (no deps — starts immediately)
2. bhiv-bucket     (waits for redis healthy)
3. bhiv-prana      (no deps — starts in parallel)
4. karma-tracker   (waits for bhiv-bucket healthy)
5. backend         (waits for bhiv-bucket healthy)
6. frontend        (waits for backend healthy)
7. proxy           (waits for frontend + backend)
8. monitoring      (independent — starts in parallel)
```

## Deploy (Dev — Local Docker)

```bash
# From repo root
docker-compose up -d --build

# Verify all services healthy
docker-compose ps
docker-compose logs --tail=20 backend
```

## Deploy (Production VM)

```bash
# 1. SSH into production VM
ssh deploy@<VM_IP>

# 2. Pull latest images (replace IMG_TAG with actual tag)
export IMG_TAG=latest
docker-compose -f docker-compose.production.template.yml pull

# 3. Start services
docker-compose -f docker-compose.production.template.yml up -d

# 4. Verify health
curl http://localhost:5000/api/ping
curl http://localhost:8001/health
curl http://localhost:8002/health

# 5. Check integration health (requires admin JWT)
curl -H "x-auth-token: <ADMIN_JWT>" http://localhost:5000/api/integration/health
```

## Environment Variable Checklist (Pre-Deploy)

| Variable | Required | Where to Set |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | `.env` — server aborts without it |
| `TANTRA_EXECUTION_KEY` | ✅ | `.env` — server aborts without it |
| `MONGODB_URI` | ✅ | `.env` — server aborts without it |
| `BUCKET_BASE_URL` | ✅ | `docker-compose` sets to `http://bhiv-bucket:8001` |
| `BUCKET_API_KEY` | ✅ | `.env` — needed for artifact writes |
| `PRANA_BASE_URL` | Optional | `docker-compose` sets to `http://bhiv-prana:8002` |
| `CLOUDINARY_*` | Conditional | `.env` — needed if screenshots enabled |

## Health Check Endpoints

| Endpoint | Auth | Expected Response |
|----------|------|-------------------|
| `GET /api/ping` | None | `{"message":"Pong!"}` |
| `GET /api/tantra/health` | None | `{"status":"healthy", ...}` |
| `GET /api/integration/health` | Admin JWT | Full ecosystem status |
| `GET /health` (Bucket :8001) | None | `{"status":"healthy"}` |
| `GET /health` (PRANA :8002) | None | `{"status":"healthy"}` |

## Post-Deploy Verification

```bash
# 1. Backend responds
curl localhost:5000/api/ping

# 2. TANTRA runtime healthy
curl localhost:5000/api/tantra/health

# 3. Bucket reachable from backend
docker exec niyantran_backend curl -s http://bhiv-bucket:8001/health

# 4. All containers running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
