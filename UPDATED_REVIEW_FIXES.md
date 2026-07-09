# SETU Infrastructure Migration Sprint: Unified Phase 1 Corrections Register

This document provides a comprehensive record of all internal review findings resolved and corrections executed under **Phase 1 — Calibration Fixes + Canonical Cleanup** before deploying to the Yotta production environment.

---

## 1. Compose Separation (Contradiction Resolution)

*   **Original Contradiction:** The development compose file exposed MongoDB to the host, violating the security baseline's claim of database isolation.
*   **Resolution Details:** We decoupled the container configurations into environment-specific profiles:
    *   **Development Profile (`docker-compose.dev.yml`):** Retains database port exposure (`27017:27017`) and backend port exposure (`5000:5000`) for debugging and administrative convenience.
    *   **Production Profile (`docker-compose.production.yml`):** Omits all public port bindings for MongoDB, backend, and frontend containers. All inter-container communication is restricted to the internal virtual network interface (`niyantran_network`).
    *   **Ingress Reverse Proxy (`nginx.conf`):** Introduced NGINX as the sole entry point (`proxy-only ingress`) mapping public ports `80` and `443` on the host, secure-proxying API calls (`/api/`), routing auth routes under stricter limits (`/api/auth/`), and upgrading WebSocket tunnels (`/socket.io/`) with custom keep-alive parameters.

**Deliverables Saved:**
*   [docker-compose.dev.yml](./docker-compose.dev.yml)
*   [docker-compose.production.yml](./docker-compose.production.yml)
*   [nginx.conf](./proxy%20configurations/nginx.conf) (Reverse Proxy configuration)
*   [NGINX/nginx.conf](./NGINX/nginx.conf) (Frontend SPA Router fallback configuration)

---

## 2. Certainty Calibration Pass

*   **Correction Objective:** Eliminate certainty inflation across all architectural and cost estimates by explicitly classifying assertions.
*   **Resolution Details:** Added standard tags to identify empirical and planned scopes across the **nine (9) core documentation files**:
    *   `[MEASURED]`: Verifiable metrics, actual bottlenecks observed (OOMs, Render timeouts, connection disconnects).
    *   `[ESTIMATED]`: Cost models, projected savings, auxiliary commitments.
    *   `[ARCHITECTURAL ASSUMPTION]`: Baseline hardware specifications, network topologies, cache allocation limitations.
    *   `[PLANNED]`: Upcoming migration steps, firewall settings, cron backup routines, and future RBAC models.

**Modified Documentation Register:**
1.  [SETU_DEPLOYMENT_AUDIT.md](./SETU_DEPLOYMENT_AUDIT.md) — Calibrated current Render metrics and future VPS targets.
2.  [PERFORMANCE_BOTTLENECK_ANALYSIS.md](./PERFORMANCE_BOTTLENECK_ANALYSIS.md) — Calibrated the before vs. after performance matrix.
3.  [SETU_SELF_HOSTING_BLUEPRINT.md](./SETU_SELF_HOSTING_BLUEPRINT.md) — Calibrated horizontal scalability limits and vertical bounds.
4.  [COST_COMPARISON_REPORT.md](./COST_COMPARISON_REPORT.md) — Calibrated monthly VPS prices and savings percentages.
5.  [SECURITY_BASELINE.md](./SECURITY_BASELINE.md) — Calibrated isolation schema and future kernel configurations.
6.  [ROLLOUT_PLAN.md](./ROLLOUT_PLAN.md) — Calibrated migration stages and rollback error thresholds.
7.  [BHIV_INFRA_READINESS.md](./BHIV_INFRA_READINESS.md) — Calibrated bare-metal specifications and roadmap expansion tiers.
8.  [DEPLOYMENT_DEMO_PROOF.md](./DEPLOYMENT_DEMO_PROOF.md) — Calibrated validation checkpoint command targets.
9.  [REVIEW_PACKET.md](./REVIEW_PACKET.md) — Calibrated core DevOps tenets and index registry check links.

---

## 3. Monitoring Status Clarification

*   **Correction Objective:** Clearly separate telemetry features that are currently active in our core codebase from planned metrics databases to avoid compliance confusion.
*   **Resolution Details:** Divided the monitoring description in `SETU_SELF_HOSTING_BLUEPRINT.md` and `REVIEW_PACKET.md`:
    *   **Implemented Monitoring (`[MEASURED]`):** HTTP ping check endpoint (`/api/ping`) and standard JSON console logging configured via Compose container log drivers.
    *   **Planned Monitoring (`[PLANNED]`):** Future telemetry scrapers (Prometheus exposing `/api/metrics`), node exporters, Loki log streams, and Grafana dashboard panels.

---

## 4. Proof System Upgrade

*   **Correction Objective:** Replace static placeholder evidence templates with actionable verification instructions.
*   **Resolution Details:** Modified `DEPLOYMENT_DEMO_PROOF.md` to establish concrete verification commands (`docker compose ps`, `docker stats`, `curl`, etc.) to produce the actual files under `/proofs`. Pointed to automated validation script logic (`test-verification.ps1`) to capture text telemetry reports instead of relying purely on visual inspection mockup templates.
