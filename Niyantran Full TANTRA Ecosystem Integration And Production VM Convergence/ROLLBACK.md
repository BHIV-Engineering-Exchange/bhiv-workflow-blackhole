# ROLLBACK.md
### Niyantran — TANTRA Ecosystem Rollback Procedure

---

## Guiding Principle

All TANTRA ecosystem integrations are **additive and fire-and-forget**. If any ecosystem service (Bucket, KARMA, PRANA) goes down or needs rollback:
- **Niyantran continues working** — monitoring, screenshots, attendance, dashboards all function
- **Cloudinary remains primary** — Bucket writes are additive, not replacement
- **KARMA signal failures are logged and swallowed** — never crash the monitoring pipeline

This means rollback is low-risk by design.

---

## Scenario 1: Roll Back a Bad Backend Deployment

```bash
# 1. SSH into production VM
ssh deploy@<VM_IP>

# 2. Identify the previous working image tag
docker images bhiv/niyantran-backend --format "{{.Tag}} {{.CreatedAt}}" | head -5

# 3. Update the compose file with the previous tag
export IMG_TAG=<previous_tag>

# 4. Restart backend only
docker-compose -f docker-compose.production.template.yml up -d --no-deps backend

# 5. Verify health
curl localhost:5000/api/ping
curl localhost:5000/api/tantra/health
```

## Scenario 2: Bucket Service Down / Broken

**Impact:** Screenshots still go to Cloudinary. KARMA signals fail silently with `[Bucket] Screenshot store failed (non-fatal)` and `[KARMA] signalExcessiveIdle failed (non-fatal)` in logs.

```bash
# 1. Check Bucket health
docker logs niyantran_bucket --tail=50

# 2. Restart Bucket + Redis
docker-compose -f docker-compose.production.template.yml restart redis bhiv-bucket

# 3. If Bucket image is broken, roll back
docker-compose -f docker-compose.production.template.yml stop bhiv-bucket
# Backend continues working — Bucket calls fail gracefully
```

## Scenario 3: KARMA Service Down

**Impact:** Behavioral signals fail silently. Employee monitoring continues unaffected.

```bash
# 1. Check KARMA health
docker logs niyantran_karma --tail=50

# 2. Restart KARMA
docker-compose -f docker-compose.production.template.yml restart karma-tracker

# 3. If KARMA is fundamentally broken, stop it
docker-compose -f docker-compose.production.template.yml stop karma-tracker
# Backend continues — karmaClient calls fail gracefully
```

## Scenario 4: PRANA Service Down

**Impact:** None currently — PRANA session telemetry is not yet wired (B6 gap).

```bash
docker-compose -f docker-compose.production.template.yml restart bhiv-prana
```

## Scenario 5: Full Ecosystem Rollback (Remove All TANTRA Services)

If you need to completely remove the ecosystem integration and go back to standalone Niyantran:

```bash
# 1. Stop all ecosystem services
docker-compose -f docker-compose.production.template.yml stop \
  bhiv-bucket bhiv-prana karma-tracker redis

# 2. Backend continues running — all ecosystem calls fail gracefully
# No code changes needed — fire-and-forget pattern handles it

# 3. To fully remove containers
docker-compose -f docker-compose.production.template.yml rm -f \
  bhiv-bucket bhiv-prana karma-tracker redis
```

## Recovery After Rollback

```bash
# Restart everything fresh
docker-compose -f docker-compose.production.template.yml down
docker-compose -f docker-compose.production.template.yml up -d

# Verify
docker-compose -f docker-compose.production.template.yml ps
curl localhost:5000/api/ping
```

---

## Key Design Decision: Why Rollback Is Safe

Every ecosystem call in Niyantran uses this pattern:

```javascript
try {
  const karmaClient = require('./karmaClient');
  karmaClient.signalExcessiveIdle(employeeId, idleMinutes)
    .catch(err => console.warn('[KARMA] failed (non-fatal):', err.message));
} catch (e) { /* module load failure is non-fatal */ }
```

- `try/catch` around `require()` — handles missing module
- `.catch()` on the promise — handles network/service failure
- `console.warn` only — never throws, never crashes, never blocks
