# Niyantran Sovereign Deployment Sprint: Live Execution Log

This document records the exact steps, commands, outputs, errors, and fixes executed during **Phase 3 — Live Deployment Execution** on the target deployment host.

---

## 1. Production Launch & Execution

### Command Executed:
```bash
docker compose -f docker-compose.production.yml up -d --build
```

### Build and Start Output:
```
 workflow-blackhole-backend  Built
 workflow-blackhole-frontend  Built
 Container niyantran_database  Running
 Container niyantran_backend  Recreated
 Container niyantran_frontend  Recreated
 Container niyantran_database  Healthy
 Container niyantran_backend  Starting
 Container niyantran_backend  Started
 Container niyantran_backend  Healthy
 Container niyantran_frontend  Starting
 Container niyantran_frontend  Started
 Container niyantran_proxy  Starting
 Container niyantran_proxy  Started
```

---

## 2. Live Runtime Status Checks

### Test 1: Container Orchestration Status (`[MEASURED]`)
**Command:**
```bash
docker compose -f docker-compose.production.yml ps
```
**Output:**
```
NAME                 IMAGE                         COMMAND                  SERVICE    STATUS                    PORTS
niyantran_backend    workflow-blackhole-backend    "docker-entrypoint.s…"   backend    Up 22 seconds (healthy)   5000/tcp
niyantran_database   mongo:6.0                     "docker-entrypoint.s…"   database   Up 2 minutes (healthy)    27017/tcp
niyantran_frontend   workflow-blackhole-frontend   "/docker-entrypoint.…"   frontend   Up 16 seconds             80/tcp
niyantran_proxy      nginx:1.25-alpine             "/docker-entrypoint.…"   proxy      Up 15 seconds             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

![Test 1: Container Orchestration Status](https://drive.google.com/file/d/1X2D3euFPQKG7fxyPYRxs90KG1sqxRMhO/view?usp=sharing)

---

### Test 2: Ingress API Routing Health check (`[MEASURED]`)
**Command:**
```bash
curl.exe -Iv http://localhost/api/ping
```
**Output Header:**
```http
HTTP/1.1 200 OK
Server: nginx/1.25.5
Content-Type: application/json; charset=utf-8
Connection: keep-alive
X-Powered-By: Express
```

![Test 2: Ingress API Routing Health check](https://drive.google.com/file/d/10_WCCh4SjnDEmpAu96dGzsRPOmAE_meU/view?usp=sharing)

---

### Test 3: Frontend Asset Delivery Ingress (`[MEASURED]`)
**Command:**
```bash
curl.exe -Iv http://localhost/
```
**Output Header:**
```http
HTTP/1.1 200 OK
Server: nginx/1.25.5
Content-Type: text/html
Content-Length: 1541
```

![Test 3: Frontend Asset Delivery Ingress](https://drive.google.com/file/d/1hFIGEyxfgbB8Cv31N5dcE17OG62sA0zl/view?usp=sharing)

---

### Test 4: Database Port Isolation Audit (`[MEASURED]`)
We audited host port bindings to ensure MongoDB is completely locked down:
**Command:**
```bash
docker inspect --format='{{json .HostConfig.PortBindings}}' niyantran_database
```
**Output:**
```json
{}
```
*   **Result:** Confirming that the container has no host-level port exposures, verifying internal bridge isolation. Note: A native service `mongod` is running on the host itself, which is unrelated to our containerized DB.

![Test 4: Database Port Isolation Audit](https://drive.google.com/file/d/1uKrXtCe5P0v5M3QXm5athz3UUrXD8Qyf/view?usp=sharing)

---

### Test 5: Live Resource Utilization Metrics (`[MEASURED]`)
**Command:**
```bash
docker stats --no-stream
```

![Test 5: Live Resource Utilization Metrics](https://drive.google.com/file/d/1CWDgUf2bZ2o_nW_U0xPp5QBEcahKYwZN/view?usp=sharing)

---

## 3. Video Walkthrough Proof (`[PLANNED]`)

![Video Walkthrough (SR-1)](https://drive.google.com/file/d/1PNhHCpdVQ8YC0L6yVh-RTMfXrvPwGQrs/view?usp=sharing)

---

## 4. Runtime Observations `[MEASURED]`

*   **Reverse Proxy Efficiency:** NGINX handles both the static frontend builds and API routing under a unified single-port namespace (port 80).
*   **Healthchecks:** Both `database` and `backend` containers successfully run health check scripts (`mongosh` ping and `curl` endpoint ping) to provide container orchestrator health visibility.
*   **Resource Utilization:** Idle RAM usage for the stack remains low (< 250MB), leaving ample head-room for Niyantran real-time data syncs on the VM.
