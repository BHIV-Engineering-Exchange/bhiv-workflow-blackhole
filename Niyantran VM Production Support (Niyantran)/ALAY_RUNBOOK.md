# Niyantran VM Production Support — Alay Runbook

Application ownership: Shashank. Infrastructure execution: Alay Patel.  
Preserve Nikhil’s Docker + GitHub Actions architecture. Do not introduce a parallel deploy path.

## Live path vs handover docs

| Item | Handover / Yotta guides | Live CI/CD (source of truth) |
|------|-------------------------|------------------------------|
| Deploy directory | `/opt/setu/production/` | `~/NIYANTRAN` |
| Env file name | `.env.production` | `.env` (written from GitHub `ENV_FILE`) |
| Compose file | `docker-compose.production.yml` | Generated on VM from `docker-compose.production.template.yml` via `sed` |
| Database | Often described as local Mongo | **MongoDB Atlas** via `MONGODB_URI` (local `database` service commented out in prod template) |

Use `~/NIYANTRAN` for all production commands below. Keep Yotta guides for OS/UFW/TLS procedures; override directory names with this table.

---

## Phase 1 — VM baseline validation checklist

Run on the VM as the deploy user:

```bash
cd ~/NIYANTRAN

# 1. Container status
docker compose -f docker-compose.production.yml ps

# 2. API + frontend health (via proxy)
curl -sf http://localhost/api/ping && echo " API_OK"
curl -sf -o /dev /null -w "%{http_code}\n" http://localhost/

# 3. Backend Mongo connect (look for Connected to MongoDB / connection errors)
docker compose -f docker-compose.production.yml logs backend --tail=80

# 4. Secrets and Configuration present (do not cat the file)
test -f .env && ls -la .env

# 5. Verify PRANA & Identity Variables exist in .env
grep -q "PRANA" .env && echo " PRANA configs present" || echo " MISSING PRANA configs"

# 6. Note monitoring exposure (hardening later)
ss -tlnp | grep -E ':3000|:9090|:5000|:27017' || true
```

Pass criteria: proxy, frontend, backend running; `/api/ping` succeeds; `.env` exists. If backend restarts in a loop, treat as Atlas/credential failure (Phase 2).

---

## Phase 2 — Secure MongoDB Atlas integration

### Credential model (required)

1. **Source of truth:** GitHub repository secrets  
   - `MONGODB_URI` — injected at deploy for Compose `environment.MONGODB_URI`  
   - `ENV_FILE` — full VM `.env` contents; **must include the same `MONGODB_URI`** plus `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN`, PRANA configurations (e.g., `PRANA_API_URL`), and canonical ecosystem identity variables.
2. **Atlas Network Access:** allowlist the **VM public egress IP only**. Do not use `0.0.0.0/0` in production.
3. **Database user:** dedicated least-privilege Atlas user for Niyantran only.
4. **Host file:** after deploy, lock permissions:

```bash
cd ~/NIYANTRAN
chmod 600 .env
# Prefer: chown to deploy user that runs docker compose (not world-readable)
ls -la .env   # expect -rw------- 
```

5. **Database name in URI:** the path segment after the host selects the DB (e.g. `...mongodb.net/blackhole_db` vs `.../niyantran`). Wrong name connects successfully but returns empty Departments/Branches.

### Alay Atlas cutover steps

1. Confirm Atlas cluster is healthy.
2. Create/verify DB user; store password only in GitHub Secrets / password manager.
3. Atlas → Network Access → add VM public IP `/32`.
4. Build URI: `mongodb+srv://USER:PASS@CLUSTER/DB_NAME?retryWrites=true&w=majority`
5. Set GitHub Secrets `MONGODB_URI` and update `ENV_FILE` with the same URI.
6. Ensure `FRONTEND_URL` and `CORS_ORIGIN` in `ENV_FILE` match the browser origin (e.g. `http://163.128.209.18` or the HTTPS domain). Backend reads these for CORS and Socket.IO.
7. Push to `main` (or re-run the Production Infrastructure workflow) to redeploy.
8. Confirm logs: `Connected to MongoDB with optimized connection pool`.

### Why this model

- Secrets never live in git.
- CI already injects Atlas URI; no second secret store.
- IP allowlisting limits blast radius if the URI leaks.
- `chmod 600` limits host-local reads.

---

## Phase 3 — Department/Branch + E2E validation

### Diagnose empty Department / Branch UI

```bash
# From a machine that can reach Atlas with the same URI (or exec into backend):
docker compose -f ~/NIYANTRAN/docker-compose.production.yml exec backend \
  node scripts/checkConnection.js
```

