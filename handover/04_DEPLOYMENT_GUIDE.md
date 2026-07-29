# Deployment Guide — Niyantran (workflow-blackhole)

Everything below was read directly from the repo's own compose files, Dockerfiles, and scripts — not inferred. Where something couldn't be run end-to-end from this sandbox (no route to the real MongoDB Atlas cluster or a production host), that's stated explicitly.

## 1. Local development (no Docker)

```bash
# Backend
cd server
npm install                 # verified: clean install, 779 packages
cp .env.example .env        # then fill in — see 11_CREDENTIALS_CONFIGURATION_REGISTER.md
                             # NOTE: .env.example is missing several vars the code requires,
                             # most importantly TANTRA_EXECUTION_KEY — see Known Issues
npm start                   # or: node index.js

# Frontend (separate terminal)
cd client
npm install --legacy-peer-deps   # verified: clean install
npm run dev                      # Vite dev server
```

**Verified boot sequence:** with no `.env`, the server prints exactly which required variables are missing and exits(1) rather than starting in a half-broken state — this is good, deliberate defensive design, confirmed by actually running it. With a complete `.env`, it passes the config check, connects toward MongoDB, initializes the OCR worker and EMS signal layer, and starts listening. See `13_EVIDENCE_PACKET.md` for the exact console output of both runs.

## 2. Docker — development topology

`docker-compose.yml` at the repo root brings up 7 containers on one network:

| Service | Container name | Image/build | Port mapping |
|---|---|---|---|
| MongoDB | `niyantran_database` | official `mongo` image | `HOST_MONGO_PORT` → 27017 |
| Redis | `niyantran_redis` | official `redis` image | internal only |
| Bucket | `niyantran_bucket` | `./bhiv-bucket` (build) | — |
| PRANA | `niyantran_prana` | `./bhiv_prana` (build) | — |
| Karma | `niyantran_karma` | `./Karma-Tracker/karma-tracker` (build) | — |
| Backend | `niyantran_backend` | `./server` (build) | `HOST_BACKEND_PORT` → 5000 |
| Frontend | `niyantran_frontend` | `./client` (build) | `HOST_FRONTEND_PORT` → 80 |

```bash
docker compose up --build
```

**Verified gap:** the Bucket and PRANA service definitions point at `bhiv-bucket/Dockerfile` and `bhiv_prana/Dockerfile`. **Neither file exists in this repository** (confirmed by direct file check). Running `docker compose up` as-is will fail to build those two specific services. The other five services (Mongo, Redis, Karma, backend, frontend) have their build contexts present and correct. Either source the missing Dockerfiles from the Bucket/PRANA teams, or point those two services at pre-built images if any exist, or comment them out for local backend/frontend-only development.

## 3. Docker — production topology

`docker-compose.production.template.yml` is the reference for how production is actually laid out, and it deliberately avoids the gap above:

- **MongoDB:** not containerized — production points at MongoDB Atlas (confirmed by the real `.env`'s `MONGODB_URL`/`MONGODB_URI` value, a `mongodb+srv://...mongodb.net` connection string).
- **Bucket:** externally hosted on Render — the template does not try to build it locally.
- **PRANA:** explicitly marked "not deployed — repo only, for future integration" in the template.
- **Backend/Frontend:** same container build as dev, but frontend's `VITE_API_URL` build arg must point at the real API domain — **this is baked into the JS bundle at build time**, so changing the API URL requires a full frontend rebuild, not just an env var change on the running container.

Copy the template to a real `docker-compose.production.yml`, fill in production values, and deploy from the production host (this sandbox has no network path to the production infrastructure to verify the live deploy — see `13_EVIDENCE_PACKET.md` §3 for exactly what could and couldn't be checked from here).

## 4. Reverse proxy / SSL — two separate nginx configs, don't confuse them

There are **two different nginx configs** in this repo serving different roles — verified by reading both and cross-referencing which one production actually mounts:

1. **`NGINX/nginx.conf`** — baked into the `client/Dockerfile` image itself; a minimal static-file server for the SPA build (`try_files ... /index.html`, 1-year asset caching), port 80, no SSL. This is what serves the frontend *inside* its own container, reached only from the reverse proxy.
2. **`proxy configurations/nginx.ssl.conf`** — the **real production edge reverse proxy**, run as its own `proxy` container (`niyantran_proxy`, image `nginx:1.25-alpine`) per `docker-compose.production.template.yml`. This is where SSL actually terminates: full Let's Encrypt certificate config (`/etc/letsencrypt/live/niyantran.blackholeinfiverse.com/`), hardened TLS 1.2/1.3 with a modern cipher suite, HSTS/X-Frame-Options/nosniff security headers, HTTP→HTTPS redirect (with a Certbot ACME-challenge exception), rate limiting (50 req/s general API, 10 req/s on `/api/auth/` specifically), and WebSocket proxying for Socket.IO with extended timeouts. It proxies `/` to the frontend container and `/api/`, `/api/auth/`, `/socket.io/` to the backend container over the internal Docker network.

**Important, verified context: this single proxy config and VM serve several other BHIV products, not just Niyantran** — the same file also has `server_name` blocks for `gurukul.blackholeinfiverse.com`, `gurukuldrishiti.blackholeinfiverse.com`, `samruddhi.blackholeinfiverse.com`, `parikshak.blackholeinfiverse.com`, and `sampada.blackholeinfiverse.com`, each proxying to different ports on the same host IP. Changes to this file affect more than just Niyantran — coordinate before editing it.

## 4a. The real CI/CD → production pipeline (read directly from `.github/workflows/cicd.yml`)

This is a genuinely complete pipeline, not a stub — worth understanding in full since it's the actual deploy mechanism:

1. **Trigger:** push to `main`.
2. **Validate:** renders `docker-compose.production.template.yml` with a real `MONGODB_URI` (from a GitHub secret) and runs `docker compose config` to catch syntax errors before building anything.
3. **Build:** builds `server/Dockerfile` and `client/Dockerfile`, tags each image with the short git SHA *and* `latest`, pushes both to Docker Hub (`bhiv/niyantran-backend`, `bhiv/niyantran-frontend`). The frontend build injects `VITE_API_URL` at this step — reconfirming that this must be correct **before** this pipeline step runs.
4. **Deploy:** SSHes into the production VM (`sshpass` with a password from a GitHub secret, not a key — see note below), extracts a tarball of the compose template + proxy configs + monitoring configs + a fresh `.env` built from a GitHub secret, regenerates `docker-compose.production.yml` from the template (substituting the real image tag), logs into Docker Hub on the VM, pulls the new images, brings the stack up with `docker compose up -d --remove-orphans`, and force-recreates the `proxy` container to pick up any nginx config changes.
5. **Health check:** polls `https://localhost/api/ping` and `https://localhost` for up to 2 minutes (12 × 10s retries), also checking Docker's own container health status.
6. **On success:** appends a row to `docs/RELEASE_HISTORY.md` **on the VM** (git SHA, timestamp, status) — this file is copied to `/var/tmp/NIYANTRAN/` so it survives the pipeline's own directory-clean step on the next run.
7. **On failure: automatic rollback.** The pipeline parses `RELEASE_HISTORY.md` for the last `SUCCESS`/`ROLLBACK_SUCCESS` entry, redeploys that image tag, and re-runs the same health check. This is a real, working rollback mechanism — not a manual procedure (see `08_OPERATIONS_RUNBOOK.md` §7, corrected accordingly).
8. Old Docker images older than 7 days are pruned after every successful deploy to keep disk usage bounded, while still keeping enough recent images for a rollback to succeed.

**Operational note worth flagging (not a defect, just worth knowing):** the VM deploy step uses password-based SSH (`sshpass -p ... -o StrictHostKeyChecking=no`) rather than key-based auth, and disables host-key verification. This is a common CI/CD convenience pattern but is generally considered weaker than SSH key auth with a pinned host key — worth a conscious decision by whoever owns VM security, not necessarily something to silently "fix."

## 5. Ports (verified from source)

| Port | Service | Source |
|---|---|---|
| 5000 (default) / `PORT` env | Backend API (internal only in production — not publicly exposed, see below) | `server/Dockerfile` EXPOSE + `index.js` |
| 80 | Frontend nginx (internal only in production) / production proxy HTTP→HTTPS redirect | `client/Dockerfile`, `proxy configurations/nginx.ssl.conf` |
| 443 | Production proxy — real SSL termination point | `docker-compose.production.template.yml`, `proxy configurations/nginx.ssl.conf` |
| 27017 | MongoDB (dev container only; prod uses Atlas over SRV externally) | `docker-compose.yml` |
| 6379 | Redis (optional) | `docker-compose.yml` |
| 9090 | Prometheus (production monitoring) | `docker-compose.production.template.yml` |
| 3000 | Grafana (production monitoring dashboard) | `docker-compose.production.template.yml` |

**Verified, important production detail:** in `docker-compose.production.template.yml`, the `backend` and `frontend` containers deliberately have **no public port mapping** — comments in the file explicitly say "Public ports are OMITTED for security isolation." The only public entry point is the `proxy` container on 80/443. This is good, deliberate security design, confirmed by reading the compose file directly.

**Confirmed production Bucket URL:** the production compose file hardcodes `BUCKET_BASE_URL: https://bhiv-bucket-i1l6.onrender.com` directly in the backend service's environment block — this is the real, externally-hosted Bucket instance this deployment talks to, consistent with the ecosystem map's description of Bucket as a Render-hosted external service.

## 6. Scheduled jobs

One cron job, defined in code (not OS-level cron): `services/attendanceCronJobs.js` runs `cron.schedule('59 23 * * *', ...)` — daily at 23:59 server-local time, auto-closing the day's attendance/work sessions. Because this is scheduled **inside the Node process**, it only runs while the server process is up, and if you run multiple backend replicas behind a load balancer, this job will fire once per replica unless something is added to make it leader-elected/idempotent-safe — worth confirming before horizontally scaling the backend.

## 7. Database backup / restore procedures (verified — real automation exists)

There is already a working, previously-used backup mechanism at `backup automation/`:

- **`backup-db.ps1`** runs `docker exec niyantran_database mongodump --archive --gzip` and writes to `backups/mongodb_backup_<timestamp>.gz`, then deletes anything older than 7 days.
- **`backup-db.bat`** is a double-clickable wrapper around the above (works around PowerShell execution-policy restrictions).
- **`backup automation/BACKUP_INSTRUCTIONS.md`** documents setting this up as a daily Windows Task Scheduler job.
- **Proof this has actually run before:** the repo ships a real backup artifact, `backups/mongodb_backup_20260604_140128.gz`, confirming the script has executed successfully at least once.

**Restore:** the corresponding restore command (not scripted, but the direct inverse of the backup command) is:
```bash
docker exec -i niyantran_database mongorestore --archive --gzip < backups/mongodb_backup_<timestamp>.gz
```

**Important scope gap, worth flagging explicitly:** this backup script targets the **local Docker container** named `niyantran_database` (matches the dev `docker-compose.yml` container name exactly). Production, per the real `.env`, runs on **MongoDB Atlas**, not a local container — so this script **will not back up the production database** as-is. Whoever owns the Atlas cluster should confirm whether Atlas's own automated backups / point-in-time recovery are enabled for the production cluster; that's outside what this codebase or this sandbox can verify.

## 8. Monitoring

**Wired in for production, not for dev.** `docker-compose.production.template.yml` runs `prometheus` (scraping via `Monitoring/prometheus.yml`), `grafana` (pre-provisioned datasource via `Monitoring/datasource.yml`), `node-exporter` (host metrics), and `cadvisor` (container metrics) — ports 9090 and 3000 respectively. None of this is present in the dev `docker-compose.yml`. The application itself exposes one lightweight liveness endpoint, `GET /api/ping`, which is what the CI/CD pipeline's own post-deploy health check polls.

## 9. Third-party services this deployment depends on

MongoDB Atlas, Cloudinary, Groq, Google Gemini, an SMTP provider, and (per the ecosystem map) the externally-hosted Bucket service on Render. Full list with which env var controls each in `02_ARCHITECTURE_GUIDE.md` §9 and `11_CREDENTIALS_CONFIGURATION_REGISTER.md`.
