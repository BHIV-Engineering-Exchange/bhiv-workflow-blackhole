# Niyantran Sovereign Telemetry: Observability Deployment Guide

This document details the production-ready monitoring and observability infrastructure implemented for the **Niyantran** stack.

---

## 1. Observability Architecture Overview

To transition our monitoring from an architectural concept into a fully deployable state, we have integrated a four-container observability stack:

```mermaid
graph TD
    subgraph Host Node (Yotta VM)
        NodeExporter[Node Exporter:9100] -->|Host OS Metrics| Prom
        cAdvisor[cAdvisor:8080] -->|Container Metrics| Prom
        Prom[Prometheus:9090] -->|Scrapes Targets| Grafana[Grafana:3000]
    end

    subgraph Developer Laptop
        DevBrowser[Web Browser] -->|SSH Tunnel 3000| Grafana
        DevBrowser -->|SSH Tunnel 9090| Prom
    end
```

### Components Implemented:
1.  **Prometheus (v2.45.0):** Time-series database that scrapes and stores metrics from endpoints.
2.  **Grafana (10.0.3):** Visualization dashboard utility pre-provisioned to load Prometheus data.
3.  **Node Exporter (v1.6.0):** Extracts raw host-level resource metrics (CPU, RAM, disk, network, load).
4.  **cAdvisor (v0.47.2):** Extracts live per-container runtime metrics (CPU, memory, IO, network throughput).

---

## 2. Directory Layout & Scraper Configuration

All monitoring files are isolated in the [Monitoring/](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/Monitoring) directory:
*   [Monitoring/prometheus.yml](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/Monitoring/prometheus.yml) — Scrape interval set to `15s`. Targets include Prometheus itself, `node-exporter:9100`, and `cadvisor:8080`.
*   [Monitoring/datasource.yml](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/Monitoring/datasource.yml) — Automatic Grafana datasource registry so that Prometheus is pre-loaded as the default source on container startup.

---

## 3. Host Port Security (Zero Public Port Exposure)

In alignment with our Phase 4 security baseline, public ports `9090` (Prometheus) and `3000` (Grafana) **are not exposed** to the public internet. They are bound strictly to `127.0.0.1` (localhost) inside [docker-compose.production.yml](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/docker-compose.production.yml).

### Accessing the Dashboards via Secure SSH Port Forwarding:
To view the Prometheus and Grafana dashboards locally on your developer PC:
1.  Open your local command prompt or terminal.
2.  Execute the following SSH port forwarding command to tunnel the secure ports over your SSH connection:
    ```bash
    # Replace 'ubuntu' with VM username and 'your-vm-ip' with your Yotta VM IP address
    ssh -L 3000:localhost:3000 -L 9090:localhost:9090 ubuntu@your-vm-ip
    ```
3.  Keep that terminal open. Now, you can open your browser on your laptop and go to:
    *   **Grafana Dashboard:** `http://localhost:3000` (Default credentials: `admin` / `admin`)
    *   **Prometheus Console:** `http://localhost:9090`

---

## 4. How to Import Pre-built Dashboards

Grafana allows you to import pre-configured dashboard templates instantly:

### Step 1: Login to Grafana
*   Navigate to `http://localhost:3000` via your secure tunnel.
*   Log in with user `admin` and password `admin` (it will prompt you to set a new password).

### Step 2: Import Dashboards
1.  On the Grafana sidebar, click on the **Dashboards** icon, and click **+ Import**.
2.  Import **Host OS Metrics** (Node Exporter):
    *   In the **Import via grafana.com** input box, type dashboard ID: **`1860`**
    *   Click **Load**, select **Prometheus** as the datasource, and click **Import**.
3.  Import **Container Metrics** (cAdvisor):
    *   In the **Import via grafana.com** input box, type dashboard ID: **`14282`**
    *   Click **Load**, select **Prometheus** as the datasource, and click **Import**.

---

## 5. Verification & Target Health Check

To verify that the scrapers are working properly, query the target status using curl via your secure tunnel or on the host:

```bash
curl http://localhost:9090/api/v1/targets
```

### Expected Response JSON:
The response should return a list containing:
*   `prometheus` job status `UP`
*   `node-exporter` job status `UP`
*   `cadvisor` job status `UP`

---

## 6. Telemetry & Environment Boundaries `[ARCHITECTURAL ASSUMPTION]`

To maintain DevOps accuracy, note the following system boundaries:
*   **Windows/Docker Desktop Local Testing:** The Node Exporter and cAdvisor containers collect statistics from the underlying WSL2 lightweight virtual machine. They will not reflect host Windows OS parameters, which are isolated by the hypervisor layer.
*   **Yotta VM Live Target:** Once deployed on Ubuntu/Debian server nodes, Node Exporter will correctly map the host's `/proc` and `/sys` volumes to extract real hardware CPU, RAM, and disk IO stats.