Expect non-zero counts for `departments`, `branches`, and `users` when production data is present.

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Backend crash-loop | IP not allowlisted / bad URI | Fix Atlas Network Access + secrets; redeploy |
| Connected, counts = 0 | Empty DB or wrong DB name | Fix URI DB name, or migrate/seed |
| API 200 with `[]` | Empty collections | Migrate or seed |
| Browser CORS / Socket errors | Origin not in allowlist | Set `FRONTEND_URL` + `CORS_ORIGIN` to exact browser origin; redeploy backend |

### Migrate (preferred when prior data exists)

```bash
# Example: dump from previous Mongo, restore into Atlas
mongodump --uri="<SOURCE_URI>" --gzip --archive=/tmp/niyantran.dump.gz
mongorestore --uri="<ATLAS_URI>" --gzip --archive=/tmp/niyantran.dump.gz
```

### Seed (only if intentional empty start)

Inside backend container (or local with Atlas URI in env):

```bash
node scripts/seedBranches.js      # creates blackhole_mumbai (required by client fallback)
node scripts/seedDepartment.js
# Optional: node scripts/seedAdmin.js
```

### E2E checklist

- [ ] Login succeeds  
- [ ] `GET /api/branches` returns active branches  
- [ ] `GET /api/departments` returns departments  
- [ ] Start/complete a workflow action in UI  
- [ ] Browser Network: Socket.IO connects via `/socket.io/` (no CORS errors)  
- [ ] Backend log shows socket join for user/department rooms  

### Failure scenarios to record

1. Bad / expired Atlas password  
2. VM IP missing from Atlas allowlist  
3. Wrong database name in URI  
4. Empty collections after successful connect  
5. CORS blocked because `CORS_ORIGIN`/`FRONTEND_URL` omit the real origin  

---

## Phase 4 — Production hardening

### UFW (Alay)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

Confirm ports `5000` and `27017` are **not** publicly reachable. Backend has no host port mapping in the production compose template.

### Secrets

- VM: `chmod 600 ~/NIYANTRAN/.env`
- Rotate Atlas password / JWT if any URI was ever committed or shared in chat
- Do not commit `.env` or real Atlas URIs

### SSH (planned cutover — do not break CI until keys work)

1. Install deploy public key on the VM (`authorized_keys`).
2. Add GitHub secret for private key; switch workflow from `sshpass`/`VM_PASSWORD` to key auth.
3. Only then set `PasswordAuthentication no` (see `YOTTA_SECURITY_HARDENING.md`).

### Monitoring ports

Compose publishes Grafana `:3000` and Prometheus `:9090`. Until closed:

- Prefer SSH tunnel: `ssh -L 3000:localhost:3000 user@VM`
- Or UFW deny public access to 3000/9090

### TLS

When DNS points at the VM, switch proxy mount to `proxy configurations/nginx.ssl.conf` and Certbot as in `YOTTA_SECURITY_HARDENING.md`. Until then HTTP on `:80` is expected; keep `FRONTEND_URL`/`CORS_ORIGIN`/`VITE_API_URL` aligned to that origin.

### Frontend build URL

CI currently builds with `--build-arg VITE_API_URL=http://163.128.209.18/api`. When the public origin changes (HTTPS domain), update that build-arg in `.github/workflows/cicd.yml` (or introduce a `VITE_API_URL` GitHub secret) and redeploy so the SPA matches CORS.

---

## Phase 5 — PRANA & Identity Integration

This deployment **includes and enables** full PRANA session monitoring and canonical Identity integration.

* **Employee Session Lifecycle:** Every authenticated employee session must automatically start PRANA monitoring on login and stop on logout. No manual activation should exist.
* **Identity:** All employee operations must use canonical ecosystem identities (no legacy/temporary string IDs). 
* Ensure all related environment variables (`PRANA_API_URL`, etc.) are correctly populated in the `ENV_FILE` before deployment.

---

## Related files

- `docker-compose.production.template.yml` — production services (no local Mongo)
- `.github/workflows/cicd.yml` — validate → build → SSH deploy
- `proxy configurations/nginx.conf` — `/api`, `/socket.io`
- `secrets isolation/SECRETS_INSTRUCTIONS.md` — host file lockdown
- `YOTTA_DEPLOYMENT_GUIDE.md` / `YOTTA_SECURITY_HARDENING.md` — OS/TLS/UFW
- [VM_PRODUCTION_SUPPORT_PACKET.md](VM_PRODUCTION_SUPPORT_PACKET.md) — review deliverable (this folder)
