# Niyantran Sovereign Infrastructure: Cost & Yotta Operations Validation Report

This report converts the Niyantran sovereign deployment cost models into a grounded, resource-tied reality. The calculations below are directly derived from the empirical resource footprint measured in Phase 6, the containerized architecture validated in Phase 7, and the actual screenshot capture service configurations found in the server implementation (`server/services/screenCapture.js` and `server/services/intelligentScreenCapture.js`).

---

## 1. Actual Deployed Stack Footprint

Based on the empirical system metrics captured during runtime validation (`[MEASURED]` in `RUNTIME_VALIDATION_REPORT.md`), the 8-container Niyantran production stack has the following resource footprint:

### A. Idle RAM Footprint
*   **Total Stack Idle Memory:** **482.16 MiB** (under the 500 MiB limit)
*   **Per-Container Breakdown:**
    *   `niyantran_backend` (Express API): **213.00 MiB**
    *   `niyantran_database` (MongoDB): **107.20 MiB**
    *   `niyantran_prometheus` (Metrics Database): **50.15 MiB**
    *   `niyantran_grafana` (Visualization Panel): **80.50 MiB**
    *   `niyantran_node_exporter` (Host Exporter): **15.20 MiB**
    *   `niyantran_cadvisor` (Container Exporter): **10.11 MiB**
    *   `niyantran_frontend` (React SPA Server): **4.50 MiB**
    *   `niyantran_proxy` (NGINX Reverse Proxy): **1.50 MiB**

### B. Expected Peak RAM Footprint (Under Load)
Under active utilization (50 to 200 users syncing telemetry and screenshots simultaneously):
*   **Express API Buffer:** Climbs to **~500 MiB** during high-concurrency canvas compression and token authentication checks.
*   **MongoDB WiredTiger Cache:** Hard-capped at **1.50 GiB** (configured via `--wiredTigerCacheSizeGB 1.5` in the compose command line to prevent memory starvation of adjacent services).
*   **Prometheus & Exporters:** Climbs to **~200 MiB** during metric compression blocks.
*   **NGINX Proxy Buffers:** Climbs to **~50 MiB** handling concurrent WebSockets payload deliveries.
*   **Total Expected Peak RAM Footprint:** **~2.25 GiB**

### C. CPU Core Allocations
*   **Baseline Idle:** `< 1.5%` total host CPU core utilization.
*   **Active Load Cycles:** Express API server and MongoDB require at least **2 dedicated vCPUs** to avoid scheduling latency during file processing. A **4 vCPU** allocation is recommended for production scale (200+ users).

---

## 2. Yotta VM Instance Sizing & Monthly Costs `[ESTIMATED]`

To host the containerized stack, we align our hardware requirements with standard Yotta virtual instance offerings. Calculations use the currency baseline of **$1 USD ≈ ₹83.33 INR**.

| Operating Stage | Target Scale | Required Host VM Specs | Monthly Yotta Pricing (INR) | Monthly Yotta Pricing (USD) | Resource Leverage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Development / Staging** | 50 Users | 2 vCPU / 4GB RAM / 40GB SSD | **₹1,500/month** | ~$18.00 | Stack runs at ~56% RAM limit under peak load. |
| **Active Growth (Production)** | 200 Users | 4 vCPU / 8GB RAM / 80GB NVMe | **₹3,500/month** | ~$42.00 | WiredTiger cache has full 1.5GB room; CPU headroom for OCR. |
| **Production Scale** | 1000 Users | 8 vCPU / 16GB RAM / 160GB NVMe | **₹7,500/month** | ~$90.00 | Handles high-frequency WebSockets and log sync operations. |

---

## 3. Storage & Database Growth Estimates

Storage growth is calculated based on system log telemetry frequencies and client file upload volumes. 

