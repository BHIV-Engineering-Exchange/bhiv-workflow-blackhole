# Niyantran Sovereign Infrastructure: Runtime Validation & Performance Verification Report

This document records the empirical results, observed issues, and operating boundaries measured during the runtime validation of the hardened Niyantran production stack.

---

## 1. Measured Results

All tests were executed on the target host environment, capturing live runtime statistics.

### A. Cold Restart Timing Check
*   **Measurement Target:** Total duration to perform `docker compose down -v` followed by `docker compose up -d` until all containers are online and `niyantran_backend` reports a `healthy` status.
*   **Command Executed:**
    ```powershell
    $Duration = Measure-Command {
        docker compose -f docker-compose.production.yml down -v
        docker compose -f docker-compose.production.yml up -d
        while ((docker inspect --format='{{.State.Health.Status}}' niyantran_backend) -ne "healthy") {
            Start-Sleep -Seconds 1
        }
    }
    $Duration.TotalSeconds
    ```
*   **Measured Result:** **16.42 Seconds** `[MEASURED]`

### B. Container Status & Health Verification
*   **Measurement Target:** Verify healthcheck statuses for all 8 orchestration services.
*   **Measured Result:** `[MEASURED]` All 8 services initialize and return status `healthy` or `running` with zero exceptions.

![Screenshot 1: Container Status and Health Verification](https://drive.google.com/file/d/1qZmLMXJmaX2Wijh6fWi3dUL_ECtiMEKX/view?usp=sharing)

---

### C. Network Ingress API & Frontend Latency
*   **Measurement Target:** Loopback query response latency from host to proxy port 80.
*   **Measured Results:** `[MEASURED]`
    *   **Express API Ingress (/api/ping):** **67.61 ms**
    *   **React static assets (/):** **28.27 ms**

![Screenshot 2: Network Ingress Latency Check](https://drive.google.com/file/d/1SVuDeAM-Dh4XPIn6Yb-N6Qfl5L3Rlpan/view?usp=sharing)

---

### D. Network Database Port Isolation Check
*   **Measurement Target:** Prove that the containerized database (`niyantran_database`) exposes no ports on the host.
*   **Measured Result:** **`{}`** (Verify that host bindings configuration is empty, confirming complete network bridge isolation). `[MEASURED]`

![Screenshot 3: Database Port Isolation Audit](https://drive.google.com/file/d/1nHG_Ugdkdt6uxubhNj55yaeHe3EPUmCr/view?usp=sharing)

---

### E. Restart Resilience Container Recovery
*   **Measurement Target:** Simulate an unexpected internal server crash and confirm automatic container recovery.
*   **Measured Result:** The Docker daemon successfully detected the exit status and immediately initialized a restart. The container returned to an `Up (health: starting)` status within **2.0 Seconds** of the crash. `[MEASURED]`

![Screenshot 4: Restart Resilience Test](https://drive.google.com/file/d/1jEzdjwk7bOBWxE14I-HsRsFZstB0ZKC3/view?usp=sharing)

---

### F. Idle Resource Footprint Metrics
*   **Measurement Target:** CPU and RAM utilization of the entire running stack under idle state.
*   **Measured Results:** `[MEASURED]` Total Stack Idle Memory footprint verified at **482.16 MiB** (under the 500MB budget threshold).

![Screenshot 5: Idle Resource Stats (docker stats)](https://drive.google.com/file/d/1oejVYOyWziUFeP78RAAv4g5WfFpP-d1x/view?usp=sharing)

---

### G. Prometheus Targets Health Status
*   **Measurement Target:** Verify that Prometheus successfully communicates with and scrapes metrics from all target exporters.
*   **Measured Result:** `[MEASURED]` Prometheus targets status page shows `prometheus`, `node-exporter`, and `cadvisor` endpoints in healthy green `UP` states.

![Screenshot 6: Prometheus Active Targets](https://drive.google.com/file/d/1ResaUJzlZ_Ak7pSGZ3-Fgs691H-CHNAK/view?usp=sharing)

---

### H. Host OS Observability Dashboard (Grafana Dashboard 1860)
*   **Measurement Target:** Verify that Grafana successfully visualizes live system CPU, memory, load, and disk utilization metrics scraped from Node Exporter.
*   **Measured Result:** `[MEASURED]` Grafana Node Exporter Full dashboard successfully displays real-time telemetry panels.

![Screenshot 7: Grafana Host OS Dashboard](https://drive.google.com/file/d/1ylRzt5P22JcHfZOuOCFxdH4-1cAlhHql/view?usp=sharing)

---

## 2. Observed Issues

*   **None:** All 8 container services launched successfully, configured their ports, completed internal healthchecks, and remained in stable executing states while I have tested them.

---

## 3. Known Limits & Telemetry Boundaries

1.  **Virtualization Layer Measurement Bounds:** When deploying and testing on local Windows machines (via Docker Desktop), Node Exporter and cAdvisor extract metrics from the underlying Linux WSL2 virtual machine rather than the parent Windows host.
2.  **Host Database Port Conflict:** A native MongoDB instance `mongod` is running on the host Windows system (binding Port 27017 natively). Running a network check to port 27017 on the host will report success, but this routes to the host's native database, not our containerized database, which remains isolated on the private Docker bridge network (`HostConfig.PortBindings = {}`).
