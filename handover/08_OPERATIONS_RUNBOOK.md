# Operations Runbook — Niyantran (workflow-blackhole)

## 1. How to deploy

**Production deploys automatically on push to `main`** via `.github/workflows/cicd.yml` — see `04_DEPLOYMENT_GUIDE.md` §4a for the full pipeline (build → push images to Docker Hub → SSH to VM → deploy → health-check → auto-rollback on failure). In practice, "how do I deploy" for most day-to-day changes is: merge to `main` and watch the GitHub Actions run.

Manual/local production-style deploy (e.g. if the pipeline itself needs debugging):
```bash
cp docker-compose.production.template.yml docker-compose.production.yml
sed -i "s|IMG_TAG|<git-sha-or-latest>|g" docker-compose.production.yml
# fill in real env values in .env, then:
docker compose -f docker-compose.production.yml up -d --build
```

## 2. How to restart

```bash
# Docker (dev or production compose, whichever is running)
docker compose restart backend        # backend only
docker compose restart frontend       # frontend only
docker compose -f docker-compose.production.yml restart proxy   # production only — reload the SSL reverse proxy
docker compose down && docker compose up -d   # full stack

# Bare process (if not containerized)
cd server && npm start                # or your process manager's restart command (pm2, systemd, etc.)
```

No process manager config (pm2 ecosystem file, systemd unit) was found in this repository for running the backend outside Docker — production, per the verified CI/CD pipeline, always runs containerized, so this is only relevant for non-standard local setups.

## 3. How to recover from common failures

| Symptom | Likely cause | What to check |
|---|---|---|
| Server exits immediately on start, prints "SERVER STARTUP ABORTED" | Missing `JWT_SECRET`, `TANTRA_EXECUTION_KEY`, or `MONGODB_URI` | The error message names exactly which ones — verified behavior, see `13_EVIDENCE_PACKET.md` |
| Server crashes with `invalid ELF header` referencing `canvas.node` | `node_modules` was copied from a different OS/architecture instead of freshly installed | `rm -rf server/node_modules && npm install` on the target machine — verified fix |
| Requests hang / time out, no response | MongoDB Atlas unreachable (network/firewall/credentials) | Check Atlas cluster status and that the deploy host's IP is allow-listed in Atlas network access; every route ultimately depends on Mongo |
| Real-time features (task/attendance live updates) not updating | Socket.IO connection issue, or Redis down (should still work — see below) | Redis being down should **not** break this; `eventBus.js` falls back automatically. If real-time truly breaks, check the Socket.IO connection itself, not Redis |
| Screenshots/EMS features failing silently | Cloudinary misconfigured, or X11/`scrot`/`imagemagick` tooling missing on the host (only relevant for local capture, not server-side) | Check `CLOUDINARY_STORAGE_ENABLED` and the 4 `CLOUDINARY_*` vars |
| AI review/optimization returns errors | `GROQ_API_KEY` / `GEMINI_API_KEY` missing, invalid, or rate-limited | These are optional-feature failures, not fatal — confirm the key and quota with whoever owns those accounts |
| Daily attendance auto-close didn't run | Cron only runs while the Node process is up; if the process restarted after 23:59 that day, it was missed | `services/attendanceCronJobs.js` — confirm the process was continuously running through 23:59 server time |

## 4. Log locations

No centralized log shipping (e.g. Winston-to-file, ELK, Datadog) was found wired into `index.js` beyond `console.log`/`console.error`. In practice this means:

- **Docker:** `docker compose logs -f backend` (or `frontend`) is the primary way to see live output.
- **Bare process:** stdout/stderr of whatever supervises the Node process — check your process manager's own log location (e.g. `pm2 logs`, `journalctl -u <service>` for systemd).
- **Morgan HTTP logging** is enabled (`app.use(morgan('dev'))` in development, `morgan('combined')` otherwise) — confirmed in `index.js` — so every HTTP request is logged to stdout with method/path/status/response time.

## 5. Monitoring process

**Corrected from an earlier draft:** production monitoring is real and wired in — `docker-compose.production.template.yml` runs `prometheus` (port 9090), `grafana` (port 3000), `node-exporter`, and `cadvisor` alongside the app containers, configured via `Monitoring/prometheus.yml` and `Monitoring/datasource.yml`. This stack is **not** present in the dev `docker-compose.yml` — local development relies on Morgan HTTP logs and manual checks only. In production, use Grafana (port 3000 on the VM) as the primary dashboard, backed by Prometheus scraping container/host metrics via cAdvisor and node-exporter. The application itself also exposes `GET /api/ping` as a lightweight liveness check — this is exactly what the CI/CD pipeline's own post-deploy health check polls (see `04_DEPLOYMENT_GUIDE.md` §4a).

## 6. Troubleshooting guide (step-by-step)

1. **Confirm the process is actually running.** `docker compose ps` or `ps aux | grep node`.
2. **Check the last 100 lines of backend logs** for the specific error (see §4).
3. **If it's a boot-time failure**, it's almost always a missing/wrong env var — the app's own startup guard names the exact missing variables for the three required ones; for everything else, cross-reference `02_ARCHITECTURE_GUIDE.md` §8's full variable list against your `.env`.
4. **If it's a runtime 500 on a specific route**, find that route's file via `03_SOURCE_CODE_WALKTHROUGH.md` §2 or `06_API_DOCUMENTATION.md` §5, and read the corresponding `try/catch` — every route in this codebase follows the same pattern (log the real error server-side, return a generic message to the client), so the real cause is in the server log, not the HTTP response.
5. **If MongoDB-dependent routes are failing/timing out**, verify Atlas connectivity independently of the app (e.g. `mongosh "<connection string>"` from the deploy host) before assuming it's an application bug.
6. **If it's a frontend-only issue** (blank page, JS errors), confirm `VITE_API_URL` was correct **at build time** — remember this is baked into the bundle, not read at runtime (see `04_DEPLOYMENT_GUIDE.md` §3).

## 7. Rollback procedure

**Corrected from an earlier draft: this is not manual.** `.github/workflows/cicd.yml` implements a real, automatic rollback: if the post-deploy health check (`https://localhost/api/ping` + frontend reachability + Docker container health, polled for up to 2 minutes) fails, the pipeline itself parses `docs/RELEASE_HISTORY.md` on the VM for the last entry marked `SUCCESS` or `ROLLBACK_SUCCESS`, re-pulls that image tag from Docker Hub, redeploys it, and re-runs the health check — logging the outcome back into `RELEASE_HISTORY.md`. No human action is required for a failed automated deploy to self-heal to the last known-good version.

**Manual rollback** (if you need to roll back something the automated system didn't catch, e.g. a "successful" deploy that's actually broken in a way health checks don't detect):
```bash
# On the VM, in ~/NIYANTRAN
sed "s|IMG_TAG|<previous-good-git-sha>|g" docker-compose.production.template.yml > docker-compose.production.yml
docker login -u <DOCKER_USERNAME> --password-stdin   # then paste the password
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d --remove-orphans
```
The previous good SHA is readable directly from `docs/RELEASE_HISTORY.md` on the VM (also mirrored to `/var/tmp/NIYANTRAN/RELEASE_HISTORY.md` so it survives the pipeline's directory-clean step).

## 8. Third-party services to have credentials/dashboard access for, operationally

MongoDB Atlas, Cloudinary, Groq, Google Gemini, whatever SMTP provider is configured, and the domain registrar/DNS provider for the production URL. See `11_CREDENTIALS_CONFIGURATION_REGISTER.md` for where each credential lives.