### A. Raw Database Transactions (Metadata Logs)
*   **Average Event size:** `0.5 KB` per user check-in/sync document.
*   **Ping Frequency:** 1 ping every 5 minutes = 12 pings/hour.
*   **Operating Duration:** 8 hours/day = 96 pings/day = 2,880 pings/month per user (assuming 30 calendar days of logging activity).
*   **Formula:**
    $$\text{Monthly DB Growth} = \text{Users} \times 2,880 \text{ events} \times 0.5 \text{ KB}$$
*   **Calculated Scales:**
    *   **50 Users:** $50 \times 2,880 \times 0.5 \text{ KB} = 72,000 \text{ KB} \approx$ **70.3 MiB/month**
    *   **200 Users:** $200 \times 2,880 \times 0.5 \text{ KB} = 288,000 \text{ KB} \approx$ **281.2 MiB/month**

### B. Screenshot & Image Files (The Code-Grounded Reality)
The codebase implements two screenshot strategies:
1.  **Regular Screen Capture (`ScreenCaptureService`):** Captures screen on a fixed interval (default 5 minutes). *Note: This is disabled by default in the active implementation code (`disabled: true` block in `screenCapture.js`).*
2.  **Intelligent Screen Capture (`IntelligentScreenCaptureService`):** Captures screenshots ONLY when an employee accesses a non-whitelisted/unauthorized website. It captures a maximum of **3 screenshots per violation session** and enforces a **5-minute cooldown** between violation sessions per employee.

We calculate storage growth for both configurations:

#### Option 1: Intelligent Screen Capture (Default Code Configuration)
*   **Average Violation rate:** 2 unauthorized browsing events per employee per day.
*   **Screenshots per Violation:** 3 captures.
*   **Total Screenshots per User/Day:** 6 screenshots.
*   **Working Days:** 22 days/month.
*   **Monthly Screenshots per User:** $6 \times 22 = 132$ screenshots/month.
*   **Average File Size (Compressed JPEG/WebP):** `50 KB` per screenshot.
*   **Formula:**
    $$\text{Intelligent Monthly Volume} = \text{Users} \times 132 \text{ captures} \times 50 \text{ KB}$$
*   **Calculated Scales:**
    *   **50 Users:** $50 \times 132 \times 50 \text{ KB} = 330,000 \text{ KB} \approx$ **322.26 MiB/month**
    *   **200 Users:** $200 \times 132 \times 50 \text{ KB} = 1,320,000 \text{ KB} \approx$ **1.26 GiB/month**

#### Option 2: Regular Screen Capture (Continuous Capture Stream - If Enabled)
*   **Screenshots per User/Day:** 12 captures/hour * 8 hours/day = 96 captures/day.
*   **Working Days:** 22 days/month.
*   **Monthly Screenshots per User:** $96 \times 22 = 2,112$ screenshots/month.
*   **Average File Size (Compressed JPEG/WebP):** `50 KB` per screenshot.
*   **Formula:**
    $$\text{Continuous Monthly Volume} = \text{Users} \times 2,112 \text{ captures} \times 50 \text{ KB}$$
*   **Calculated Scales:**
    *   **50 Users:** $50 \times 2,112 \times 50 \text{ KB} = 5,280,000 \text{ KB} \approx$ **5.04 GiB/month**
    *   **200 Users:** $200 \times 2,112 \times 50 \text{ KB} = 21,120,000 \text{ KB} \approx$ **20.14 GiB/month**

### C. System Logs & Prometheus Metrics
*   **Prometheus TSDB Metrics Retention (15 days):** Fixed at **~5.00 GiB**.
*   **Docker Container Log Rotations (NGINX/Express/MongoDB):** **~2.00 GiB/month**.

### D. Total Storage Requirement (with 30-Day Retention Policy)

To limit disk overhead, we enforce a strict 30-day screenshot rotation rule. Below is the total host disk growth depending on configuration options:

*   **Under Intelligent Screen Capture (Active Default):**
    *   **50 Users Stack:** $70.3 \text{ MiB (DB)} + 322.26 \text{ MiB (Images)} + 5 \text{ GiB (Metrics)} + 2 \text{ GiB (Logs)} \approx$ **7.38 GiB** (Static baseline + 392.56 MiB growth per month).
    *   **200 Users Stack:** $281.2 \text{ MiB (DB)} + 1.26 \text{ GiB (Images)} + 5 \text{ GiB (Metrics)} + 2 \text{ GiB (Logs)} \approx$ **8.53 GiB** (Static baseline + 1.54 GiB growth per month).
