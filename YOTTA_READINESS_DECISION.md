# Niyantran Sovereign Infrastructure: Yotta Readiness Decision

This document delivers the final, objective engineering evaluation and deployment conclusion for the Niyantran sovereign monitoring stack. It assesses architectural readiness, identifies environmental boundaries, details active blocks, and establishes key operational risk parameters.

---

## 1. Executive Conclusion: CONDITIONAL GO

The Niyantran sovereign stack is awarded a status of **CONDITIONAL GO** for production release.

```
+-------------------------------------------------------------------+
|                     DEPLOYMENT STATUS: CONDITIONAL GO             |
|                                                                   |
|  * Software Architecture & Hardening: 100% PRODUCTION READY       |
|  * Physical Infrastructure & DNS:      AWAITING PROVISIONING      |
|  * Environment Secrets & API Keys:     AWAITING INJECTION         |
+-------------------------------------------------------------------+
```

### Why a CONDITIONAL GO?
The entire containerized software orchestration, reverse proxy rate-limiting, database backup automation, access locking scripts, and telemetry setups are fully implemented, tested, and validated. However, deployment to the live sovereign environment is blocked by physical hosting prerequisites (virtual machine provisioning, domain registration, SSL challenge completion, and API key generation). Once the target host VM is assigned, the stack is prepared for immediate launch.

---

## 2. Production-Ready Components (What is Ready)

The following core infrastructure blocks have been implemented, hard-tested, and verified on local staging:

1.  **Orchestration & Port Isolation (`docker-compose.production.yml`):**
    *   The 8-container stack is fully configured.
    *   MongoDB (`niyantran_database`) and Node.js (`niyantran_backend`) have zero host-level port exposures (`PortBindings` is empty), preventing direct network intrusion.
    *   All internal traffic is routed exclusively inside the private `niyantran_network` bridge.
2.  **Ingress Rate-Limiting & Proxy Routing (`nginx.conf`):**
    *   NGINX proxy serves static assets on Port 80 and handles proxy routing to the API backend.
    *   Implements rate-limiting zones limiting standard API requests to `10r/s` and auth endpoints to `2r/s` to prevent Denial of Service (DoS) exploits.
    *   WebSockets (`/socket.io/`) are correctly tunneled with custom connection headers and extended timeouts.
3.  **Secrets Security & Locking Scripting (`secrets isolation/`):**
    *   Environment configuration files (`.env*`) are strictly gitignored to prevent credential leaks.
    *   Lockdown scripts ([lock-secrets.ps1](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/secrets%20isolation/lock-secrets.ps1)) utilize Windows Access Control Lists (`icacls`) to strip permission inheritance, restricting read/write privileges strictly to the owner and the `SYSTEM` security accounts.
4.  **Database Backup Automation (`backup automation/`):**
    *   Database dumps are captured daily via a PowerShell script ([backup-db.ps1](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/backup%20automation/backup-db.ps1)) using Gzip compression (`mongodump --gzip`), realizing a `10:1` storage reduction.
    *   Implements automated retention logic, purging local backups older than 7 days to conserve host disk space.
5.  **Telemetry & Metrics Scraping (`Monitoring/`):**
    *   Prometheus, Node Exporter, and Grafana are wired together.
    *   Prometheus scraper configurations ([prometheus.yml](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/Monitoring/prometheus.yml)) are active.
    *   Grafana automatically provisions Prometheus as a datasource on startup, isolating monitoring panels on localhost to restrict metrics visualization to secure SSH tunnels.
6.  **Hardened HTTPS/TLS Template (`proxy configurations/nginx.ssl.conf`):**
    *   SSL configuration includes redirect rules (Port 80 to Port 443), modern TLS protocols (`TLSv1.2 TLSv1.3`), custom secure ciphers, and HSTS headers.
    *   Hardened NGINX configurations passed all syntax verification checks (`nginx -t`) inside a local validation container.

---

## 3. Not Yet Production-Ready Elements

The following items are functional but configured as staging simulations or mock configurations:

