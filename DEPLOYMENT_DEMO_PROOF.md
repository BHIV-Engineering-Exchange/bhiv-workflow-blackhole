# SETU Sovereign Infrastructure: Deployment Demo Proof

## 1. Checkpoint 1: Active Container Status Verification (`docker compose ps`) `[PLANNED]`
*   **Objective:** Visually confirm that the core Niyantran stack is healthy and running.
*   **Host Command to Execute:**
    ```bash
    docker compose -f docker-compose.production.yml ps
    ```
*   **Evidence Calibration Key:** The screenshot should show `niyantran_database` as `healthy`, `niyantran_backend` as `healthy`, and `niyantran_frontend` as `running` or `started`, confirming successful internal container startup. `[ARCHITECTURAL ASSUMPTION]`

![Screenshot 1: Active Docker Compose Status](https://drive.google.com/file/d/1X2D3euFPQKG7fxyPYRxs90KG1sqxRMhO/view?usp=sharing)

---

## 2. Checkpoint 2: End-to-End API Health Response (`curl -i /api/ping`) `[PLANNED]`
*   **Objective:** Visually verify that the Niyantran backend API is fully integrated with the database and responds correctly to network queries via NGINX.
*   **Host Command to Execute:**
    ```bash
    curl http://localhost/api/ping
    ```
*   **Evidence Calibration Key:** The snapshot must verify an HTTP status `200 OK` and display the JSON payload containing the healthy status and service identification. `[ARCHITECTURAL ASSUMPTION]`

![Screenshot 2: API End-to-End Health Response](https://drive.google.com/file/d/10_WCCh4SjnDEmpAu96dGzsRPOmAE_meU/view?usp=sharing)

---

## 3. Checkpoint 3: Frontend Ingress Reachability (`curl /`) `[PLANNED]`
*   **Objective:** Visually verify that NGINX successfully serves the static Vite React app index page on port 80.
*   **Host Command to Execute:**
    ```bash
    curl.exe -Iv http://localhost/
    ```
*   **Evidence Calibration Key:** The snapshot must verify an HTTP status `200 OK` and show NGINX serving text/html headers for the index page. `[ARCHITECTURAL ASSUMPTION]`

![Screenshot 3: Frontend Ingress Reachability](https://drive.google.com/file/d/1hFIGEyxfgbB8Cv31N5dcE17OG62sA0zl/view?usp=sharing)

---

## 4. Checkpoint 4: Network Port Isolation Check (`docker ps`) `[PLANNED]`
*   **Objective:** Confirm that network ports are correctly isolated in production and only exposed via the ingress proxy.
*   **Host Command to Execute:**
    ```bash
    docker ps --format "table {{.Names}}\t{{.Ports}}"
    ```
*   **Evidence Calibration Key:** The screenshot must display the specific port mappings, verifying that in production, only the `niyantran_proxy` container binds public host ports (80/443), while the backend and database containers remain strictly unmapped to the host. `[ARCHITECTURAL ASSUMPTION]`

![Screenshot 4: Network Ports and Isolation](https://drive.google.com/file/d/1uKrXtCe5P0v5M3QXm5athz3UUrXD8Qyf/view?usp=sharing)

---

## 5. Checkpoint 5: Low-Burn Container Resource Footprint (`docker stats`) `[PLANNED]`
*   **Objective:** Confirm that our strict memory boundaries keep the idle Niyantran resource usage extremely lean to prevent runaway cloud burn.
*   **Host Command to Execute:**
    ```bash
    docker stats --no-stream
    ```
*   **Evidence Calibration Key:** The screenshot must show the RAM metrics for `niyantran_database`, `niyantran_backend`, and `niyantran_frontend`. The total idle memory consumption across the entire Niyantran stack is estimated to remain under 500MB total. `[ESTIMATED]`

![Screenshot 5: Container Resource Footprint](https://drive.google.com/file/d/1CWDgUf2bZ2o_nW_U0xPp5QBEcahKYwZN/view?usp=sharing)

---

## 6. Video Walkthrough Verification (SR-1) `[PLANNED]`
*   **Objective:** Provide a continuous execution video validating container startup, health updates, and ingress routing checks.
*   **Action Steps to Record:** Screen recording of `docker compose down`, `docker compose up -d`, `docker compose ps` checks, and a live curl call showing service success.

![Video Walkthrough (SR-1)](https://drive.google.com/file/d/1PNhHCpdVQ8YC0L6yVh-RTMfXrvPwGQrs/view?usp=sharing)

---

## 7. Verification Boundaries & Calibration Note `[ARCHITECTURAL ASSUMPTION]`

To maintain an objective and realistic DevOps posture:
*   **Log Verification Boundaries:** These visual proofs confirm active container status, loopback HTTP pings, and low resource overhead under idle states. They do not validate high-load concurrency, network-attached hard drive failure modes, or external web-push delivery bounds, which remain bounded by your local network.
*   **Screenshot Integrity:** Ensure screenshots display complete terminal paths and unchanged host outputs to preserve certification evidence density.