*   **Under Regular Screen Capture (Continuous Stream):**
    *   **50 Users Stack:** $70.3 \text{ MiB (DB)} + 5.04 \text{ GiB (Images)} + 5 \text{ GiB (Metrics)} + 2 \text{ GiB (Logs)} \approx$ **12.11 GiB** (Static baseline + 5.11 GiB growth per month).
    *   **200 Users Stack:** $281.2 \text{ MiB (DB)} + 20.14 \text{ GiB (Images)} + 5 \text{ GiB (Metrics)} + 2 \text{ GiB (Logs)} \approx$ **27.41 GiB** (Static baseline + 20.41 GiB growth per month).

---

## 4. Cloudinary vs. Local Storage Cost Trade-Offs

The codebase supports dual-storage strategies via `CLOUDINARY_STORAGE_ENABLED` and `ENABLE_LOCAL_BACKUP` environment variables.

### A. Cloudinary Pricing Model (Credits System)
Cloudinary uses a credit system where **1 Credit = 1 GB of storage OR 1 GB of bandwidth**. We assume an average viewing rate of 20% for screenshots by managers/HR.

*   **At 50 Users (Intelligent Capture Mode):**
    *   *Storage consumed:* 322.26 MiB = **0.31 Credits**
    *   *Bandwidth consumed (20% viewed):* 64.45 MiB = **0.06 Credits**
    *   *Total Credits needed:* **0.37 Credits / month**
    *   *Cost:* **₹0/month (Free Tier)** (Fits easily within Cloudinary's 25 free credits limit).
*   **At 200 Users (Intelligent Capture Mode):**
    *   *Storage consumed:* 1.26 GiB = **1.26 Credits**
    *   *Bandwidth consumed (20% viewed):* 258 MiB = **0.25 Credits**
    *   *Total Credits needed:* **1.51 Credits / month**
    *   *Cost:* **₹0/month (Free Tier)** (Fits easily within Cloudinary's 25 free credits limit).
*   **At 200 Users (Continuous Capture Mode - If Enabled):**
    *   *Storage consumed:* 20.14 GiB = **20.14 Credits**
    *   *Bandwidth consumed (20% viewed):* 4.03 GiB = **4.03 Credits**
    *   *Total Credits needed:* **24.17 Credits / month**
    *   *Cost:* **₹0/month (Free Tier)** (Borderline on 25 free credits limit).
*   **At 1000 Users (Intelligent Capture Mode):**
    *   *Storage consumed:* 6.30 GiB = **6.30 Credits**
    *   *Bandwidth consumed (20% viewed):* 1.26 GiB = **1.26 Credits**
    *   *Total Credits needed:* **7.56 Credits / month**
    *   *Cost:* **₹0/month (Free Tier)** (Fits easily within Cloudinary's 25 free credits limit).

> [!TIP]
> Under **Intelligent Capture Mode**, the system can support up to **1,500 active users** entirely on Cloudinary's **Free Tier** without spending anything on image storage or bandwidth, as total credit usage remains below 25.

---

## 5. Backup Storage Cost Estimates `[ESTIMATED]`

We implement automated backups via the configured `backup-db.ps1` script, dumping database contents daily and archiving logs.

### A. Database Backup Volumes
Database dumps are compressed using Gzip (`mongodump --gzip`), yielding a high compression ratio of approximately **10:1**:
*   **50 Users (70.3 MiB DB):** Compressed archive size is **~7.0 MiB** per daily backup.
*   **200 Users (281.2 MiB DB):** Compressed archive size is **~28.1 MiB** per daily backup.

### B. Retention Policy (7-Day Local + Offsite Lifecycle)
*   **Local Backups (7 Days):**
    *   50 Users: $7 \times 7.0 \text{ MiB} \approx$ **49.0 MiB** local backup storage.
    *   200 Users: $7 \times 28.1 \text{ MiB} \approx$ **196.7 MiB** local backup storage.
*   **Offsite Object Storage (Yotta Object Storage / S3-Compatible):**
    *   *Sizing:* We allocate a flat **100 GB** storage bucket to store daily database archives, configuration backups, and compressed monthly historical reports.
    *   *Unit Cost:* **₹1.65 / GB / month** ($0.02 USD / GB).
    *   *Total Monthly Cost:* **₹165/month** (~$2.00 USD) flat rate.

---

## 6. Operational Maintenance Overhead `[ESTIMATED]`

Unlike public cloud PaaS platforms which automate scaling and networking, self-hosting requires manual DevOps monitoring. We allocate a minimal, scheduled time commitment monthly to guarantee high uptime:

1.  **Weekly Health Audits & Log Cleanup (0.5 hrs/month):**
    *   Executing log rotations and checking system volume spaces to keep active storage below 80%.
2.  **OS Updates & Security Patches (0.5 hrs/month):**
    *   Running host-level commands (`sudo apt update && sudo apt upgrade -y`) and checking Docker daemon logs.
3.  **Backup Integration Tests (0.5 hrs/month):**
    *   Running mock database restoration checks to verify archive integrity.
4.  **Prometheus & Grafana Alert Calibration (0.5 hrs/month):**
    *   Tuning threshold values in Prometheus alerting rules based on CPU/RAM trends.
*   **Total Monthly Operational Labor:** **2.0 Hours**

---

## 7. Comparison to Render PaaS (TCO Grounded Reality)

We compare the total cost of ownership (TCO) between Render's managed multi-tenant PaaS and the self-hosted Yotta VM.

### A. Total Monthly Cost Comparison (INR & USD)

*   **At 50 Users (Staging Stage - Intelligent Capture Active):**
    *   *Render Cost:* **₹3,000/month** ($36.00 USD)
    *   *Yotta Cost:* ₹1,500 (VM) + ₹165 (Backups) = **₹1,665/month** ($20.00 USD)
    *   **Savings: ₹1,335/month (44.5% Saved)**
*   **At 200 Users (Growth Stage - Intelligent Capture Active):**
    *   *Render Cost:* **₹6,000/month** ($72.00 USD)
    *   *Yotta Cost:* ₹3,500 (VM) + ₹165 (Backups) = **₹3,665/month** ($44.00 USD)
    *   **Savings: ₹2,335/month (38.9% Saved)**
*   **At 1000 Users (Production Scale - Intelligent Capture Active):**
    *   *Render Cost:* **₹15,000/month** ($180.00 USD)
    *   *Yotta Cost:* ₹7,500 (VM) + ₹165 (Backups) = **₹7,665/month** ($92.00 USD)
    *   **Savings: ₹7,335/month (48.9% Saved)**

---

## 8. Run Verification Proof & Telemetry Evidence

Please execute the system footprint checks and input your Google Drive links into the placeholders below to finalize the validation.

### Proof 1: Live Container Footprint Verification
Run `docker stats --no-stream` while the production stack is online to record live container memory utilization under your target user scaling environment.

![Proof 1: Deployed Stack Resource Footprint](INSERT_GOOGLE_DRIVE_LINK_HERE)

---

### Proof 2: Host Volume Disk Space Audit
Run a directory sizing command (e.g. `du -sh /opt/setu/production/data/db` on Linux or check the folder properties in Windows) to verify that database directories reflect active storage profiles.

![Proof 2: Host Volume Disk Space Footprint](INSERT_GOOGLE_DRIVE_LINK_HERE)

---

### Proof 3: Backup File Size Verification
List the contents of your backup directory (`dir .\backups\` or `ls -l /opt/setu/production/backups/`) to confirm that daily database dumps are generated and compressed successfully.

![Proof 3: Automated Database Backup Gzip Size](INSERT_GOOGLE_DRIVE_LINK_HERE)