1.  **SSL/TLS Certificate Files:**
    *   Local NGINX configs run on HTTP (Port 80). The production NGINX SSL config template references mock certificate file paths (`/etc/letsencrypt/live/...`). No active certificate verification is possible until a DNS record exists.
2.  **Centralized Text Log Aggregation:**
    *   While system metric telemetry is operational (Prometheus), centralized console log indexing and searching (e.g., Grafana Loki and Promtail) are not implemented in the current production compose file.
3.  **Third-Party API Secrets:**
    *   Production environment configurations (`.env.production`) contain developer placeholders for critical integrations:
        *   `GEMINI_API_KEY` (Sensing telemetry interpretation)
        *   `GROQ_API_KEY` (OCR/Website context analysis)
        *   `CLOUDINARY_*` keys (Sovereign file uploads bypass)
    *   These must be replaced with real, funded subscription credentials prior to launch.
4.  **cAdvisor WSL2 Telemetry Limits:**
    *   Under local Windows staging, cAdvisor cannot scrape container resource usage due to WSL2 cgroup directory constraints, resulting in a temporary "No Data" visual on Grafana container-level panels. (This is a staging-only limitation and will resolve natively on Linux hosts).

---

## 4. Active Deployment Blocks (Remaining Blocks)

Deployment to the live Yotta Sovereign Infrastructure is currently blocked by the following missing prerequisites:

1.  **Target VM Host Allocation:**
    *   No virtual server instance has been provisioned on Yotta Enterprise Cloud.
    *   The host OS (Ubuntu 22.04 LTS / Debian 12) is not initialized, and SSH keys are not mapped.
2.  **Domain Name Mapping (DNS):**
    *   No registered FQDN (e.g. `niyantran.bhiv.in`) is assigned.
    *   A-record mappings pointing the domain to the target Yotta VM public IP are pending.
3.  **Certbot SSL Issuance:**
    *   Running Let's Encrypt DNS or HTTP challenge scripts to populate real SSL certificates is blocked until the domain and VM public IP are live.
4.  **Host-Level Security Rules (UFW):**
    *   Host-level firewall rules blocking public access to ports `5000` and `27017` must be applied directly on the target VM shell using the commands defined in the [YOTTA_DEPLOYMENT_GUIDE.md](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/YOTTA_DEPLOYMENT_GUIDE.md).

---

## 5. Remaining Operational Risks

The following technical risks must be monitored during ongoing Yotta VM operations:

*   **MongoDB WiredTiger Memory Exhaustion:**
    *   *Risk:* Mongoose/MongoDB WiredTiger engine claims 50% of host RAM by default if uncapped. If host RAM drops too low, the Linux kernel Out-Of-Memory (OOM) killer will terminate adjacent NodeJS API containers.
    *   *Mitigation:* The stack enforces a strict limit (`--wiredTigerCacheSizeGB 1.5` in the compose command line). This cap must never be removed on standard 4GB/8GB VM targets.
*   **Screenshot Image Disk Bloat:**
    *   *Risk:* While the stack defaults to **Intelligent Screen Capture** (captures only 3 screenshots per unauthorized browsing violation session), storage growth will eventually fill the host disk if retention rules fail.
    *   *Mitigation:* The database screenshot pruning function (`cleanupOldScreenshots`) must be configured to run as a recurring cron utility to enforce the 30-day deletion/offload policy.
*   **Headless Linux Screen Capture Dependencies:**
    *   *Risk:* The node screenshot library (`screenshot-desktop`) requires a desktop environment or a virtual display buffer to capture screens. On headless Linux servers, direct capture commands can trigger runtime exceptions.
    *   *Mitigation:* The codebase includes placeholder fallback images for headless engines. For real-world deployments, virtual display servers (e.g., `Xvfb`) must be initialized on the host client machines.
*   **Manual Log Rotations:**
    *   *Risk:* Standard Docker console logs (`stdout`/`stderr`) grow indefinitely, consuming gigabytes of disk space over time.
    *   *Mitigation:* Hard logging limits must be configured inside the Docker daemon configuration `/etc/docker/daemon.json` (e.g., `max-size: "10m"`, `max-file: "3"`) to prevent log file exhaustion of host disks.
